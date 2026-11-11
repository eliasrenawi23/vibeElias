import { resources, type Locale, type LocaleTree } from '@renawi/shared';

/** Translates an i18n key of the shared `common` namespace; `{{name}}` placeholders filled. */
export type Translate = (key: string, params?: Record<string, string | number>) => string;

function lookup(tree: LocaleTree, key: string): string | undefined {
  let node: string | LocaleTree | undefined = tree;
  for (const part of key.split('.')) {
    if (!node || typeof node === 'string') return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/**
 * Server-side translator for exports, reading the shared locale files (read-only). A missing
 * key falls back to the key itself so a gap is visible instead of silently empty.
 */
export function translator(lang: Locale, tree: LocaleTree = resources[lang].common): Translate {
  return (key, params) => {
    const text = lookup(tree, key) ?? key;
    if (!params) return text;
    return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) =>
      name in params ? String(params[name]) : match,
    );
  };
}
