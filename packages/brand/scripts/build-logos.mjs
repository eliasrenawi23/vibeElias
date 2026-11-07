#!/usr/bin/env node
/**
 * Builds the Renawi Motors logo lockups.
 *
 * Inputs (hand-written, the source of truth):
 *   logo/{a,b}-icon.svg          mark for light backgrounds
 *   logo/{a,b}-icon-inverse.svg  mark for dark backgrounds
 *   fonts/Rubik[wght].ttf        Rubik variable font (SIL OFL 1.1)
 *
 * Outputs (generated, committed):
 *   logo/{a,b}-horizontal-{en,he,ar}.svg  icon on the leading side, one-line wordmark
 *   logo/{a,b}-stacked-{en,he,ar}.svg     icon above a two-line wordmark
 *   logo/{a,b}-on-dark-{en,he,ar}.svg     horizontal lockup for dark backgrounds
 *
 * Wordmarks are vector outlines, not live <text>, so they render identically without the font.
 * HarfBuzz (harfbuzzjs) shapes the text: Arabic joining forms, Hebrew/Arabic right-to-left
 * order and GPOS kerning with the variable-font deltas. opentype.js turns the shaped glyph ids
 * into outlines at the same weight (gvar) and writes them as SVG path data.
 * (opentype.js 2.0 alone cannot do the shaping for Rubik: its shaper throws on Rubik's chained
 * contextual ccmp lookups, and it skips GPOS extension lookups, where Rubik keeps its Latin
 * kerning.)
 *
 * Usage: node scripts/build-logos.mjs [--out <dir>]
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as hb from 'harfbuzzjs';
import opentype from 'opentype.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FONT_FILE = path.join(ROOT, 'fonts', 'Rubik[wght].ttf');
const LOGO_DIR = path.join(ROOT, 'logo');

const outArg = process.argv.indexOf('--out');
const OUT_DIR = outArg > -1 ? path.resolve(process.argv[outArg + 1]) : LOGO_DIR;

const INK = '#0F0F10';
const WHITE = '#FFFFFF';

/** Wordmark weight on Rubik's wght axis (300-900). */
const WEIGHT = 650;

/**
 * Wordmarks per script.
 * - `band`: the vertical band (font units, y up) that is aligned with the icon. Latin uses the
 *   cap height; Hebrew its letter height; Arabic its ink box (tall alef, deep descenders).
 * - `sizeRatio`: size of that band relative to the Latin cap height, so all three scripts read
 *   at the same optical size next to the same icon.
 * - `tracking`: letter-spacing in em. Arabic is never letter-spaced (it would break the joins).
 */
const WORDMARKS = {
  en: {
    lang: 'en',
    title: 'Renawi Motors',
    text: 'RENAWI MOTORS',
    lines: ['RENAWI', 'MOTORS'],
    band: 'cap',
    refHeight: 700,
    sizeRatio: 1,
    tracking: 0.045,
    justifyLine2: true,
  },
  he: {
    lang: 'he',
    title: 'רינאוי מוטורס',
    text: 'רינאוי מוטורס',
    lines: ['רינאוי', 'מוטורס'],
    band: 'ink',
    refHeight: 571,
    sizeRatio: 0.97,
    tracking: 0.02,
    justifyLine2: true,
  },
  ar: {
    lang: 'ar',
    title: 'ريناوي موتورز',
    text: 'ريناوي موتورز',
    lines: ['ريناوي', 'موتورز'],
    band: 'ink',
    refHeight: 750,
    sizeRatio: 1.22,
    tracking: 0,
    justifyLine2: false,
    line2Ratio: 0.64, // not letter-spaced, so a little larger to hold the block together
  },
};

/**
 * Per-concept lockup geometry in lockup units.
 * `capBand` (optional, in the mark's viewBox units): the wordmark's cap band is aligned with
 * this band of the mark (concept B aligns with the R inside the roof sign). Without it the cap
 * band is centred on the mark.
 */
const CONCEPTS = {
  a: {
    light: 'a-icon.svg',
    dark: 'a-icon-inverse.svg',
    markHeight: 64,
    capHeight: 30,
    gap: 20,
    stacked: { markHeight: 72, capHeight: 34, gap: 18, lineGap: 10, line2Ratio: 0.5 },
  },
  b: {
    light: 'b-icon.svg',
    dark: 'b-icon-inverse.svg',
    markHeight: 40,
    capBand: [3.36, 24.64],
    gap: 18,
    stacked: { markHeight: 48, capHeight: 34, gap: 16, lineGap: 10, line2Ratio: 0.5 },
  },
};

// ---------------------------------------------------------------------------------------------
// Shaping and outlines
// ---------------------------------------------------------------------------------------------

async function loadFonts() {
  const buf = await readFile(FONT_FILE);
  const data = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const otFont = opentype.parse(data);
  const hbFont = new hb.Font(new hb.Face(new hb.Blob(data)));
  hbFont.setVariations([hb.Variation.fromString(`wght=${WEIGHT}`)]);
  return { otFont, hbFont };
}

/**
 * Shapes one line. Returns glyphs in visual (left-to-right) order with x/y in font units and
 * the line's ink box (font units, y up).
 */
function shapeLine({ otFont, hbFont }, text, tracking = 0) {
  const buffer = new hb.Buffer();
  buffer.addText(text);
  buffer.guessSegmentProperties(); // script + direction from the text (RTL for he/ar)
  hb.shape(hbFont, buffer);
  const infos = buffer.getGlyphInfos();
  const positions = buffer.getGlyphPositions();

  const coords = { wght: WEIGHT };
  const trackingUnits = tracking * otFont.unitsPerEm;
  let pen = 0;
  const glyphs = infos.map((info, i) => {
    if (info.codepoint === 0) throw new Error(`Rubik has no glyph for part of "${text}"`);
    const pos = positions[i];
    const outline = otFont.variation.getTransform(otFont.glyphs.get(info.codepoint), coords);
    const glyph = { commands: outline.path.commands, x: pen + pos.xOffset, y: pos.yOffset };
    pen += pos.xAdvance + (i < infos.length - 1 ? trackingUnits : 0);
    return glyph;
  });

  const ink = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  for (const g of glyphs) {
    for (const c of g.commands) {
      for (const [px, py] of [
        [c.x, c.y],
        [c.x1, c.y1],
        [c.x2, c.y2],
      ]) {
        if (px === undefined) continue;
        ink.minX = Math.min(ink.minX, g.x + px);
        ink.maxX = Math.max(ink.maxX, g.x + px);
        ink.minY = Math.min(ink.minY, g.y + py);
        ink.maxY = Math.max(ink.maxY, g.y + py);
      }
    }
  }
  return { glyphs, ink, glyphCount: infos.length };
}

/** Vertical band (font units) of a line that is aligned with the icon. */
function bandOf(spec, line) {
  if (spec.band === 'cap') return { top: spec.refHeight, bottom: 0 };
  return { top: line.ink.maxY, bottom: line.ink.minY };
}

const round = (n) => {
  const r = Math.round(n * 100) / 100;
  return Object.is(r, -0) ? 0 : r;
};
const fmt = (n) => String(round(n));

/**
 * Converts a shaped line to SVG path data (y down). `left` is where the line's ink starts.
 * Returns the path data and the vertical extent in lockup units.
 */
function linePath(line, scale, left, baseline) {
  const ox = left - line.ink.minX * scale;
  const parts = [];
  let current = '';
  for (const g of line.glyphs) {
    const X = (x) => fmt(ox + (g.x + x) * scale);
    const Y = (y) => fmt(baseline - (g.y + y) * scale);
    for (const c of g.commands) {
      const end = c.x === undefined ? current : `${X(c.x)} ${Y(c.y)}`;
      if (c.type === 'M') parts.push(`M${end}`);
      else if (c.type === 'L') {
        if (end !== current) parts.push(`L${end}`); // skip zero-length segments
      } else if (c.type === 'Q') parts.push(`Q${X(c.x1)} ${Y(c.y1)} ${X(c.x)} ${Y(c.y)}`);
      else if (c.type === 'C') {
        parts.push(`C${X(c.x1)} ${Y(c.y1)} ${X(c.x2)} ${Y(c.y2)} ${X(c.x)} ${Y(c.y)}`);
      } else if (c.type === 'Z') parts.push('Z');
      else throw new Error(`Unknown path command ${c.type}`);
      current = end;
    }
  }
  return {
    d: parts.join(''),
    top: baseline - line.ink.maxY * scale,
    bottom: baseline - line.ink.minY * scale,
    width: (line.ink.maxX - line.ink.minX) * scale,
  };
}

// ---------------------------------------------------------------------------------------------
// Marks and documents
// ---------------------------------------------------------------------------------------------

/** Reads a hand-written mark: its viewBox and inner markup (without <title>). */
async function readMark(file) {
  const svg = await readFile(path.join(LOGO_DIR, file), 'utf8');
  const viewBox = svg
    .match(/viewBox="([^"]+)"/)[1]
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const inner = svg
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/<title>[\s\S]*?<\/title>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  return { viewBox, inner, aspect: viewBox[2] / viewBox[3] };
}

function placeMark(mark, x, y, height) {
  const [vx, vy, , vh] = mark.viewBox;
  const s = height / vh;
  const transform =
    s === 1
      ? `translate(${fmt(x - vx)} ${fmt(y - vy)})`
      : `matrix(${+s.toFixed(4)} 0 0 ${+s.toFixed(4)} ${fmt(x - vx * s)} ${fmt(y - vy * s)})`;
  return [`  <g transform="${transform}">`, ...mark.inner.map((l) => `    ${l}`), '  </g>'];
}

function svgDocument({ width, height, spec, color, body }) {
  const w = fmt(width);
  const h = fmt(height);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${spec.title}" lang="${spec.lang}" color="${color}">`,
    `  <title>${spec.title}</title>`,
    '  <!-- Generated by scripts/build-logos.mjs from the hand-written mark and Rubik. Do not edit. -->',
    ...body,
    '</svg>',
    '',
  ].join('\n');
}

/** Shifts everything down when a wordmark (Arabic descenders) pokes out of the top. */
function shifted(body, dy) {
  if (Math.abs(dy) < 0.005) return body;
  return [`  <g transform="translate(0 ${fmt(dy)})">`, ...body.map((l) => `  ${l}`), '  </g>'];
}

// ---------------------------------------------------------------------------------------------
// Lockups
// ---------------------------------------------------------------------------------------------

/** Horizontal lockup: icon on the leading side (left of English, right of Hebrew/Arabic). */
function horizontal({ fonts, mark, concept, spec, color }) {
  const line = shapeLine(fonts, spec.text, spec.tracking);
  const markH = concept.markHeight;
  const markW = mark.aspect * markH;

  // The Latin cap band either matches a band of the mark or is centred on it.
  let capHeight = concept.capHeight;
  let bandCentre = markH / 2;
  if (concept.capBand) {
    const s = markH / mark.viewBox[3];
    const [t, b] = concept.capBand.map((v) => (v - mark.viewBox[1]) * s);
    capHeight = b - t;
    bandCentre = (t + b) / 2;
  }
  const band = bandOf(spec, line);
  const scale = (capHeight * spec.sizeRatio) / spec.refHeight;
  const baseline = bandCentre + ((band.top + band.bottom) / 2) * scale;

  const textW = (line.ink.maxX - line.ink.minX) * scale;
  const width = markW + concept.gap + textW;
  const rtl = spec.lang !== 'en';
  const markX = rtl ? width - markW : 0;
  const textX = rtl ? 0 : markW + concept.gap;
  const wm = linePath(line, scale, textX, baseline);

  const top = Math.min(0, wm.top);
  const bottom = Math.max(markH, wm.bottom);
  const body = [...placeMark(mark, markX, 0, markH), `  <path fill="currentColor" d="${wm.d}"/>`];
  return svgDocument({ width, height: bottom - top, spec, color, body: shifted(body, -top) });
}

/**
 * Stacked lockup: icon centred above a two-line wordmark. Line 2 is smaller; for Latin and
 * Hebrew it is letter-spaced to the width of line 1, Arabic is centred without spacing.
 */
function stacked({ fonts, mark, concept, spec, color }) {
  const st = concept.stacked;
  const markW = mark.aspect * st.markHeight;
  const scale1 = (st.capHeight * spec.sizeRatio) / spec.refHeight;
  const scale2 = scale1 * (spec.line2Ratio ?? st.line2Ratio);

  const line1 = shapeLine(fonts, spec.lines[0], spec.tracking);
  const w1 = (line1.ink.maxX - line1.ink.minX) * scale1;
  let line2 = shapeLine(fonts, spec.lines[1], 0);
  if (spec.justifyLine2 && line2.glyphCount > 1) {
    const w2 = (line2.ink.maxX - line2.ink.minX) * scale2;
    const tracking = (w1 - w2) / scale2 / (line2.glyphCount - 1) / fonts.otFont.unitsPerEm;
    line2 = shapeLine(fonts, spec.lines[1], Math.max(0, tracking));
  }
  const w2 = (line2.ink.maxX - line2.ink.minX) * scale2;
  const width = Math.max(markW, w1, w2);

  const band1 = bandOf(spec, line1);
  const baseline1 = st.markHeight + st.gap + band1.top * scale1;
  const l1 = linePath(line1, scale1, (width - w1) / 2, baseline1);
  const baseline2 = l1.bottom + st.lineGap + line2.ink.maxY * scale2;
  const l2 = linePath(line2, scale2, (width - w2) / 2, baseline2);

  const top = Math.min(0, l1.top);
  const bottom = l2.bottom;
  const body = [
    ...placeMark(mark, (width - markW) / 2, 0, st.markHeight),
    `  <path fill="currentColor" d="${l1.d}${l2.d}"/>`,
  ];
  return svgDocument({ width, height: bottom - top, spec, color, body: shifted(body, -top) });
}

async function main() {
  const fonts = await loadFonts();
  await mkdir(OUT_DIR, { recursive: true });
  const written = [];

  for (const [id, concept] of Object.entries(CONCEPTS)) {
    const light = await readMark(concept.light);
    const dark = await readMark(concept.dark);
    for (const [key, spec] of Object.entries(WORDMARKS)) {
      const files = {
        [`${id}-horizontal-${key}.svg`]: horizontal({
          fonts,
          mark: light,
          concept,
          spec,
          color: INK,
        }),
        [`${id}-stacked-${key}.svg`]: stacked({ fonts, mark: light, concept, spec, color: INK }),
        [`${id}-on-dark-${key}.svg`]: horizontal({
          fonts,
          mark: dark,
          concept,
          spec,
          color: WHITE,
        }),
      };
      for (const [name, svg] of Object.entries(files)) {
        await writeFile(path.join(OUT_DIR, name), svg, 'utf8');
        written.push(name);
      }
    }
  }
  console.log(`build-logos: wrote ${written.length} lockups to ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
