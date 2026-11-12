import {
  DEFAULT_LOCALE,
  formatPhone,
  formatPlate,
  localeDirection,
  round2,
  stripBidiMarks,
  toLocale,
  type DecimalValue,
  type Locale,
} from '@renawi/shared';

/*
 * Pure formatting rules of the generated PDFs (same output in every language): Latin digits,
 * dates DD/MM/YYYY, money ₪1,234.50, plates 312-45-625. Values that must read left-to-right
 * inside right-to-left text are wrapped in `<bdi dir="ltr">` by the template helpers.
 */

const HTML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#96;',
  '=': '&#61;',
};

/** Escapes text for HTML element content and quoted attribute values. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"'`=]/g, (c) => HTML_ESCAPES[c] ?? c);
}

/** `<bdi dir="ltr">…</bdi>` around already-escaped HTML. */
export function ltrIsolate(html: string): string {
  return `<bdi dir="ltr">${html}</bdi>`;
}

const GROUPED = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const INTEGER = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** `₪1,234.50`; negative `-₪1,234.50` (Latin digits, symbol first in every language). */
export function formatPdfMoney(amount: DecimalValue): string {
  const value = round2(amount);
  const text = `₪${GROUPED.format(Math.abs(value))}`;
  return value < 0 ? `-${text}` : text;
}

/** `128,400` (Latin digits, comma grouping). */
export function formatPdfNumber(value: number): string {
  return INTEGER.format(value);
}

/** `YYYY-MM-DD` (or a Date / ISO instant: its UTC calendar date) -> `DD/MM/YYYY`. */
export function formatPdfDate(value: string | Date): string {
  const iso = value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : value instanceof Date ? iso : value;
}

/** Calendar date of an instant in a time zone (`YYYY-MM-DD`). */
export function dateInZone(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Plate display form (`312-45-625`); other text unchanged apart from bidi marks. */
export function formatPdfPlate(plate: string): string {
  return formatPlate(stripBidiMarks(plate));
}

/** Phone display form (`050-123-4567`). */
export function formatPdfPhone(phone: string): string {
  return formatPhone(stripBidiMarks(phone));
}

/** `dir` attribute of a document language. */
export function pdfDirection(lang: Locale): 'rtl' | 'ltr' {
  return localeDirection(lang);
}

/**
 * Document language: the requested one, else the counterparty's preferred language, else the
 * user's locale, else Hebrew.
 */
export function pickPdfLanguage(
  requested: Locale | undefined | null,
  counterpartyLang: string | null | undefined,
  userLocale: string | null | undefined,
): Locale {
  if (requested) return requested;
  if (counterpartyLang) return toLocale(counterpartyLang, toLocale(userLocale, DEFAULT_LOCALE));
  return toLocale(userLocale, DEFAULT_LOCALE);
}

/**
 * Document number printed in the footer: `<PREFIX>-<number>` for numbered records
 * (`LC-000012`), `<PREFIX>-<YYYYMMDD>-<id tail>` for the others.
 */
export function pdfDocumentNumber(
  prefix: string,
  ref: { no: number } | { date: string; id: string },
): string {
  if ('no' in ref) return `${prefix}-${String(ref.no).padStart(6, '0')}`;
  const tail = ref.id
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(-6)
    .toUpperCase();
  return `${prefix}-${ref.date.replace(/-/g, '')}-${tail}`;
}

/** Safe file name of a generated PDF: `sale-agreement-000004-he.pdf`. */
export function pdfFileName(template: string, number: string, lang: Locale): string {
  const safe = number.replace(/[^A-Za-z0-9-]/g, '').toLowerCase();
  return `${template}-${safe}-${lang}.pdf`;
}
