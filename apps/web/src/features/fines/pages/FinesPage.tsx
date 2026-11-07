import { PlusOutlined } from '@ant-design/icons';
import { FineStatus } from '@renawi/shared';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Flex } from 'antd';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isolateAuto } from '../../../shared/lib/bidi';
import { useEnumOptions } from '../../../shared/lib/enums';
import { useListParams } from '../../../shared/lib/listParams';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { FilterBar } from '../../../shared/ui/FilterBar';
import { LoadError } from '../../../shared/ui/LoadError';
import { driverKeys } from '../../drivers/queryKeys';
import { ledgerKeys } from '../../ledger/queryKeys';
import { fetchFines } from '../api';
import { FineDrawer } from '../components/FineDrawer';
import { FinesTable } from '../components/FinesTable';
import { FineDialog } from '../dialogs/FineDialog';
import { fineKeys } from '../queryKeys';
import type { FineListQuery, TrafficFine } from '../types';

/** `/fines`: traffic fines with the matched driver, status and reassignment deadline. */
export function FinesPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const statusOptions = useEnumOptions('FineStatus', FineStatus.options);
  const { page, pageSize, sort, order, searchParams, setTableParams } = useListParams();
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const query = useMemo<FineListQuery>(
    () => ({ status: searchParams.get('status') || undefined, page, pageSize, sort, order }),
    [searchParams, page, pageSize, sort, order],
  );
  const list = useQuery({
    queryKey: fineKeys.list(query),
    queryFn: ({ signal }) => fetchFines(query, signal),
    placeholderData: keepPreviousData,
  });
  const open = list.data?.items.find((f) => f.id === openId) ?? null;

  /** A fine changed: patch it into the visible list, refresh lists and the money views. */
  const applyFine = (fine: TrafficFine) => {
    queryClient.setQueryData(fineKeys.list(query), (prev: typeof list.data) =>
      prev ? { ...prev, items: prev.items.map((f) => (f.id === fine.id ? fine : f)) } : prev,
    );
    void queryClient.invalidateQueries({ queryKey: fineKeys.all });
    void queryClient.invalidateQueries({ queryKey: driverKeys.all });
    void queryClient.invalidateQueries({ queryKey: ledgerKeys.all });
  };

  const addButton = (
    <Button
      type="primary"
      icon={<PlusOutlined />}
      onClick={() => setAdding(true)}
      data-testid="fine-add"
    >
      {t('fines.add')}
    </Button>
  );

  return (
    <Flex vertical gap={16}>
      <FilterBar
        searchKey={null}
        filters={[
          {
            type: 'select',
            key: 'status',
            label: t('common.status'),
            options: statusOptions,
            multiple: true,
            width: 220,
          },
        ]}
        extra={addButton}
      />
      {list.isError ? (
        <LoadError error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <FinesTable
          data={list.data?.items}
          loading={list.isFetching}
          total={list.data?.total ?? 0}
          page={page}
          pageSize={pageSize}
          onChange={setTableParams}
          onOpen={(f) => setOpenId(f.id)}
          empty={
            query.status ? (
              <EmptyState compact description={t('table.emptyFiltered')} />
            ) : (
              <EmptyState
                title={t('fines.listEmpty')}
                description={t('fines.listEmptyHint')}
                action={addButton}
              />
            )
          }
        />
      )}
      {adding && (
        <FineDialog
          onClose={() => setAdding(false)}
          onSaved={(fine) => {
            setAdding(false);
            void queryClient.invalidateQueries({ queryKey: fineKeys.all });
            void message.success(
              fine.driver
                ? t('fines.addedMatched', { name: isolateAuto(fine.driver.name) })
                : t('fines.added'),
            );
          }}
        />
      )}
      {open && <FineDrawer fine={open} onClose={() => setOpenId(null)} onSaved={applyFine} />}
    </Flex>
  );
}
