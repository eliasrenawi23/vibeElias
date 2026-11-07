import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  formatPhone,
  idNumber,
  isValidCompanyNumber,
  isValidIsraeliId,
  isValidIsraeliPhone,
  isoDate,
  israeliIdKind,
  money,
  msg,
  normalizePhone,
  optionalEmail,
  optionalText,
  pagination,
  paginated,
  parseValidationMessage,
  phone,
  phoneToE164,
  positiveMoney,
  queryBool,
  validationErrorMap,
  withParams,
} from '../src/index.js';

describe('Israeli ID / company number', () => {
  it('validates the check digit', () => {
    expect(isValidIsraeliId('000000018')).toBe(true);
    expect(isValidIsraeliId('123456782')).toBe(true);
    expect(isValidIsraeliId('123456789')).toBe(false);
    expect(isValidIsraeliId('000000000')).toBe(false);
    expect(isValidIsraeliId('12345678a')).toBe(false);
  });

  it('left-pads short IDs', () => {
    expect(isValidIsraeliId('00000018')).toBe(true);
    expect(isValidIsraeliId('18')).toBe(false); // too short to be an ID
    expect(idNumber.parse('0000-0018')).toBe('000000018');
  });

  it('accepts company numbers (same check digit, prefix 5)', () => {
    expect(isValidCompanyNumber('520013954')).toBe(true);
    expect(isValidCompanyNumber('123456782')).toBe(false);
    expect(israeliIdKind('520013954')).toBe('COMPANY');
    expect(israeliIdKind('123456782')).toBe('PERSON');
    expect(israeliIdKind('123456789')).toBeNull();
  });

  it('idNumber schema reports a translatable message', () => {
    const r = idNumber.safeParse('123456789');
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe(msg.invalidIdNumber);
  });
});

describe('phone', () => {
  it('normalises Israeli formats to national digits', () => {
    expect(normalizePhone('050-123-4567')).toBe('0501234567');
    expect(normalizePhone('+972 50 123 4567')).toBe('0501234567');
    expect(normalizePhone('972501234567')).toBe('0501234567');
    expect(normalizePhone('+972-0-50-1234567')).toBe('0501234567');
    expect(normalizePhone('00972-2-6234567')).toBe('026234567');
    expect(normalizePhone('(04) 123-4567')).toBe('041234567');
  });

  it('validates', () => {
    expect(isValidIsraeliPhone('0501234567')).toBe(true);
    expect(isValidIsraeliPhone('077-1234567')).toBe(true);
    expect(isValidIsraeliPhone('1-800-123-456')).toBe(true);
    expect(isValidIsraeliPhone('0601234567')).toBe(false);
    expect(isValidIsraeliPhone('12345')).toBe(false);
    expect(isValidIsraeliPhone('+1 212 555 1234')).toBe(false);
  });

  it('formats and converts to E.164', () => {
    expect(formatPhone('0501234567')).toBe('050-123-4567');
    expect(formatPhone('026234567')).toBe('02-623-4567');
    expect(phoneToE164('050-123-4567')).toBe('+972501234567');
    expect(phone.parse('+972 52 765 4321')).toBe('0527654321');
    expect(phone.safeParse('123').error?.issues[0]?.message).toBe(msg.invalidPhone);
  });
});

describe('money schema', () => {
  it('accepts at most 2 decimals within +-1e9', () => {
    expect(money.safeParse(19.99).success).toBe(true);
    expect(money.safeParse(0.07).success).toBe(true);
    expect(money.safeParse(-250.5).success).toBe(true);
    expect(money.safeParse(1_000_000_000).success).toBe(true);
    expect(money.safeParse(1.005).success).toBe(false);
    expect(money.safeParse(0.1 + 0.2).success).toBe(false);
    expect(money.safeParse(1_000_000_000.01).success).toBe(false);
    expect(money.safeParse(Number.NaN).success).toBe(false);
    expect(money.safeParse(Number.POSITIVE_INFINITY).success).toBe(false);
    expect(money.safeParse('10').success).toBe(false);
  });

  it('positiveMoney rejects zero', () => {
    expect(positiveMoney.safeParse(0).success).toBe(false);
    expect(positiveMoney.safeParse(0.01).success).toBe(true);
  });
});

describe('dates and text', () => {
  it('isoDate checks real calendar dates', () => {
    expect(isoDate.safeParse('2026-11-07').success).toBe(true);
    expect(isoDate.safeParse('2026-02-30').success).toBe(false);
    expect(isoDate.safeParse('07/11/2026').success).toBe(false);
  });

  it('optional helpers turn empty strings into null', () => {
    expect(optionalText(10).parse('  ')).toBeNull();
    expect(optionalText(10).parse(' hi ')).toBe('hi');
    expect(optionalEmail.parse('')).toBeNull();
    expect(optionalEmail.parse(' Admin@Renawi.Local ')).toBe('admin@renawi.local');
    expect(optionalEmail.safeParse('nope').error?.issues[0]?.message).toBe(msg.invalidEmail);
  });

  it('queryBool parses query strings', () => {
    expect(queryBool.parse('true')).toBe(true);
    expect(queryBool.parse('0')).toBe(false);
    expect(queryBool.safeParse('maybe').success).toBe(false);
  });
});

describe('pagination', () => {
  it('coerces and defaults', () => {
    expect(pagination.parse({})).toEqual({ page: 1, pageSize: 25, order: 'desc' });
    expect(
      pagination.parse({ page: '3', pageSize: '200', sort: 'createdAt', order: 'asc' }),
    ).toEqual({ page: 3, pageSize: 200, sort: 'createdAt', order: 'asc' });
    expect(pagination.safeParse({ pageSize: '201' }).success).toBe(false);
    expect(pagination.safeParse({ page: '0' }).success).toBe(false);
    expect(pagination.safeParse({ sort: 'name; drop table' }).success).toBe(false);
  });

  it('wraps paginated responses', () => {
    const schema = paginated(z.object({ id: z.string() }));
    expect(
      schema.parse({ items: [{ id: 'a' }], total: 1, page: 1, pageSize: 25 }).items,
    ).toHaveLength(1);
  });
});

describe('validation messages', () => {
  it('encodes and decodes params', () => {
    const m = withParams(msg.maxLength, { max: 3 });
    expect(m).toBe('validation.maxLength::{"max":3}');
    expect(parseValidationMessage(m)).toEqual({ key: 'validation.maxLength', params: { max: 3 } });
    expect(parseValidationMessage('validation.required')).toEqual({
      key: 'validation.required',
      params: {},
    });
  });

  it('error map turns generic issues into i18n keys', () => {
    const opts = { errorMap: validationErrorMap };
    const schema = z.object({ name: z.string().max(3), age: z.number().min(18) });
    const r = schema.safeParse({ name: 'abcd', age: 5 }, opts);
    expect(r.error?.issues.map((i) => parseValidationMessage(i.message))).toEqual([
      { key: 'validation.maxLength', params: { max: 3 } },
      { key: 'validation.min', params: { min: 18 } },
    ]);
    const missing = schema.safeParse({}, opts);
    expect(missing.error?.issues.map((i) => i.message)).toEqual([msg.required, msg.required]);
    const empty = z.string().min(1).safeParse('', opts);
    expect(empty.error?.issues[0]?.message).toBe(msg.required);
  });
});
