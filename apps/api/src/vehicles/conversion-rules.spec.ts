import {
  conversionAuditSummary,
  conversionBlockers,
  conversionDateError,
  conversionExpenseDescription,
  convertedListingPrice,
  formerTaxiPlateOf,
  newPlateError,
  privatePriceEstimate,
  type ConversionState,
} from './conversion-rules';

/** An idle taxi of ours in stock: convertible. */
const idle: ConversionState = {
  isTaxi: true,
  ownership: 'OWNED',
  status: 'IN_STOCK',
  hasOpenSegment: false,
  hasRegisteredLicense: false,
};

describe('conversionBlockers', () => {
  it('allows an idle taxi of ours in stock or reserved', () => {
    expect(conversionBlockers(idle)).toEqual([]);
    expect(conversionBlockers({ ...idle, status: 'RESERVED' })).toEqual([]);
  });

  it('names each rule that blocks', () => {
    expect(conversionBlockers({ ...idle, isTaxi: false })).toEqual(['errors.vehicleNotTaxi']);
    expect(conversionBlockers({ ...idle, ownership: 'CONSIGNED' })).toEqual([
      'errors.vehicleNotAvailable',
    ]);
    expect(conversionBlockers({ ...idle, ownership: 'THIRD_PARTY' })).toEqual([
      'errors.vehicleNotAvailable',
    ]);
    expect(conversionBlockers({ ...idle, status: 'LEASED' })).toEqual(['errors.vehicleLeased']);
    for (const status of ['SOLD', 'RETURNED', 'SCRAPPED', 'EXTERNAL'] as const) {
      expect(conversionBlockers({ ...idle, status })).toEqual(['errors.invalidTransition']);
    }
    expect(conversionBlockers({ ...idle, hasOpenSegment: true })).toEqual(['errors.vehicleLeased']);
    expect(conversionBlockers({ ...idle, hasRegisteredLicense: true })).toEqual([
      'errors.licenseStillRegistered',
    ]);
  });

  it('lists every blocker once, in rule order', () => {
    expect(
      conversionBlockers({
        isTaxi: false,
        ownership: 'THIRD_PARTY',
        status: 'LEASED',
        hasOpenSegment: true,
        hasRegisteredLicense: true,
      }),
    ).toEqual([
      'errors.vehicleNotTaxi',
      'errors.vehicleNotAvailable',
      'errors.vehicleLeased',
      'errors.licenseStillRegistered',
    ]);
  });
});

describe('newPlateError', () => {
  it('needs a different, private plate', () => {
    expect(newPlateError('8473126', '8473126')).toBe('validation.samePlate');
    expect(newPlateError('12345625', '8473126')).toBe('validation.privatePlateExpected');
    expect(newPlateError('1234526', '8473126')).toBe('validation.privatePlateExpected');
    expect(newPlateError('12345678', '8473126')).toBeNull();
  });
});

describe('conversionDateError', () => {
  const T = '2026-11-26';
  const open = { startedAt: '2026-06-01', endedAt: null };

  it('refuses a future date and a date outside the cycle', () => {
    expect(conversionDateError('2026-11-27', T, open)).toBe('validation.dateInFuture');
    expect(conversionDateError('2026-05-31', T, open)).toBe('validation.outsideCycle');
    expect(
      conversionDateError('2026-10-02', T, { startedAt: '2026-06-01', endedAt: '2026-10-01' }),
    ).toBe('validation.outsideCycle');
  });

  it('accepts today, the cycle start and any date without a cycle', () => {
    expect(conversionDateError(T, T, open)).toBeNull();
    expect(conversionDateError('2026-06-01', T, open)).toBeNull();
    expect(conversionDateError('2020-01-01', T, null)).toBeNull();
  });
});

describe('convertedListingPrice', () => {
  it('defaults to the price as taxi + the customs (35,000 -> 50,000)', () => {
    expect(convertedListingPrice(35_000, 15_000, undefined)).toBe(50_000);
    expect(convertedListingPrice(35_000, 15_000, null)).toBe(50_000);
    expect(convertedListingPrice(35_000, 0, undefined)).toBe(35_000);
  });

  it('keeps the price sent, and no price stays no price', () => {
    expect(convertedListingPrice(35_000, 15_000, 48_900)).toBe(48_900);
    expect(convertedListingPrice(null, 15_000, undefined)).toBeNull();
    expect(convertedListingPrice(null, 15_000, 49_000)).toBe(49_000);
  });
});

describe('privatePriceEstimate', () => {
  it('is the sum while a taxi has both parts, else null', () => {
    const taxi = { isTaxi: true, listingPrice: 35_000, expectedConversionTax: 15_000 };
    expect(privatePriceEstimate(taxi)).toBe(50_000);
    expect(privatePriceEstimate({ ...taxi, expectedConversionTax: null })).toBeNull();
    expect(privatePriceEstimate({ ...taxi, listingPrice: null })).toBeNull();
    expect(privatePriceEstimate({ ...taxi, isTaxi: false })).toBeNull();
  });
});

describe('texts and read model', () => {
  it('describes the customs expense and the audit entry with both plates', () => {
    expect(conversionExpenseDescription('8473126', '12345678')).toBe(
      'Taxi to private conversion, 84-731-26 → 123-45-678',
    );
    expect(conversionAuditSummary('8473126', '12345678')).toBe(
      'Converted taxi to private: 84-731-26 → 123-45-678',
    );
    expect(conversionAuditSummary('8473126', '12345678', true)).toMatch(/^Corrected/);
  });

  it('reads the former taxi plate from the loaded plate change', () => {
    expect(formerTaxiPlateOf([{ oldPlateNo: '8473126' }])).toBe('8473126');
    expect(formerTaxiPlateOf([])).toBeNull();
    expect(formerTaxiPlateOf(undefined)).toBeNull();
  });
});
