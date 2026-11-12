import { LOCALES, resources, type Locale, type LocaleTree } from '@renawi/shared';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
 * Wording of the generated PDFs lives in `pdf/locales/<lang>.json` (owned by the API, copied to
 * dist by the Nest build). Enum labels (deposit kind, payment method, fuel...) are read from the
 * shared web locales (`enums.<Name>.<VALUE>`), with the PDF locale as a fallback.
 */

/** Folder of the PDF locale files (next to this module in src and in dist). */
export const PDF_LOCALES_DIR = join(__dirname, 'locales');

let cache: Readonly<Record<Locale, LocaleTree>> | null = null;

/** The three PDF locale trees (read once). */
export function pdfLocales(): Readonly<Record<Locale, LocaleTree>> {
  if (!cache) {
    const out = {} as Record<Locale, LocaleTree>;
    for (const lang of LOCALES) {
      out[lang] = JSON.parse(
        readFileSync(join(PDF_LOCALES_DIR, `${lang}.json`), 'utf8'),
      ) as LocaleTree;
    }
    cache = Object.freeze(out);
  }
  return cache;
}

function lookup(tree: LocaleTree | undefined, key: string): string | undefined {
  let node: string | LocaleTree | undefined = tree;
  for (const part of key.split('.')) {
    if (!node || typeof node === 'string') return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/**
 * Raw PDF text of a key in a language; falls back to Hebrew (the legally leading version), then
 * to the key itself so a gap is visible.
 */
export function pdfText(lang: Locale, key: string): string {
  const trees = pdfLocales();
  return lookup(trees[lang], key) ?? lookup(trees.he, key) ?? key;
}

/** True when the key exists in the language (no fallback). */
export function hasPdfText(lang: Locale, key: string): boolean {
  return lookup(pdfLocales()[lang], key) !== undefined;
}

/** Fills `{{name}}` placeholders (values are inserted as given). */
export function fillPlaceholders(text: string, params: Readonly<Record<string, string>>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) =>
    name in params ? (params[name] as string) : match,
  );
}

/** Plain-text translation with placeholders (document titles, file metadata). */
export function pdfT(
  lang: Locale,
  key: string,
  params: Record<string, string | number> = {},
): string {
  return fillPlaceholders(
    pdfText(lang, key),
    Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  );
}

/** Label of an enum value: shared web locale, then the PDF locale (`enums.*`), then the value. */
export function pdfEnumLabel(lang: Locale, enumName: string, value: string): string {
  const key = `enums.${enumName}.${value}`;
  return lookup(resources[lang]?.common, key) ?? lookup(pdfLocales()[lang], key) ?? value;
}
