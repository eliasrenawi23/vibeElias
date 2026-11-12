import { Injectable } from '@nestjs/common';
import type { Contact, Prisma, Vehicle } from '@prisma/client';
import {
  contactDisplayName,
  DefaultLeaseTermsSchema,
  PDF_TEMPLATE_DOC_KINDS,
  PdfTemplate,
  ResponsibilitiesSchema,
  round2,
  type Locale,
} from '@renawi/shared';
import { Clock } from '../common/clock';
import { isoOf, isoOrNull } from '../common/dates';
import { AppException, ErrorKey } from '../common/errors/app-exception';
import { DocumentsService, type DocumentView } from '../documents/documents.service';
import { newStorageKey, StorageService } from '../documents/storage/storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { dateInZone, pdfFileName, pickPdfLanguage } from './pdf-format';
import {
  buildChecklist,
  buildConsignment,
  buildDealPayment,
  buildDepositReceipt,
  buildDisclosure,
  buildLeaseContract,
  buildLedgerPayment,
  buildPurchaseAgreement,
  buildSaleAgreement,
  PdfNotApplicableError,
  type ConsignmentInput,
  type DealInput,
  type DealPaymentInput,
  type LeaseInput,
  type LedgerReceiptInput,
  type PdfContext,
  type PdfModel,
  type PdfPerson,
  type PdfVehicle,
} from './pdf-models';
import { PdfRenderer } from './pdf-renderer.service';
import { PdfTemplateEngine } from './pdf-templates';

/** Who asked for the document (language fallback, `uploadedById`). */
export interface PdfRequester {
  userId: string | null;
  locale: string | null;
}

const num = (v: Prisma.Decimal | number | null | undefined): number | null =>
  v === null || v === undefined ? null : round2(v);

/** Contact -> document party (name, ID, address with city, first phone). */
export function personOf(c: Contact): PdfPerson {
  return {
    name: contactDisplayName(c) || '—',
    idNumber: c.idNumber,
    address: [c.address, c.city].filter((p) => p && p.trim()).join(', ') || null,
    phone: c.phones.find(Boolean) ?? null,
    isCompany: !c.firstName && !c.lastName && !!c.companyName,
  };
}

export function vehicleOf(v: Vehicle): PdfVehicle {
  return {
    plateNo: v.plateNo,
    make: v.make,
    model: v.model,
    trim: v.trim,
    year: v.year,
    vin: v.vin,
    color: v.color,
    hand: v.hand,
    km: v.currentKm,
    fuel: v.fuel,
    gearbox: v.gearbox,
    engineCc: v.engineCc,
    testExpiry: isoOrNull(v.registrationExpiry),
    isTaxi: v.isTaxi,
  };
}

/** A built model plus the counterparty's preferred language (used when no lang is given). */
type Built = (ctx: PdfContext) => PdfModel;

/**
 * Generated PDFs: loads the entity, builds the template model (409 errors.pdfNotApplicable
 * when the template does not fit), renders HTML with Handlebars and PDF with Chromium, stores
 * the file and creates a Document row on the right owner.
 */
@Injectable()
export class PdfService {
  private engineInstance: PdfTemplateEngine | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly storage: StorageService,
    private readonly documents: DocumentsService,
    private readonly renderer: PdfRenderer,
    private readonly clock: Clock,
  ) {}

  private get engine(): PdfTemplateEngine {
    this.engineInstance ??= new PdfTemplateEngine();
    return this.engineInstance;
  }

  /** The template model (HTML data) of a template + entity in a language. */
  async model(
    template: string,
    id: string,
    lang: Locale | undefined,
    who: PdfRequester,
  ): Promise<PdfModel> {
    const parsed = PdfTemplate.safeParse(template);
    if (!parsed.success) throw AppException.notFound();
    const { build, counterpartyLang } = await this.load(parsed.data, id);
    const settings = await this.settings.get();
    const terms = DefaultLeaseTermsSchema.safeParse(settings.defaultLeaseTerms);
    const ctx: PdfContext = {
      lang: pickPdfLanguage(lang, counterpartyLang, who.locale),
      today: dateInZone(new Date(), this.clock.timeZone),
      business: {
        name: settings.businessName,
        legalId: settings.legalId ?? null,
        dealerLicenseNo: settings.dealerLicenseNo ?? null,
        address: settings.address ?? null,
        phone: settings.phone ?? null,
        email: settings.email ?? null,
      },
      vatRate: Number(settings.vatRate),
      leaseClauses: terms.success ? terms.data.clauses : undefined,
    };
    try {
      return build(ctx);
    } catch (e) {
      if (e instanceof PdfNotApplicableError) {
        throw AppException.conflict(ErrorKey.pdfNotApplicable);
      }
      throw e;
    }
  }

  /** `GET /pdf/:template/:id/preview`: the HTML document. */
  async preview(template: string, id: string, lang: Locale | undefined, who: PdfRequester) {
    return this.engine.render(await this.model(template, id, lang, who));
  }

  /** `POST /pdf/:template/:id`: renders, stores and records a new Document. */
  async generate(
    template: string,
    id: string,
    lang: Locale | undefined,
    who: PdfRequester,
  ): Promise<DocumentView> {
    const model = await this.model(template, id, lang, who);
    const pdf = await this.renderer.pdf(this.engine.render(model), {
      footerTemplate: this.engine.footer(model),
    });
    const key = newStorageKey('pdf');
    await this.storage.put(pdf, key, 'application/pdf');
    try {
      const doc = await this.prisma.document.create({
        data: {
          kind: PDF_TEMPLATE_DOC_KINDS[model.template],
          fileKey: key,
          fileName: pdfFileName(model.template, model.number, model.lang),
          mime: 'application/pdf',
          size: pdf.length,
          hasThumb: false,
          title: model.documentTitle.slice(0, 200),
          lang: model.lang,
          [model.owner.key]: model.owner.id,
          uploadedById: who.userId,
        },
      });
      return this.documents.toView(doc);
    } catch (e) {
      await this.storage.delete(key).catch(() => undefined);
      throw e;
    }
  }

  /* ------------------------------------------------------------------------------------ */
  /* Loaders                                                                              */
  /* ------------------------------------------------------------------------------------ */

  private async load(
    template: PdfTemplate,
    id: string,
  ): Promise<{ build: Built; counterpartyLang: string | null }> {
    switch (template) {
      case 'lease-contract':
      case 'handover':
      case 'return': {
        const { input, lang } = await this.lease(id);
        const build: Built =
          template === 'lease-contract'
            ? (ctx) => buildLeaseContract(input, ctx)
            : (ctx) => buildChecklist(input, template, ctx);
        return { build, counterpartyLang: lang };
      }
      case 'deposit-receipt': {
        const entry = await this.ledgerEntry(id);
        if (!entry) throw AppException.notFound();
        return {
          build: (ctx) => buildDepositReceipt(entry.input, ctx),
          counterpartyLang: entry.lang,
        };
      }
      case 'payment-confirmation': {
        const entry = await this.ledgerEntry(id);
        if (entry) {
          return {
            build: (ctx) => buildLedgerPayment(entry.input, ctx),
            counterpartyLang: entry.lang,
          };
        }
        const payment = await this.dealPayment(id);
        if (!payment) throw AppException.notFound();
        return {
          build: (ctx) => buildDealPayment(payment.input, ctx),
          counterpartyLang: payment.lang,
        };
      }
      case 'sale-agreement':
      case 'purchase-agreement':
      case 'disclosure-form': {
        const { input, lang } = await this.deal(id);
        const build: Built =
          template === 'sale-agreement'
            ? (ctx) => buildSaleAgreement(input, ctx)
            : template === 'purchase-agreement'
              ? (ctx) => buildPurchaseAgreement(input, ctx)
              : (ctx) => buildDisclosure(input, ctx);
        return { build, counterpartyLang: lang };
      }
      case 'consignment-agreement': {
        const { input, lang } = await this.cycle(id);
        return { build: (ctx) => buildConsignment(input, ctx), counterpartyLang: lang };
      }
      default: {
        const exhaustive: never = template;
        throw new RangeError(`Unknown template ${String(exhaustive)}`);
      }
    }
  }

  private async lease(id: string): Promise<{ input: LeaseInput; lang: string | null }> {
    const c = await this.prisma.leaseContract.findUnique({
      where: { id },
      include: {
        driver: { include: { contact: true } },
        segments: {
          orderBy: [{ startDate: 'asc' }, { createdAt: 'asc' }],
          include: { taxiLicense: { select: { licenseNo: true } }, vehicle: true },
        },
      },
    });
    if (!c) throw AppException.notFound();
    const responsibilities = ResponsibilitiesSchema.safeParse(c.responsibilities ?? {});
    return {
      lang: c.driver.contact.preferredLang,
      input: {
        id: c.id,
        contractNo: c.contractNo,
        type: c.type,
        status: c.status,
        startDate: isoOf(c.startDate),
        endDate: isoOf(c.endDate),
        paymentDay: c.paymentDay,
        rentIncludesVat: c.rentIncludesVat,
        earlyExitPenaltyMonths: Number(c.earlyExitPenaltyMonths),
        depositAmount: Number(c.depositAmount),
        depositKind: c.depositKind,
        responsibilities: responsibilities.success
          ? responsibilities.data
          : ResponsibilitiesSchema.parse({}),
        terms: c.terms,
        signedAt: c.signedAt ? c.signedAt.toISOString() : null,
        handoverChecklist: c.handoverChecklist,
        returnChecklist: c.returnChecklist,
        lessee: {
          ...personOf(c.driver.contact),
          licenseNo: c.driver.licenseNo,
          taxiPermitNo: c.driver.taxiPermitNo,
        },
        segments: c.segments.map((s) => ({
          licenseNo: s.taxiLicense.licenseNo,
          vehicle: s.vehicle
            ? { ...vehicleOf(s.vehicle), ours: s.vehicle.ownership === 'OWNED' }
            : null,
          monthlyRent: Number(s.monthlyRent),
          startDate: isoOf(s.startDate),
          endDate: isoOrNull(s.endDate),
        })),
      },
    };
  }

  private async ledgerEntry(
    id: string,
  ): Promise<{ input: LedgerReceiptInput; lang: string | null } | null> {
    const e = await this.prisma.ledgerEntry.findUnique({
      where: { id },
      include: {
        driver: { include: { contact: true } },
        contract: { select: { contractNo: true, depositKind: true } },
        taxiLicense: { select: { licenseNo: true } },
        vehicle: { select: { plateNo: true } },
        segment: {
          select: {
            taxiLicense: { select: { licenseNo: true } },
            vehicle: { select: { plateNo: true } },
          },
        },
      },
    });
    if (!e) return null;
    return {
      lang: e.driver.contact.preferredLang,
      input: {
        id: e.id,
        type: e.type,
        date: isoOf(e.date),
        amount: Number(e.amount),
        method: e.method,
        reference: e.reference,
        description: e.description,
        rentPeriod: e.rentPeriod,
        voided: e.voidedAt !== null,
        driverId: e.driverId,
        payer: personOf(e.driver.contact),
        contract: e.contract,
        licenseNo: e.taxiLicense?.licenseNo ?? e.segment?.taxiLicense.licenseNo ?? null,
        plateNo: e.vehicle?.plateNo ?? e.segment?.vehicle?.plateNo ?? null,
      },
    };
  }

  private async dealPayment(
    id: string,
  ): Promise<{ input: DealPaymentInput; lang: string | null } | null> {
    const p = await this.prisma.dealPayment.findUnique({
      where: { id },
      include: {
        contact: true,
        deal: {
          include: {
            vehicle: { select: { plateNo: true, make: true, model: true, year: true } },
            counterparty: true,
            cycle: { include: { consignor: true } },
          },
        },
      },
    });
    if (!p) return null;
    // OUT payments of a consignment sale go to the consignor; others to / from the counterparty.
    const party =
      p.contact ??
      (p.deal.type === 'CONSIGNMENT_SALE' && p.direction === 'OUT' && p.deal.cycle?.consignor
        ? p.deal.cycle.consignor
        : p.deal.counterparty);
    return {
      lang: party.preferredLang,
      input: {
        id: p.id,
        dealId: p.dealId,
        dealNo: p.deal.dealNo,
        dealType: p.deal.type,
        direction: p.direction,
        date: isoOf(p.date),
        amount: Number(p.amount),
        method: p.method,
        reference: p.reference,
        notes: p.notes,
        party: personOf(party),
        vehicle: p.deal.vehicle,
      },
    };
  }

  private async deal(id: string): Promise<{ input: DealInput; lang: string | null }> {
    const d = await this.prisma.deal.findUnique({
      where: { id },
      include: {
        vehicle: true,
        counterparty: true,
        payments: { orderBy: [{ date: 'asc' }, { createdAt: 'asc' }] },
        tradeInDeal: { include: { vehicle: true } },
        tradeInFor: { select: { dealNo: true } },
        cycle: {
          include: { consignor: true, purchaseDeal: { include: { counterparty: true } } },
        },
      },
    });
    if (!d) throw AppException.notFound();
    const previous = d.cycle?.purchaseDeal?.counterparty;
    return {
      lang: d.counterparty.preferredLang,
      input: {
        id: d.id,
        dealNo: d.dealNo,
        type: d.type,
        status: d.status,
        date: isoOf(d.date),
        price: Number(d.price),
        vatMode: d.vatMode,
        payoutAmount: num(d.payoutAmount),
        warrantyText: d.warrantyText,
        disclosureSignedAt: d.disclosureSignedAt ? d.disclosureSignedAt.toISOString() : null,
        transferDueAt: isoOrNull(d.transferDueAt),
        sellerIsVatBusiness: d.sellerIsVatBusiness,
        isTradeIn: d.isTradeIn,
        counterparty: personOf(d.counterparty),
        vehicle: {
          ...vehicleOf(d.vehicle),
          dealerRegisteredAt: isoOrNull(d.vehicle.dealerRegisteredAt),
        },
        payments: d.payments.map((p) => ({
          date: isoOf(p.date),
          direction: p.direction,
          method: p.method,
          amount: Number(p.amount),
          reference: p.reference,
        })),
        tradeIn: d.tradeInDeal
          ? { vehicle: vehicleOf(d.tradeInDeal.vehicle), value: Number(d.tradeInDeal.price) }
          : null,
        tradeInForDealNo: d.tradeInFor?.dealNo ?? null,
        consignor: d.cycle?.consignor ? personOf(d.cycle.consignor) : null,
        previousOwner: previous && previous.id !== d.counterpartyId ? personOf(previous) : null,
      },
    };
  }

  private async cycle(id: string): Promise<{ input: ConsignmentInput; lang: string | null }> {
    const c = await this.prisma.inventoryCycle.findUnique({
      where: { id },
      include: { vehicle: true, consignor: true },
    });
    if (!c) throw AppException.notFound();
    return {
      lang: c.consignor?.preferredLang ?? null,
      input: {
        id: c.id,
        kind: c.kind,
        startedAt: isoOf(c.startedAt),
        endedAt: isoOrNull(c.endedAt),
        agreementEndsAt: isoOrNull(c.agreementEndsAt),
        askingPrice: num(c.askingPrice),
        minNetToConsignor: num(c.minNetToConsignor),
        commissionMode: c.commissionMode,
        commissionValue: num(c.commissionValue),
        vehicleId: c.vehicleId,
        owner: c.consignor ? personOf(c.consignor) : null,
        vehicle: vehicleOf(c.vehicle),
      },
    };
  }
}
