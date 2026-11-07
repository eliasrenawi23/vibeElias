import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { lastValueFrom, of } from 'rxjs';
import { DATE_ONLY_FIELDS, toWire } from '../serialization/wire';
import { DecimalToNumberInterceptor } from './decimal-to-number.interceptor';

function run(payload: unknown): Promise<unknown> {
  const interceptor = new DecimalToNumberInterceptor();
  const next: CallHandler = { handle: () => of(payload) };
  return lastValueFrom(interceptor.intercept({} as ExecutionContext, next));
}

describe('DecimalToNumberInterceptor', () => {
  it('converts Prisma Decimals to numbers with 2 decimals', async () => {
    const result = await run({
      price: new Prisma.Decimal('125000.00'),
      vatRate: new Prisma.Decimal('18.00'),
      prorated: new Prisma.Decimal('1548.3871'),
      negative: new Prisma.Decimal('-0.005'),
      nullable: null,
    });
    expect(result).toEqual({
      price: 125000,
      vatRate: 18,
      prorated: 1548.39,
      negative: -0.01,
      nullable: null,
    });
    expect(typeof (result as { price: unknown }).price).toBe('number');
  });

  it('serialises date-only fields as YYYY-MM-DD and timestamps as ISO instants', async () => {
    const result = await run({
      dueDate: new Date('2026-11-10T00:00:00.000Z'),
      startDate: new Date('2026-02-01T00:00:00.000Z'),
      createdAt: new Date('2026-11-07T08:30:15.123Z'),
      voidedAt: null,
    });
    expect(result).toEqual({
      dueDate: '2026-11-10',
      startDate: '2026-02-01',
      createdAt: '2026-11-07T08:30:15.123Z',
      voidedAt: null,
    });
  });

  it('walks nested objects and arrays, keeping other values', async () => {
    const result = await run({
      items: [
        { id: 'a', amount: new Prisma.Decimal('10.5'), date: new Date('2026-01-31T00:00:00Z') },
        { id: 'b', amount: new Prisma.Decimal('0'), date: new Date('2026-02-28T00:00:00Z') },
      ],
      meta: { total: BigInt(2), ok: true, label: 'רנאוי', tags: ['DRIVER'] },
    });
    expect(result).toEqual({
      items: [
        { id: 'a', amount: 10.5, date: '2026-01-31' },
        { id: 'b', amount: 0, date: '2026-02-28' },
      ],
      meta: { total: 2, ok: true, label: 'רנאוי', tags: ['DRIVER'] },
    });
  });

  it('passes primitives, undefined and class instances through', async () => {
    class Stream {
      readonly kind = 'stream';
    }
    const stream = new Stream();
    expect(await run(undefined)).toBeUndefined();
    expect(await run('text')).toBe('text');
    expect(await run(42)).toBe(42);
    expect(await run(stream)).toBe(stream);
  });

  it('derives the date-only field list from the Prisma schema', () => {
    for (const field of ['date', 'dueDate', 'startDate', 'endDate', 'followUpAt', 'expiresAt']) {
      expect(DATE_ONLY_FIELDS.has(field)).toBe(true);
    }
    for (const field of ['createdAt', 'updatedAt', 'voidedAt', 'offenceAt', 'disclosureSignedAt']) {
      expect(DATE_ONLY_FIELDS.has(field)).toBe(false);
    }
    expect(toWire(new Date('invalid'), 'date')).toBeNull();
  });
});
