import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App, Flex } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { PageBreadcrumbs } from '../../../shared/ui/PageBreadcrumbs';
import { createVehicle } from '../api';
import { VehicleForm } from '../forms/VehicleForm';
import { vehicleKeys } from '../queryKeys';

/** `/vehicles/new`: create a vehicle, then open its page. */
export function VehicleNewPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: createVehicle,
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: vehicleKeys.all });
      void message.success(t('vehicles.created'));
      navigate(`/vehicles/${encodeURIComponent(created.id)}`, { replace: true });
    },
  });
  return (
    <Flex vertical gap={16}>
      <PageBreadcrumbs
        items={[{ title: t('nav.vehicles'), to: '/vehicles' }, { title: t('vehicles.newTitle') }]}
      />
      <VehicleForm
        onSubmit={(values) => mutation.mutateAsync(values)}
        submitting={mutation.isPending}
        onCancel={() => navigate('/vehicles')}
        submitLabel={t('actions.create')}
      />
    </Flex>
  );
}
