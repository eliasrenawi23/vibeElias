import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { AutoDir } from '../../../shared/lib/bidi';
import { fetchContact } from '../api';
import { contactName } from '../lib';
import { contactKeys } from '../queryKeys';

export interface ContactLinkProps {
  id: string | null | undefined;
  /** Known display name; when missing the contact is fetched (cached). */
  name?: string | null;
}

/** Contact name linking to `/contacts/:id`. */
export function ContactLink({ id, name }: ContactLinkProps) {
  const query = useQuery({
    queryKey: contactKeys.detail(id ?? ''),
    queryFn: ({ signal }) => fetchContact(id ?? '', signal),
    enabled: Boolean(id) && !name,
    staleTime: 5 * 60_000,
  });
  if (!id) return <span className="rm-empty-value">—</span>;
  const label = name || (query.data ? contactName(query.data) : '') || '…';
  return (
    <Link to={`/contacts/${encodeURIComponent(id)}`}>
      <AutoDir>{label}</AutoDir>
    </Link>
  );
}
