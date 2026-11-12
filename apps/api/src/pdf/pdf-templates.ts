import type { Locale, PdfTemplate } from '@renawi/shared';
import Handlebars from 'handlebars';
import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { pdfAssets, type PdfAssets } from './pdf-assets';
import {
  escapeHtml,
  formatPdfDate,
  formatPdfMoney,
  formatPdfNumber,
  formatPdfPhone,
  formatPdfPlate,
  ltrIsolate,
} from './pdf-format';
import { fillPlaceholders, pdfEnumLabel, pdfText } from './pdf-i18n';
import type { PdfModel } from './pdf-models';

/** Folder of the Handlebars templates (next to this module in src and in dist). */
export const PDF_TEMPLATES_DIR = join(__dirname, 'templates');

/** Template file per PDF template (some templates share a file). */
const TEMPLATE_FILES: Readonly<Record<PdfTemplate, string>> = {
  'lease-contract': 'lease-contract',
  handover: 'checklist',
  return: 'checklist',
  'deposit-receipt': 'receipt',
  'payment-confirmation': 'receipt',
  'sale-agreement': 'sale-agreement',
  'purchase-agreement': 'purchase-agreement',
  'consignment-agreement': 'consignment-agreement',
  'disclosure-form': 'disclosure-form',
};

/** Placeholder printed for a missing value. */
const DASH = '—';

type HelperOptions = Handlebars.HelperOptions;
type Hb = typeof Handlebars;

function langOf(options: HelperOptions): Locale {
  const root = (options.data as { root?: { lang?: Locale } } | undefined)?.root;
  return root?.lang ?? 'he';
}

function isMissing(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

const CHECK_SVG =
  '<svg class="mark yes" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.4 6.4l2.4 2.4 4.8-5.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CROSS_SVG =
  '<svg class="mark no" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3l-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const BOX_SVG =
  '<svg class="box" viewBox="0 0 12 12" aria-hidden="true"><rect x="0.75" y="0.75" width="10.5" height="10.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1"/></svg>';
const BOX_CHECKED_SVG =
  '<svg class="box" viewBox="0 0 12 12" aria-hidden="true"><rect x="0.75" y="0.75" width="10.5" height="10.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1"/><path d="M2.8 6.2l2.2 2.2 4.2-4.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/**
 * Registers the template helpers on a Handlebars instance:
 * - `t key name=value…` translated PDF text (params escaped unless they are helper output)
 * - `ltr`, `money`, `date`, `plate`, `phone`, `num` values isolated as `<bdi dir="ltr">`
 * - `auto` free text isolated with `dir="auto"`; `text` multi-line free text
 * - `enum Name VALUE` label from the shared locales; `check` ✓ / ✗; `box` form checkbox
 * - `eq ne and or not gt concat` for conditions
 */
export function registerPdfHelpers(hb: Hb): void {
  const safe = (html: string) => new hb.SafeString(html);
  const htmlOf = (value: unknown): string => {
    if (value instanceof hb.SafeString) return value.toHTML();
    if (isMissing(value)) return DASH;
    return escapeHtml(String(value));
  };

  hb.registerHelper('t', function (key: string, options: HelperOptions) {
    const params: Record<string, string> = {};
    for (const [name, value] of Object.entries(options.hash as Record<string, unknown>)) {
      params[name] = htmlOf(value);
    }
    return safe(fillPlaceholders(pdfText(langOf(options), String(key)), params));
  });

  hb.registerHelper('ltr', (value: unknown) =>
    safe(isMissing(value) ? DASH : ltrIsolate(escapeHtml(String(value)))),
  );
  hb.registerHelper('money', (value: unknown) =>
    safe(
      isMissing(value) || Number.isNaN(Number(value))
        ? DASH
        : ltrIsolate(escapeHtml(formatPdfMoney(Number(value)))),
    ),
  );
  hb.registerHelper('date', (value: unknown) =>
    safe(isMissing(value) ? DASH : ltrIsolate(escapeHtml(formatPdfDate(value as string | Date)))),
  );
  hb.registerHelper('plate', (value: unknown) =>
    safe(isMissing(value) ? DASH : ltrIsolate(escapeHtml(formatPdfPlate(String(value))))),
  );
  hb.registerHelper('phone', (value: unknown) =>
    safe(isMissing(value) ? DASH : ltrIsolate(escapeHtml(formatPdfPhone(String(value))))),
  );
  hb.registerHelper('num', (value: unknown, unit: unknown) => {
    if (isMissing(value) || Number.isNaN(Number(value))) return safe(DASH);
    const text = formatPdfNumber(Number(value));
    const unitHtml =
      unit instanceof hb.SafeString
        ? unit.toHTML()
        : typeof unit === 'string'
          ? escapeHtml(unit)
          : '';
    return safe(ltrIsolate(escapeHtml(text)) + (unitHtml ? ` ${unitHtml}` : ''));
  });
  hb.registerHelper('auto', (value: unknown) =>
    safe(isMissing(value) ? DASH : `<bdi dir="auto">${escapeHtml(String(value))}</bdi>`),
  );
  hb.registerHelper('text', (value: unknown) =>
    safe(
      isMissing(value)
        ? DASH
        : `<span class="free" dir="auto">${escapeHtml(String(value).trim())}</span>`,
    ),
  );
  hb.registerHelper('enum', (name: string, value: unknown, options: HelperOptions) =>
    isMissing(value) ? DASH : pdfEnumLabel(langOf(options), String(name), String(value)),
  );
  hb.registerHelper('check', (value: unknown) =>
    safe(value === true ? CHECK_SVG : value === false ? CROSS_SVG : BOX_SVG),
  );
  hb.registerHelper('box', (value: unknown) => safe(value === true ? BOX_CHECKED_SVG : BOX_SVG));

  hb.registerHelper('eq', (a: unknown, b: unknown) => a === b);
  hb.registerHelper('ne', (a: unknown, b: unknown) => a !== b);
  hb.registerHelper('gt', (a: unknown, b: unknown) => Number(a) > Number(b));
  hb.registerHelper('not', (a: unknown) => !a);
  hb.registerHelper('and', (...args: unknown[]) => args.slice(0, -1).every(Boolean));
  hb.registerHelper('or', (...args: unknown[]) => args.slice(0, -1).some(Boolean));
  hb.registerHelper('pick', (cond: unknown, a: unknown, b: unknown) => (cond ? a : b));
  // Plain strings join as text (e.g. i18n keys); joining helper output keeps it as HTML.
  hb.registerHelper('concat', (...args: unknown[]) => {
    const parts = args.slice(0, -1);
    if (!parts.some((a) => a instanceof hb.SafeString)) {
      return parts.map((a) => (isMissing(a) ? '' : String(a))).join('');
    }
    return safe(
      parts
        .map((a) =>
          a instanceof hb.SafeString ? a.toHTML() : isMissing(a) ? '' : escapeHtml(String(a)),
        )
        .join(''),
    );
  });
}

/**
 * Renders the PDF templates to HTML: a shared layout (letterhead, fonts, `dir`) around one
 * template per document, plus the footer template used by Chromium's header / footer.
 */
export class PdfTemplateEngine {
  private readonly hb: Hb = Handlebars.create();
  private readonly templates = new Map<string, Handlebars.TemplateDelegate>();
  private readonly footerTemplate: Handlebars.TemplateDelegate;

  constructor(
    private readonly dir: string = PDF_TEMPLATES_DIR,
    private readonly assets: () => PdfAssets = pdfAssets,
  ) {
    registerPdfHelpers(this.hb);
    const partials = join(dir, 'partials');
    for (const file of readdirSync(partials).filter((f) => f.endsWith('.hbs'))) {
      this.hb.registerPartial(basename(file, '.hbs'), readFileSync(join(partials, file), 'utf8'));
    }
    this.footerTemplate = this.compile('footer');
  }

  private compile(name: string): Handlebars.TemplateDelegate {
    let tpl = this.templates.get(name);
    if (!tpl) {
      tpl = this.hb.compile(readFileSync(join(this.dir, `${name}.hbs`), 'utf8'), {
        strict: false,
        preventIndent: true,
      });
      this.templates.set(name, tpl);
    }
    return tpl;
  }

  /** Full HTML document of a model. */
  render(model: PdfModel): string {
    return this.compile(TEMPLATE_FILES[model.template])({ ...model, assets: this.assets() });
  }

  /** Footer template for `page.pdf({ footerTemplate })` (page x of y, document number). */
  footer(model: PdfModel): string {
    return this.footerTemplate({ ...model, assets: this.assets() });
  }
}
