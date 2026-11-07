#!/usr/bin/env node
/**
 * Generates the PNG app icons from the hand-written SVG marks with sharp.
 *
 *   icons/icon-192.png              PWA "any" icon, rounded tile with transparent corners
 *   icons/icon-512.png              PWA "any" icon, rounded tile with transparent corners
 *   icons/apple-touch-icon-180.png  full-bleed square (iOS rounds the corners itself)
 *   icons/maskable-512.png          full-bleed square, glyph inside the 80% safe-zone circle
 *
 * Usage: node scripts/build-icons.mjs [--concept a|b] [--out <dir>]
 * Concept B (the roof sign, the chosen logo) is the default; pass `--concept a` to build the set
 * from the road R instead.
 */
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOGO_DIR = path.join(ROOT, 'logo');

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const CONCEPT = arg('concept', 'b');
const OUT_DIR = path.resolve(arg('out', path.join(ROOT, 'icons')));

const TILE = '#0F0F10';
const GRID = 64; // all marks are drawn on a 64-unit grid
const TILE_RADIUS = 14; // same corner radius as a-icon.svg

const strip = (svg) =>
  svg
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/<title>[\s\S]*?<\/title>/g, '')
    .trim();

/** Returns the glyph markup (everything except the tile) on the 64-unit grid. */
async function glyphFor(concept) {
  if (concept === 'a') {
    // a-icon.svg = one <rect> tile + the R and its road line; drop the tile.
    const inner = strip(await readFile(path.join(LOGO_DIR, 'a-icon.svg'), 'utf8'));
    return inner.replace(/<rect\b[^>]*\/>/, '').trim();
  }
  if (concept === 'b') {
    // The roof sign (64 x 36, R cut out, white roof line) centred on the tile at 3/4 size.
    const inner = strip(await readFile(path.join(LOGO_DIR, 'b-icon-inverse.svg'), 'utf8'));
    const s = 0.75;
    const ty = (GRID - 36 * s) / 2;
    return `<g transform="matrix(${s} 0 0 ${s} ${(GRID - GRID * s) / 2} ${ty})">${inner}</g>`;
  }
  throw new Error(`Unknown concept "${concept}" (use a or b)`);
}

/** Builds a square SVG: tile (rounded or full-bleed) + glyph scaled about the centre. */
function iconSvg(glyph, { size, radius, glyphScale }) {
  const c = GRID / 2;
  const t = c - c * glyphScale;
  const g =
    glyphScale === 1
      ? glyph
      : `<g transform="matrix(${glyphScale} 0 0 ${glyphScale} ${t} ${t})">${glyph}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID} ${GRID}" width="${size}" height="${size}"><rect width="${GRID}" height="${GRID}" rx="${radius}" fill="${TILE}"/>${g}</svg>`;
}

const OUTPUTS = [
  { file: 'icon-192.png', size: 192, radius: TILE_RADIUS, glyphScale: 1 },
  { file: 'icon-512.png', size: 512, radius: TILE_RADIUS, glyphScale: 1 },
  { file: 'apple-touch-icon-180.png', size: 180, radius: 0, glyphScale: 1 },
  // Maskable: platforms may crop to a circle of 80% diameter; keep the glyph well inside it.
  { file: 'maskable-512.png', size: 512, radius: 0, glyphScale: 0.78 },
];

async function main() {
  const glyph = await glyphFor(CONCEPT);
  await mkdir(OUT_DIR, { recursive: true });
  for (const out of OUTPUTS) {
    const svg = iconSvg(glyph, out);
    const target = path.join(OUT_DIR, out.file);
    const info = await sharp(Buffer.from(svg))
      .resize(out.size, out.size)
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toFile(target);
    console.log(`build-icons: ${out.file} ${info.width}x${info.height} (concept ${CONCEPT})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
