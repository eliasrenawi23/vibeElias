import { describe, expect, it } from 'vitest';
import {
  computeCommission,
  formatMoney,
  grossFromNet,
  netFromGross,
  prorate,
  round2,
  stripBidiMarks,
  sumMoney,
  vatFromGross,
  vatOnMargin,
} from '../src/index.js';

describe('round2 / sumMoney', () => {
  it('rounds half-up to 2 decimals without float noise', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2('10.125')).toBe(10.13);
    expect(round2(2.344)).toBe(2.34);
    expect(round2(-2.345)).toBe(-2.35);
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });

  it('sums exactly', () => {
    expect(sumMoney([0.1, 0.2, 0.3])).toBe(0.6);
    expect(sumMoney([])).toBe(0);
  });
});

describe('prorate', () => {
  it('prorates a partial month: start on the 16th of a 31-day month', () => {
    expect(prorate(1000, 16, 31)).toBe(516.13);
  });

  it('returns the exact rent for a full month and 0 for no days', () => {
    expect(prorate(1234.56, 31, 31)).toBe(1234.56);
    expect(prorate(1500, 28, 28)).toBe(1500);
    expect(prorate(1000, 0, 30)).toBe(0);
  });

  it('car swap on the 10th: the two lines add up to the monthly rent', () => {
    expect(prorate(1000, 9, 31) + prorate(1000, 22, 31)).toBeCloseTo(1000, 10);
    expect(round2(prorate(1000, 9, 30) + prorate(1000, 21, 30))).toBe(1000);
  });

  it('rejects impossible inputs', () => {
    expect(() => prorate(1000, 32, 31)).toThrow(RangeError);
    expect(() => prorate(1000, 5, 27)).toThrow(RangeError);
    expect(() => prorate(1000, 1.5, 30)).toThrow(RangeError);
  });
});

describe('VAT', () => {
  it('computes VAT on the margin and never goes negative', () => {
    expect(vatOnMargin(59000, 50000, 18)).toBe(1372.88);
    expect(vatOnMargin(45000, 50000, 18)).toBe(0);
    expect(vatOnMargin(50000, 50000, 18)).toBe(0);
  });

  it('splits gross amounts', () => {
    expect(vatFromGross(118, 18)).toBe(18);
    expect(netFromGross(118, 18)).toBe(100);
    expect(grossFromNet(100, 18)).toBe(118);
    expect(vatFromGross(1000, 18)).toBe(152.54);
  });
});

describe('computeCommission', () => {
  it('FIXED', () => {
    expect(computeCommission('FIXED', 3000, 50000)).toEqual({
      commission: 3000,
      payout: 47000,
      belowMinNet: false,
    });
  });

  it('PERCENT', () => {
    expect(computeCommission('PERCENT', 5, 50000)).toEqual({
      commission: 2500,
      payout: 47500,
      belowMinNet: false,
    });
    expect(computeCommission('PERCENT', 2.5, 33333).commission).toBe(833.33);
  });

  it('SURPLUS keeps everything above the minimum net', () => {
    expect(computeCommission('SURPLUS', null, 50000, 45000)).toEqual({
      commission: 5000,
      payout: 45000,
      belowMinNet: false,
    });
    expect(computeCommission('SURPLUS', null, 44000, 45000)).toEqual({
      commission: 0,
      payout: 44000,
      belowMinNet: true,
    });
    expect(() => computeCommission('SURPLUS', null, 50000)).toThrow(RangeError);
  });

  it('flags payouts below the minimum net and clamps the commission to the price', () => {
    expect(computeCommission('FIXED', 3000, 50000, 48000).belowMinNet).toBe(true);
    expect(computeCommission('FIXED', 60000, 50000)).toEqual({
      commission: 50000,
      payout: 0,
      belowMinNet: false,
    });
  });
});

describe('formatMoney', () => {
  it('formats ILS per UI language with Latin digits', () => {
    expect(formatMoney(1234.5, 'en')).toBe('₪1,234.50');
    expect(formatMoney(1234.5, 'he', { stripMarks: true })).toMatch(/^1,234\.50\s₪$/);
    const ar = formatMoney(1234.5, 'ar', { stripMarks: true });
    expect(ar).toMatch(/^1,234\.50\s₪$/);
    expect(ar).not.toMatch(/[٠-٩]/);
  });

  it('keeps Intl bidi marks unless asked to strip them', () => {
    const raw = formatMoney(-1234.5, 'he');
    expect(stripBidiMarks(raw)).not.toBe(raw);
    expect(stripBidiMarks(raw)).toMatch(/^-1,234\.50\s₪$/);
  });

  it('supports whole shekels, ISO code and plain numbers', () => {
    expect(formatMoney(1234.5, 'en', { decimals: false })).toBe('₪1,235');
    expect(formatMoney(10, 'en', { display: 'code' })).toMatch(/^ILS\s10\.00$/);
    expect(formatMoney(10, 'en', { display: 'none' })).toBe('10.00');
  });
});
