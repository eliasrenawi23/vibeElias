import { PlusOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Flex } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { LoadError } from '../../../shared/ui/LoadError';
import { fetchFines } from '../../fines/api';
import { FineDrawer } from '../../fines/components/FineDrawer';
import { FinesTable } from '../../fines/components/FinesTable';
import { FineDialog } from '../../fines/dialogs/FineDialog';
import { fineKeys } from '../../fines/queryKeys';

/** Traffic fines received for this vehicle (`GET /fines?vehicleId=`), with "add fine". */
export function VehicleFinesTab({ vehicleId }: { vehicleId: string }) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const filters = { vehicleId, pageSize: 100 };
  const query = useQuery({
    queryKey: fineKeys.list(filters),
    queryFn: ({ signal }) => fetchFines(filters, signal),
  });
  const open = query.data?.items.find((f) => f.id === openId) ?? null;
  const refresh = () => void queryClient.invalidateQueries({ queryKey: fineKeys.all });

  return (
    <Flex vertical gap={16}>
      <Flex justify="flex-end">
        <Button
          icon={<PlusOutlined />}
          onClick={() => setAdding(true)}
          data-testid="vehicle-fine-add"
        >
          {t('fines.add')}
        </Button>
      </Flex>
      {query.isError ? (
        <LoadError error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <FinesTable
          data={query.data?.items}
          loading={query.isFetching}
          onOpen={(f) => setOpenId(f.id)}
          hideVehicle
          empty={<EmptyState compact description={t('vehicles.noFines')} />}
        />
      )}
      {adding && (
        <FineDialog
          vehicleId={vehicleId}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            refresh();
            void message.success(t('fines.added'));
          }}
        />
      )}
      {open && <FineDrawer fine={open} onClose={() => setOpenId(null)} onSaved={refresh} />}
    </Flex>
  );
}
