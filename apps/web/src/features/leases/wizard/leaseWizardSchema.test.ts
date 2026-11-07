import { installValidationErrorMap } from '@renawi/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  defaultWizardValues,
  firstInvalidStep,
  LeaseWizardSchema,
  toLeaseCreateBody,
  validateLeaseStep,
  VEHICLE_REQUIRED_MESSAGE,
  type LeaseWizardInput,
} from './leaseWizardSchema';

beforeAll(() => installValidationErrorMap());

const TODAY = '2026-11-07';

function values(over: Partial<LeaseWizardInput> = {}): LeaseWizardInput {
  return { ...defaultWizardValues('drv_1', TODAY), ...over };
}

const paths = (issues: { path: string }[]) => issues.map((i) => i.path);

describe('lease wizard step validation', () => {
  it('needs a driver on the first step', () => {
    expect(paths(validateLeaseStep('driver', values({ driverId: '' })))).toEqual(['driverId']);
    expect(validateLeaseStep('driver', values())).toEqual([]);
  });

  it('cannot continue without a licence', () => {
    const issues = validateLeaseStep('license', values());
    expect(issues).toEqual([{ path: 'taxiLicenseId', message: 'validation.required' }]);
    expect(validateLeaseStep('license', values({ taxiLicenseId: 'tl_1' }))).toEqual([]);
  });

  it('requires the car for a car + licence lease, not for a licence-only lease', () => {
    const car = validateLeaseStep('vehicle', values({ type: 'CAR_AND_NUMBER', vehicleId: null }));
    expect(car).toEqual([{ path: 'vehicleId', message: VEHICLE_REQUIRED_MESSAGE }]);
    expect(
      validateLeaseStep('vehicle', values({ type: 'CAR_AND_NUMBER', vehicleId: 'veh_1' })),
    ).toEqual([]);
    expect(validateLeaseStep('vehicle', values({ type: 'NUMBER_ONLY', vehicleId: null }))).toEqual(
      [],
    );
  });

  it('only checks the fields of the current step', () => {
    // Rent (terms step) is still empty: the licence step does not care.
    expect(validateLeaseStep('license', values({ taxiLicenseId: 'tl_1' }))).toEqual([]);
    expect(paths(validateLeaseStep('terms', values()))).toEqual(['monthlyRent']);
  });

  it('needs the end date after the start date', () => {
    const issues = validateLeaseStep(
      'terms',
      values({ monthlyRent: 1500, startDate: '2026-11-07', endDate: '2026-11-07' }),
    );
    expect(issues).toEqual([{ path: 'endDate', message: 'validation.endBeforeStart' }]);
  });

  it('points the review back to the first incomplete step', () => {
    expect(firstInvalidStep(values())).toBe('license');
    expect(firstInvalidStep(values({ taxiLicenseId: 'tl_1' }))).toBe('vehicle');
    expect(
      firstInvalidStep(values({ taxiLicenseId: 'tl_1', vehicleId: 'veh_1', monthlyRent: 1500 })),
    ).toBeNull();
  });
});

describe('toLeaseCreateBody', () => {
  it('builds the DRAFT with its first segment and the handover checklist for our car', () => {
    const parsed = LeaseWizardSchema.parse(
      values({
        taxiLicenseId: 'tl_1',
        vehicleId: 'veh_1',
        monthlyRent: 1500,
        depositAmount: 5000,
        handoverChecklist: { ...values().handoverChecklist, km: 120500, fuelLevel: 'FULL' },
      }),
    );
    const body = toLeaseCreateBody(parsed);
    expect(body).toMatchObject({
      driverId: 'drv_1',
      type: 'CAR_AND_NUMBER',
      billingPeriod: 'MONTHLY',
      startDate: TODAY,
      endDate: '2027-11-06',
      taxiLicenseId: 'tl_1',
      vehicleId: 'veh_1',
      monthlyRent: 1500,
      paymentDay: 1,
      responsibilities: { insurance: 'DRIVER', test: 'DRIVER', repairs: 'DRIVER', fines: 'DRIVER' },
      depositAmount: 5000,
      depositKind: 'CASH',
      terms: null,
    });
    expect(body.handoverChecklist).toMatchObject({ km: 120500, fuelLevel: 'FULL', date: TODAY });
  });

  it('sends no handover checklist for a licence-only lease', () => {
    const parsed = LeaseWizardSchema.parse(
      values({ type: 'NUMBER_ONLY', taxiLicenseId: 'tl_1', vehicleId: null, monthlyRent: 1200 }),
    );
    expect(toLeaseCreateBody(parsed)).toMatchObject({ vehicleId: null, handoverChecklist: null });
  });
});
