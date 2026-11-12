import { DealStatus, LeaseStatus, type DealType, type LeaseType } from '@renawi/shared';
import { describe, expect, it } from 'vitest';
import {
  consignmentPdfChoice,
  dealAgreementChoice,
  dealDisclosureChoice,
  dealPaymentPdfChoice,
  leasePdfChoices,
  ledgerPdfChoice,
} from './pdf';

const templates = (type: LeaseType, status: LeaseStatus) =>
  leasePdfChoices({ id: 'lc_1', type, status }).map((c) => c.template);

describe('PDF templates offered', () => {
  it('per lease type and status', () => {
    expect(templates('CAR_AND_NUMBER', 'DRAFT')).toEqual(['lease-contract', 'handover']);
    for (const status of ['ACTIVE', 'ENDED', 'TERMINATED'] as const) {
      expect(templates('CAR_AND_NUMBER', status)).toEqual(['lease-contract', 'handover', 'return']);
    }
    // A number-only lease has no car to hand over or return.
    for (const status of LeaseStatus.options) {
      expect(templates('NUMBER_ONLY', status)).toEqual(['lease-contract']);
    }
    expect(leasePdfChoices({ id: 'lc_9', type: 'CAR_AND_NUMBER', status: 'ACTIVE' })).toEqual([
      { template: 'lease-contract', id: 'lc_9' },
      { template: 'handover', id: 'lc_9' },
      { template: 'return', id: 'lc_9' },
    ]);
  });

  it('per deal type, none for a cancelled deal', () => {
    const deal = (type: DealType, status: DealStatus = 'COMPLETED') => ({
      id: 'deal_1',
      type,
      status,
    });
    expect(dealAgreementChoice(deal('SALE'))).toEqual({ template: 'sale-agreement', id: 'deal_1' });
    expect(dealAgreementChoice(deal('CONSIGNMENT_SALE'))?.template).toBe('sale-agreement');
    expect(dealAgreementChoice(deal('PURCHASE'))?.template).toBe('purchase-agreement');
    expect(dealDisclosureChoice(deal('SALE', 'DRAFT'))).toEqual({
      template: 'disclosure-form',
      id: 'deal_1',
    });
    expect(dealDisclosureChoice(deal('CONSIGNMENT_SALE'))?.template).toBe('disclosure-form');
    expect(dealDisclosureChoice(deal('PURCHASE'))).toBeNull();
    for (const type of ['SALE', 'PURCHASE', 'CONSIGNMENT_SALE'] as const) {
      expect(dealAgreementChoice(deal(type, 'CANCELLED'))).toBeNull();
      expect(dealDisclosureChoice(deal(type, 'CANCELLED'))).toBeNull();
    }
    for (const status of DealStatus.options.filter((s) => s !== 'CANCELLED')) {
      expect(dealAgreementChoice(deal('SALE', status))).not.toBeNull();
    }
  });

  it('per ledger row: deposits and payments, not voided ones', () => {
    expect(ledgerPdfChoice({ id: 'le_1', type: 'DEPOSIT_IN' })).toEqual({
      template: 'deposit-receipt',
      id: 'le_1',
    });
    expect(ledgerPdfChoice({ id: 'le_2', type: 'DEPOSIT_OUT' })?.template).toBe('deposit-receipt');
    expect(ledgerPdfChoice({ id: 'le_3', type: 'PAYMENT' })).toEqual({
      template: 'payment-confirmation',
      id: 'le_3',
    });
    expect(
      ledgerPdfChoice({ id: 'le_4', type: 'PAYMENT', voidedAt: '2026-11-01T08:00:00Z' }),
    ).toBeNull();
    for (const type of ['CHARGE', 'CREDIT', 'DEPOSIT_APPLIED'] as const) {
      expect(ledgerPdfChoice({ id: 'le_5', type })).toBeNull();
    }
  });

  it('per deal payment (not the trade-in) and for a consignment cycle', () => {
    expect(dealPaymentPdfChoice({ id: 'dp_1', method: 'CASH' }, 'COMPLETED')).toEqual({
      template: 'payment-confirmation',
      id: 'dp_1',
    });
    expect(dealPaymentPdfChoice({ id: 'dp_2', method: 'TRADE_IN' }, 'COMPLETED')).toBeNull();
    expect(dealPaymentPdfChoice({ id: 'dp_3', method: 'CASH' }, 'CANCELLED')).toBeNull();
    expect(consignmentPdfChoice({ id: 'cyc_1', kind: 'CONSIGNED' })).toEqual({
      template: 'consignment-agreement',
      id: 'cyc_1',
    });
    expect(consignmentPdfChoice({ id: 'cyc_2', kind: 'OWNED' })).toBeNull();
    expect(consignmentPdfChoice(null)).toBeNull();
  });
});
