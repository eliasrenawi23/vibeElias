#!/usr/bin/env node
/**
 * Generates tokens.css and tokens.js from tokens.ts and checks colour contrast.
 *
 *   tokens.css  CSS custom properties (light on :root, dark via [data-theme="dark"] and
 *               prefers-color-scheme), plus two tiny utilities
 *   tokens.js   tokens.ts with the types stripped (Node's built-in stripTypeScriptTypes)
 *
 * Contrast: every text/background pair the UI relies on is checked against WCAG 2.2 AA and the
 * build fails if one drops below its threshold. `--contrast` prints the table as Markdown.
 *
 * Usage: node --disable-warning=ExperimentalWarning scripts/build-tokens.mjs [--contrast]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'tokens.ts');

const tokens = await import(pathToFileURL(SRC).href);
const { brand, palette, colors, typography, space, radius, shadows, motion, control } = tokens;

const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
const px = (n) => (n === 0 ? '0' : `${n}px`);

// ---------------------------------------------------------------------------------------------
// tokens.css
// ---------------------------------------------------------------------------------------------

function themeBlock(mode) {
  const lines = [];
  for (const [role, value] of Object.entries(colors[mode])) {
    lines.push(`--rm-color-${kebab(role)}: ${value};`);
  }
  for (const [name, value] of Object.entries(shadows[mode])) {
    lines.push(`--rm-shadow-${name}: ${value};`);
  }
  lines.push(`--rm-focus-ring: 0 0 0 3px ${colors[mode].focusRing};`);
  return lines;
}

function staticBlock() {
  const lines = ['/* Brand */'];
  for (const [name, value] of Object.entries(brand.colors)) {
    lines.push(`--rm-brand-${kebab(name)}: ${value};`);
  }
  lines.push('', '/* Palette (same in both themes) */');
  for (const [scale, steps] of Object.entries(palette)) {
    for (const [step, value] of Object.entries(steps))
      lines.push(`--rm-${scale}-${step}: ${value};`);
  }
  lines.push('', '/* Typography */');
  lines.push(`--rm-font-sans: ${typography.fontFamily};`);
  lines.push(`--rm-font-mono: ${typography.fontFamilyMono};`);
  lines.push(`--rm-font-numeric: ${typography.numeric};`);
  for (const [name, value] of Object.entries(typography.weight)) {
    lines.push(`--rm-font-weight-${name}: ${value};`);
  }
  for (const [name, style] of Object.entries(typography.scale)) {
    const k = kebab(name);
    lines.push(`--rm-text-${k}-size: ${px(style.size)};`);
    lines.push(`--rm-text-${k}-line-height: ${px(style.lineHeight)};`);
    lines.push(`--rm-text-${k}-weight: ${style.weight};`);
  }
  lines.push('', '/* Space (4px grid) */');
  for (const [step, value] of Object.entries(space))
    lines.push(`--rm-space-${step}: ${px(value)};`);
  lines.push('', '/* Radius */');
  for (const [name, value] of Object.entries(radius))
    lines.push(`--rm-radius-${name}: ${px(value)};`);
  lines.push('', '/* Controls */');
  for (const [name, value] of Object.entries(control)) {
    lines.push(`--rm-control-${kebab(name)}: ${px(value)};`);
  }
  lines.push('', '/* Motion */');
  for (const [name, value] of Object.entries(motion)) lines.push(`--rm-${kebab(name)}: ${value};`);
  return lines;
}

const indent = (lines, n) => lines.map((l) => (l ? ' '.repeat(n) + l : l));

const css = [
  '/*',
  ' * Renawi Motors design tokens.',
  ' * Generated from tokens.ts by scripts/build-tokens.mjs. Do not edit by hand.',
  ' *',
  ' * Light theme on :root. Dark theme when <html data-theme="dark">, or when the system prefers',
  ' * dark and the page has not forced <html data-theme="light">.',
  ' */',
  '',
  ':root {',
  '  color-scheme: light;',
  '',
  ...indent(staticBlock(), 2),
  '',
  '  /* Theme: light */',
  ...indent(themeBlock('light'), 2),
  '}',
  '',
  ":root[data-theme='dark'] {",
  '  color-scheme: dark;',
  ...indent(themeBlock('dark'), 2),
  '}',
  '',
  '@media (prefers-color-scheme: dark) {',
  "  :root:not([data-theme='light']) {",
  '    color-scheme: dark;',
  ...indent(themeBlock('dark'), 4),
  '  }',
  '}',
  '',
  '/* Utilities */',
  '',
  '/* Amounts, plates, dates and counters: tabular figures so columns line up. */',
  '.rm-tabular {',
  '  font-variant-numeric: tabular-nums;',
  '}',
  '',
  '/* Plates, VINs, phones, amounts inside RTL text: left-to-right and isolated. */',
  '.rm-ltr {',
  '  direction: ltr;',
  '  unicode-bidi: isolate;',
  '  white-space: nowrap;',
  '}',
  '',
].join('\n');

// ---------------------------------------------------------------------------------------------
// tokens.js
// ---------------------------------------------------------------------------------------------

async function buildJs() {
  const source = await readFile(SRC, 'utf8');
  // Stripping leaves blanks where the types were; tidy them up (code lines only, not comments).
  const isComment = (line) => /^\s*(\*|\/\*|\/\/)/.test(line);
  let js = stripTypeScriptTypes(source, { mode: 'strip' })
    .split('\n')
    .map((line) =>
      isComment(line)
        ? line
        : line.replace(/(?<=\S)[ \t]{2,}(?=[)\],;])/g, '').replace(/(?<=\S)[ \t]{2,}/g, ' '),
    )
    .join('\n')
    .replace(/[ \t]+$/gm, '')
    // doc comments of stripped interfaces/types are left dangling before a blank line
    .replace(/^\/\*\*(?:(?!\*\/)[\s\S])*\*\/\n(?=\n)/gm, '')
    .replace(/\n{3,}/g, '\n\n');
  js = `// Generated from tokens.ts by scripts/build-tokens.mjs (types stripped). Do not edit.\n${js}`;
  return format(js, 'tokens.js');
}

/** Formats generated output with the repo's Prettier when it is installed (root devDependency). */
async function format(text, file) {
  try {
    const prettier = await import('prettier');
    const target = path.join(ROOT, file);
    const options = (await prettier.resolveConfig(target)) ?? {};
    return await prettier.format(text, { ...options, filepath: target });
  } catch {
    return text; // Prettier not installed: the unformatted output is still valid.
  }
}

// ---------------------------------------------------------------------------------------------
// Contrast (WCAG 2.2)
// ---------------------------------------------------------------------------------------------

function parseColor(value) {
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)).concat(1);
  const rgba = value.match(/^rgba?\(([^)]+)\)$/);
  if (rgba) {
    const [r, g, b, a = 1] = rgba[1].split(',').map((v) => Number(v.trim()));
    return [r, g, b, a];
  }
  throw new Error(`Cannot parse colour ${value}`);
}

/** Composites `fg` (may be translucent) over an opaque `bg`. */
function over(fg, bg) {
  const [r, g, b, a] = parseColor(fg);
  const [R, G, B] = parseColor(bg);
  return [r * a + R * (1 - a), g * a + G * (1 - a), b * a + B * (1 - a)];
}

function luminance([r, g, b]) {
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(fg, bg, base) {
  const bgRgb = over(bg, base);
  const bgHex = `#${bgRgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
  const fgRgb = over(fg, bgHex);
  const [hi, lo] = [luminance(fgRgb), luminance(bgRgb)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** [label, foreground role, background role, minimum ratio (0 = informational only)] */
const PAIRS = [
  ['Body text on card', 'text', 'bgContainer', 4.5],
  ['Body text on page', 'text', 'bgLayout', 4.5],
  ['Secondary text on card', 'textSecondary', 'bgContainer', 4.5],
  ['Secondary text on table header', 'textSecondary', 'bgSunken', 4.5],
  ['Tertiary text / placeholder on card', 'textTertiary', 'bgContainer', 4.5],
  ['Text on primary button (yellow)', 'onPrimary', 'primary', 4.5],
  ['Text on selected row / menu item', 'text', 'primarySoft', 4.5],
  ['Primary-coloured text on card', 'primaryText', 'bgContainer', 4.5],
  ['Link on card', 'link', 'bgContainer', 4.5],
  ['Success text on card', 'success', 'bgContainer', 4.5],
  ['Success text on success tag', 'success', 'successBg', 4.5],
  ['Warning text on card', 'warning', 'bgContainer', 4.5],
  ['Warning text on warning tag', 'warning', 'warningBg', 4.5],
  ['Error text on card', 'error', 'bgContainer', 4.5],
  ['Error text on error tag', 'error', 'errorBg', 4.5],
  ['Info text on card', 'info', 'bgContainer', 4.5],
  ['Info text on info tag', 'info', 'infoBg', 4.5],
  ['Accent text on accent tag (primary-soft)', 'primaryText', 'primarySoft', 4.5],
  ['Neutral text on neutral tag', 'neutral', 'neutralBg', 4.5],
  ['Purple text on card', 'purple', 'bgContainer', 4.5],
  ['Purple text on purple tag', 'purple', 'purpleBg', 4.5],
  ['Licence green on card', 'license', 'bgContainer', 4.5],
  ['Licence green on licence tag', 'license', 'licenseBg', 4.5],
  ['Nav text on chrome', 'chromeText', 'chromeBg', 4.5],
  ['Nav secondary text on chrome', 'chromeTextSecondary', 'chromeBg', 4.5],
  ['Selected nav item', 'chromeSelectedText', 'chromeSelectedBg', 4.5],
  ['Text on danger button / error fill', 'onStatus', 'error', 4.5],
  ['Text on success fill', 'onStatus', 'success', 4.5],
  ['Text on warning fill', 'onStatus', 'warning', 4.5],
  ['Text on licence fill', 'onStatus', 'license', 4.5],
  ['Focus border (ink / yellow) vs card', 'FOCUS', 'bgContainer', 3],
  ['Yellow fill vs card (decorative only)', 'primary', 'bgContainer', 0],
];

const SOLID_PAIRS = [['White on yellow (never use)', '#FFFFFF', 'primary', 0]];

function contrastRows() {
  const rows = [];
  for (const mode of ['light', 'dark']) {
    const c = colors[mode];
    const base = c.bgContainer;
    for (const [label, fg, bg, min] of PAIRS) {
      const fgValue = fg === 'FOCUS' ? (mode === 'light' ? palette.grey[950] : c.primary) : c[fg];
      rows.push({
        mode,
        label,
        fg: fgValue,
        bg: c[bg],
        ratio: contrast(fgValue, c[bg], base),
        min,
      });
    }
    if (mode === 'light') {
      for (const [label, fg, bg, min] of SOLID_PAIRS) {
        rows.push({ mode, label, fg, bg: c[bg], ratio: contrast(fg, c[bg], base), min });
      }
    }
  }
  return rows;
}

function markdownTable(rows) {
  const out = [
    '| Theme | Pair | Foreground | Background | Ratio | Needs | Result |',
    '|---|---|---|---|---|---|---|',
  ];
  for (const r of rows) {
    const result = r.min === 0 ? 'info' : r.ratio >= r.min ? (r.ratio >= 7 ? 'AAA' : 'AA') : 'FAIL';
    const needs = r.min === 0 ? '-' : `${r.min}:1`;
    out.push(
      `| ${r.mode} | ${r.label} | \`${r.fg}\` | \`${r.bg}\` | ${r.ratio.toFixed(2)}:1 | ${needs} | ${result} |`,
    );
  }
  return out.join('\n');
}

// ---------------------------------------------------------------------------------------------

const rows = contrastRows();
const failures = rows.filter((r) => r.min > 0 && r.ratio < r.min);
if (process.argv.includes('--contrast')) console.log(markdownTable(rows));

await writeFile(path.join(ROOT, 'tokens.css'), await format(css, 'tokens.css'), 'utf8');
await writeFile(path.join(ROOT, 'tokens.js'), await buildJs(), 'utf8');
console.log(`build-tokens: wrote tokens.css and tokens.js; ${rows.length} contrast pairs checked`);

if (failures.length) {
  for (const f of failures) {
    console.error(`  FAIL ${f.mode}: ${f.label} ${f.ratio.toFixed(2)}:1 < ${f.min}:1`);
  }
  process.exitCode = 1;
}
