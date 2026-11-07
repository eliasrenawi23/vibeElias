import { DownOutlined, PlusOutlined } from '@ant-design/icons';
import { DealStatus, DealType } from '@renawi/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Button, Dropdown, Flex, Space } from 'antd';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useEnumOptions } from '../../../shared/lib/enums';
import { useListParams } from '../../../shared/lib/listParams';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { FilterBar } from '../../../shared/ui/FilterBar';
import { LoadError } from '../../../shared/ui/LoadError';
import { fetchDeals } from '../api';
import { DealsTable } from '../components/DealsTable';
import { newDealPath } from '../lib/dealRules';
import { dealKeys } from '../queryKeys';
import type { DealListQuery } from '../types';

/** "New sale" with a menu for the other deal types (`/deals/new?type=`). */
export function NewDealButton({ vehicleId }: { vehicleId?: string | null }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <Space.Compact>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={() => navigate(newDealPath('SALE', vehicleId))}
        data-testid="deal-new"
      >
        {t('deals.new')}
      </Button>
      <Dropdown
        trigger={['click']}
        menu={{
          items: DealType.options.map((type) => ({
            key: type,
            label: t(`deals.newOfType.${type}`),
          })),
          onClick: ({ key }) => navigate(newDealPath(key as DealType, vehicleId)),
        }}
      >
        <Button
          type="primary"
          icon={<DownOutlined />}
          aria-label={t('deals.newMenu')}
          data-testid="deal-new-menu"
        />
      </Dropdown>
    </Space.Compact>
  );
}

/** `/deals`: purchases, sales and consignment sales with filters and the paid / due state. */
export function DealsPage() {
  const { t } = useTranslation();
  const typeOptions = useEnumOptions('DealType', DealType.options);
  const statusOptions = useEnumOptions('DealStatus', DealStatus.options);
  const { page, pageSize, sort, order, searchParams, setTableParams } = useListParams();

  const query = useMemo<DealListQuery>(
    () => ({
      q: searchParams.get('q') || undefined,
      type: searchParams.get('type') || undefined,
      status: searchParams.get('status') || undefined,
      from: searchParams.get('from') || undefined,
      to: searchParams.get('to') || undefined,
      page,
      pageSize,
      sort,
      order,
    }),
    [searchParams, page, pageSize, sort, order],
  );
  const filtered = Boolean(query.q || query.type || query.status || query.from || query.to);

  const list = useQuery({
    queryKey: dealKeys.list(query),
    queryFn: ({ signal }) => fetchDeals(query, signal),
    placeholderData: keepPreviousData,
  });

  return (
    <Flex vertical gap={16}>
      <FilterBar
        searchPlaceholder={t('deals.searchPlaceholder')}
        filters={[
          {
            type: 'select',
            key: 'type',
            label: t('deals.fields.type'),
            options: typeOptions,
            multiple: true,
            width: 180,
          },
          {
            type: 'select',
            key: 'status',
            label: t('common.status'),
            options: statusOptions,
            multiple: true,
            width: 180,
          },
          {
            type: 'dateRange',
            keys: ['from', 'to'],
            label: `${t('common.from')} – ${t('common.to')}`,
          },
        ]}
        extra={<NewDealButton />}
      />
      {list.isError ? (
        <LoadError error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <DealsTable
          data={list.data?.items}
          loading={list.isFetching}
          paging={{
            total: list.data?.total ?? 0,
            page,
            pageSize,
            sort,
            order,
            onChange: setTableParams,
          }}
          empty={
            filtered ? (
              <EmptyState compact description={t('table.emptyFiltered')} />
            ) : (
              <EmptyState
                title={t('deals.listEmpty')}
                description={t('deals.listEmptyHint')}
                action={<NewDealButton />}
              />
            )
          }
        />
      )}
    </Flex>
  );
}
