import type { ReportResult } from '@renawi/shared';
import { Workbook } from 'exceljs';
import {
  cellText,
  csvField,
  csvLine,
  exportFileName,
  MONEY_FORMAT,
  neutralizeFormula,
  reportToCsv,
  reportToXlsx,
  sanitizeSheetName,
  wallClock,
  type ExportOptions,
} from './report-export';
import type { Translate } from './report-i18n';

/** Fake translator: returns `[key]` so tests do not depend on the locale texts. */
const t: Translate = (key) => `[${key}]`;
const TZ = 'Asia/Jerusalem';

const options = (over: Partial<ExportOptions> = {}): ExportOptions => ({
  report: 'trade-book',
  lang: 'he',
  t,
  exportedAt: new Date('2026-11-12T08:30:00.000Z'),
  timeZone: TZ,
  paramKinds: { from: 'date', to: 'date' },
  ...over,
});

const RESULT: ReportResult = {
  report: 'trade-book',
  params: { from: '2026-01-01', to: '2026-11-12' },
  columns: [
    { key: 'plateNo', label: 'reports.columns.plateNo', type: 'plate' },
    { key: 'buyerName', label: 'reports.columns.buyerName', type: 'text' },
    { key: 'salePrice', label: 'reports.columns.salePrice', type: 'money' },
    { key: 'saleDate', label: 'reports.columns.saleDate', type: 'date' },
  ],
  rows: [
    {
      plateNo: '31245625',
      buyerName: 'רונית לוי, "נוף הגליל"',
      salePrice: 92000.5,
      saleDate: '2026-11-08',
    },
    { plateNo: '8473126', buyerName: null, salePrice: null, saleDate: null },
  ],
  totals: { plateNo: null, buyerName: null, salePrice: 92000.5, saleDate: null },
};

describe('CSV escaping (RFC 4180)', () => {
  it('leaves plain fields (Hebrew / Arabic included) unquoted', () => {
    expect(csvField('abc')).toBe('abc');
    expect(csvField('רונית לוי')).toBe('רונית לוי');
    expect(csvField('محمد حلبي')).toBe('محمد حلبي');
    expect(csvField('')).toBe('');
  });

  it('quotes fields with commas, quotes, CR / LF and edge spaces; doubles quotes', () => {
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('line1\nline2')).toBe('"line1\nline2"');
    expect(csvField('line1\r\nline2')).toBe('"line1\r\nline2"');
    expect(csvField(' padded')).toBe('" padded"');
    expect(csvField('padded ')).toBe('"padded "');
    expect(csvField('בע״מ "צפון", חיפה')).toBe('"בע״מ ""צפון"", חיפה"');
  });

  it('csvLine joins escaped fields with commas', () => {
    expect(csvLine(['a', 'b,c', 'ד"ה'])).toBe('a,"b,c","ד""ה"');
  });

  it('neutralizes spreadsheet formulas but keeps numbers and phones', () => {
    expect(neutralizeFormula('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)");
    expect(neutralizeFormula('@cmd')).toBe("'@cmd");
    expect(neutralizeFormula('+cmd')).toBe("'+cmd");
    expect(neutralizeFormula('-x')).toBe("'-x");
    expect(neutralizeFormula('+972 50 123 4567')).toBe('+972 50 123 4567');
    expect(neutralizeFormula('-1234.50')).toBe('-1234.50');
    expect(neutralizeFormula('שלום')).toBe('שלום');
  });

  it('reportToCsv: UTF-8 BOM, CRLF, translated header, n/a for missing values', () => {
    const csv = reportToCsv(RESULT, options()).toString('utf8');
    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toBe(
      '[reports.columns.plateNo],[reports.columns.buyerName],[reports.columns.salePrice],[reports.columns.saleDate]',
    );
    expect(lines[1]).toBe('312-45-625,"רונית לוי, ""נוף הגליל""",92000.50,2026-11-08');
    expect(lines[2]).toBe('84-731-26,[reports.na],[reports.na],[reports.na]');
    expect(lines[3]).toBe('');
  });
});

describe('sanitizeSheetName', () => {
  it('replaces forbidden characters and trims apostrophes', () => {
    expect(sanitizeSheetName('Profit [2026]: Q1/Q2*?')).toBe('Profit 2026 Q1 Q2');
    expect(sanitizeSheetName("'quoted'")).toBe('quoted');
    expect(sanitizeSheetName('a\\b')).toBe('a b');
  });

  it('keeps at most 31 characters (Hebrew counted per character)', () => {
    const long = 'ספר סחר — רכישות ומכירות לשנת 2026 המלאה';
    const out = sanitizeSheetName(long);
    expect(Array.from(out).length).toBeLessThanOrEqual(31);
    expect(long.startsWith(out)).toBe(true);
  });

  it('falls back to "Sheet", avoids the reserved "History", and makes names unique', () => {
    expect(sanitizeSheetName('***')).toBe('Sheet');
    expect(sanitizeSheetName('History')).toBe('History_');
    const used = new Set<string>();
    expect(sanitizeSheetName('דוח', used)).toBe('דוח');
    expect(sanitizeSheetName('דוח', used)).toBe('דוח (2)');
    expect(sanitizeSheetName('DATA', used)).toBe('DATA');
    expect(sanitizeSheetName('data', used)).toBe('data (2)');
    const long = 'x'.repeat(40);
    expect(sanitizeSheetName(long, used)).toBe('x'.repeat(31));
    expect(sanitizeSheetName(long, used)).toBe(`${'x'.repeat(27)} (2)`);
  });
});

describe('cell text and file names', () => {
  it('formats each column type', () => {
    expect(cellText({ type: 'money' }, 1234.5, t, TZ)).toBe('1234.50');
    expect(cellText({ type: 'int' }, 12.7, t, TZ)).toBe('12');
    expect(cellText({ type: 'bool' }, true, t, TZ)).toBe('[reports.bool.true]');
    expect(cellText({ type: 'bool' }, false, t, TZ)).toBe('[reports.bool.false]');
    expect(cellText({ type: 'enum', enum: 'FineStatus' }, 'NEW', t, TZ)).toBe(
      '[enums.FineStatus.NEW]',
    );
    expect(cellText({ type: 'plate' }, '31245625', t, TZ)).toBe('312-45-625');
    expect(cellText({ type: 'date' }, '2026-11-12', t, TZ)).toBe('2026-11-12');
    expect(cellText({ type: 'datetime' }, '2026-11-12T22:30:00.000Z', t, TZ)).toBe(
      '2026-11-13 00:30',
    );
    expect(cellText({ type: 'text' }, '=1+1', t, TZ)).toBe("'=1+1");
  });

  it('missing values are a translated n/a, never 0', () => {
    expect(cellText({ type: 'money' }, null, t, TZ)).toBe('[reports.na]');
    expect(cellText({ type: 'text' }, '', t, TZ)).toBe('[reports.na]');
    expect(cellText({ type: 'int' }, 0, t, TZ)).toBe('0');
  });

  it('wallClock converts an instant to the business time zone', () => {
    const w = wallClock(new Date('2026-07-01T21:15:00.000Z'), TZ);
    expect(w.date).toBe('2026-07-02');
    expect(w.time).toBe('00:15');
    expect(w.excel.toISOString()).toBe('2026-07-02T00:15:00.000Z');
  });

  it('exportFileName', () => {
    expect(exportFileName('trade-book', 'xlsx', '2026-11-12')).toBe(
      'renawi-trade-book-2026-11-12.xlsx',
    );
  });
});

describe('reportToXlsx', () => {
  async function load(buffer: Buffer): Promise<Workbook> {
    const wb = new Workbook();
    await wb.xlsx.load(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
    );
    return wb;
  }

  it('context sheet + RTL data sheet with typed cells, n/a and a totals row', async () => {
    const wb = await load(await reportToXlsx(RESULT, options()));
    // Sheet names are sanitised: the fake translator's brackets are forbidden characters.
    expect(wb.worksheets.map((s) => s.name)).toEqual([
      'reports.context.sheetName',
      'reports.names.tradeBook',
    ]);
    const context = wb.worksheets[0];
    const data = wb.worksheets[1];
    if (!context || !data) throw new Error('missing sheets');
    expect(data.views[0]?.rightToLeft).toBe(true);
    expect(context.getCell('A1').value).toBe('[reports.context.report]');
    expect(context.getCell('B1').value).toBe('[reports.names.tradeBook]');
    expect(String(context.getCell('B2').value)).toContain('(Asia/Jerusalem)');
    expect(context.getCell('A3').value).toBe('[reports.context.period]');
    expect(context.getCell('B3').value).toBe('01.01.2026 – 12.11.2026');

    expect(data.getCell('A2').value).toBe('312-45-625');
    expect(data.getCell('B2').value).toBe('רונית לוי, "נוף הגליל"');
    expect(data.getCell('C2').value).toBe(92000.5);
    expect(data.getCell('C2').numFmt).toBe(MONEY_FORMAT);
    expect(data.getCell('D2').value).toEqual(new Date('2026-11-08T00:00:00.000Z'));
    expect(data.getCell('C3').value).toBe('[reports.na]');
    // Totals row: label in the first cell, sums of money columns.
    expect(data.getCell('A4').value).toBe('[reports.total]');
    expect(data.getCell('C4').value).toBe(92000.5);
    expect(data.getCell('C4').numFmt).toBe(MONEY_FORMAT);
  });

  it('an empty report gets a "no data" row and no totals row; en is left-to-right', async () => {
    const empty: ReportResult = { ...RESULT, rows: [], totals: { salePrice: null } };
    const wb = await load(await reportToXlsx(empty, options({ lang: 'en' })));
    const data = wb.worksheets[1];
    if (!data) throw new Error('missing data sheet');
    expect(data.views[0]?.rightToLeft).toBe(false);
    expect(data.getCell('A2').value).toBe('[reports.noData]');
    expect(data.rowCount).toBe(2);
  });
});
