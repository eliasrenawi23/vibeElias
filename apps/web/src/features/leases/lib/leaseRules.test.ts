import { describe, expect, it } from 'vitest';
import { computePenalty, defaultEndDate, isEarlyExit } from './leaseRules';

describe('computePenalty', () => {
  it.each([
    [1, 1500, 1500],
    [2, 1450, 2900],
    [1.5, 1333.33, 2000], // 1999.995 rounds half-up to the agora
    [0.5, 1234.57, 617.29], // 617.285
    [1.25, 0.01, 0.01], // 0.0125
    [0, 1500, 0],
    [1, 0, 0],
    [null, 1500, 0],
  ])('%s months x %s = %s', (months, rent, expected) => {
    expect(computePenalty(months, rent)).toBe(expected);
  });
});

describe('isEarlyExit / defaultEndDate', () => {
  it('detects an end before the agreed end date', () => {
    expect(isEarlyExit('2027-03-31', '2027-11-06')).toBe(true);
    expect(isEarlyExit('2027-11-06', '2027-11-06')).toBe(false);
    expect(isEarlyExit(null, '2027-11-06')).toBe(false);
  });

  it('ends a default contract the day before its anniversary', () => {
    expect(defaultEndDate('2026-11-07')).toBe('2027-11-06');
    expect(defaultEndDate('2026-01-01')).toBe('2026-12-31');
  });
});
