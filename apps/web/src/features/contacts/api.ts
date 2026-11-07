import type { ContactCreate, ContactUpdate, Paginated } from '@renawi/shared';
import { http } from '../../shared/lib/http';
import type { Contact, ContactDetail, ContactListQuery } from './types';

const path = (id: string) => `/contacts/${encodeURIComponent(id)}`;

/** `GET /api/contacts?q&tag&followUpBefore&includeArchived&archived&page&pageSize&sort&order` */
export function fetchContacts(
  query: ContactListQuery,
  signal?: AbortSignal,
): Promise<Paginated<Contact>> {
  return http.get<Paginated<Contact>>('/contacts', {
    query: {
      ...query,
      includeArchived: query.includeArchived ? true : undefined,
      archived: query.archived ?? undefined,
    },
    signal,
  });
}

/** `GET /api/contacts/:id` (with `driver` and `counts`). */
export function fetchContact(id: string, signal?: AbortSignal): Promise<ContactDetail> {
  return http.get<ContactDetail>(path(id), { signal });
}

/** `POST /api/contacts` (409 with `errors[idNumber] = validation.duplicate` for a known ID). */
export function createContact(body: ContactCreate): Promise<Contact> {
  return http.post<Contact>('/contacts', body);
}

/** `PATCH /api/contacts/:id` */
export function updateContact(id: string, body: ContactUpdate): Promise<Contact> {
  return http.patch<Contact>(path(id), body);
}

/** `POST /api/contacts/:id/archive` */
export function archiveContact(id: string): Promise<Contact> {
  return http.post<Contact>(`${path(id)}/archive`);
}

/** `POST /api/contacts/:id/unarchive` */
export function unarchiveContact(id: string): Promise<Contact> {
  return http.post<Contact>(`${path(id)}/unarchive`);
}
