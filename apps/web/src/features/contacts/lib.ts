import type { Contact } from './types';

type Named = Pick<Contact, 'firstName' | 'lastName' | 'companyName'>;

/** Person name (`first last`), or '' when the contact has none. */
export function personName(c: Named): string {
  return [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
}

/** Display name: the person's name, else the company name (else ''). */
export function contactName(c: Named): string {
  return personName(c) || c.companyName?.trim() || '';
}

/** A company record: company name and no person name. */
export function isCompany(c: Named): boolean {
  return Boolean(c.companyName) && !personName(c);
}
