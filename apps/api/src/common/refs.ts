import { contactDisplayName } from '@renawi/shared';

/** Compact reference to a contact-like row: `{ id, name }`. */
export interface NamedRef {
  id: string;
  name: string;
}

export interface ContactNameFields {
  id: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
}

/** Prisma `select` for the fields `contactRef()` needs. */
export const CONTACT_NAME_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  companyName: true,
} as const;

export function contactRef(c: ContactNameFields | null | undefined): NamedRef | null {
  return c ? { id: c.id, name: contactDisplayName(c) } : null;
}

/** Digits with separators only: a phone / plate / ID typed with spaces (`+972 50 123 4567`). */
const NUMBER_LIKE_RE = /^[+\d][\d\s\-().+/]*$/;

/**
 * Whitespace-separated search tokens (max 5, empty tokens removed); every token must match some
 * field. A number typed with spaces stays one token so phones and plates still match.
 */
export function searchTokens(q: string | undefined): string[] {
  const text = (q ?? '').trim();
  if (NUMBER_LIKE_RE.test(text)) return [text];
  return text
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 5);
}
