import { Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/*
 * Self-hosted fonts and the logo of the generated PDFs. Rubik (variable, Latin + Hebrew +
 * Arabic) comes from `packages/brand/fonts`; Noto Sans Hebrew / Arabic from the web app's
 * `@fontsource` packages when they can be resolved (development), else Rubik alone (it covers
 * all three scripts). Everything is embedded as base64 `@font-face` rules, so Chromium never
 * loads anything from the network or the system.
 */

const logger = new Logger('PdfAssets');

/** `packages/brand` of the monorepo (dev: from src or dist; Docker: /app/packages/brand). */
export function findBrandDir(): string | null {
  const candidates = [
    process.env.PDF_BRAND_DIR,
    resolve(__dirname, '../../../../packages/brand'),
    resolve(process.cwd(), '../../packages/brand'),
    resolve(process.cwd(), 'packages/brand'),
  ].filter((p): p is string => !!p);
  return candidates.find((dir) => existsSync(join(dir, 'fonts', 'Rubik[wght].ttf'))) ?? null;
}

function fontsourceFile(pkg: string, file: string): string | null {
  try {
    const dir = dirname(require.resolve(`${pkg}/package.json`));
    const path = join(dir, 'files', file);
    return existsSync(path) ? path : null;
  } catch {
    return null;
  }
}

interface FontFace {
  family: string;
  path: string;
  format: 'truetype' | 'woff2';
  weight: string;
  unicodeRange?: string;
}

/** Hebrew block + presentation forms (fallback face only). */
const HEBREW_RANGE = 'U+0590-05FF, U+200C-2010, U+20AA, U+25CC, U+FB1D-FB4F';
/** Arabic blocks + presentation forms (fallback face only). */
const ARABIC_RANGE =
  'U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0898-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC';

function faces(): FontFace[] {
  const out: FontFace[] = [];
  const brand = findBrandDir();
  if (brand) {
    out.push({
      family: 'Rubik',
      path: join(brand, 'fonts', 'Rubik[wght].ttf'),
      format: 'truetype',
      weight: '300 900',
    });
  } else {
    logger.warn('Rubik font not found (packages/brand/fonts); PDFs fall back to system fonts');
  }
  for (const weight of ['400', '700']) {
    const he = fontsourceFile('@fontsource/noto-sans-hebrew', `noto-sans-hebrew-hebrew-${weight}-normal.woff2`);
    if (he) out.push({ family: 'Noto Sans Hebrew', path: he, format: 'woff2', weight, unicodeRange: HEBREW_RANGE });
    const ar = fontsourceFile('@fontsource/noto-sans-arabic', `noto-sans-arabic-arabic-${weight}-normal.woff2`);
    if (ar) out.push({ family: 'Noto Sans Arabic', path: ar, format: 'woff2', weight, unicodeRange: ARABIC_RANGE });
  }
  return out;
}

export interface PdfAssets {
  /** `@font-face` rules with base64 data URLs. */
  fontCss: string;
  /** Only the Rubik face (for the header / footer template, which cannot see page fonts). */
  footerFontCss: string;
  /** Families in fallback order, for `font-family`. */
  fontFamily: string;
  /** Inline concept-B icon (taxi roof sign with an R) as an `<svg>` element. */
  logoSvg: string;
  /** Font families that were embedded (for diagnostics / tests). */
  families: string[];
}

let cached: PdfAssets | null = null;

const FALLBACK_LOGO =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 36" role="img" aria-label="Renawi Motors">' +
  '<path fill="#F5C518" d="M6 28L9.93 6Q11 0 17 0H47Q53 0 54.07 6L58 28Z"/>' +
  '<path fill="#0F0F10" d="M5.5 31h53a2.5 2.5 0 0 1 0 5h-53a2.5 2.5 0 0 1 0-5z"/></svg>';

function loadLogo(): string {
  const brand = findBrandDir();
  const path = brand ? join(brand, 'logo', 'b-icon.svg') : null;
  if (!path || !existsSync(path)) return FALLBACK_LOGO;
  return readFileSync(path, 'utf8')
    .replace(/<\?xml[^>]*>\s*/g, '')
    .replace(/<title>[\s\S]*?<\/title>\s*/g, '')
    .trim();
}

function faceCss(f: FontFace): string {
  const data = readFileSync(f.path).toString('base64');
  const mime = f.format === 'woff2' ? 'font/woff2' : 'font/ttf';
  const range = f.unicodeRange ? `unicode-range:${f.unicodeRange};` : '';
  return (
    `@font-face{font-family:'${f.family}';font-style:normal;font-weight:${f.weight};` +
    `font-display:block;${range}src:url(data:${mime};base64,${data}) format('${f.format}');}`
  );
}

/** Fonts and logo (read once per process). */
export function pdfAssets(): PdfAssets {
  if (cached) return cached;
  const list = faces();
  const rubik = list.filter((f) => f.family === 'Rubik');
  const families = [...new Set(list.map((f) => f.family))];
  cached = {
    fontCss: list.map(faceCss).join('\n'),
    footerFontCss: rubik.map(faceCss).join('\n'),
    fontFamily: [...families.map((f) => `'${f}'`), 'Arial', 'sans-serif'].join(', '),
    logoSvg: loadLogo(),
    families,
  };
  return cached;
}
