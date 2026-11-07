import type { ContactTag, DriverStatus, Locale, SortOrder } from '@renawi/shared';

/** A contact as returned by the API (list items and the base of the detail). */
export interface Contact {
  id: string;
  tags: ContactTag[];
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  idNumber: string | null;
  phones: string[];
  email: string | null;
  address: string | null;
  city: string | null;
  preferredLang: Locale;
  source: string | null;
  notes: string | null;
  followUpAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Present on the detail; list items may carry it too. */
  driver?: { id: string; status: DriverStatus } | null;
}

/** `GET /api/contacts/:id` */
export interface ContactDetail extends Contact {
  driver: { id: string; status: DriverStatus } | null;
  counts: { deals: number; documents: number };
}

/** Query of `GET /api/contacts`. */
export interface ContactListQuery {
  q?: string;
  /** Comma-separated tags. */
  tag?: string;
  followUpBefore?: string;
  /** Also list archived contacts (`archived` alone would list only archived ones). */
  includeArchived?: boolean;
  /** true = archived only, false = active only. */
  archived?: boolean;
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: SortOrder;
}
