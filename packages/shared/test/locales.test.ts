import { describe, expect, it } from 'vitest';
import {
  LOCALES,
  RESPONSIBILITY_KEYS,
  RETURN_CHECKLIST_KEYS,
  TRANSFER_CHECKLIST_KEYS,
  Theme,
  labelledEnums,
  msg,
  resources,
} from '../src/index.js';
import ar from '../src/locales/ar/common.json';
import en from '../src/locales/en/common.json';
import he from '../src/locales/he/common.json';

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out.set(key, v);
    else for (const [ck, cv] of flatten(v, key)) out.set(ck, cv);
  }
  return out;
}

function get(tree: Tree, path: string): unknown {
  return path.split('.').reduce<unknown>((node, part) => {
    if (node && typeof node === 'object') return (node as Tree)[part];
    return undefined;
  }, tree);
}

const flat = Object.fromEntries(
  LOCALES.map((lng) => [lng, flatten(resources[lng].common as unknown as Tree)]),
) as Record<(typeof LOCALES)[number], Map<string, string>>;

const placeholders = (s: string) => [...s.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort();

describe('locale files', () => {
  it('have identical key sets in he, ar and en', () => {
    const en = [...flat.en.keys()].sort();
    expect([...flat.he.keys()].sort()).toEqual(en);
    expect([...flat.ar.keys()].sort()).toEqual(en);
  });

  it('have no empty strings', () => {
    for (const lng of LOCALES) {
      for (const [key, value] of flat[lng]) {
        expect(value.trim(), `${lng}:${key}`).not.toBe('');
      }
    }
  });

  it('use the same interpolation placeholders in every language', () => {
    for (const [key, value] of flat.en) {
      expect(placeholders(flat.he.get(key) ?? ''), `he:${key}`).toEqual(placeholders(value));
      expect(placeholders(flat.ar.get(key) ?? ''), `ar:${key}`).toEqual(placeholders(value));
    }
  });

  it('really are translated (Hebrew / Arabic script, not English placeholders)', () => {
    expect(he.nav.vehicles).toMatch(/[א-ת]/);
    expect(ar.nav.vehicles).toMatch(/[ء-ي]/);
    let sameAsEnglish = 0;
    for (const [key, value] of flat.en) if (flat.he.get(key) === value) sameAsEnglish++;
    // Only symbols / codes such as "ILS", "%", "1/4" may stay identical.
    expect(sameAsEnglish).toBeLessThan(10);
  });

  it('carry the brand name', () => {
    expect(en.app.name).toBe('Renawi Motors');
    expect(he.app.name).toBe('רינאוי מוטורס');
    expect(ar.app.name).toBe('ريناوي موتورز');
  });

  it('label every value of every labelled enum (and nothing else)', () => {
    for (const lng of LOCALES) {
      const enums = resources[lng].common.enums as unknown as Record<
        string,
        Record<string, string>
      >;
      expect(Object.keys(enums).sort(), lng).toEqual(Object.keys(labelledEnums).sort());
      for (const [name, schema] of Object.entries(labelledEnums)) {
        expect(Object.keys(enums[name] ?? {}).sort(), `${lng}:${name}`).toEqual(
          [...schema.options].sort(),
        );
      }
    }
  });

  it('contain every validation message key used by the schemas', () => {
    for (const lng of LOCALES) {
      for (const key of Object.values(msg)) {
        expect(typeof get(resources[lng].common as unknown as Tree, key), `${lng}:${key}`).toBe(
          'string',
        );
      }
    }
  });

  it('label checklists, responsibilities, languages and themes', () => {
    for (const lng of LOCALES) {
      const c = resources[lng].common as unknown as Tree;
      for (const k of TRANSFER_CHECKLIST_KEYS)
        expect(get(c, `checklist.transfer.${k}`)).toBeTypeOf('string');
      for (const k of RETURN_CHECKLIST_KEYS)
        expect(get(c, `checklist.condition.${k}`)).toBeTypeOf('string');
      for (const k of RESPONSIBILITY_KEYS)
        expect(get(c, `responsibility.${k}`)).toBeTypeOf('string');
      for (const k of LOCALES) expect(get(c, `language.${k}`)).toBeTypeOf('string');
      for (const k of Theme.options) expect(get(c, `theme.${k}`)).toBeTypeOf('string');
    }
  });

  it('have the navigation items of the app shell', () => {
    expect(Object.keys(en.nav)).toEqual([
      'dashboard',
      'vehicles',
      'taxiLicenses',
      'drivers',
      'leases',
      'deals',
      'fines',
      'contacts',
      'reminders',
      'reports',
      'settings',
    ]);
  });
});
