import { describe, expect, it } from 'vitest';
import {
  DealAlert,
  DealCreateRequestSchema,
  DealPaymentRequestSchema,
  DealTransferRequestSchema,
  DealUpdateRequestSchema,
  ExpenseRebillRequestSchema,
  createTransferChecklist,
  msg,
  transferStatusFromChecklist,
} from '../src/index.js';

const base = { counterpartyId: 'c1', date: '2026-11-05', price: 60000 };

describe('deal request bodies (milestone 4)', () => {
  it('PURCHASE takes a vehicle id or inline details (plate normalised)', () => {
    const byId = DealCreateRequestSchema.parse({
      ...base,
      type: 'PURCHASE',
      vehicle: { id: 'v1' },
    });
    expect(byId).toMatchObject({
      type: 'PURCHASE',
      vehicle: { id: 'v1' },
      sellerIsVatBusiness: false,
    });
    const inline = DealCreateRequestSchema.parse({
      ...base,
      type: 'PURCHASE',
      vehicle: { create: { plateNo: '123-45-678', make: 'Kia', model: 'Picanto', year: 2017 } },
    });
    expect(inline.type === 'PURCHASE' && inline.vehicle.create?.plateNo).toBe('12345678');
    // isTaxi is left undefined so a relinked car keeps its flag.
    expect(inline.type === 'PURCHASE' && inline.vehicle.create?.isTaxi).toBeUndefined();
    for (const vehicle of [
      {},
      { id: 'v1', create: { plateNo: '1234567', make: 'a', model: 'b', year: 2020 } },
    ]) {
      const r = DealCreateRequestSchema.safeParse({ ...base, type: 'PURCHASE', vehicle });
      expect(r.error?.issues).toEqual([
        expect.objectContaining({ path: ['vehicle'], message: msg.vehicleRequired }),
      ]);
    }
  });

  it('SALE: vatMode MARGIN | FULL only, trade-in value up to the price', () => {
    const sale = { ...base, type: 'SALE', vehicleId: 'v1' };
    expect(DealCreateRequestSchema.parse(sale)).toMatchObject({ type: 'SALE', vehicleId: 'v1' });
    expect(DealCreateRequestSchema.safeParse({ ...sale, vatMode: 'NONE' }).success).toBe(false);
    const tradeIn = { vehicle: { id: 'v2' }, value: 20000, listPrice: 22000 };
    expect(DealCreateRequestSchema.parse({ ...sale, tradeIn })).toMatchObject({
      tradeIn: { value: 20000, sellerIsVatBusiness: false },
    });
    const tooMuch = DealCreateRequestSchema.safeParse({
      ...sale,
      tradeIn: { ...tradeIn, value: 70000 },
    });
    expect(tooMuch.error?.issues[0]).toMatchObject({
      path: ['tradeIn', 'value'],
      message: msg.invalidAmount,
    });
  });

  it('rejects an unknown type and a trade-in outside a sale', () => {
    expect(DealCreateRequestSchema.safeParse({ ...base, type: 'LEASE' }).success).toBe(false);
    const consignment = DealCreateRequestSchema.parse({
      ...base,
      type: 'CONSIGNMENT_SALE',
      vehicleId: 'v1',
      tradeIn: { vehicle: { id: 'v2' }, value: 1 },
    });
    // Unknown keys are stripped: a consignment sale never carries a trade-in.
    expect(consignment).not.toHaveProperty('tradeIn');
  });

  it('PATCH, payment and transfer bodies', () => {
    expect(DealUpdateRequestSchema.parse({ listPrice: null, notes: '' })).toEqual({
      listPrice: null,
      notes: null,
    });
    expect(DealUpdateRequestSchema.safeParse({ status: 'COMPLETED' }).success).toBe(false);
    const pay = { direction: 'IN', date: '2026-11-05', amount: 100, method: 'CASH' };
    expect(DealPaymentRequestSchema.safeParse(pay).success).toBe(true);
    for (const method of ['TRADE_IN', 'OFFSET']) {
      expect(DealPaymentRequestSchema.safeParse({ ...pay, method }).success).toBe(false);
    }
    // A partial checklist stays partial (no defaults filled in).
    expect(DealTransferRequestSchema.parse({ checklist: { idCopies: true } })).toEqual({
      checklist: { idCopies: true },
    });
    expect(ExpenseRebillRequestSchema.parse({})).toEqual({});
    expect(DealAlert.options).toEqual([
      'disclosureMissing',
      'transferDue',
      'transferOverdue',
      'unpaid',
    ]);
  });

  it('transferStatusFromChecklist: none / some / all applicable items', () => {
    const empty = createTransferChecklist();
    expect(transferStatusFromChecklist(null, false)).toBe('NOT_STARTED');
    expect(transferStatusFromChecklist(empty, false)).toBe('NOT_STARTED');
    expect(transferStatusFromChecklist({ ...empty, idCopies: true }, false)).toBe('IN_PROGRESS');
    const all = {
      ...empty,
      idCopies: true,
      vehicleLicenseSigned: true,
      liensChecked: true,
      finesChecked: true,
      transferFiled: true,
      newLicenseReceived: true,
      insuranceHandled: true,
    };
    expect(transferStatusFromChecklist(all, false)).toBe('DONE');
    expect(transferStatusFromChecklist(all, true)).toBe('IN_PROGRESS');
    expect(transferStatusFromChecklist({ ...all, taxiLicenseDetached: true }, true)).toBe('DONE');
  });
});
