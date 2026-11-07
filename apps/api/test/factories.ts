import { addDays, addMonths, addPeriods, daysInMonth, periodOf } from '@renawi/shared';
import type { Session } from './helpers';
import { today } from './helpers';

/* Response shapes used by the lease-domain suites (wire form). */
export interface Ref {
  id: string;
  [key: string]: unknown;
}
export interface BalanceBody {
  charged: number;
  paid: number;
  credited: number;
  balance: number;
  depositHeld: number;
}
export interface LedgerEntryBody {
  id: string;
  type: string;
  chargeKind: string | null;
  rentPeriod: string | null;
  segmentId: string | null;
  contractId: string | null;
  vehicleId: string | null;
  taxiLicenseId: string | null;
  date: string;
  dueDate: string | null;
  amount: number;
  method: string | null;
  reference: string | null;
  description: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  allocated: number | null;
  remaining: number | null;
  runningBalance?: number;
  driver: { id: string; name: string };
}
export interface SegmentBody {
  id: string;
  taxiLicense: { id: string; licenseNo: string };
  vehicle: { id: string; plateNo: string } | null;
  monthlyRent: number;
  startDate: string;
  endDate?: string | null;
  reason?: string | null;
}
export interface LeaseBody {
  id: string;
  contractNo: number;
  driverId: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  actualEndDate: string | null;
  endReason: string | null;
  paymentDay: number;
  depositAmount: number;
  responsibilities: Record<string, string>;
  handoverChecklist: Record<string, unknown> | null;
  returnChecklist: Record<string, unknown> | null;
  terms: string | null;
  notes: string | null;
  terminationNote: string | null;
  renewedFromId: string | null;
  signedAt: string | null;
  driver: { id: string; name: string };
  currentSegment: SegmentBody | null;
  segments: SegmentBody[];
  balance: BalanceBody;
  openCharges: {
    id: string;
    chargeKind: string;
    rentPeriod: string | null;
    dueDate: string;
    amount: number;
    remaining: number;
  }[];
  lastPayment: { date: string; amount: number } | null;
  renewedFrom: { id: string; contractNo: number } | null;
  renewedTo: { id: string; contractNo: number } | null;
  documentCount: number;
  alerts: string[];
}

/** The latest month before the current one that has 31 days (`YYYY-MM`). */
export function last31DayMonthBefore(period: string = periodOf(today())): string {
  let p = addPeriods(period, -1);
  while (daysInMonth(p) !== 31) p = addPeriods(p, -1);
  return p;
}

/** Contract end one year after the start (inclusive). */
export function yearAfter(start: string): string {
  return addDays(addMonths(start, 12), -1);
}

/** Creates vehicles, licences, drivers and leases through the API with unique numbers. */
export class Factory {
  private plateSeq: number;
  private licenseSeq: number;
  private personSeq = 0;

  constructor(
    private readonly s: Session,
    seed: number,
  ) {
    this.plateSeq = 6_000_000 + seed * 10_000;
    this.licenseSeq = 70_000 + seed * 1_000;
  }

  private async ok<T>(res: { status: number; body: unknown }, status = 201): Promise<T> {
    expect({ status: res.status, body: res.status === status ? 'ok' : res.body }).toEqual({
      status,
      body: 'ok',
    });
    return res.body as T;
  }

  nextPlate(): string {
    this.plateSeq += 3;
    return String(this.plateSeq);
  }

  /** One of our taxis, IN_STOCK (opens an OWNED cycle). */
  async taxi(body: Record<string, unknown> = {}): Promise<Ref & { plateNo: string }> {
    return this.ok(
      await this.s.api.post('/api/vehicles').send({
        plateNo: this.nextPlate(),
        make: 'Toyota',
        model: 'Corolla',
        year: 2023,
        isTaxi: true,
        ...body,
      }),
    );
  }

  /** A driver's own car (THIRD_PARTY, EXTERNAL). */
  async driverCar(driverId: string, body: Record<string, unknown> = {}) {
    return this.taxi({
      ownership: 'THIRD_PARTY',
      status: 'EXTERNAL',
      ownerDriverId: driverId,
      make: 'Kia',
      model: 'Niro',
      ...body,
    });
  }

  async license(body: Record<string, unknown> = {}): Promise<Ref & { licenseNo: string }> {
    this.licenseSeq += 1;
    return this.ok(
      await this.s.api
        .post('/api/taxi-licenses')
        .send({ licenseNo: String(this.licenseSeq), ...body }),
    );
  }

  async driver(body: Record<string, unknown> = {}): Promise<Ref & { name: string }> {
    this.personSeq += 1;
    return this.ok(
      await this.s.api.post('/api/drivers').send({
        contact: { firstName: 'נהג', lastName: `בדיקה ${this.personSeq}` },
        ...body,
      }),
    );
  }

  /** DRAFT lease (CAR_AND_NUMBER on a new taxi + licence unless given). */
  async draft(body: Record<string, unknown> = {}): Promise<LeaseBody> {
    const driverId = (body.driverId as string | undefined) ?? (await this.driver()).id;
    const type = (body.type as string | undefined) ?? 'CAR_AND_NUMBER';
    const taxiLicenseId = (body.taxiLicenseId as string | undefined) ?? (await this.license()).id;
    const vehicleId =
      'vehicleId' in body
        ? body.vehicleId
        : type === 'CAR_AND_NUMBER'
          ? (await this.taxi()).id
          : undefined;
    const startDate = (body.startDate as string | undefined) ?? today();
    return this.ok(
      await this.s.api.post('/api/leases').send({
        type,
        endDate: yearAfter(startDate),
        monthlyRent: 6000,
        paymentDay: 10,
        ...body,
        driverId,
        taxiLicenseId,
        vehicleId,
        startDate,
      }),
    );
  }

  async activate(id: string, body: Record<string, unknown> = {}): Promise<LeaseBody> {
    return this.ok(await this.s.api.post(`/api/leases/${id}/activate`).send(body), 200);
  }

  /** Draft + activation in one go. */
  async activeLease(
    body: Record<string, unknown> = {},
    activation: Record<string, unknown> = {},
  ): Promise<LeaseBody> {
    const draft = await this.draft(body);
    return this.activate(draft.id, activation);
  }

  async ledger(
    driverId: string,
    query = '',
  ): Promise<{
    items: LedgerEntryBody[];
    openingBalance: number;
    closingBalance: number;
    balance: number;
    depositHeld: number;
  }> {
    const res = await this.s.api.get(`/api/drivers/${driverId}/ledger${query}`);
    return this.ok(res, 200);
  }

  async lease(id: string): Promise<LeaseBody> {
    return this.ok(await this.s.api.get(`/api/leases/${id}`), 200);
  }
}
