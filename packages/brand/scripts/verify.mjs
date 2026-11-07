#!/usr/bin/env node
/**
 * Sanity checks for the brand package. Exits non-zero on the first category with errors.
 *
 * - every SVG in logo/ parses (librsvg via sharp, a strict XML parser) and rasterises, has an
 *   xmlns and a viewBox, and contains no <text>, <script> or external references
 *   (wordmarks must be outlines)
 * - the full logo set exists for both concepts and all three languages
 * - the PNG icons exist at the expected sizes
 * - every relative src/href in brand-preview.html resolves to a file
 * - tokens.css defines the same colour roles for light and dark
 * - every target in package.json "exports" exists
 *
 * Usage: node scripts/verify.mjs
 */
import { readFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const ok = [];
const exists = (p) =>
  access(p).then(
    () => true,
    () => false,
  );

// SVGs ------------------------------------------------------------------------------------------
const logoDir = path.join(ROOT, 'logo');
const svgs = (await readdir(logoDir)).filter((f) => f.endsWith('.svg')).sort();
for (const file of svgs) {
  const svg = await readFile(path.join(logoDir, file), 'utf8');
  const open = svg.match(/<svg\b[^>]*>/)?.[0] ?? '';
  if (!open.includes('xmlns="http://www.w3.org/2000/svg"')) errors.push(`${file}: missing xmlns`);
  if (!/\bviewBox="[^"]+"/.test(open)) errors.push(`${file}: missing viewBox`);
  if (/<text\b/.test(svg))
    errors.push(`${file}: contains live <text> (wordmarks must be outlines)`);
  if (/<script\b/i.test(svg)) errors.push(`${file}: contains <script>`);
  if (/(?:href|src)="(?!#)[^"]+"/.test(svg))
    errors.push(`${file}: references an external resource`);
  try {
    const { width, height } = await sharp(Buffer.from(svg))
      .png()
      .toBuffer({ resolveWithObject: true })
      .then((r) => r.info);
    if (!width || !height) errors.push(`${file}: rendered to an empty image`);
  } catch (err) {
    errors.push(`${file}: does not parse/render: ${err.message}`);
  }
}
ok.push(`${svgs.length} SVGs parse and render`);

const expected = ['favicon.svg'];
for (const c of ['a', 'b']) {
  expected.push(`${c}-icon.svg`, `${c}-icon-inverse.svg`, `${c}-icon-mono.svg`);
  for (const l of ['en', 'he', 'ar']) {
    expected.push(`${c}-horizontal-${l}.svg`, `${c}-stacked-${l}.svg`, `${c}-on-dark-${l}.svg`);
  }
}
for (const f of expected) if (!svgs.includes(f)) errors.push(`logo/${f} is missing`);
ok.push(`${expected.length} expected logo files present`);

// PNG icons -------------------------------------------------------------------------------------
const icons = {
  'icon-192.png': 192,
  'icon-512.png': 512,
  'apple-touch-icon-180.png': 180,
  'maskable-512.png': 512,
};
for (const [file, size] of Object.entries(icons)) {
  const p = path.join(ROOT, 'icons', file);
  if (!(await exists(p))) {
    errors.push(`icons/${file} is missing (run npm run build:icons)`);
    continue;
  }
  const meta = await sharp(p).metadata();
  if (meta.width !== size || meta.height !== size) {
    errors.push(`icons/${file} is ${meta.width}x${meta.height}, expected ${size}x${size}`);
  }
}
ok.push(`${Object.keys(icons).length} PNG icons at the right sizes`);

// brand-preview.html ----------------------------------------------------------------------------
const html = await readFile(path.join(ROOT, 'brand-preview.html'), 'utf8');
const refs = new Set();
for (const m of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
  const ref = m[1];
  if (/^(?:https?:|#|data:|mailto:)/.test(ref) || ref.includes("' +")) continue; // skip JS-built strings
  refs.add(ref);
}
// paths the preview script assembles at runtime: 'logo/' + id + '-...'
for (const m of html.matchAll(
  /'logo\/' \+ (?:id|state\.concept) \+ '(-[a-z-]+?)(?:-' \+ (?:l|lang) \+ ')?\.svg'/g,
)) {
  const withLang = m[0].includes('+ l +') || m[0].includes('+ lang +');
  for (const c of ['a', 'b']) {
    if (withLang) for (const l of ['en', 'he', 'ar']) refs.add(`logo/${c}${m[1]}-${l}.svg`);
    else refs.add(`logo/${c}${m[1]}.svg`);
  }
}
for (const ref of refs) {
  if (!(await exists(path.resolve(ROOT, ref))))
    errors.push(`brand-preview.html: ${ref} does not resolve`);
}
ok.push(`${refs.size} brand-preview.html references resolve`);

// tokens.css ------------------------------------------------------------------------------------
const css = await readFile(path.join(ROOT, 'tokens.css'), 'utf8');
const block = (selector) => {
  const start = css.indexOf(selector);
  return start < 0 ? '' : css.slice(start, css.indexOf('}', start));
};
const roles = (text) =>
  [...text.matchAll(/--rm-color-([a-z-]+):/g)]
    .map((m) => m[1])
    .sort()
    .join(',');
const lightRoles = roles(block(':root {'));
const darkRoles = roles(block(":root[data-theme='dark'] {"));
const mediaRoles = roles(block(":root:not([data-theme='light']) {"));
if (!lightRoles || lightRoles !== darkRoles || darkRoles !== mediaRoles) {
  errors.push('tokens.css: light and dark themes define different colour roles');
}
ok.push(`tokens.css: ${lightRoles.split(',').length} colour roles in light, dark and system-dark`);

// package.json exports --------------------------------------------------------------------------
const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
for (const [key, target] of Object.entries(pkg.exports)) {
  const targets = typeof target === 'string' ? [target] : Object.values(target);
  for (const t of targets) {
    const p = path.resolve(ROOT, t.replace('/*', ''));
    if (!(await exists(p))) errors.push(`package.json exports["${key}"] -> ${t} does not exist`);
  }
}
ok.push('package.json exports resolve');

for (const line of ok) console.log(`ok  ${line}`);
if (errors.length) {
  for (const e of errors) console.error(`ERR ${e}`);
  process.exitCode = 1;
} else {
  console.log('verify: all checks passed');
}
