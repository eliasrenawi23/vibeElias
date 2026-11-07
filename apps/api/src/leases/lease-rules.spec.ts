import { driverAlerts } from '../drivers/drivers.service';
import { fineAlerts } from '../fines/fines.service';
import { taxiLicenseAlerts } from '../taxi-licenses/taxi-licenses.service';
import {
  depositMethodOf,
  leaseAlerts,
  leaseVehicleProblem,
  statusAfterEnd,
  type LeaseVehicleFacts,
} from './lease-rules';

const T = '2026-11-07';

describe('leaseVehicleProblem', () => {
  const taxi: LeaseVehicleFacts = {
    isTaxi: true,
    ownership: 'OWNED',
    status: 'IN_STOCK',
    year: 2020,
    ownerDriverId: null,
  };

  it('accepts one of our taxis in stock for CAR_AND_NUMBER', () => {
    expect(leaseVehicleProblem('CAR_AND_NUMBER', taxi, 'd1', T, true)).toBeNull();
    // Renewals keep the leased car.
    expect(
      leaseVehicleProblem('CAR_AND_NUMBER', { ...taxi, status: 'LEASED' }, 'd1', T, false),
    ).toBeNull();
  });

  it('refuses cars that are not ours, not taxis or not in stock', () => {
    for (const v of [
      { ...taxi, isTaxi: false },
      { ...taxi, ownership: 'CONSIGNED' as const },
      { ...taxi, status: 'LEASED' as const },
    ]) {
      expect(leaseVehicleProblem('CAR_AND_NUMBER', v, 'd1', T, true)).toBe(
        'errors.vehicleNotAvailable',
      );
    }
  });

  it('applies the 12-year rule (10 years is only a warning)', () => {
    expect(leaseVehicleProblem('CAR_AND_NUMBER', { ...taxi, year: 2016 }, 'd1', T, true)).toBe(
      null,
    );
    expect(leaseVehicleProblem('CAR_AND_NUMBER', { ...taxi, year: 2014 }, 'd1', T, true)).toBe(
      'errors.taxiAgeBlocked',
    );
  });

  it('NUMBER_ONLY needs the driver own THIRD_PARTY car', () => {
    const own = { ...taxi, ownership: 'THIRD_PARTY' as const, status: 'EXTERNAL' as const };
    expect(leaseVehicleProblem('NUMBER_ONLY', { ...own, ownerDriverId: 'd1' }, 'd1', T, true)).toBe(
      null,
    );
    expect(leaseVehicleProblem('NUMBER_ONLY', { ...own, ownerDriverId: 'd2' }, 'd1', T, true)).toBe(
      'errors.vehicleNotAvailable',
    );
    expect(leaseVehicleProblem('NUMBER_ONLY', taxi, 'd1', T, true)).toBe(
      'errors.vehicleNotAvailable',
    );
  });
});

describe('lease alerts and end rules', () => {
  it('flags drafts, contracts ending soon / past their end and overdue charges', () => {
    expect(leaseAlerts({ status: 'DRAFT', endDate: '2027-11-01', overdue: false }, T, 30)).toEqual([
      'draft',
    ]);
    expect(leaseAlerts({ status: 'ACTIVE', endDate: '2026-12-01', overdue: true }, T, 30)).toEqual([
      'endingSoon',
      'overdue',
    ]);
    expect(leaseAlerts({ status: 'ACTIVE', endDate: '2026-11-06', overdue: false }, T, 30)).toEqual(
      ['ended'],
    );
    expect(leaseAlerts({ status: 'ENDED', endDate: '2026-11-06', overdue: false }, T, 30)).toEqual(
      [],
    );
  });

  it('maps end reasons to statuses and deposit kinds to methods', () => {
    expect(statusAfterEnd('EXPIRED')).toBe('ENDED');
    expect(statusAfterEnd('OTHER')).toBe('ENDED');
    expect(statusAfterEnd('TERMINATED_BY_DRIVER')).toBe('TERMINATED');
    expect(statusAfterEnd('TERMINATED_BY_US')).toBe('TERMINATED');
    expect(depositMethodOf('CASH')).toBe('CASH');
    expect(depositMethodOf('CHECK')).toBe('CHECK');
    expect(depositMethodOf('PROMISSORY_NOTE')).toBeNull();
  });
});

describe('licence, driver and fine alerts', () => {
  it('taxi licence: fee / renewal due or overdue, idle', () => {
    expect(
      taxiLicenseAlerts(
        { status: 'ACTIVE', annualFeeDueAt: '2026-12-31', renewalAt: null, hasOpenSegment: false },
        T,
        60,
      ),
    ).toEqual(['annualFeeDue', 'idle']);
    expect(
      taxiLicenseAlerts(
        {
          status: 'ACTIVE',
          annualFeeDueAt: '2026-11-01',
          renewalAt: '2026-11-20',
          hasOpenSegment: true,
        },
        T,
        60,
      ),
    ).toEqual(['annualFeeOverdue', 'renewalDue']);
    expect(
      taxiLicenseAlerts(
        { status: 'SOLD', annualFeeDueAt: '2026-11-01', renewalAt: null, hasOpenSegment: false },
        T,
        60,
      ),
    ).toEqual([]);
  });

  it('driver: document expiries by lead days and overdue', () => {
    const lead = { driverLicense: 60, taxiPermit: 60, medical: 30 };
    expect(
      driverAlerts(
        {
          status: 'ACTIVE',
          licenseExpiry: '2026-11-01',
          taxiPermitExpiry: '2026-12-01',
          medicalExpiry: '2026-12-20',
        },
        T,
        lead,
        true,
      ),
    ).toEqual(['licenseExpired', 'taxiPermitExpiring', 'overdue']);
    expect(
      driverAlerts(
        {
          status: 'INACTIVE',
          licenseExpiry: '2026-11-01',
          taxiPermitExpiry: null,
          medicalExpiry: null,
        },
        T,
        lead,
        false,
      ),
    ).toEqual([]);
  });

  it('fine: reassignment deadline due within 14 days or overdue (NEW only)', () => {
    expect(fineAlerts('NEW', '2026-11-20', T)).toEqual(['reassignDueSoon']);
    expect(fineAlerts('NEW', '2026-11-06', T)).toEqual(['reassignOverdue']);
    expect(fineAlerts('NEW', '2026-12-30', T)).toEqual([]);
    expect(fineAlerts('REASSIGN_SUBMITTED', '2026-11-06', T)).toEqual([]);
  });
});
