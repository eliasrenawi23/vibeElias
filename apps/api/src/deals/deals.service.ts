import { Injectable } from '@nestjs/common';
import {
  AuditAction,
  ContactTag,
  DealStatus,
  DealType,
  InventoryCycle,
  Prisma,
  Vehicle,
} from '@prisma/client';
import {
  contactDisplayName,
  msg,
  normalizePhone,
  normalizePlate,
  round2,
  type DealCancelRequest,
  type DealCompleteRequest,
  type DealConsignmentSaleCreate,
  type DealCreateRequest,
  type DealDisclosure,
  type DealPaymentRequest,
  type DealPurchaseCreate,
  type DealQuery,
  type DealSummary,
  type DealSummaryQuery,
  DealStatus as DealStatusSchema,
  type DealSaleCreate,
  type DealTradeInInput,
  type DealTransferRequest,
  type DealUpdateRequest,
  type DealVehicleCreate,
  type DealVehicleInput,
  type Paginated,
} from '@renawi/shared';
import { AuditRecord, AuditService } from '../common/audit/audit.service';
import { readLeadDays, readVatRate } from '../common/business-settings';
import { Clock } from '../common/clock';
import { dbDate, dbDateOpt, isoOf, isoOrNull } from '../common/dates';
import { AppException, ErrorKey } from '../common/errors/app-exception';
import { contactRef, searchTokens } from '../common/refs';
import { ContactsService } from '../contacts/contacts.service';
import { isDecimal, toDbMoney, toDbMoneyOrNull } from '../prisma/prisma.decimal';
import { zeroCounts } from '../common/status-counts';
import { PrismaService } from '../prisma/prisma.service';
import {
  consignmentAmounts,
  dealAlerts,
  dealMoney,
  dealVat,
  mergeTransferChecklist,
  purchaseVatMode,
  rollUpTransfer,
  saleVatMode,
  transferDueDate,
} from './deal-rules';
import {
  DEAL_DETAIL_INCLUDE,
  DEAL_LIST_INCLUDE,
  DealDetail,
  DealDetailRow,
  DealListItem,
  DealListRow,
  PURCHASE_REF_SELECT,
} from './deal-views';

type Tx = Prisma.TransactionClient;
type Audits = AuditRecord[];

const TX_OPTIONS = { timeout: 20_000, maxWait: 10_000 } as const;
const OPEN_STATUSES: DealStatus[] = ['DRAFT', 'PENDING'];
const SALE_TYPES: DealType[] = ['SALE', 'CONSIGNMENT_SALE'];

const SORTABLE_FIELDS = new Set([
  'date',
  'dealNo',
  'price',
  'createdAt',
  'updatedAt',
  'status',
  'type',
  'transferDueAt',
  'completedAt',
]);
const NULLABLE_SORT_FIELDS = new Set(['transferDueAt', 'completedAt']);

const PAYMENT_SUMS_SELECT = {
  id: true,
  direction: true,
  method: true,
  amount: true,
} satisfies Prisma.DealPaymentSelect;

/** Relations needed by the deal mutations. */
const MUTATION_INCLUDE = {
  vehicle: true,
  cycle: { include: { purchaseDeal: { select: PURCHASE_REF_SELECT } } },
  payments: { select: PAYMENT_SUMS_SELECT },
  tradeInDeal: {
    include: { cycle: true, vehicle: true, payments: { select: PAYMENT_SUMS_SELECT } },
  },
} satisfies Prisma.DealInclude;
type DealRow = Prisma.DealGetPayload<{ include: typeof MUTATION_INCLUDE }>;
type TradeInRow = NonNullable<DealRow['tradeInDeal']>;

/** Fields `PATCH` may change on a COMPLETED deal. */
const COMPLETED_EDITABLE = new Set(['notes', 'warrantyText']);
/** Fields a trade-in purchase takes from its sale. */
const TRADE_IN_LOCKED = new Set(['price', 'date', 'counterpartyId']);

/** JSON-comparable form of a request value vs the stored one. */
function comparable(key: string, value: unknown): string {
  if (value instanceof Date) {
    return JSON.stringify(key === 'disclosureSignedAt' ? value.toISOString() : isoOf(value));
  }
  if (isDecimal(value) || typeof value === 'number') return JSON.stringify(round2(value));
  return JSON.stringify(value ?? null);
}

/** Vehicle columns from a deal's inline vehicle (undefined = not sent). */
function vehicleFields(c: DealVehicleCreate) {
  return {
    vin: c.vin,
    make: c.make,
    model: c.model,
    trim: c.trim,
    year: c.year,
    color: c.color,
    fuel: c.fuel,
    gearbox: c.gearbox,
    engineCc: c.engineCc,
    hand: c.hand,
    isTaxi: c.isTaxi,
    currentKm: c.currentKm,
    registrationExpiry: dbDateOpt(c.registrationExpiry),
    dealerRegisteredAt: dbDateOpt(c.dealerRegisteredAt),
    meterSerial: c.meterSerial,
    meterSealedAt: dbDateOpt(c.meterSealedAt),
    location: c.location,
    listingPrice: c.listingPrice === undefined ? undefined : toDbMoneyOrNull(c.listingPrice),
    notes: c.notes,
  } satisfies Prisma.VehicleUncheckedUpdateInput;
}

/** True when `cycle` was opened by `deal` (same transaction, same `createdAt`). */
function openedBy(cycle: InventoryCycle, deal: { id: string; createdAt: Date }): boolean {
  return cycle.purchaseDealId === deal.id && cycle.createdAt.getTime() >= deal.createdAt.getTime();
}

/** Unique violations during deal writes. */
function rethrowConflict(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    const target = JSON.stringify(e.meta?.target ?? '');
    if (target.includes('plateNo')) throw AppException.duplicate('plateNo');
    if (target.includes('vin')) throw AppException.duplicate('vin');
    throw AppException.conflict(ErrorKey.cycleOpen);
  }
  throw e;
}

interface VehicleTarget {
  input: DealVehicleInput;
  /** Vehicle already in the system (by id or plate); null = create it. */
  existing: Vehicle | null;
  /** Open OWNED cycle without a purchase deal that a PURCHASE attaches to. */
  attach: InventoryCycle | null;
}

/**
 * Deals: purchases (incl. trade-ins), sales and consignment sales with their payments,
 * disclosure gate, completion / cancellation side effects on cycles and vehicles, and the
 * ownership-transfer checklist.
 */
@Injectable()
export class DealsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly audit: AuditService,
    private readonly contacts: ContactsService,
  ) {}

  /* ------------------------------------------------------------------------------------ */
  /* Reads                                                                                */
  /* ------------------------------------------------------------------------------------ */

  /** Count per status under the list filters, ignoring `status` (one groupBy). */
  async summary(query: DealSummaryQuery): Promise<DealSummary> {
    const rows = await this.prisma.deal.groupBy({
      by: ['status'],
      where: this.buildWhere({ ...query, status: undefined }, this.clock.today()),
      _count: { _all: true },
    });
    const counts = zeroCounts(DealStatusSchema.options);
    for (const r of rows) counts[r.status] = r._count._all;
    return { counts };
  }

  async list(q: DealQuery): Promise<Paginated<DealListItem>> {
    const today = this.clock.today();
    const where = this.buildWhere(q, today);
    const sort = q.sort && SORTABLE_FIELDS.has(q.sort) ? q.sort : 'date';
    const orderBy: Prisma.DealOrderByWithRelationInput[] = [
      NULLABLE_SORT_FIELDS.has(sort)
        ? { [sort]: { sort: q.order, nulls: 'last' } }
        : { [sort]: q.order },
      { dealNo: q.order },
    ];
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.deal.count({ where }),
      this.prisma.deal.findMany({
        where,
        orderBy,
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: DEAL_LIST_INCLUDE,
      }),
    ]);
    const lead = (await readLeadDays(this.prisma)).transfer;
    return {
      items: rows.map((r) => this.toListItem(r, today, lead)),
      total,
      page: q.page,
      pageSize: q.pageSize,
    };
  }

  async get(id: string): Promise<DealDetail> {
    const row = await this.prisma.deal.findUnique({ where: { id }, include: DEAL_DETAIL_INCLUDE });
    if (!row) throw AppException.notFound();
    const lead = (await readLeadDays(this.prisma)).transfer;
    return this.toDetail(row, this.clock.today(), lead);
  }

  /* ------------------------------------------------------------------------------------ */
  /* Create                                                                               */
  /* ------------------------------------------------------------------------------------ */

  async create(dto: DealCreateRequest, userId: string | null): Promise<DealDetail> {
    let id: string;
    switch (dto.type) {
      case 'PURCHASE':
        id = await this.createPurchase(dto, userId);
        break;
      case 'SALE':
        id = await this.createSale(dto, userId);
        break;
      case 'CONSIGNMENT_SALE':
        id = await this.createConsignmentSale(dto, userId);
        break;
      default: {
        const exhaustive: never = dto;
        throw new Error(`Unknown deal type ${JSON.stringify(exhaustive)}`);
      }
    }
    return this.get(id);
  }

  /**
   * PURCHASE: vehicle by id or inline (plate upsert). A vehicle with an open OWNED cycle that has
   * no purchase deal (stock entered manually / seeded) gets this deal attached to that cycle;
   * any other open cycle -> 409 `errors.cycleOpen`. Otherwise a new OWNED cycle opens on `date`
   * (a known plate without an open cycle = buy-back) and the car becomes IN_STOCK / OWNED.
   */
  private async createPurchase(dto: DealPurchaseCreate, userId: string | null): Promise<string> {
    await this.contacts.assertExists(dto.counterpartyId, 'counterpartyId');
    const target = await this.resolveVehicle(dto.vehicle, 'vehicle', true);
    const vatRate = await readVatRate(this.prisma);
    const audits: Audits = [];
    const id = await this.inTx(async (tx) => {
      const vehicle = await this.enterVehicle(tx, target, audits);
      const now = new Date();
      const deal = await tx.deal.create({
        data: {
          type: 'PURCHASE',
          status: 'DRAFT',
          vehicleId: vehicle.id,
          cycleId: target.attach?.id ?? null,
          counterpartyId: dto.counterpartyId,
          date: dbDate(dto.date),
          price: toDbMoney(dto.price),
          listPrice: toDbMoneyOrNull(dto.listPrice),
          vatMode: purchaseVatMode(dto.sellerIsVatBusiness),
          vatRate,
          sellerIsVatBusiness: dto.sellerIsVatBusiness,
          notes: dto.notes ?? null,
          createdById: userId,
          createdAt: now,
        },
      });
      if (target.attach) {
        const attached = await tx.inventoryCycle.updateMany({
          where: { id: target.attach.id, endedAt: null, purchaseDealId: null },
          data: {
            purchaseDealId: deal.id,
            // A purchase recorded after the stock entry moves the cycle start back.
            ...(dto.date < isoOf(target.attach.startedAt) ? { startedAt: dbDate(dto.date) } : {}),
          },
        });
        if (attached.count === 0) throw AppException.conflict(ErrorKey.cycleOpen);
      } else {
        await this.openPurchaseCycle(tx, vehicle, deal.id, dto.date, now, audits);
      }
      return deal.id;
    });
    await this.contacts.addTag(dto.counterpartyId, 'SELLER', userId);
    await this.flush(audits, userId);
    return id;
  }

  /**
   * SALE (DRAFT): needs an open OWNED cycle (`errors.noOpenCycle`), no open lease segment
   * (`errors.vehicleLeased`) and no other DRAFT / PENDING sale (`errors.dealPending`). The car
   * becomes RESERVED. With a trade-in the same transaction creates the linked PURCHASE
   * (`isTradeIn`, PENDING) with its own OWNED cycle and the two TRADE_IN payments.
   */
  private async createSale(dto: DealSaleCreate, userId: string | null): Promise<string> {
    await this.contacts.assertExists(dto.counterpartyId, 'counterpartyId');
    const vehicle = await this.vehicleRow(dto.vehicleId, 'vehicleId');
    const cycle = await this.prisma.inventoryCycle.findFirst({
      where: { vehicleId: vehicle.id, endedAt: null },
      include: { purchaseDeal: { select: PURCHASE_REF_SELECT } },
    });
    if (!cycle || cycle.kind !== 'OWNED') throw AppException.conflict(ErrorKey.noOpenCycle);
    await this.assertSellable(vehicle.id);
    let tradeIn: VehicleTarget | null = null;
    if (dto.tradeIn) {
      const input = dto.tradeIn.vehicle;
      if (input.id === vehicle.id || input.create?.plateNo === vehicle.plateNo) {
        throw AppException.fieldError('tradeIn.vehicle', msg.invalidValue);
      }
      tradeIn = await this.resolveVehicle(input, 'tradeIn.vehicle', false);
    }
    const purchase = cycle.purchaseDeal?.status === 'CANCELLED' ? null : cycle.purchaseDeal;
    const vatMode = saleVatMode(dto.vatMode, purchase?.sellerIsVatBusiness ?? false);
    const vatRate = await readVatRate(this.prisma);
    const audits: Audits = [];
    const id = await this.inTx(async (tx) => {
      const sale = await tx.deal.create({
        data: {
          type: 'SALE',
          status: 'DRAFT',
          vehicleId: vehicle.id,
          cycleId: cycle.id,
          counterpartyId: dto.counterpartyId,
          date: dbDate(dto.date),
          price: toDbMoney(dto.price),
          listPrice: toDbMoneyOrNull(dto.listPrice),
          vatMode,
          vatRate,
          warrantyText: dto.warrantyText ?? null,
          notes: dto.notes ?? null,
          createdById: userId,
        },
      });
      if (dto.tradeIn && tradeIn) {
        await this.createTradeIn(tx, sale, vehicle, dto.tradeIn, tradeIn, vatRate, userId, audits);
      }
      await this.updateVehicle(tx, vehicle.id, { status: 'RESERVED' }, audits);
      return sale.id;
    });
    await this.contacts.addTag(dto.counterpartyId, 'BUYER', userId);
    if (dto.tradeIn) await this.contacts.addTag(dto.counterpartyId, 'SELLER', userId);
    await this.flush(audits, userId);
    return id;
  }

  /** Linked trade-in PURCHASE of a sale (inside the sale's transaction). */
  private async createTradeIn(
    tx: Tx,
    sale: { id: string; counterpartyId: string; date: Date },
    saleVehicle: Vehicle,
    block: DealTradeInInput,
    target: VehicleTarget,
    vatRate: Prisma.Decimal,
    userId: string | null,
    audits: Audits,
  ): Promise<void> {
    const vehicle = await this.enterVehicle(tx, target, audits);
    const now = new Date();
    const purchase = await tx.deal.create({
      data: {
        type: 'PURCHASE',
        status: 'PENDING',
        isTradeIn: true,
        vehicleId: vehicle.id,
        counterpartyId: sale.counterpartyId,
        date: sale.date,
        price: toDbMoney(block.value),
        listPrice: toDbMoneyOrNull(block.listPrice),
        vatMode: purchaseVatMode(block.sellerIsVatBusiness),
        vatRate,
        sellerIsVatBusiness: block.sellerIsVatBusiness,
        notes: block.notes ?? null,
        createdById: userId,
        createdAt: now,
      },
    });
    await this.openPurchaseCycle(tx, vehicle, purchase.id, isoOf(sale.date), now, audits);
    await tx.deal.update({ where: { id: sale.id }, data: { tradeInDealId: purchase.id } });
    await tx.dealPayment.createMany({
      data: [
        {
          dealId: sale.id,
          direction: 'IN',
          contactId: sale.counterpartyId,
          date: sale.date,
          amount: purchase.price,
          method: 'TRADE_IN',
          reference: vehicle.plateNo,
        },
        {
          dealId: purchase.id,
          direction: 'OUT',
          contactId: sale.counterpartyId,
          date: sale.date,
          amount: purchase.price,
          method: 'TRADE_IN',
          reference: saleVehicle.plateNo,
        },
      ],
    });
    audits.push({
      entity: 'Deal',
      entityId: purchase.id,
      action: AuditAction.CREATE,
      after: purchase,
    });
  }

  /**
   * CONSIGNMENT_SALE (DRAFT): needs an open CONSIGNED cycle; commission / payout from the cycle
   * rule; VAT mode NONE (VAT is due on the commission at business level); car RESERVED.
   */
  private async createConsignmentSale(
    dto: DealConsignmentSaleCreate,
    userId: string | null,
  ): Promise<string> {
    await this.contacts.assertExists(dto.counterpartyId, 'counterpartyId');
    const vehicle = await this.vehicleRow(dto.vehicleId, 'vehicleId');
    const cycle = await this.openCycle(vehicle.id);
    if (!cycle || cycle.kind !== 'CONSIGNED') throw AppException.conflict(ErrorKey.noOpenCycle);
    await this.assertSellable(vehicle.id);
    const amounts = consignmentAmounts(cycle, dto.price);
    const vatRate = await readVatRate(this.prisma);
    const audits: Audits = [];
    const id = await this.inTx(async (tx) => {
      const deal = await tx.deal.create({
        data: {
          type: 'CONSIGNMENT_SALE',
          status: 'DRAFT',
          vehicleId: vehicle.id,
          cycleId: cycle.id,
          counterpartyId: dto.counterpartyId,
          date: dbDate(dto.date),
          price: toDbMoney(dto.price),
          listPrice: toDbMoneyOrNull(dto.listPrice),
          vatMode: 'NONE',
          vatRate,
          commissionAmount: toDbMoney(amounts.commission),
          payoutAmount: toDbMoney(amounts.payout),
          warrantyText: dto.warrantyText ?? null,
          notes: dto.notes ?? null,
          createdById: userId,
        },
      });
      await this.updateVehicle(tx, vehicle.id, { status: 'RESERVED' }, audits);
      return deal.id;
    });
    await this.contacts.addTag(dto.counterpartyId, 'BUYER', userId);
    await this.flush(audits, userId);
    return id;
  }

  /* ------------------------------------------------------------------------------------ */
  /* Update                                                                               */
  /* ------------------------------------------------------------------------------------ */

  /**
   * DRAFT / PENDING: date, price, listPrice, counterparty, VAT mode (within the type rules),
   * warranty, notes, sellerIsVatBusiness (PURCHASE), status DRAFT <-> PENDING. A consignment
   * sale recomputes commission / payout; a sale with a trade-in carries date and buyer over to
   * the trade-in. COMPLETED: notes and warrantyText only. CANCELLED: nothing.
   */
  async update(id: string, dto: DealUpdateRequest, userId: string | null): Promise<DealDetail> {
    const deal = await this.row(id);
    const current = deal as unknown as Record<string, unknown>;
    const changed = Object.entries(dto).filter(
      ([key, value]) =>
        value !== undefined && comparable(key, value) !== comparable(key, current[key]),
    );
    const lock = (keys: [string, unknown][]) => {
      if (keys.length || deal.status === 'CANCELLED') {
        throw AppException.conflict(
          ErrorKey.dealNotEditable,
          keys.map(([path]) => ({ path, message: ErrorKey.dealNotEditable })),
        );
      }
    };
    if (deal.status === 'CANCELLED') lock(changed);
    if (deal.status === 'COMPLETED') lock(changed.filter(([k]) => !COMPLETED_EDITABLE.has(k)));
    if (deal.isTradeIn) lock(changed.filter(([k]) => TRADE_IN_LOCKED.has(k)));
    if (changed.length === 0) return this.get(id);

    if (deal.status === 'COMPLETED') {
      await this.prisma.deal.update({
        where: { id },
        data: { notes: dto.notes, warrantyText: dto.warrantyText },
      });
      return this.get(id);
    }

    const has = (key: keyof DealUpdateRequest) => changed.some(([k]) => k === key);
    if (has('sellerIsVatBusiness') && deal.type !== 'PURCHASE') {
      throw AppException.fieldError('sellerIsVatBusiness', msg.invalidValue);
    }
    const vatMode = this.nextVatMode(deal, dto);
    const price = dto.price ?? round2(deal.price);
    if (deal.type === 'SALE' && deal.tradeInDeal && price < round2(deal.tradeInDeal.price)) {
      throw AppException.fieldError('price', msg.invalidAmount);
    }
    if (has('counterpartyId') && dto.counterpartyId) {
      await this.contacts.assertExists(dto.counterpartyId, 'counterpartyId');
    }
    const amounts =
      deal.type === 'CONSIGNMENT_SALE' && deal.cycle && has('price')
        ? consignmentAmounts(deal.cycle, price)
        : null;
    const date = has('date') ? dto.date : undefined;
    const counterpartyId = has('counterpartyId') ? dto.counterpartyId : undefined;

    await this.inTx(async (tx) => {
      await tx.deal.update({
        where: { id },
        data: {
          status: dto.status,
          counterpartyId,
          date: date ? dbDate(date) : undefined,
          price: dto.price === undefined ? undefined : toDbMoney(dto.price),
          listPrice: dto.listPrice === undefined ? undefined : toDbMoneyOrNull(dto.listPrice),
          vatMode,
          sellerIsVatBusiness: deal.type === 'PURCHASE' ? dto.sellerIsVatBusiness : undefined,
          warrantyText: dto.warrantyText,
          notes: dto.notes,
          ...(amounts
            ? {
                commissionAmount: toDbMoney(amounts.commission),
                payoutAmount: toDbMoney(amounts.payout),
              }
            : {}),
        },
      });
      if (deal.type === 'PURCHASE') {
        if (date) await this.movePurchaseStart(tx, deal, date);
        if (has('sellerIsVatBusiness') && dto.sellerIsVatBusiness && deal.cycleId) {
          // A VAT-business purchase forces full VAT on the open sale of the same cycle.
          await tx.deal.updateMany({
            where: { cycleId: deal.cycleId, type: 'SALE', status: { in: OPEN_STATUSES } },
            data: { vatMode: 'FULL' },
          });
        }
      }
      if (deal.type === 'SALE' && deal.tradeInDeal && (date || counterpartyId)) {
        await this.syncTradeIn(tx, deal.id, deal.tradeInDeal, { date, counterpartyId });
      }
    });
    if (counterpartyId) {
      const tags: ContactTag[] =
        deal.type === 'PURCHASE' ? ['SELLER'] : deal.tradeInDeal ? ['BUYER', 'SELLER'] : ['BUYER'];
      for (const tag of tags) await this.contacts.addTag(counterpartyId, tag, userId);
    }
    return this.get(id);
  }

  /** VAT mode after a PATCH, or a 400 on `vatMode` when the type does not allow it. */
  private nextVatMode(deal: DealRow, dto: DealUpdateRequest) {
    switch (deal.type) {
      case 'PURCHASE': {
        const derived = purchaseVatMode(dto.sellerIsVatBusiness ?? deal.sellerIsVatBusiness);
        if (dto.vatMode !== undefined && dto.vatMode !== derived) {
          throw AppException.fieldError('vatMode', msg.invalidOption);
        }
        return derived;
      }
      case 'SALE': {
        if (dto.vatMode === 'NONE') throw AppException.fieldError('vatMode', msg.invalidOption);
        const purchase = deal.cycle?.purchaseDeal;
        const forced =
          !!purchase && purchase.status !== 'CANCELLED' && purchase.sellerIsVatBusiness;
        return saleVatMode(dto.vatMode ?? deal.vatMode, forced);
      }
      case 'CONSIGNMENT_SALE':
        if (dto.vatMode !== undefined && dto.vatMode !== 'NONE') {
          throw AppException.fieldError('vatMode', msg.invalidOption);
        }
        return 'NONE' as const;
      default: {
        const exhaustive: never = deal.type;
        throw new Error(`Unknown deal type ${String(exhaustive)}`);
      }
    }
  }

  /** `POST /deals/:id/disclosure`: SALE / CONSIGNMENT_SALE that is not cancelled. */
  async setDisclosure(id: string, dto: DealDisclosure): Promise<DealDetail> {
    const deal = await this.prisma.deal.findUnique({ where: { id } });
    if (!deal) throw AppException.notFound();
    if (deal.type === 'PURCHASE' || deal.status === 'CANCELLED') {
      throw AppException.conflict(ErrorKey.invalidTransition);
    }
    if (dto.signedAt === null && deal.status === 'COMPLETED') {
      throw AppException.conflict(ErrorKey.dealNotEditable, [
        { path: 'signedAt', message: ErrorKey.dealNotEditable },
      ]);
    }
    await this.prisma.deal.update({
      where: { id },
      data: { disclosureSignedAt: dto.signedAt ? new Date(dto.signedAt) : null },
    });
    return this.get(id);
  }

  /* ------------------------------------------------------------------------------------ */
  /* Complete / cancel                                                                    */
  /* ------------------------------------------------------------------------------------ */

  /**
   * DRAFT / PENDING -> COMPLETED on `date` (default: the deal date; a given date becomes the
   * deal date). PURCHASE: the cycle stays open (a trade-in completes with its sale). SALE /
   * CONSIGNMENT_SALE: needs the signed disclosure form (`errors.disclosureRequired`) and no open
   * lease segment; closes the cycle (SOLD), vehicle SOLD, `transferDueAt = date + 6 working
   * days`; the trade-in purchase completes too; a consignment recomputes commission / payout.
   */
  async complete(id: string, dto: DealCompleteRequest, userId: string | null): Promise<DealDetail> {
    const deal = await this.row(id);
    if (!OPEN_STATUSES.includes(deal.status)) {
      throw AppException.conflict(ErrorKey.invalidTransition);
    }
    const date = dto.date ?? isoOf(deal.date);
    const dateChanged = date !== isoOf(deal.date);
    const now = new Date();
    const audits: Audits = [];

    if (deal.type === 'PURCHASE') {
      if (deal.isTradeIn) throw AppException.conflict(ErrorKey.invalidTransition);
      await this.inTx(async (tx) => {
        await tx.deal.update({
          where: { id },
          data: { status: 'COMPLETED', completedAt: now, date: dbDate(date) },
        });
        if (dateChanged) await this.movePurchaseStart(tx, deal, date);
      });
      return this.get(id);
    }

    if (!deal.disclosureSignedAt) throw AppException.conflict(ErrorKey.disclosureRequired);
    if (await this.hasOpenSegment(deal.vehicleId)) {
      throw AppException.conflict(ErrorKey.vehicleLeased);
    }
    const cycle = deal.cycle;
    const kind = deal.type === 'SALE' ? 'OWNED' : 'CONSIGNED';
    if (!cycle || cycle.endedAt || cycle.kind !== kind) {
      throw AppException.conflict(ErrorKey.noOpenCycle);
    }
    const amounts = deal.type === 'CONSIGNMENT_SALE' ? consignmentAmounts(cycle, deal.price) : null;
    await this.inTx(async (tx) => {
      const start = isoOf(cycle.startedAt);
      await tx.inventoryCycle.update({
        where: { id: cycle.id },
        data: { saleDealId: id, endedAt: dbDate(date < start ? start : date), endReason: 'SOLD' },
      });
      await this.updateVehicle(tx, deal.vehicleId, { status: 'SOLD' }, audits);
      await tx.deal.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedAt: now,
          date: dbDate(date),
          transferDueAt: dbDate(transferDueDate(date)),
          ...(amounts
            ? {
                commissionAmount: toDbMoney(amounts.commission),
                payoutAmount: toDbMoney(amounts.payout),
              }
            : {}),
        },
      });
      if (deal.tradeInDeal) {
        await tx.deal.update({
          where: { id: deal.tradeInDeal.id },
          data: { status: 'COMPLETED', completedAt: now },
        });
        if (dateChanged) await this.syncTradeIn(tx, deal.id, deal.tradeInDeal, { date });
      }
    });
    await this.flush(audits, userId);
    return this.get(id);
  }

  /**
   * DRAFT / PENDING only (`errors.dealNotCancellable`; a trade-in is cancelled with its sale);
   * no manual payments (`errors.dealHasPayments`). SALE: car back IN_STOCK, the trade-in deal
   * and its cycle are cancelled (trade-in car EXTERNAL unless it has an earlier cycle), TRADE_IN
   * payments removed. PURCHASE: the cycle it opened is cancelled (car EXTERNAL unless it has an
   * earlier cycle); a purchase attached to existing stock is just detached. CONSIGNMENT_SALE:
   * car back IN_STOCK. The reason is appended to the notes.
   */
  async cancel(id: string, dto: DealCancelRequest, userId: string | null): Promise<DealDetail> {
    const deal = await this.row(id);
    if (!OPEN_STATUSES.includes(deal.status) || deal.isTradeIn) {
      throw AppException.conflict(ErrorKey.dealNotCancellable);
    }
    const payments = [...deal.payments, ...(deal.tradeInDeal?.payments ?? [])];
    if (payments.some((p) => p.method !== 'TRADE_IN')) {
      throw AppException.conflict(ErrorKey.dealHasPayments);
    }
    const now = new Date();
    const audits: Audits = [];
    const cancelData: Prisma.DealUncheckedUpdateInput = {
      status: 'CANCELLED',
      cancelledAt: now,
      ...(dto.reason ? { notes: deal.notes ? `${deal.notes}\n${dto.reason}` : dto.reason } : {}),
    };

    if (deal.type === 'PURCHASE') {
      const cycle = deal.cycle;
      const owns = cycle !== null && cycle.purchaseDealId === deal.id;
      const opened = cycle !== null && openedBy(cycle, deal);
      if (owns && cycle.endedAt) throw AppException.conflict(ErrorKey.dealNotCancellable);
      if (opened) await this.assertCycleIdle(cycle.id, deal.vehicleId);
      await this.inTx(async (tx) => {
        if (opened) await this.cancelCycle(tx, cycle, audits);
        else if (owns) {
          await tx.inventoryCycle.update({
            where: { id: cycle.id },
            data: { purchaseDealId: null },
          });
        }
        await tx.deal.update({ where: { id }, data: cancelData });
      });
    } else {
      const trade = deal.tradeInDeal;
      const tradeCycle =
        trade?.cycle && !trade.cycle.endedAt && openedBy(trade.cycle, trade) ? trade.cycle : null;
      if (trade && tradeCycle) await this.assertCycleIdle(tradeCycle.id, trade.vehicleId);
      await this.inTx(async (tx) => {
        if (deal.vehicle.status === 'RESERVED') {
          await this.updateVehicle(tx, deal.vehicleId, { status: 'IN_STOCK' }, audits);
        }
        if (trade) {
          await tx.dealPayment.deleteMany({
            where: { dealId: { in: [deal.id, trade.id] }, method: 'TRADE_IN' },
          });
          await tx.deal.update({
            where: { id: trade.id },
            data: { status: 'CANCELLED', cancelledAt: now },
          });
          if (tradeCycle) await this.cancelCycle(tx, tradeCycle, audits);
        }
        await tx.deal.update({ where: { id }, data: cancelData });
      });
    }
    await this.flush(audits, userId);
    return this.get(id);
  }

  /* ------------------------------------------------------------------------------------ */
  /* Payments                                                                             */
  /* ------------------------------------------------------------------------------------ */

  /**
   * Manual payment (not TRADE_IN) on a DRAFT / PENDING / COMPLETED deal. The contact defaults to
   * the counterparty, or the consignor for an OUT payment on a consignment sale.
   */
  async addPayment(
    id: string,
    dto: DealPaymentRequest,
    userId: string | null,
  ): Promise<DealDetail> {
    const deal = await this.prisma.deal.findUnique({
      where: { id },
      include: { cycle: { select: { consignorId: true } } },
    });
    if (!deal) throw AppException.notFound();
    if (deal.status === 'CANCELLED') throw AppException.conflict(ErrorKey.dealNotEditable);
    if (dto.contactId) await this.contacts.assertExists(dto.contactId, 'contactId');
    const contactId =
      dto.contactId ??
      (deal.type === 'CONSIGNMENT_SALE' && dto.direction === 'OUT'
        ? (deal.cycle?.consignorId ?? deal.counterpartyId)
        : deal.counterpartyId);
    const payment = await this.prisma.dealPayment.create({
      data: {
        dealId: id,
        direction: dto.direction,
        contactId,
        date: dbDate(dto.date),
        amount: toDbMoney(dto.amount),
        method: dto.method,
        reference: dto.reference ?? null,
        notes: dto.notes ?? null,
      },
    });
    await this.audit.record({
      userId,
      entity: 'DealPayment',
      entityId: payment.id,
      action: AuditAction.CREATE,
      after: payment,
    });
    return this.get(id);
  }

  /** Deletes a manual payment; TRADE_IN rows belong to the trade-in (`errors.systemPayment`). */
  async removePayment(paymentId: string): Promise<DealDetail> {
    const payment = await this.prisma.dealPayment.findUnique({
      where: { id: paymentId },
      include: { deal: { select: { status: true } } },
    });
    if (!payment) throw AppException.notFound();
    if (payment.method === 'TRADE_IN') throw AppException.conflict(ErrorKey.systemPayment);
    if (payment.deal.status === 'CANCELLED') throw AppException.conflict(ErrorKey.dealNotEditable);
    await this.prisma.dealPayment.delete({ where: { id: paymentId } });
    return this.get(payment.dealId);
  }

  /* ------------------------------------------------------------------------------------ */
  /* Ownership transfer                                                                   */
  /* ------------------------------------------------------------------------------------ */

  /** Merges the checklist and rolls the status up (see `rollUpTransfer`). */
  async updateTransfer(id: string, dto: DealTransferRequest): Promise<DealDetail> {
    const deal = await this.prisma.deal.findUnique({
      where: { id },
      include: { vehicle: { select: { isTaxi: true } } },
    });
    if (!deal) throw AppException.notFound();
    if (deal.status === 'CANCELLED') throw AppException.conflict(ErrorKey.dealNotEditable);
    const isTaxi = deal.vehicle.isTaxi;
    const checklist = mergeTransferChecklist(deal.transferChecklist, isTaxi, dto.checklist);
    const roll = rollUpTransfer({
      storedStatus: deal.transferStatus,
      storedTransferredAt: isoOrNull(deal.transferredAt),
      checklist,
      isTaxi,
      explicitStatus: dto.transferStatus,
      explicitTransferredAt: dto.transferredAt,
      today: this.clock.today(),
    });
    await this.prisma.deal.update({
      where: { id },
      data: {
        transferChecklist: checklist as Prisma.InputJsonObject,
        transferStatus: roll.status,
        transferredAt: roll.transferredAt ? dbDate(roll.transferredAt) : null,
      },
    });
    return this.get(id);
  }

  /* ------------------------------------------------------------------------------------ */
  /* Building blocks                                                                      */
  /* ------------------------------------------------------------------------------------ */

  private async row(id: string): Promise<DealRow> {
    const row = await this.prisma.deal.findUnique({ where: { id }, include: MUTATION_INCLUDE });
    if (!row) throw AppException.notFound();
    return row;
  }

  private async vehicleRow(id: string, field: string): Promise<Vehicle> {
    const row = await this.prisma.vehicle.findUnique({ where: { id } });
    if (!row) throw AppException.notFoundField(field);
    return row;
  }

  private openCycle(vehicleId: string, tx: Tx = this.prisma): Promise<InventoryCycle | null> {
    return tx.inventoryCycle.findFirst({ where: { vehicleId, endedAt: null } });
  }

  private async hasOpenSegment(vehicleId: string, tx: Tx = this.prisma): Promise<boolean> {
    return (await tx.leaseSegment.count({ where: { vehicleId, endDate: null } })) > 0;
  }

  /** No open lease segment and no other DRAFT / PENDING sale on the car. */
  private async assertSellable(vehicleId: string): Promise<void> {
    if (await this.hasOpenSegment(vehicleId)) throw AppException.conflict(ErrorKey.vehicleLeased);
    const pending = await this.prisma.deal.count({
      where: { vehicleId, type: { in: SALE_TYPES }, status: { in: OPEN_STATUSES } },
    });
    if (pending > 0) throw AppException.conflict(ErrorKey.dealPending);
  }

  /** A cycle about to be cancelled: no (non-cancelled) sale on it and the car not on a lease. */
  private async assertCycleIdle(cycleId: string, vehicleId: string): Promise<void> {
    const sales = await this.prisma.deal.count({
      where: { cycleId, type: { in: SALE_TYPES }, status: { not: 'CANCELLED' } },
    });
    if (sales > 0) throw AppException.conflict(ErrorKey.dealPending);
    if (await this.hasOpenSegment(vehicleId)) throw AppException.conflict(ErrorKey.vehicleLeased);
  }

  /**
   * Vehicle of a purchase / trade-in: by id or by plate (inline details). An open cycle is only
   * acceptable for a PURCHASE attaching to purchase-less OWNED stock (`allowAttach`); otherwise
   * 409 `errors.cycleOpen`. A car on an open lease segment cannot be bought.
   */
  private async resolveVehicle(
    input: DealVehicleInput,
    path: string,
    allowAttach: boolean,
  ): Promise<VehicleTarget> {
    let existing: Vehicle | null;
    if (input.id) {
      existing = await this.prisma.vehicle.findUnique({ where: { id: input.id } });
      if (!existing) throw AppException.notFoundField(`${path}.id`);
    } else {
      const create = input.create as DealVehicleCreate;
      existing = await this.prisma.vehicle.findUnique({ where: { plateNo: create.plateNo } });
      if (create.vin) {
        const other = await this.prisma.vehicle.findFirst({
          where: { vin: create.vin, ...(existing ? { id: { not: existing.id } } : {}) },
          select: { id: true },
        });
        if (other) throw AppException.duplicate(`${path}.create.vin`);
      }
    }
    let attach: InventoryCycle | null = null;
    if (existing) {
      const open = await this.openCycle(existing.id);
      if (open) {
        if (allowAttach && open.kind === 'OWNED' && !open.purchaseDealId) attach = open;
        else throw AppException.conflict(ErrorKey.cycleOpen);
      } else if (await this.hasOpenSegment(existing.id)) {
        throw AppException.conflict(ErrorKey.vehicleLeased);
      }
    }
    return { input, existing, attach };
  }

  /**
   * Creates the vehicle, relinks a known one (buy-back: IN_STOCK / OWNED, inline details
   * applied) or, when attaching to existing stock, only applies the inline details.
   */
  private async enterVehicle(tx: Tx, target: VehicleTarget, audits: Audits): Promise<Vehicle> {
    const create = target.input.create;
    if (!target.existing) {
      const c = create as DealVehicleCreate;
      const v = await tx.vehicle.create({
        data: {
          plateNo: c.plateNo,
          ...vehicleFields(c),
          isTaxi: c.isTaxi ?? false,
          status: 'IN_STOCK',
          ownership: 'OWNED',
        },
      });
      audits.push({ entity: 'Vehicle', entityId: v.id, action: AuditAction.CREATE, after: v });
      return v;
    }
    const data: Prisma.VehicleUncheckedUpdateInput = create ? vehicleFields(create) : {};
    if (!target.attach) {
      data.status = 'IN_STOCK';
      data.ownership = 'OWNED';
      data.ownerDriverId = null;
    }
    if (Object.values(data).every((v) => v === undefined)) return target.existing;
    return this.updateVehicle(tx, target.existing.id, data, audits);
  }

  /** Opens the OWNED cycle of a purchase (`createdAt` shared with the deal, see `openedBy`). */
  private async openPurchaseCycle(
    tx: Tx,
    vehicle: Vehicle,
    dealId: string,
    date: string,
    createdAt: Date,
    audits: Audits,
  ): Promise<InventoryCycle> {
    const cycle = await tx.inventoryCycle.create({
      data: {
        vehicleId: vehicle.id,
        kind: 'OWNED',
        startedAt: dbDate(date),
        askingPrice: vehicle.listingPrice,
        purchaseDealId: dealId,
        createdAt,
      },
    });
    await tx.deal.update({ where: { id: dealId }, data: { cycleId: cycle.id } });
    audits.push({
      entity: 'InventoryCycle',
      entityId: cycle.id,
      action: AuditAction.CREATE,
      after: cycle,
    });
    return cycle;
  }

  /**
   * A purchase's new date moves the start of the open cycle it opened; an attached (older)
   * stock cycle only moves back.
   */
  private async movePurchaseStart(tx: Tx, deal: DealRow, date: string): Promise<void> {
    const cycle = deal.cycle;
    if (!cycle || cycle.endedAt || cycle.purchaseDealId !== deal.id) return;
    if (openedBy(cycle, deal) || date < isoOf(cycle.startedAt)) {
      await tx.inventoryCycle.update({
        where: { id: cycle.id },
        data: { startedAt: dbDate(date) },
      });
    }
  }

  /** Carries a sale's date / buyer over to its trade-in purchase and the TRADE_IN payments. */
  private async syncTradeIn(
    tx: Tx,
    saleId: string,
    trade: TradeInRow,
    change: { date?: string; counterpartyId?: string },
  ): Promise<void> {
    const date = change.date ? dbDate(change.date) : undefined;
    await tx.deal.update({
      where: { id: trade.id },
      data: { date, counterpartyId: change.counterpartyId },
    });
    await tx.dealPayment.updateMany({
      where: { dealId: { in: [saleId, trade.id] }, method: 'TRADE_IN' },
      data: { date, contactId: change.counterpartyId },
    });
    if (date && trade.cycle && !trade.cycle.endedAt && openedBy(trade.cycle, trade)) {
      await tx.inventoryCycle.update({ where: { id: trade.cycle.id }, data: { startedAt: date } });
    }
  }

  /**
   * Ends a cycle as CANCELLED (zero length: it never really happened) and puts the car back:
   * the state after its latest other cycle, or EXTERNAL when it has none.
   */
  private async cancelCycle(tx: Tx, cycle: InventoryCycle, audits: Audits): Promise<void> {
    await tx.inventoryCycle.update({
      where: { id: cycle.id },
      data: { endedAt: cycle.startedAt, endReason: 'CANCELLED' },
    });
    const previous = await tx.inventoryCycle.findFirst({
      where: {
        vehicleId: cycle.vehicleId,
        id: { not: cycle.id },
        OR: [{ endReason: null }, { endReason: { not: 'CANCELLED' } }],
      },
      orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }],
    });
    let data: Prisma.VehicleUncheckedUpdateInput;
    if (!previous) data = { status: 'EXTERNAL' };
    else if (previous.endReason === 'SOLD') data = { status: 'SOLD', ownership: previous.kind };
    else if (previous.endReason === 'RETURNED_TO_CONSIGNOR') {
      data = { status: 'RETURNED', ownership: 'CONSIGNED' };
    } else if (previous.endReason === 'SCRAPPED') data = { status: 'SCRAPPED' };
    else return;
    await this.updateVehicle(tx, cycle.vehicleId, data, audits);
  }

  private async updateVehicle(
    tx: Tx,
    id: string,
    data: Prisma.VehicleUncheckedUpdateInput,
    audits: Audits,
  ): Promise<Vehicle> {
    const before = await tx.vehicle.findUniqueOrThrow({ where: { id } });
    const after = await tx.vehicle.update({ where: { id }, data });
    audits.push({ entity: 'Vehicle', entityId: id, action: AuditAction.UPDATE, before, after });
    return after;
  }

  private async inTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(fn, TX_OPTIONS);
    } catch (e) {
      rethrowConflict(e);
    }
  }

  private async flush(audits: Audits, userId: string | null): Promise<void> {
    for (const a of audits) await this.audit.record({ ...a, userId });
  }

  /* ------------------------------------------------------------------------------------ */
  /* Views                                                                                */
  /* ------------------------------------------------------------------------------------ */

  private toListItem(row: DealListRow, today: string, transferLead: number): DealListItem {
    const { vehicle, counterparty, payments, transferChecklist, ...deal } = row;
    const money = dealMoney(deal, payments);
    return {
      ...deal,
      vehicle,
      counterparty: { id: counterparty.id, name: contactDisplayName(counterparty) },
      transferChecklist: mergeTransferChecklist(transferChecklist, vehicle.isTaxi),
      ...money,
      alerts: dealAlerts(
        {
          type: deal.type,
          status: deal.status,
          hasDisclosure: !!deal.disclosureSignedAt,
          transferStatus: deal.transferStatus,
          transferDueAt: isoOrNull(deal.transferDueAt),
          balanceDue: money.balanceDue,
          payoutDue: money.payoutDue,
        },
        today,
        transferLead,
      ),
    };
  }

  private toDetail(row: DealDetailRow, today: string, transferLead: number): DealDetail {
    const { cycle, tradeInDeal, tradeInFor, _count, payments, ...rest } = row;
    const sums = payments.map((p) => ({
      direction: p.direction,
      method: p.method,
      amount: p.amount,
    }));
    const item = this.toListItem({ ...rest, payments: sums }, today, transferLead);
    const purchase =
      cycle?.kind === 'OWNED' && cycle.purchaseDeal && cycle.purchaseDeal.status !== 'CANCELLED'
        ? cycle.purchaseDeal
        : null;
    return {
      ...item,
      cycle: cycle
        ? {
            id: cycle.id,
            kind: cycle.kind,
            startedAt: cycle.startedAt,
            endedAt: cycle.endedAt,
            endReason: cycle.endReason,
            purchasePrice: purchase?.price ?? null,
            askingPrice: cycle.askingPrice,
            consignor: contactRef(cycle.consignor),
            commissionMode: cycle.commissionMode,
            commissionValue: cycle.commissionValue,
            minNetToConsignor: cycle.minNetToConsignor,
          }
        : null,
      tradeInDeal: tradeInDeal ?? null,
      tradeInFor: tradeInFor ?? null,
      payments: payments.map(({ contact, ...p }) => ({ ...p, contact: contactRef(contact) })),
      vat: dealVat(
        row.vatMode,
        row.vatRate,
        row.price,
        row.type === 'SALE' ? (purchase?.price ?? null) : null,
      ),
      documentCount: _count.documents,
    };
  }

  private buildWhere(
    q: DealSummaryQuery & { status?: DealQuery['status'] },
    today: string,
  ): Prisma.DealWhereInput {
    const and: Prisma.DealWhereInput[] = [];
    if (q.type?.length) and.push({ type: { in: q.type } });
    if (q.status?.length) and.push({ status: { in: q.status } });
    if (q.vehicleId) and.push({ vehicleId: q.vehicleId });
    if (q.counterpartyId) and.push({ counterpartyId: q.counterpartyId });
    let { from, to } = q;
    if (from && to && from > to) [from, to] = [to, from];
    if (from || to) {
      and.push({
        date: { gte: from ? dbDate(from) : undefined, lte: to ? dbDate(to) : undefined },
      });
    }
    if (q.transferOverdue) {
      and.push({
        type: { in: SALE_TYPES },
        status: 'COMPLETED',
        transferStatus: { not: 'DONE' },
        transferDueAt: { lt: dbDate(today) },
      });
    }
    for (const token of searchTokens(q.q)) {
      const text = { contains: token, mode: 'insensitive' as const };
      const or: Prisma.DealWhereInput[] = [
        { counterparty: { firstName: text } },
        { counterparty: { lastName: text } },
        { counterparty: { companyName: text } },
        { vehicle: { make: text } },
        { vehicle: { model: text } },
      ];
      const digits = token.replace(/^#/, '');
      if (/^\d{1,9}$/.test(digits)) or.push({ dealNo: Number(digits) });
      const plate = normalizePlate(token);
      if (/^\d{2,8}$/.test(plate)) or.push({ vehicle: { plateNo: { contains: plate } } });
      const phone = normalizePhone(token);
      if (/^\d{9,10}$/.test(phone)) or.push({ counterparty: { phones: { has: phone } } });
      and.push({ OR: or });
    }
    return and.length ? { AND: and } : {};
  }
}
