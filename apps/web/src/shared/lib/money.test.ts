import { stripBidiMarks } from '@renawi/shared';
import { describe, expect, it } from 'vitest';
import { formatAmount, formatCount, parseAmountInput, toLatinDigits } from './money';

const ARABIC_INDIC = /[٠-٩۰-۹]/;

describe('formatAmount', () => {
  it('formats ILS for English', () => {
    expect(formatAmount(1234.5, 'en')).toBe('₪1,234.50');
  });

  it('uses Latin digits and the shekel sign in Hebrew and Arabic', () => {
    for (const lng of ['he', 'ar'] as const) {
      const text = formatAmount(1234.5, lng);
      expect(text, lng).not.toMatch(ARABIC_INDIC);
      expect(stripBidiMarks(text), lng).toContain('1,234.50');
      expect(text, lng).toContain('₪');
    }
  });

  it('accepts i18next region codes and falls back to Hebrew for unknown languages', () => {
    expect(formatAmount(10, 'en-US')).toBe('₪10.00');
    expect(formatAmount(10, 'fr')).toBe(formatAmount(10, 'he'));
  });

  it('rounds half-up and can hide agorot', () => {
    expect(formatAmount(0.005, 'en')).toBe('₪0.01');
    expect(formatAmount(1999.5, 'en', { decimals: false })).toBe('₪2,000');
  });

  it('formats counts with Latin digits in Arabic', () => {
    expect(formatCount(123456, 'ar')).toBe('123,456');
  });
});

describe('toLatinDigits', () => {
  it('converts Arabic-Indic and Extended Arabic-Indic digits', () => {
    expect(toLatinDigits('١٢٣٤٥٦٧٨٩٠')).toBe('1234567890');
    expect(toLatinDigits('۱۲۳')).toBe('123');
    expect(toLatinDigits('abc 42')).toBe('abc 42');
  });
});

describe('parseAmountInput', () => {
  it.each([
    ['1234.5', 1234.5],
    ['1,234.50', 1234.5],
    ['₪ 1,234.50', 1234.5],
    ['1,234.50 ₪', 1234.5],
    ['\u{200F}1,234.50\u{00A0}₪', 1234.5],
    ['ILS 99', 99],
    ['-20', -20],
    ['\u{0661}\u{066C}\u{0662}\u{0663}\u{0664}\u{066B}\u{0665}', 1234.5],
  ])('parses %j', (input, expected) => {
    expect(parseAmountInput(input)).toBe(expected);
  });

  it.each(['', '   ', 'abc', '1.2.3', '--5'])('rejects %j', (input) => {
    expect(parseAmountInput(input)).toBeNull();
  });

  it('handles null and undefined', () => {
    expect(parseAmountInput(null)).toBeNull();
    expect(parseAmountInput(undefined)).toBeNull();
  });
});
