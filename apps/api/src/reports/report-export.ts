import {
  formatDate,
  formatPlate,
  isRtlLocale,
  REPORT_TITLE_KEYS,
  type LabelledEnumName,
  type Locale,
  type ReportCell,
  type ReportColumn,
  type ReportFormat,
  type ReportName,
  type ReportResult,
} from '@renawi/shared';
import { Workbook, type Cell, type Worksheet } from 'exceljs';
import type { Translate } from './report-i18n';

/*
 * CSV / XLSX rendering of a `ReportResult` (export rules of docs/plans/ui-patterns-from-hct.md
 * C4): a "Report context" sheet first (report, exported at in the business time zone, period,
 * every filter, column definitions, all in the user's language); a data sheet with a
 * right-to-left view for he/ar, translated headers and typed cells (money numbers in
 * `"₪" #,##0.00`, real dates, translated enums); missing values as a translated "n/a", never 0;
 * sanitised sheet names; a "no data" note on empty sheets. CSV: UTF-8 BOM, CRLF, RFC 4180
 * quoting.
 */

/** How a report parameter is shown on the context sheet. */
export type ParamKind = 'date' | 'groupBy' | { enum: LabelledEnumName };

export interface ExportOptions {
  report: ReportName;
  lang: Locale;
  t: Translate;
  /** Export instant (shown in `timeZone`). */
  exportedAt: Date;
  /** Business time zone (Asia/Jerusalem). */
  timeZone: string;
  /** Display kind of each parameter in `result.params` (others are shown as text). */
  paramKinds?: Readonly<Record<string, ParamKind>>;
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const CSV_MIME = 'text/csv; charset=utf-8';

/** Number format of money cells. */
export const MONEY_FORMAT = '"₪" #,##0.00';
export const DATE_FORMAT = 'dd/mm/yyyy';
export const DATETIME_FORMAT = 'dd/mm/yyyy hh:mm';

const UTF8_BOM = '﻿';
const CRLF = '\r\n';

/* ------------------------------------------------------------------------------------------ */
/* Small pure helpers                                                                         */
/* ------------------------------------------------------------------------------------------ */

/** `renawi-<report>-YYYY-MM-DD.<ext>` (date = the business date of the export). */
export function exportFileName(report: ReportName, format: Exclude<ReportFormat, 'json'>, day: string) {
  return `renawi-${report}-${day}.${format}`;
}

/** One CSV field (RFC 4180): quoted when it holds a quote, comma, CR / LF or edge spaces. */
export function csvField(text: string): string {
  if (/[",\r\n]/.test(text) || /^\s|\s$/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** One CSV record. */
export function csvLine(fields: readonly string[]): string {
  return fields.map(csvField).join(',');
}

/**
 * Text that a spreadsheet would run as a formula (`=`, `@`, tab / CR, or `+` / `-` not
 * followed by a number) gets a leading apostrophe. Numbers and phone numbers are untouched.
 */
export function neutralizeFormula(text: string): string {
  if (/^[=@\t\r]/.test(text)) return `'${text}`;
  if (/^[+-]/.test(text) && !/^[+-][\d\s().-]*\d[\d\s().-]*$/.test(text)) return `'${text}`;
  return text;
}

const SHEET_NAME_FORBIDDEN = /[[\]*?/\\:]/g;
const SHEET_NAME_MAX = 31;

/**
 * Valid Excel sheet name: no `[ ] * ? / \ :`, no leading / trailing apostrophe, at most 31
 * characters, not "History", unique (case-insensitive) within `used` (which it is added to).
 */
export function sanitizeSheetName(name: string, used?: Set<string>): string {
  let base = name.replace(SHEET_NAME_FORBIDDEN, ' ').replace(/\s+/g, ' ').trim();
  base = base.replace(/^'+|'+$/g, '').trim();
  if (!base) base = 'Sheet';
  if (base.toLowerCase() === 'history') base = `${base}_`;
  const clip = (s: string, max: number) => Array.from(s).slice(0, max).join('').trim();
  let candidate = clip(base, SHEET_NAME_MAX);
  for (let n = 2; used?.has(candidate.toLowerCase()); n++) {
    const suffix = ` (${n})`;
    candidate = `${clip(base, SHEET_NAME_MAX - suffix.length)}${suffix}`;
  }
  used?.add(candidate.toLowerCase());
  return candidate;
}

/** Wall-clock parts of an instant in a time zone. */
export function wallClock(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const [year, month, day, hour, minute, second] = [
    get('year'),
    get('month'),
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  ];
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${year}-${pad(month)}-${pad(day)}`,
    time: `${pad(hour)}:${pad(minute)}`,
    /** The wall-clock time as a UTC Date (spreadsheet dates carry no time zone). */
    excel: new Date(Date.UTC(year, month - 1, day, hour, minute, second)),
  };
}

function enumLabel(t: Translate, name: string | undefined, value: string): string {
  return name ? t(`enums.${name}.${value}`) : value;
}

/**
 * Display text of a cell (CSV fields, the context sheet): money `1234.50`, dates
 * `YYYY-MM-DD`, date-times `YYYY-MM-DD HH:mm` in the business time zone, enums / booleans
 * translated, plates formatted, null -> translated "n/a".
 */
export function cellText(
  col: Pick<ReportColumn, 'type' | 'enum'>,
  value: ReportCell,
  t: Translate,
  timeZone: string,
): string {
  if (value === null || value === undefined || value === '') return t('reports.na');
  switch (col.type) {
    case 'money':
      return typeof value === 'number' ? value.toFixed(2) : String(value);
    case 'int':
      return typeof value === 'number' ? String(Math.trunc(value)) : String(value);
    case 'bool':
      return t(value === true || value === 'true' ? 'reports.bool.true' : 'reports.bool.false');
    case 'enum':
      return enumLabel(t, col.enum, String(value));
    case 'plate':
      return formatPlate(String(value));
    case 'datetime': {
      const d = new Date(String(value));
      if (Number.isNaN(d.getTime())) return String(value);
      const w = wallClock(d, timeZone);
      return `${w.date} ${w.time}`;
    }
    case 'date':
      return String(value);
    default:
      return neutralizeFormula(String(value));
  }
}

/* ------------------------------------------------------------------------------------------ */
/* CSV                                                                                        */
/* ------------------------------------------------------------------------------------------ */

/** UTF-8 CSV with BOM and CRLF: one header row (translated labels), then the data rows. */
export function reportToCsv(result: ReportResult, o: ExportOptions): Buffer {
  const lines = [csvLine(result.columns.map((c) => o.t(c.label)))];
  for (const row of result.rows) {
    lines.push(csvLine(result.columns.map((c) => cellText(c, row[c.key] ?? null, o.t, o.timeZone))));
  }
  return Buffer.from(UTF8_BOM + lines.join(CRLF) + CRLF, 'utf8');
}

/* ------------------------------------------------------------------------------------------ */
/* XLSX                                                                                       */
/* ------------------------------------------------------------------------------------------ */

const HEADER_FILL = 'FFF5C518';
const MUTED = 'FF8C8C8C';

function paramText(key: string, value: string | string[], o: ExportOptions): string {
  const kind = o.paramKinds?.[key];
  const values = Array.isArray(value) ? value : [value];
  const one = (v: string): string => {
    if (kind === 'date') return formatDate(v, o.lang);
    if (kind === 'groupBy') return o.t(`reports.groupBy.${v}`);
    if (kind && typeof kind === 'object') return enumLabel(o.t, kind.enum, v);
    return v;
  };
  return values.map(one).join(', ');
}

function styleHeader(row: ReturnType<Worksheet['getRow']>): void {
  row.font = { bold: true, color: { argb: 'FF0F0F10' } };
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF0F0F10' } } };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
}

function setMissing(cell: Cell, o: ExportOptions): void {
  cell.value = o.t('reports.na');
  cell.font = { italic: true, color: { argb: MUTED } };
  cell.alignment = { horizontal: 'center' };
}

/** Writes one typed value into a data cell. */
function setTyped(cell: Cell, col: ReportColumn, value: ReportCell, o: ExportOptions): void {
  if (value === null || value === undefined || value === '') {
    setMissing(cell, o);
    return;
  }
  switch (col.type) {
    case 'money':
      if (typeof value === 'number') {
        cell.value = value;
        cell.numFmt = MONEY_FORMAT;
        return;
      }
      break;
    case 'int':
      if (typeof value === 'number') {
        cell.value = value;
        cell.numFmt = '0';
        return;
      }
      break;
    case 'date':
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        cell.value = new Date(`${value}T00:00:00.000Z`);
        cell.numFmt = DATE_FORMAT;
        return;
      }
      break;
    case 'datetime': {
      const d = new Date(String(value));
      if (!Number.isNaN(d.getTime())) {
        cell.value = wallClock(d, o.timeZone).excel;
        cell.numFmt = DATETIME_FORMAT;
        return;
      }
      break;
    }
    default:
      break;
  }
  cell.value = cellText(col, value, o.t, o.timeZone);
}

function autoWidth(sheet: Worksheet, texts: string[][], min = 10, max = 50): void {
  const widths: number[] = [];
  for (const row of texts) {
    row.forEach((text, i) => {
      const longest = Math.max(...text.split('\n').map((l) => Array.from(l).length));
      widths[i] = Math.max(widths[i] ?? 0, longest);
    });
  }
  widths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = Math.min(max, Math.max(min, w + 2));
  });
}

function addContextSheet(wb: Workbook, result: ReportResult, o: ExportOptions, used: Set<string>) {
  const { t } = o;
  const rtl = isRtlLocale(o.lang);
  const sheet = wb.addWorksheet(sanitizeSheetName(t('reports.context.sheetName'), used), {
    views: [{ rightToLeft: rtl }],
  });
  const at = wallClock(o.exportedAt, o.timeZone);
  const rows: [string, string][] = [
    [t('reports.context.report'), t(REPORT_TITLE_KEYS[o.report])],
    [
      t('reports.context.exportedAt'),
      `${formatDate(at.date, o.lang)} ${at.time} (${o.timeZone})`,
    ],
  ];
  const params = result.params;
  const from = typeof params.from === 'string' ? params.from : null;
  const to = typeof params.to === 'string' ? params.to : null;
  if (from || to) {
    rows.push([
      t('reports.context.period'),
      `${from ? formatDate(from, o.lang) : '…'} – ${to ? formatDate(to, o.lang) : '…'}`,
    ]);
  }
  if (typeof params.asOf === 'string') {
    rows.push([t('reports.context.asOf'), formatDate(params.asOf, o.lang)]);
  }
  for (const [key, value] of Object.entries(params)) {
    if (['from', 'to', 'asOf', 'format', 'lang'].includes(key)) continue;
    rows.push([t(`reports.params.${key}`), paramText(key, value, o)]);
  }
  rows.push([t('reports.context.language'), t(`language.${o.lang}`)]);
  rows.push([t('reports.context.rows'), String(result.rows.length)]);

  for (const [label, value] of rows) {
    const row = sheet.addRow([label, value]);
    row.getCell(1).font = { bold: true };
  }
  sheet.addRow([]);
  const header = sheet.addRow([t('reports.context.column'), t('reports.context.type')]);
  styleHeader(header);
  for (const col of result.columns) {
    const type = t(`reports.columnTypes.${col.type}`);
    sheet.addRow([t(col.label), col.type === 'enum' && col.enum ? `${type}` : type]);
  }
  sheet.getColumn(1).width = 30;
  sheet.getColumn(2).width = 60;
}

function addDataSheet(wb: Workbook, result: ReportResult, o: ExportOptions, used: Set<string>) {
  const { t } = o;
  const rtl = isRtlLocale(o.lang);
  const sheet = wb.addWorksheet(sanitizeSheetName(t(REPORT_TITLE_KEYS[o.report]), used), {
    views: [{ rightToLeft: rtl, state: 'frozen', ySplit: 1 }],
  });
  const cols = result.columns;
  const headers = cols.map((c) => t(c.label));
  styleHeader(sheet.addRow(headers));
  const texts: string[][] = [headers];

  if (result.rows.length === 0) {
    const row = sheet.addRow([t('reports.noData')]);
    row.getCell(1).font = { italic: true, color: { argb: MUTED } };
    if (cols.length > 1) sheet.mergeCells(row.number, 1, row.number, cols.length);
  } else {
    for (const data of result.rows) {
      const row = sheet.addRow([]);
      cols.forEach((col, i) => setTyped(row.getCell(i + 1), col, data[col.key] ?? null, o));
      texts.push(cols.map((c) => cellText(c, data[c.key] ?? null, t, o.timeZone)));
    }
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  }

  if (result.totals && result.rows.length > 0) {
    const totals = result.totals;
    const row = sheet.addRow([]);
    cols.forEach((col, i) => {
      const value = totals[col.key];
      const cell = row.getCell(i + 1);
      if (typeof value === 'number') setTyped(cell, col, value, o);
    });
    const first = row.getCell(1);
    if (first.value === null || first.value === undefined) first.value = t('reports.total');
    row.font = { bold: true };
    row.eachCell((cell) => {
      cell.border = { top: { style: 'thin', color: { argb: 'FF0F0F10' } } };
    });
  }
  autoWidth(sheet, texts);
}

/** XLSX workbook: "Report context" sheet first, then the data sheet. */
export async function reportToXlsx(result: ReportResult, o: ExportOptions): Promise<Buffer> {
  const wb = new Workbook();
  wb.creator = 'Renawi Motors';
  wb.created = o.exportedAt;
  wb.title = o.t(REPORT_TITLE_KEYS[o.report]);
  const used = new Set<string>();
  addContextSheet(wb, result, o, used);
  addDataSheet(wb, result, o, used);
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}
