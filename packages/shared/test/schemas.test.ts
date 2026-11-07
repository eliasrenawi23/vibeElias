import { describe, expect, it } from 'vitest';
import {
  ConsignSchema,
  ContactCreateSchema,
  DEFAULT_REMINDER_LEAD_DAYS,
  DEFAULT_SETTINGS,
  DealCreateSchema,
  DocumentCreateSchema,
  DriverCreateSchema,
  InsuranceCreateSchema,
  LeaseActivateSchema,
  LeaseCreateSchema,
  LeaseDepositActionSchema,
  LeaseSegmentCreateSchema,
  LoginSchema,
  MeUpdateSchema,
  SettingsSchema,
  SettingsUpdateSchema,
  VehicleCreateSchema,
  VehicleQuerySchema,
  VehicleUpdateSchema,
  createHandoverChecklist,
  createTransferChecklist,
  isTransferChecklistComplete,
  msg,
} from '../src/index.js';

describe('auth', () => {
  it('normalises the login email', () => {
    expect(LoginSchema.parse({ email: ' Admin@Renawi.LOCAL ', password: 'x' }).email).toBe(
      'admin@renawi.local',
    );
  });

  it('requires the current password to set a new one', () => {
    const r = MeUpdateSchema.safeParse({ newPassword: 'NewPass123' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(['currentPassword']);
    expect(
      MeUpdateSchema.safeParse({ currentPassword: 'old', newPassword: 'NewPass123' }).success,
    ).toBe(true);
    expect(
      MeUpdateSchema.safeParse({ currentPassword: 'old', newPassword: 'short1' }).success,
    ).toBe(false);
    expect(
      MeUpdateSchema.safeParse({ currentPassword: 'old', newPassword: 'lettersonly' }).success,
    ).toBe(false);
    expect(MeUpdateSchema.parse({ locale: 'ar', theme: 'dark' })).toEqual({
      locale: 'ar',
      theme: 'dark',
    });
  });
});

describe('settings', () => {
  it('accepts the defaults and keeps the plan lead days', () => {
    expect(SettingsSchema.parse(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_REMINDER_LEAD_DAYS).toEqual({
      registration: 30,
      insurance: 30,
      driverLicense: 60,
      taxiPermit: 60,
      medical: 60,
      taxiLicense: 60,
      lease: 30,
      document: 30,
      dealerRegistration: 30,
      transfer: 2,
    });
    expect(DEFAULT_SETTINGS.defaultLeaseTerms.responsibilities).toEqual({
      insurance: 'DRIVER',
      test: 'DRIVER',
      repairs: 'DRIVER',
      fines: 'DRIVER',
    });
  });

  it('validates partial updates', () => {
    expect(SettingsUpdateSchema.parse({ vatRate: 17 })).toEqual({ vatRate: 17 });
    expect(SettingsUpdateSchema.safeParse({ vatRate: 101 }).success).toBe(false);
    expect(SettingsUpdateSchema.safeParse({ legalId: '123456789' }).success).toBe(false);
    expect(SettingsUpdateSchema.parse({ legalId: '520013954', phone: '' })).toEqual({
      legalId: '520013954',
      phone: null,
    });
  });
});

describe('contact & driver', () => {
  it('needs some name and normalises phones', () => {
    expect(ContactCreateSchema.safeParse({}).error?.issues[0]?.message).toBe(msg.nameRequired);
    const c = ContactCreateSchema.parse({
      firstName: 'Ahmad',
      phones: ['+972-50-1234567'],
      email: '',
    });
    expect(c.phones).toEqual(['0501234567']);
    expect(c.email).toBeNull();
    expect(c.tags).toEqual([]);
    expect(c.preferredLang).toBe('he');
  });

  it('driver needs exactly one of contactId / contact', () => {
    expect(DriverCreateSchema.safeParse({}).success).toBe(false);
    expect(DriverCreateSchema.safeParse({ contactId: 'c1' }).success).toBe(true);
    expect(DriverCreateSchema.safeParse({ contact: { lastName: 'Cohen' } }).success).toBe(true);
    expect(
      DriverCreateSchema.safeParse({ contactId: 'c1', contact: { lastName: 'Cohen' } }).success,
    ).toBe(false);
  });
});

describe('vehicle', () => {
  const base = { plateNo: '12-345-67', make: 'Toyota', model: 'Corolla', year: 2020 };

  it('applies defaults and canonical plate', () => {
    expect(VehicleCreateSchema.parse(base)).toMatchObject({
      plateNo: '1234567',
      isTaxi: false,
      status: 'IN_STOCK',
      ownership: 'OWNED',
    });
  });

  it('requires an owner driver for THIRD_PARTY cars', () => {
    expect(VehicleCreateSchema.safeParse({ ...base, ownership: 'THIRD_PARTY' }).success).toBe(
      false,
    );
    expect(
      VehicleCreateSchema.safeParse({ ...base, ownership: 'THIRD_PARTY', ownerDriverId: 'd1' })
        .success,
    ).toBe(true);
    expect(VehicleUpdateSchema.safeParse({ ownership: 'THIRD_PARTY' }).success).toBe(true);
    expect(VehicleUpdateSchema.parse({})).toEqual({});
  });

  it('parses list queries from strings', () => {
    expect(
      VehicleQuerySchema.parse({
        page: '2',
        status: 'IN_STOCK,SOLD',
        isTaxi: 'true',
        q: ' corolla ',
      }),
    ).toEqual({
      page: 2,
      pageSize: 25,
      order: 'desc',
      status: ['IN_STOCK', 'SOLD'],
      isTaxi: true,
      q: 'corolla',
    });
    expect(VehicleQuerySchema.parse({ status: ['LEASED', 'SOLD'] }).status).toEqual([
      'LEASED',
      'SOLD',
    ]);
    expect(VehicleQuerySchema.safeParse({ status: 'FLYING' }).success).toBe(false);
  });

  it('checks insurance scope rules', () => {
    const policy = {
      type: 'COMPULSORY',
      insurer: 'Harel',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    };
    expect(InsuranceCreateSchema.safeParse(policy).success).toBe(true);
    expect(InsuranceCreateSchema.safeParse({ ...policy, endDate: '2025-12-31' }).success).toBe(
      false,
    );
    expect(InsuranceCreateSchema.safeParse({ ...policy, type: 'LOT' }).success).toBe(false);
    expect(
      InsuranceCreateSchema.safeParse({ ...policy, type: 'LOT', scope: 'BUSINESS' }).success,
    ).toBe(true);
  });

  it('checks consignment commission rules', () => {
    const c = { consignorId: 'c1', askingPrice: 50000 };
    expect(ConsignSchema.safeParse({ ...c, commissionMode: 'SURPLUS' }).success).toBe(false);
    expect(
      ConsignSchema.safeParse({ ...c, commissionMode: 'SURPLUS', minNetToConsignor: 45000 })
        .success,
    ).toBe(true);
    expect(
      ConsignSchema.safeParse({ ...c, commissionMode: 'PERCENT', commissionValue: 150 }).success,
    ).toBe(false);
    expect(
      ConsignSchema.safeParse({ ...c, commissionMode: 'FIXED', commissionValue: 3000 }).success,
    ).toBe(true);
  });
});

describe('lease', () => {
  const draft = {
    driverId: 'd1',
    type: 'CAR_AND_NUMBER',
    startDate: '2026-11-16',
    endDate: '2027-11-15',
  };

  it('applies draft defaults', () => {
    expect(LeaseCreateSchema.parse(draft)).toMatchObject({
      billingPeriod: 'MONTHLY',
      paymentDay: 1,
      rentIncludesVat: true,
      earlyExitPenaltyMonths: 1,
      depositAmount: 0,
      depositKind: 'CASH',
    });
  });

  it('rejects bad ranges, weekly billing and payment days past 28', () => {
    expect(
      LeaseCreateSchema.safeParse({ ...draft, endDate: '2026-11-16' }).error?.issues[0]?.message,
    ).toBe(msg.endBeforeStart);
    expect(LeaseCreateSchema.safeParse({ ...draft, billingPeriod: 'WEEKLY' }).success).toBe(false);
    expect(LeaseCreateSchema.safeParse({ ...draft, paymentDay: 31 }).success).toBe(false);
  });

  it('activation and segments', () => {
    expect(LeaseActivateSchema.safeParse({ taxiLicenseId: 't1', monthlyRent: 1400 }).success).toBe(
      true,
    );
    expect(
      LeaseActivateSchema.parse({
        taxiLicenseId: 't1',
        monthlyRent: 1400,
        deposit: { amount: 5000 },
      }).deposit,
    ).toEqual({ amount: 5000, kind: 'CASH' });
    expect(LeaseSegmentCreateSchema.safeParse({ startDate: '2026-12-10' }).success).toBe(false);
    expect(
      LeaseSegmentCreateSchema.safeParse({ startDate: '2026-12-10', vehicleId: 'v2' }).success,
    ).toBe(true);
  });

  it('deposit actions are a discriminated union', () => {
    expect(
      LeaseDepositActionSchema.parse({ action: 'OUT', amount: 5000, date: '2027-11-15' }),
    ).toMatchObject({ action: 'OUT', method: 'CASH' });
    expect(
      LeaseDepositActionSchema.safeParse({ action: 'IN', amount: 5000, date: '2026-11-16' })
        .success,
    ).toBe(false);
    expect(
      LeaseDepositActionSchema.safeParse({ action: 'TAKE', amount: 1, date: '2026-11-16' }).success,
    ).toBe(false);
  });
});

describe('deal', () => {
  const sale = {
    type: 'SALE',
    vehicleId: 'v1',
    counterpartyId: 'c1',
    date: '2026-11-05',
    price: 60000,
  };

  it('accepts a sale with a trade-in', () => {
    const tradeIn = {
      tradeInValue: 20000,
      vehicle: { plateNo: '123-45-678', make: 'Kia', model: 'Picanto', year: 2017 },
    };
    const d = DealCreateSchema.parse({ ...sale, tradeIn });
    expect(d.tradeIn?.vehicle?.plateNo).toBe('12345678');
    expect(
      DealCreateSchema.safeParse({ ...sale, tradeIn: { ...tradeIn, tradeInValue: 70000 } }).success,
    ).toBe(false);
  });

  it('enforces vehicle and trade-in rules per type', () => {
    expect(DealCreateSchema.safeParse({ ...sale, vehicleId: undefined }).success).toBe(false);
    const purchase = { ...sale, type: 'PURCHASE', vehicleId: undefined };
    expect(DealCreateSchema.safeParse(purchase).success).toBe(false);
    expect(
      DealCreateSchema.safeParse({
        ...purchase,
        vehicle: { plateNo: '1234567', make: 'Skoda', model: 'Octavia', year: 2019 },
      }).success,
    ).toBe(true);
    const r = DealCreateSchema.safeParse({
      ...purchase,
      vehicleId: 'v1',
      tradeIn: { vehicleId: 'v2', tradeInValue: 1000 },
    });
    expect(r.error?.issues.map((i) => i.message)).toContain(msg.tradeInSaleOnly);
  });
});

describe('documents', () => {
  it('needs exactly one owner', () => {
    expect(DocumentCreateSchema.safeParse({ kind: 'PHOTO' }).success).toBe(false);
    expect(
      DocumentCreateSchema.safeParse({ kind: 'PHOTO', vehicleId: 'v1', dealId: 'd1' }).success,
    ).toBe(false);
    expect(
      DocumentCreateSchema.parse({ kind: 'INSURANCE', vehicleId: 'v1', expiresAt: '', lang: '' }),
    ).toMatchObject({ kind: 'INSURANCE', vehicleId: 'v1', expiresAt: null, lang: null });
  });
});

describe('checklists', () => {
  it('creates empty checklists', () => {
    const t = createTransferChecklist();
    expect(t.idCopies).toBe(false);
    expect(t.transferFee).toBeNull();
    expect(createHandoverChecklist()).toMatchObject({
      photosTaken: false,
      km: null,
      fuelLevel: null,
    });
  });

  it('ignores the taxi item for regular cars', () => {
    const done = {
      ...createTransferChecklist(),
      idCopies: true,
      vehicleLicenseSigned: true,
      liensChecked: true,
      finesChecked: true,
      transferFiled: true,
      newLicenseReceived: true,
      insuranceHandled: true,
    };
    expect(isTransferChecklistComplete(done, false)).toBe(true);
    expect(isTransferChecklistComplete(done, true)).toBe(false);
    expect(isTransferChecklistComplete(null, false)).toBe(false);
  });
});
