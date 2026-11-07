import { checkStatusTransition, vehicleAlerts, type VehicleAlertInput } from './vehicle-rules';

const none = { hasOpenSegment: false };

describe('checkStatusTransition', () => {
  it('allows the manual transitions of the plan', () => {
    expect(checkStatusTransition('IN_STOCK', 'RESERVED', none)).toEqual({
      ok: true,
      noop: false,
      effect: 'none',
    });
    expect(checkStatusTransition('RESERVED', 'IN_STOCK', none)).toMatchObject({ ok: true });
    expect(checkStatusTransition('LEASED', 'IN_STOCK', none)).toMatchObject({ ok: true });
    expect(checkStatusTransition('IN_STOCK', 'SCRAPPED', none)).toEqual({
      ok: true,
      noop: false,
      effect: 'closeCycleScrapped',
    });
    expect(checkStatusTransition('EXTERNAL', 'IN_STOCK', none)).toEqual({
      ok: true,
      noop: false,
      effect: 'openOwnedCycle',
    });
  });

  it('treats the same status as a no-op', () => {
    expect(checkStatusTransition('RESERVED', 'RESERVED', none)).toEqual({
      ok: true,
      noop: true,
      effect: 'none',
    });
  });

  it('never sets SOLD (sales come from deals)', () => {
    for (const from of ['IN_STOCK', 'RESERVED', 'LEASED', 'EXTERNAL'] as const) {
      expect(checkStatusTransition(from, 'SOLD', none)).toEqual({
        ok: false,
        error: 'errors.useDeal',
      });
    }
  });

  it('rejects transitions outside the table', () => {
    const invalid = [
      ['IN_STOCK', 'LEASED'],
      ['RESERVED', 'SCRAPPED'],
      ['SOLD', 'IN_STOCK'],
      ['SCRAPPED', 'IN_STOCK'],
      ['RETURNED', 'IN_STOCK'],
      ['IN_STOCK', 'EXTERNAL'],
      ['LEASED', 'RESERVED'],
    ] as const;
    for (const [from, to] of invalid) {
      expect(checkStatusTransition(from, to, none)).toEqual({
        ok: false,
        error: 'errors.invalidTransition',
      });
    }
  });

  it('keeps a leased car leased while a lease segment is open', () => {
    expect(checkStatusTransition('LEASED', 'IN_STOCK', { hasOpenSegment: true })).toEqual({
      ok: false,
      error: 'errors.vehicleLeased',
    });
  });
});

describe('vehicleAlerts', () => {
  const today = '2026-11-07';
  const base: VehicleAlertInput = {
    year: 2022,
    isTaxi: false,
    status: 'IN_STOCK',
    registrationExpiry: null,
    dealerRegisteredAt: null,
  };

  it('returns nothing for a healthy car', () => {
    expect(vehicleAlerts({ ...base, registrationExpiry: '2027-05-01' }, today, 30)).toEqual([]);
  });

  it('flags expired and expiring registrations using the lead days', () => {
    expect(vehicleAlerts({ ...base, registrationExpiry: '2026-11-06' }, today, 30)).toEqual([
      'registrationExpired',
    ]);
    expect(vehicleAlerts({ ...base, registrationExpiry: '2026-11-07' }, today, 30)).toEqual([
      'registrationExpiring',
    ]);
    expect(vehicleAlerts({ ...base, registrationExpiry: '2026-12-07' }, today, 30)).toEqual([
      'registrationExpiring',
    ]);
    expect(vehicleAlerts({ ...base, registrationExpiry: '2026-12-08' }, today, 30)).toEqual([]);
    expect(vehicleAlerts({ ...base, registrationExpiry: '2026-12-08' }, today, 31)).toEqual([
      'registrationExpiring',
    ]);
  });

  it('flags 11 months on dealer registration', () => {
    expect(vehicleAlerts({ ...base, dealerRegisteredAt: '2025-12-08' }, today, 30)).toEqual([]);
    expect(vehicleAlerts({ ...base, dealerRegisteredAt: '2025-12-07' }, today, 30)).toEqual([
      'dealerRegistration11Months',
    ]);
    expect(vehicleAlerts({ ...base, dealerRegisteredAt: '2025-01-01' }, today, 30)).toEqual([
      'dealerRegistration11Months',
    ]);
  });

  it('applies the taxi age rules only to taxis', () => {
    expect(vehicleAlerts({ ...base, year: 2016 }, today, 30)).toEqual([]);
    expect(vehicleAlerts({ ...base, year: 2016, isTaxi: true }, today, 30)).toEqual(['taxiAge10']);
    expect(vehicleAlerts({ ...base, year: 2015, isTaxi: true }, today, 30)).toEqual([
      'taxiAge10',
      'taxiAgeNearLimit',
    ]);
    expect(vehicleAlerts({ ...base, year: 2014, isTaxi: true }, today, 30)).toEqual([
      'taxiAge10',
      'taxiAgeBlocked',
    ]);
    expect(vehicleAlerts({ ...base, year: 2017, isTaxi: true }, today, 30)).toEqual([]);
  });

  it('is silent for cars that left us', () => {
    for (const status of ['SOLD', 'SCRAPPED', 'RETURNED'] as const) {
      expect(
        vehicleAlerts(
          { ...base, status, isTaxi: true, year: 2010, registrationExpiry: '2020-01-01' },
          today,
          30,
        ),
      ).toEqual([]);
    }
  });

  it('still warns about third-party taxis (licence registered on the driver car)', () => {
    expect(
      vehicleAlerts(
        { ...base, status: 'EXTERNAL', isTaxi: true, year: 2016, registrationExpiry: '2026-11-20' },
        today,
        30,
      ),
    ).toEqual(['registrationExpiring', 'taxiAge10']);
  });
});
