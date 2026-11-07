import { describe, expect, it } from 'vitest';
import {
  FSI,
  LRI,
  LRM,
  PDI,
  RLI,
  RLM,
  formatPlate,
  hasBidiMarks,
  isTaxiPlate,
  isValidPlate,
  isolateAuto,
  isolateLtr,
  isolateRtl,
  msg,
  normalizePlate,
  plateNo,
  stripBidiMarks,
} from '../src/index.js';

describe('plate', () => {
  it('normalises separators and bidi marks', () => {
    expect(normalizePlate('12-345-67')).toBe('1234567');
    expect(normalizePlate(' 123 45 678 ')).toBe('12345678');
    expect(normalizePlate(`${LRI}123.45.678${PDI}`)).toBe('12345678');
  });

  it('formats 7 and 8 digit plates', () => {
    expect(formatPlate('1234567')).toBe('12-345-67');
    expect(formatPlate('12345678')).toBe('123-45-678');
    expect(formatPlate('12-345-67')).toBe('12-345-67');
    expect(formatPlate('123')).toBe('123');
  });

  it('validates', () => {
    expect(isValidPlate('12 345 67')).toBe(true);
    expect(isValidPlate('123456')).toBe(false);
    expect(isValidPlate('123456789')).toBe(false);
    expect(isValidPlate('AB-123-45')).toBe(false);
  });

  it('hints taxi plates (ending in 25/26)', () => {
    expect(isTaxiPlate('123-45-625')).toBe(true);
    expect(isTaxiPlate('12-345-26')).toBe(true);
    expect(isTaxiPlate('1234567')).toBe(false);
    expect(isTaxiPlate('25')).toBe(false);
  });

  it('plateNo schema outputs canonical digits', () => {
    expect(plateNo.parse('123-45-678')).toBe('12345678');
    const bad = plateNo.safeParse('AB-123-45');
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0]?.message).toBe(msg.invalidPlate);
  });
});

describe('bidi', () => {
  it('strips every directional mark', () => {
    expect(stripBidiMarks(`${RLM}abc${LRM}`)).toBe('abc');
    expect(stripBidiMarks(isolateLtr('12-345-67'))).toBe('12-345-67');
    expect(hasBidiMarks(`x${RLM}`)).toBe(true);
    expect(hasBidiMarks('plain')).toBe(false);
  });

  it('wraps text in isolates', () => {
    expect(isolateLtr('050-123-4567')).toBe(`${LRI}050-123-4567${PDI}`);
    expect(isolateRtl('שלום')).toBe(`${RLI}שלום${PDI}`);
    expect(isolateAuto('ريناوي')).toBe(`${FSI}ريناوي${PDI}`);
    expect(LRI.codePointAt(0)).toBe(0x2066);
    expect(FSI.codePointAt(0)).toBe(0x2068);
    expect(PDI.codePointAt(0)).toBe(0x2069);
  });
});
