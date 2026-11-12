import Handlebars from 'handlebars';
import {
  dateInZone,
  escapeHtml,
  formatPdfDate,
  formatPdfMoney,
  formatPdfNumber,
  formatPdfPlate,
  pdfDirection,
  pdfDocumentNumber,
  pdfFileName,
  pickPdfLanguage,
} from './pdf-format';
import { pdfEnumLabel, pdfLocales, pdfT } from './pdf-i18n';
import { registerPdfHelpers } from './pdf-templates';

function render(source: string, context: Record<string, unknown> = {}, lang = 'he'): string {
  const hb = Handlebars.create();
  registerPdfHelpers(hb);
  return hb.compile(source)({ lang, ...context });
}

describe('formatting rules', () => {
  it('money: ₪ first, comma grouping, 2 decimals, Latin digits', () => {
    expect(formatPdfMoney(1234.5)).toBe('₪1,234.50');
    expect(formatPdfMoney('89900')).toBe('₪89,900.00');
    expect(formatPdfMoney(0)).toBe('₪0.00');
    expect(formatPdfMoney(-250.255)).toBe('-₪250.26');
  });

  it('dates DD/MM/YYYY from calendar dates and instants', () => {
    expect(formatPdfDate('2026-11-07')).toBe('07/11/2026');
    expect(formatPdfDate('2026-11-07T22:30:00.000Z')).toBe('07/11/2026');
    expect(formatPdfDate(new Date('2026-01-31T00:00:00.000Z'))).toBe('31/01/2026');
    expect(dateInZone(new Date('2026-07-01T21:30:00.000Z'), 'Asia/Jerusalem')).toBe('2026-07-02');
  });

  it('numbers, plates, escaping', () => {
    expect(formatPdfNumber(128400)).toBe('128,400');
    expect(formatPdfPlate('31245625')).toBe('312-45-625');
    expect(formatPdfPlate('8473126')).toBe('84-731-26');
    expect(escapeHtml('<b>"A&B"</b>')).toBe('&lt;b&gt;&quot;A&amp;B&quot;&lt;/b&gt;');
  });

  it('document numbers and file names', () => {
    expect(pdfDocumentNumber('LC', { no: 12 })).toBe('LC-000012');
    expect(pdfDocumentNumber('DR', { date: '2026-11-12', id: 'cmw5mpia40000xdlkeklpwya6' })).toBe(
      'DR-20261112-LPWYA6',
    );
    expect(pdfFileName('sale-agreement', 'SA-000004', 'he')).toBe(
      'sale-agreement-sa-000004-he.pdf',
    );
  });
});

describe('language and direction', () => {
  it('requested language wins, then the counterparty, then the user, then Hebrew', () => {
    expect(pickPdfLanguage('en', 'ar', 'he')).toBe('en');
    expect(pickPdfLanguage(undefined, 'ar', 'en')).toBe('ar');
    expect(pickPdfLanguage(undefined, null, 'en')).toBe('en');
    expect(pickPdfLanguage(undefined, 'fr', 'en')).toBe('en');
    expect(pickPdfLanguage(undefined, undefined, undefined)).toBe('he');
  });

  it('he / ar are right-to-left, en left-to-right', () => {
    expect(pdfDirection('he')).toBe('rtl');
    expect(pdfDirection('ar')).toBe('rtl');
    expect(pdfDirection('en')).toBe('ltr');
  });

  it('the three PDF locales have the same keys; ar / en state that Hebrew prevails', () => {
    const keys = (tree: object, prefix = ''): string[] =>
      Object.entries(tree).flatMap(([k, v]) =>
        typeof v === 'string' ? [`${prefix}${k}`] : keys(v as object, `${prefix}${k}.`),
      );
    const { he, ar, en } = pdfLocales();
    expect(keys(ar).sort()).toEqual(keys(he).sort());
    expect(keys(en).sort()).toEqual(keys(he).sort());
    expect(pdfT('he', 'common.translationNotice')).toBe('');
    expect(pdfT('en', 'common.translationNotice')).toMatch(/Hebrew version prevails/);
    expect(pdfT('ar', 'common.translationNotice')).toMatch(/يسري النص العبري/);
    expect(pdfT('he', 'receipt.notTaxInvoice')).toContain('אינו מהווה חשבונית מס/קבלה');
  });

  it('enum labels come from the shared locales with a PDF fallback', () => {
    expect(pdfEnumLabel('en', 'NoSuchEnum', 'X')).toBe('X');
    expect(pdfEnumLabel('he', 'DepositKind', 'CASH')).toBeTruthy();
  });
});

describe('Handlebars helpers', () => {
  it('ltr / plate / money / date wrap values in <bdi dir="ltr">', () => {
    expect(render('{{ltr v}}', { v: 'TP-88412' })).toBe('<bdi dir="ltr">TP-88412</bdi>');
    expect(render('{{plate v}}', { v: '31245625' })).toBe('<bdi dir="ltr">312-45-625</bdi>');
    expect(render('{{money v}}', { v: 6500 })).toBe('<bdi dir="ltr">₪6,500.00</bdi>');
    expect(render('{{date v}}', { v: '2026-08-16' })).toBe('<bdi dir="ltr">16/08/2026</bdi>');
    expect(render('{{phone v}}', { v: '0527345611' })).toBe('<bdi dir="ltr">052-734-5611</bdi>');
    expect(render('{{num v "km"}}', { v: 128400 })).toBe('<bdi dir="ltr">128,400</bdi> km');
  });

  it('missing values print a dash; text is escaped', () => {
    expect(render('{{money v}}|{{date v}}|{{ltr v}}', { v: null })).toBe('—|—|—');
    expect(render('{{ltr v}}', { v: '<x>' })).toBe('<bdi dir="ltr">&lt;x&gt;</bdi>');
    expect(render('{{auto v}}', { v: 'خالد' })).toBe('<bdi dir="auto">خالد</bdi>');
    expect(render('{{text v}}', { v: 'a\n<b>' })).toBe(
      '<span class="free" dir="auto">a\n&lt;b&gt;</span>',
    );
  });

  it('t fills placeholders: helper output stays HTML, plain values are escaped', () => {
    const he = render('{{t "lease.term" start=(date a) end=(date b)}}', {
      a: '2026-08-16',
      b: '2027-08-15',
    });
    expect(he).toContain('<bdi dir="ltr">16/08/2026</bdi>');
    expect(he).toContain('<bdi dir="ltr">15/08/2027</bdi>');
    expect(he).toContain('תקופת השכירות תחל');
    const en = render('{{t "receipt.payment" name=n amount=(money 5)}}', { n: '<Dana>' }, 'en');
    expect(en).toBe(
      'We confirm that we have received from &lt;Dana&gt; a payment of <bdi dir="ltr">₪5.00</bdi>.',
    );
  });

  it('check / box / conditions / concat', () => {
    expect(render('{{check v}}', { v: true })).toContain('mark yes');
    expect(render('{{check v}}', { v: false })).toContain('mark no');
    expect(render('{{check v}}', { v: null })).toContain('class="box"');
    expect(render('{{#if (and a (or b c))}}y{{else}}n{{/if}}', { a: 1, b: 0, c: 1 })).toBe('y');
    expect(render('{{#if (eq a "X")}}y{{/if}}{{#if (gt n 0)}}+{{/if}}', { a: 'X', n: 2 })).toBe(
      'y+',
    );
    expect(render('{{concat "lease.object." t}}', { t: 'NUMBER_ONLY' })).toBe(
      'lease.object.NUMBER_ONLY',
    );
    expect(render('{{pick f "a" "b"}}', { f: false })).toBe('b');
  });
});
