import { DealType } from '@renawi/shared';
import { useQueryClient } from '@tanstack/react-query';
import { App, Flex, Segmented } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { PageBreadcrumbs } from '../../../shared/ui/PageBreadcrumbs';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { contactKeys } from '../../contacts/queryKeys';
import { dashboardKeys } from '../../dashboard/queryKeys';
import { vehicleKeys } from '../../vehicles/queryKeys';
import { DealForm } from '../forms/DealForm';
import { dealPath, newDealPath } from '../lib/dealRules';
import { dealKeys } from '../queryKeys';

/**
 * `/deals/new?type=PURCHASE|SALE|CONSIGNMENT_SALE[&vehicleId=]`: the deal form of that type
 * (a sale by default). The created deal opens on its page.
 */
export function DealNewPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const type = DealType.safeParse(params.get('type')).data ?? 'SALE';
  const vehicleId = params.get('vehicleId');

  return (
    <Flex vertical gap={16}>
      <PageBreadcrumbs
        items={[{ title: t('nav.deals'), to: '/deals' }, { title: t('deals.newTitle') }]}
      />
      <PageHeader
        title={t(`deals.newOfType.${type}`)}
        extra={
          <Segmented<DealType>
            value={type}
            onChange={(next) => navigate(newDealPath(next, vehicleId), { replace: true })}
            options={DealType.options.map((value) => ({
              value,
              label: t(`enums.DealType.${value}`),
            }))}
            data-testid="deal-type-switch"
          />
        }
      />
      <DealForm
        // A new type starts from a fresh form.
        key={`${type}:${vehicleId ?? ''}`}
        type={type}
        initialVehicleId={vehicleId}
        onCreated={(deal) => {
          queryClient.setQueryData(dealKeys.detail(deal.id), deal);
          for (const key of [dealKeys.all, vehicleKeys.all, contactKeys.all, dashboardKeys.all]) {
            void queryClient.invalidateQueries({ queryKey: key });
          }
          void message.success(t('deals.created'));
          navigate(dealPath(deal.id), { replace: true });
        }}
        onCancel={() =>
          navigate(vehicleId ? `/vehicles/${encodeURIComponent(vehicleId)}?tab=deals` : '/deals')
        }
      />
    </Flex>
  );
}
