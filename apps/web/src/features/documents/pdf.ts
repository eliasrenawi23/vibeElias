import type {
  DealStatus,
  DealType,
  LeaseStatus,
  LeaseType,
  LedgerType,
  Locale,
  PaymentMethod,
  PdfTemplate,
} from '@renawi/shared';
import { http } from '../../shared/lib/http';
import type { DocumentItem } from './types';

/**
 * Generated PDFs (milestone 6). `POST /pdf/:template/:id?lang=` renders the document and stores
 * it as a new `Document` (every call makes a new one); without `lang` the API uses the
 * counterparty's preferred language, else the user's. A template that does not fit the record
 * answers 409 `errors.pdfNotApplicable`.
 *
 * The rules below decide which templates a page offers; they mirror the API's checks so the user
 * is never shown a button that can only fail.
 */

/** A template to offer, with the id the API expects for it. */
export interface PdfChoice {
  template: PdfTemplate;
  /** Lease / deal / ledger entry / deal payment / inventory cycle id, per template. */
  id: string;
}

const pdfPath = (template: PdfTemplate, id: string) =>
  `/pdf/${template}/${encodeURIComponent(id)}`;

/** `POST /api/pdf/:template/:id?lang=`: the stored document (`url` opens the file). */
export function generatePdf(
  template: PdfTemplate,
  id: string,
  lang?: Locale | null,
): Promise<DocumentItem> {
  return http.post<DocumentItem>(pdfPath(template, id), undefined, {
    query: { lang: lang ?? undefined },
  });
}

/** Lease contract, handover and return reports a lease can print. */
export function leasePdfChoices(lease: {
  id: string;
  type: LeaseType;
  status: LeaseStatus;
}): PdfChoice[] {
  const carAndNumber = lease.type === 'CAR_AND_NUMBER';
  return [
    { template: 'lease-contract' as const, id: lease.id },
    // A number-only lease hands over no car.
    ...(carAndNumber ? [{ template: 'handover' as const, id: lease.id }] : []),
    // Nothing comes back from a draft.
    ...(carAndNumber && lease.status !== 'DRAFT'
      ? [{ template: 'return' as const, id: lease.id }]
      : []),
  ];
}

/** The agreement of a deal (sale or purchase by type); none for a cancelled deal. */
export function dealAgreementChoice(deal: {
  id: string;
  type: DealType;
  status: DealStatus;
}): PdfChoice | null {
  if (deal.status === 'CANCELLED') return null;
  return {
    template: deal.type === 'PURCHASE' ? 'purchase-agreement' : 'sale-agreement',
    id: deal.id,
  };
}

/** The disclosure form of a sale or consignment sale; none for purchases or cancelled deals. */
export function dealDisclosureChoice(deal: {
  id: string;
  type: DealType;
  status: DealStatus;
}): PdfChoice | null {
  if (deal.status === 'CANCELLED' || deal.type === 'PURCHASE') return null;
  return { template: 'disclosure-form', id: deal.id };
}

/** Deposit confirmation on a deposit row, payment confirmation on a payment row (not voided). */
export function ledgerPdfChoice(entry: {
  id: string;
  type: LedgerType;
  voidedAt?: string | null;
}): PdfChoice | null {
  if (entry.voidedAt) return null;
  if (entry.type === 'DEPOSIT_IN' || entry.type === 'DEPOSIT_OUT') {
    return { template: 'deposit-receipt', id: entry.id };
  }
  if (entry.type === 'PAYMENT') return { template: 'payment-confirmation', id: entry.id };
  return null;
}

/** Payment confirmation of a deal payment (not the trade-in, not on a cancelled deal). */
export function dealPaymentPdfChoice(
  payment: { id: string; method: PaymentMethod },
  dealStatus: DealStatus,
): PdfChoice | null {
  if (dealStatus === 'CANCELLED' || payment.method === 'TRADE_IN') return null;
  return { template: 'payment-confirmation', id: payment.id };
}

/** The consignment agreement of a car whose open cycle is a consignment. */
export function consignmentPdfChoice(
  openCycle: { id: string; kind: string } | null | undefined,
): PdfChoice | null {
  return openCycle?.kind === 'CONSIGNED'
    ? { template: 'consignment-agreement', id: openCycle.id }
    : null;
}
