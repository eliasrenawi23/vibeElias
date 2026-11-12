import {
  addWorkingDays,
  HANDOVER_CHECKLIST_KEYS,
  HandoverChecklistSchema,
  RESPONSIBILITY_KEYS,
  RETURN_CHECKLIST_KEYS,
  ReturnChecklistSchema,
  round2,
  sumMoney,
  TRANSFER_DUE_WORKING_DAYS,
  type BusinessName,
  type CommissionMode,
  type DealType,
  type DepositKind,
  type Direction,
  type DocumentOwnerKey,
  type Fuel,
  type FuelLevel,
  type Gearbox,
  type LeaseStatus,
  type LeaseType,
  type LedgerType,
  type Locale,
  type PaymentMethod,
  type PdfTemplate,
  type ResponsibleParty,
  type Responsibilities,
  type VatMode,
} from '@renawi/shared';
import { dealMoney } from '../deals/deal-rules';
import { pdfDirection, pdfDocumentNumber } from './pdf-format';
import { pdfT } from './pdf-i18n';

/*
 * Pure builders of the PDF template models: applicability rules (a template that does not fit
 * the entity throws `PdfNotApplicableError` -> 409 errors.pdfNotApplicable) and the data each
 * template prints. Inputs are plain values (the loader maps Prisma rows); outputs are rendered by
 * the Handlebars templates in `templates/`.
 */

/** The template does not fit the entity (e.g. a disclosure form for a purchase). */
export class PdfNotApplicableError extends Error {
  constructor(readonly reason: string) {
    super(`PDF template not applicable: ${reason}`);
    this.name = 'PdfNotApplicableError';
  }
}

function notApplicable(reason: string): never {
  throw new PdfNotApplicableError(reason);
}

/* ------------------------------------------------------------------------------------------ */
/* Shared shapes                                                                              */
/* ------------------------------------------------------------------------------------------ */

/** Business details from Settings. */
export interface PdfBusiness {
  name: BusinessName;
  legalId: string | null;
  dealerLicenseNo: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
}

/** A party of a document (contact). */
export interface PdfPerson {
  name: string;
  idNumber: string | null;
  address: string | null;
  phone: string | null;
  isCompany?: boolean;
}

export interface PdfVehicle {
  plateNo: string;
  make: string;
  model: string;
  trim: string | null;
  year: number;
  vin: string | null;
  color: string | null;
  hand: number | null;
  km: number | null;
  fuel: Fuel | null;
  gearbox: Gearbox | null;
  engineCc: number | null;
  testExpiry: string | null;
  isTaxi: boolean;
}

export interface PdfContext {
  lang: Locale;
  /** Business date of the generation (`YYYY-MM-DD`). */
  today: string;
  business: PdfBusiness;
  /** VAT percent (Settings). */
  vatRate: number;
  /** `Settings.defaultLeaseTerms.clauses`. */
  leaseClauses?: { he: string; ar: string; en: string };
}

/** Header data common to every document. */
export interface PdfBase {
  template: PdfTemplate;
  lang: Locale;
  dir: 'rtl' | 'ltr';
  /** Heading printed on the document. */
  title: string;
  /** `Document.title` of the stored PDF. */
  documentTitle: string;
  /** Document number printed in the footer (`LC-000012`). */
  number: string;
  generatedOn: string;
  /** The ar / en versions are translations; the Hebrew text prevails. */
  translated: boolean;
  business: Omit<PdfBusiness, 'name'> & { name: string };
}

export interface PdfModel<T = unknown> extends PdfBase {
  data: T;
  /** Owner of the stored Document. */
  owner: { key: DocumentOwnerKey; id: string };
}

function base(template: PdfTemplate, ctx: PdfContext, title: string, number: string): PdfBase {
  return {
    template,
    lang: ctx.lang,
    dir: pdfDirection(ctx.lang),
    title,
    documentTitle: pdfT(ctx.lang, 'common.documentTitle', { title, number }),
    number,
    generatedOn: ctx.today,
    translated: ctx.lang !== 'he',
    business: { ...ctx.business, name: ctx.business.name[ctx.lang] || ctx.business.name.he },
  };
}

/* ------------------------------------------------------------------------------------------ */
/* Lease contract                                                                             */
/* ------------------------------------------------------------------------------------------ */

export interface LeaseSegmentInput {
  licenseNo: string;
  vehicle: (PdfVehicle & { ours: boolean }) | null;
  monthlyRent: number;
  startDate: string;
  endDate: string | null;
}

export interface LeaseInput {
  id: string;
  contractNo: number;
  type: LeaseType;
  status: LeaseStatus;
  startDate: string;
  endDate: string;
  paymentDay: number;
  rentIncludesVat: boolean;
  earlyExitPenaltyMonths: number;
  depositAmount: number;
  depositKind: DepositKind;
  responsibilities: Responsibilities;
  terms: string | null;
  signedAt: string | null;
  handoverChecklist: unknown;
  returnChecklist: unknown;
  lessee: PdfPerson & { licenseNo: string | null; taxiPermitNo: string | null };
  /** Ordered by start date. */
  segments: LeaseSegmentInput[];
}

export interface LeaseContractData {
  contractNo: number;
  type: LeaseType;
  carAndNumber: boolean;
  lessee: LeaseInput['lessee'];
  licenseNo: string;
  vehicle: (PdfVehicle & { ours: boolean }) | null;
  startDate: string;
  endDate: string;
  signedOn: string;
  monthlyRent: number;
  rentIncludesVat: boolean;
  vatRate: number;
  paymentDay: number;
  deposit: { amount: number; kind: DepositKind } | null;
  responsibilities: { key: (typeof RESPONSIBILITY_KEYS)[number]; party: ResponsibleParty }[];
  penaltyMonths: number;
  penaltyAmount: number;
  terms: string | null;
  clauses: { text: string; dir: 'rtl' | 'ltr' } | null;
}

/** The segment the contract prints: the open one, else the latest. */
function currentSegment(segments: readonly LeaseSegmentInput[]): LeaseSegmentInput | undefined {
  return segments.find((s) => s.endDate === null) ?? segments[segments.length - 1];
}

export function buildLeaseContract(
  input: LeaseInput,
  ctx: PdfContext,
): PdfModel<LeaseContractData> {
  const segment = currentSegment(input.segments);
  if (!segment) notApplicable('lease has no segment');
  const carAndNumber = input.type === 'CAR_AND_NUMBER';
  if (carAndNumber && !segment.vehicle) notApplicable('car lease segment has no vehicle');
  const rent = round2(segment.monthlyRent);
  const months = round2(input.earlyExitPenaltyMonths);
  const clauses = ctx.leaseClauses;
  const clauseText = clauses ? clauses[ctx.lang]?.trim() || clauses.he?.trim() || '' : '';
  const clauseLang: Locale = clauses?.[ctx.lang]?.trim() ? ctx.lang : 'he';
  const title = pdfT(ctx.lang, `lease.title.${input.type}`);
  return {
    ...base('lease-contract', ctx, title, pdfDocumentNumber('LC', { no: input.contractNo })),
    owner: { key: 'contractId', id: input.id },
    data: {
      contractNo: input.contractNo,
      type: input.type,
      carAndNumber,
      lessee: input.lessee,
      licenseNo: segment.licenseNo,
      vehicle: segment.vehicle,
      startDate: input.startDate,
      endDate: input.endDate,
      signedOn: input.signedAt ? input.signedAt.slice(0, 10) : ctx.today,
      monthlyRent: rent,
      rentIncludesVat: input.rentIncludesVat,
      vatRate: ctx.vatRate,
      paymentDay: input.paymentDay,
      deposit:
        input.depositAmount > 0
          ? { amount: round2(input.depositAmount), kind: input.depositKind }
          : null,
      responsibilities: RESPONSIBILITY_KEYS.map((key) => ({
        key,
        party: input.responsibilities[key] ?? 'DRIVER',
      })),
      penaltyMonths: months,
      penaltyAmount: round2(months * rent),
      terms: input.terms?.trim() || null,
      clauses: clauseText ? { text: clauseText, dir: pdfDirection(clauseLang) } : null,
    },
  };
}

/* ------------------------------------------------------------------------------------------ */
/* Handover / return checklist                                                                */
/* ------------------------------------------------------------------------------------------ */

export interface ChecklistData {
  variant: 'handover' | 'return';
  contractNo: number;
  lessee: LeaseInput['lessee'];
  licenseNo: string;
  vehicle: PdfVehicle;
  /** False when the checklist was not filled in the app (printed as a blank form). */
  filled: boolean;
  date: string | null;
  km: number | null;
  fuelLevel: FuelLevel | null;
  /** `checked` null = not filled. */
  items: { key: string; checked: boolean | null }[];
  damages: string | null;
  notes: string | null;
}

export function buildChecklist(
  input: LeaseInput,
  variant: 'handover' | 'return',
  ctx: PdfContext,
): PdfModel<ChecklistData> {
  if (input.type !== 'CAR_AND_NUMBER') notApplicable('number-only lease has no car handover');
  if (variant === 'return' && input.status === 'DRAFT') notApplicable('draft lease has no return');
  const withCar = input.segments.filter((s) => s.vehicle);
  const segment = variant === 'handover' ? withCar[0] : withCar[withCar.length - 1];
  if (!segment?.vehicle) notApplicable('lease has no car segment');
  const raw = variant === 'handover' ? input.handoverChecklist : input.returnChecklist;
  const parsed =
    raw && typeof raw === 'object'
      ? (variant === 'handover' ? HandoverChecklistSchema : ReturnChecklistSchema).safeParse(raw)
      : null;
  const list = parsed?.success ? (parsed.data as Record<string, unknown>) : null;
  const keys = variant === 'handover' ? HANDOVER_CHECKLIST_KEYS : RETURN_CHECKLIST_KEYS;
  const template = variant === 'handover' ? 'handover' : 'return';
  const title = pdfT(ctx.lang, `titles.${template}`);
  return {
    ...base(
      template,
      ctx,
      title,
      pdfDocumentNumber(variant === 'handover' ? 'HO' : 'RT', { no: input.contractNo }),
    ),
    owner: { key: 'contractId', id: input.id },
    data: {
      variant,
      contractNo: input.contractNo,
      lessee: input.lessee,
      licenseNo: segment.licenseNo,
      vehicle: segment.vehicle,
      filled: list !== null,
      date: (list?.date as string | null | undefined) ?? null,
      km: (list?.km as number | null | undefined) ?? null,
      fuelLevel: (list?.fuelLevel as FuelLevel | null | undefined) ?? null,
      items: keys.map((key) => ({ key, checked: list ? list[key] === true : null })),
      damages: (list?.damages as string | null | undefined) ?? null,
      notes: (list?.notes as string | null | undefined) ?? null,
    },
  };
}

/* ------------------------------------------------------------------------------------------ */
/* Deposit receipt / payment confirmation                                                     */
/* ------------------------------------------------------------------------------------------ */

export interface LedgerReceiptInput {
  id: string;
  type: LedgerType;
  date: string;
  amount: number;
  method: PaymentMethod | null;
  reference: string | null;
  description: string | null;
  rentPeriod: string | null;
  voided: boolean;
  driverId: string;
  payer: PdfPerson;
  contract: { contractNo: number; depositKind: DepositKind } | null;
  licenseNo: string | null;
  plateNo: string | null;
}

export interface DealPaymentInput {
  id: string;
  dealId: string;
  dealNo: number;
  dealType: DealType;
  direction: Direction;
  date: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  party: PdfPerson;
  vehicle: { plateNo: string; make: string; model: string; year: number };
}

export type ReceiptKind =
  'depositIn' | 'depositOut' | 'payment' | 'dealPaymentIn' | 'dealPaymentOut';

export interface ReceiptData {
  kind: ReceiptKind;
  date: string;
  amount: number;
  /** Payment method, or the deposit kind when the entry has no method. */
  method: { enumName: 'PaymentMethod' | 'DepositKind'; value: string } | null;
  reference: string | null;
  description: string | null;
  rentPeriod: string | null;
  party: PdfPerson;
  contractNo: number | null;
  licenseNo: string | null;
  plateNo: string | null;
  dealNo: number | null;
  vehicle: DealPaymentInput['vehicle'] | null;
}

export function buildDepositReceipt(
  input: LedgerReceiptInput,
  ctx: PdfContext,
): PdfModel<ReceiptData> {
  if (input.voided) notApplicable('voided entry');
  if (input.type !== 'DEPOSIT_IN' && input.type !== 'DEPOSIT_OUT') notApplicable('not a deposit');
  const kind: ReceiptKind = input.type === 'DEPOSIT_IN' ? 'depositIn' : 'depositOut';
  const title = pdfT(
    ctx.lang,
    kind === 'depositIn' ? 'titles.deposit-receipt' : 'titles.deposit-return',
  );
  return {
    ...base(
      'deposit-receipt',
      ctx,
      title,
      pdfDocumentNumber('DR', { date: input.date, id: input.id }),
    ),
    owner: { key: 'ledgerEntryId', id: input.id },
    data: ledgerReceiptData(kind, input),
  };
}

export function buildLedgerPayment(
  input: LedgerReceiptInput,
  ctx: PdfContext,
): PdfModel<ReceiptData> {
  if (input.voided) notApplicable('voided entry');
  if (input.type !== 'PAYMENT') notApplicable('not a payment');
  const title = pdfT(ctx.lang, 'titles.payment-confirmation');
  return {
    ...base(
      'payment-confirmation',
      ctx,
      title,
      pdfDocumentNumber('PC', { date: input.date, id: input.id }),
    ),
    owner: { key: 'ledgerEntryId', id: input.id },
    data: ledgerReceiptData('payment', input),
  };
}

function ledgerReceiptData(kind: ReceiptKind, input: LedgerReceiptInput): ReceiptData {
  const method = input.method
    ? { enumName: 'PaymentMethod' as const, value: input.method }
    : kind !== 'payment' && input.contract
      ? { enumName: 'DepositKind' as const, value: input.contract.depositKind }
      : null;
  return {
    kind,
    date: input.date,
    amount: round2(input.amount),
    method,
    reference: input.reference,
    description: input.description,
    rentPeriod: input.rentPeriod,
    party: input.payer,
    contractNo: input.contract?.contractNo ?? null,
    licenseNo: input.licenseNo,
    plateNo: input.plateNo,
    dealNo: null,
    vehicle: null,
  };
}

export function buildDealPayment(input: DealPaymentInput, ctx: PdfContext): PdfModel<ReceiptData> {
  if (input.method === 'TRADE_IN') notApplicable('trade-in value is not a payment');
  const kind: ReceiptKind = input.direction === 'IN' ? 'dealPaymentIn' : 'dealPaymentOut';
  const title = pdfT(ctx.lang, 'titles.payment-confirmation');
  return {
    ...base(
      'payment-confirmation',
      ctx,
      title,
      pdfDocumentNumber('PC', { date: input.date, id: input.id }),
    ),
    owner: { key: 'dealId', id: input.dealId },
    data: {
      kind,
      date: input.date,
      amount: round2(input.amount),
      method: { enumName: 'PaymentMethod', value: input.method },
      reference: input.reference,
      description: input.notes,
      rentPeriod: null,
      party: input.party,
      contractNo: null,
      licenseNo: null,
      plateNo: input.vehicle.plateNo,
      dealNo: input.dealNo,
      vehicle: input.vehicle,
    },
  };
}

/* ------------------------------------------------------------------------------------------ */
/* Deals: sale / purchase agreement, disclosure form                                          */
/* ------------------------------------------------------------------------------------------ */

export interface DealPaymentRow {
  date: string;
  direction: Direction;
  method: PaymentMethod;
  amount: number;
  reference: string | null;
}

export interface DealInput {
  id: string;
  dealNo: number;
  type: DealType;
  status: 'DRAFT' | 'PENDING' | 'COMPLETED' | 'CANCELLED';
  date: string;
  price: number;
  vatMode: VatMode;
  payoutAmount: number | null;
  warrantyText: string | null;
  disclosureSignedAt: string | null;
  transferDueAt: string | null;
  sellerIsVatBusiness: boolean;
  isTradeIn: boolean;
  counterparty: PdfPerson;
  vehicle: PdfVehicle & { dealerRegisteredAt: string | null };
  payments: DealPaymentRow[];
  /** SALE: the trade-in purchase (vehicle + agreed value). */
  tradeIn: { vehicle: PdfVehicle; value: number } | null;
  /** PURCHASE that is a trade-in: the sale it belongs to. */
  tradeInForDealNo: number | null;
  /** CONSIGNMENT_SALE: the registered owner. */
  consignor: PdfPerson | null;
  /** OWNED cycle: the seller of the purchase deal (previous owner). */
  previousOwner: PdfPerson | null;
}

/** Sale contract deposit rule (section 81): above this price at most 20% before delivery. */
export const DEPOSIT_CAP_PRICE = 59_610;
export const DEPOSIT_CAP_PERCENT = 20;

/** Default warranty wording (Hebrew, as section 86 requires) when the deal has none. */
export const DEFAULT_WARRANTY_KEY = 'sale.defaultWarranty';

export interface SaleAgreementData {
  dealNo: number;
  consignment: boolean;
  date: string;
  buyer: PdfPerson;
  consignor: PdfPerson | null;
  vehicle: PdfVehicle;
  price: number;
  vatMode: VatMode;
  payments: DealPaymentRow[];
  paid: number;
  tradeInValue: number;
  balance: number;
  tradeIn: DealInput['tradeIn'];
  /** Always Hebrew. */
  warrantyText: string;
  warrantyIsDefault: boolean;
  transferDueAt: string;
  disclosureSignedOn: string | null;
  depositCap: { applies: boolean; threshold: number; percent: number; maxAmount: number };
}

function assertSale(input: DealInput): void {
  if (input.type !== 'SALE' && input.type !== 'CONSIGNMENT_SALE') notApplicable('not a sale');
  if (input.status === 'CANCELLED') notApplicable('cancelled deal');
}

export function buildSaleAgreement(input: DealInput, ctx: PdfContext): PdfModel<SaleAgreementData> {
  assertSale(input);
  const consignment = input.type === 'CONSIGNMENT_SALE';
  if (consignment && !input.consignor) notApplicable('consignment sale without a consignor');
  const money = dealMoney(
    { type: input.type, price: input.price, payoutAmount: input.payoutAmount },
    input.payments,
  );
  // The trade-in value has its own line and clause; the table lists money payments only.
  const incoming = input.payments.filter((p) => p.direction === 'IN' && p.method !== 'TRADE_IN');
  const warranty = input.warrantyText?.trim();
  const title = pdfT(ctx.lang, consignment ? 'sale.titleConsignment' : 'titles.sale-agreement');
  return {
    ...base('sale-agreement', ctx, title, pdfDocumentNumber('SA', { no: input.dealNo })),
    owner: { key: 'dealId', id: input.id },
    data: {
      dealNo: input.dealNo,
      consignment,
      date: input.date,
      buyer: input.counterparty,
      consignor: input.consignor,
      vehicle: input.vehicle,
      price: round2(input.price),
      vatMode: input.vatMode,
      payments: incoming,
      paid: sumMoney(incoming.map((p) => p.amount)),
      tradeInValue: money.tradeInValue,
      balance: Math.max(0, money.balanceDue),
      tradeIn: input.tradeIn,
      warrantyText: warranty || pdfT('he', DEFAULT_WARRANTY_KEY),
      warrantyIsDefault: !warranty,
      transferDueAt: input.transferDueAt ?? addWorkingDays(input.date, TRANSFER_DUE_WORKING_DAYS),
      disclosureSignedOn: input.disclosureSignedAt ? input.disclosureSignedAt.slice(0, 10) : null,
      depositCap: {
        applies: input.price > DEPOSIT_CAP_PRICE,
        threshold: DEPOSIT_CAP_PRICE,
        percent: DEPOSIT_CAP_PERCENT,
        maxAmount: round2((input.price * DEPOSIT_CAP_PERCENT) / 100),
      },
    },
  };
}

export interface PurchaseAgreementData {
  dealNo: number;
  date: string;
  seller: PdfPerson;
  vehicle: PdfVehicle;
  price: number;
  sellerIsVatBusiness: boolean;
  payments: DealPaymentRow[];
  paid: number;
  tradeInValue: number;
  balance: number;
  tradeInForDealNo: number | null;
}

export function buildPurchaseAgreement(
  input: DealInput,
  ctx: PdfContext,
): PdfModel<PurchaseAgreementData> {
  if (input.type !== 'PURCHASE') notApplicable('not a purchase');
  if (input.status === 'CANCELLED') notApplicable('cancelled deal');
  const money = dealMoney(
    { type: input.type, price: input.price, payoutAmount: input.payoutAmount },
    input.payments,
  );
  const outgoing = input.payments.filter((p) => p.direction === 'OUT' && p.method !== 'TRADE_IN');
  const title = pdfT(ctx.lang, 'titles.purchase-agreement');
  return {
    ...base('purchase-agreement', ctx, title, pdfDocumentNumber('PA', { no: input.dealNo })),
    owner: { key: 'dealId', id: input.id },
    data: {
      dealNo: input.dealNo,
      date: input.date,
      seller: input.counterparty,
      vehicle: input.vehicle,
      price: round2(input.price),
      sellerIsVatBusiness: input.sellerIsVatBusiness,
      payments: outgoing,
      paid: money.paidOut,
      tradeInValue: money.tradeInValue,
      balance: Math.max(0, money.balanceDue),
      tradeInForDealNo: input.isTradeIn ? input.tradeInForDealNo : null,
    },
  };
}

export interface DisclosureData {
  dealNo: number;
  consignment: boolean;
  date: string;
  buyer: PdfPerson;
  /** Registered owner: the consignor, the dealer (dealer registration) or the previous owner. */
  registeredOwner: PdfPerson & { isDealer: boolean };
  previousOwner: PdfPerson | null;
  vehicle: PdfVehicle;
  hands: number | null;
  /** Known prior uses; null = unknown (left for the dealer to tick). */
  history: {
    taxi: boolean | null;
    leasing: boolean | null;
    rental: boolean | null;
    school: boolean | null;
  };
  km: number | null;
  price: number;
  signedOn: string | null;
}

export function buildDisclosure(input: DealInput, ctx: PdfContext): PdfModel<DisclosureData> {
  assertSale(input);
  const consignment = input.type === 'CONSIGNMENT_SALE';
  if (consignment && !input.consignor) notApplicable('consignment sale without a consignor');
  const dealer: PdfPerson = {
    name: ctx.business.name[ctx.lang] || ctx.business.name.he,
    idNumber: ctx.business.legalId,
    address: ctx.business.address,
    phone: ctx.business.phone,
    isCompany: true,
  };
  let registeredOwner: PdfPerson & { isDealer: boolean };
  if (consignment && input.consignor) registeredOwner = { ...input.consignor, isDealer: false };
  else if (input.vehicle.dealerRegisteredAt || !input.previousOwner)
    registeredOwner = { ...dealer, isDealer: true };
  else registeredOwner = { ...input.previousOwner, isDealer: false };
  const title = pdfT(ctx.lang, 'titles.disclosure-form');
  return {
    ...base('disclosure-form', ctx, title, pdfDocumentNumber('DF', { no: input.dealNo })),
    owner: { key: 'dealId', id: input.id },
    data: {
      dealNo: input.dealNo,
      consignment,
      date: input.date,
      buyer: input.counterparty,
      registeredOwner,
      previousOwner: consignment ? null : input.previousOwner,
      vehicle: input.vehicle,
      hands: input.vehicle.hand,
      history: {
        taxi: input.vehicle.isTaxi ? true : null,
        leasing: null,
        rental: null,
        school: null,
      },
      km: input.vehicle.km,
      price: round2(input.price),
      signedOn: input.disclosureSignedAt ? input.disclosureSignedAt.slice(0, 10) : null,
    },
  };
}

/* ------------------------------------------------------------------------------------------ */
/* Consignment agreement                                                                      */
/* ------------------------------------------------------------------------------------------ */

export interface ConsignmentInput {
  id: string;
  kind: 'OWNED' | 'CONSIGNED';
  startedAt: string;
  endedAt: string | null;
  agreementEndsAt: string | null;
  askingPrice: number | null;
  minNetToConsignor: number | null;
  commissionMode: CommissionMode | null;
  commissionValue: number | null;
  vehicleId: string;
  owner: PdfPerson | null;
  vehicle: PdfVehicle;
}

export interface ConsignmentData {
  owner: PdfPerson;
  vehicle: PdfVehicle;
  startedAt: string;
  agreementEndsAt: string | null;
  askingPrice: number | null;
  minNet: number | null;
  commissionMode: CommissionMode | null;
  commissionValue: number | null;
}

export function buildConsignment(
  input: ConsignmentInput,
  ctx: PdfContext,
): PdfModel<ConsignmentData> {
  if (input.kind !== 'CONSIGNED') notApplicable('not a consignment cycle');
  if (!input.owner) notApplicable('consignment without an owner');
  const title = pdfT(ctx.lang, 'titles.consignment-agreement');
  return {
    ...base(
      'consignment-agreement',
      ctx,
      title,
      pdfDocumentNumber('CA', { date: input.startedAt, id: input.id }),
    ),
    owner: { key: 'vehicleId', id: input.vehicleId },
    data: {
      owner: input.owner,
      vehicle: input.vehicle,
      startedAt: input.startedAt,
      agreementEndsAt: input.agreementEndsAt,
      askingPrice: input.askingPrice === null ? null : round2(input.askingPrice),
      minNet: input.minNetToConsignor === null ? null : round2(input.minNetToConsignor),
      commissionMode: input.commissionMode,
      commissionValue: input.commissionValue === null ? null : round2(input.commissionValue),
    },
  };
}
