import { describe, expect, it } from 'vitest';
import { displayPlate, isValidPlate, normalizePlateInput, plateInputProps } from './plate';

describe('plate helpers', () => {
  it('formats 7- and 8-digit plates', () => {
    expect(displayPlate('1234567')).toBe('12-345-67');
    expect(displayPlate('12345678')).toBe('123-45-678');
  });

  it('normalises typed input: separators, bidi marks and Arabic-Indic digits', () => {
    expect(normalizePlateInput('12-345-67')).toBe('1234567');
    expect(normalizePlateInput(' 123 45 678 ')).toBe('12345678');
    expect(normalizePlateInput('\u{2066}123.45.678\u{2069}')).toBe('12345678');
    expect(normalizePlateInput('١٢٣-٤٥-٦٧٨')).toBe('12345678');
  });

  it('validates lengths', () => {
    expect(isValidPlate('12-345-67')).toBe(true);
    expect(isValidPlate('123456')).toBe(false);
    expect(isValidPlate('123456789')).toBe(false);
  });

  it('returns an empty string for missing values and leaves odd lengths unformatted', () => {
    expect(displayPlate(null)).toBe('');
    expect(displayPlate('')).toBe('');
    expect(displayPlate('12345')).toBe('12345');
  });

  it('declares LTR numeric input props', () => {
    expect(plateInputProps).toMatchObject({ dir: 'ltr', inputMode: 'numeric' });
  });
});
