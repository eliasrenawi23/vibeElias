import { useQuery } from '@tanstack/react-query';
import { Card } from 'antd';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { LoadError } from '../../../shared/ui/LoadError';
import { fetchDeals } from '../../deals/api';
import { DealsTable } from '../../deals/components/DealsTable';
import { dealKeys } from '../../deals/queryKeys';

/** Deals where the contact is the buyer or the seller (`GET /deals?counterpartyId=`). */
export function ContactDealsSection({ contactId }: { contactId: string }) {
  const { t } = useTranslation();
  const filters = { counterpartyId: contactId, pageSize: 100 };
  const query = useQuery({
    queryKey: dealKeys.list(filters),
    queryFn: ({ signal }) => fetchDeals(filters, signal),
  });
  return (
    <Card variant="borderless" title={t('contacts.deals.title')} data-testid="contact-deals">
      {query.isError ? (
        <LoadError error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <DealsTable
          data={query.data?.items}
          loading={query.isFetching}
          hide={['counterparty']}
          label={t('contacts.deals.title')}
          data-testid="contact-deals-table"
          empty={<EmptyState compact description={t('contacts.deals.empty')} />}
        />
      )}
    </Card>
  );
}
