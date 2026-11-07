/**
 * Unicode bidi helpers for mixing Hebrew/Arabic (RTL) with plates, phones, VINs and amounts (LTR).
 * In HTML prefer `<bdi dir="ltr">` / `dir="auto"`; use these isolates in plain text (PDF, CSV,
 * notifications) where markup is not available.
 */

/** LEFT-TO-RIGHT ISOLATE */
export const LRI = '\u2066';
/** RIGHT-TO-LEFT ISOLATE */
export const RLI = '\u2067';
/** FIRST STRONG ISOLATE */
export const FSI = '\u2068';
/** POP DIRECTIONAL ISOLATE */
export const PDI = '\u2069';
/** LEFT-TO-RIGHT MARK */
export const LRM = '\u200E';
/** RIGHT-TO-LEFT MARK */
export const RLM = '\u200F';
/** ARABIC LETTER MARK */
export const ALM = '\u061C';

/**
 * Every invisible directional formatting character: LRM, RLM, ALM, the embeddings/overrides
 * (LRE, RLE, PDF, LRO, RLO) and the isolates (LRI, RLI, FSI, PDI).
 */
const BIDI_CONTROL_RE = /[\u200E\u200F\u061C\u202A-\u202E\u2066-\u2069]/g;

/**
 * Remove all directional formatting characters. `Intl` output for he/ar contains U+200E/U+200F;
 * strip them before comparing, searching, exporting or storing.
 */
export function stripBidiMarks(text: string): string {
  return text.replace(BIDI_CONTROL_RE, '');
}

/** True if the text contains any directional formatting character. */
export function hasBidiMarks(text: string): boolean {
  return new RegExp(BIDI_CONTROL_RE.source).test(text);
}

/** Wrap in LRI ... PDI: force left-to-right (plates, phones, VINs, amounts, IDs). */
export function isolateLtr(text: string): string {
  return `${LRI}${text}${PDI}`;
}

/** Wrap in RLI ... PDI: force right-to-left. */
export function isolateRtl(text: string): string {
  return `${RLI}${text}${PDI}`;
}

/** Wrap in FSI ... PDI: direction from the first strong character (free text, names). */
export function isolateAuto(text: string): string {
  return `${FSI}${text}${PDI}`;
}
