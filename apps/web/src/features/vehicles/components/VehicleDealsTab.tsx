import { useQuery } from '@tanstack/react-query';
import { Button, Flex } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { LoadError } from '../../../shared/ui/LoadError';
import { fetchDeals } from '../../deals/api';
import { DealsTable } from '../../deals/components/DealsTable';
import { newDealPath } from '../../deals/lib/dealRules';
import { dealKeys } from '../../deals/queryKeys';
import { hasOpenCycle } from '../lib/vehicleRules';
import type { VehicleDetail } from '../types';

/**
 * Deals of the car (`GET /deals?vehicleId=`) with the deal that fits its state: sell it (own
 * stock), a consignment sale (consignment car) or record its purchase (outside the stock).
 */
export function VehicleDealsTab({ vehicle }: { vehicle: VehicleDetail }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const filters = { vehicleId: vehicle.id, pageSize: 100 };
  const query = useQuery({
    queryKey: dealKeys.list(filters),
    queryFn: ({ signal }) => fetchDeals(filters, signal),
  });

  const open = hasOpenCycle(vehicle);
  const sellable = open && (vehicle.status === 'IN_STOCK' || vehicle.status === 'RESERVED');
  const canSell = sellable && vehicle.ownership === 'OWNED';
  const canConsignSell = sellable && vehicle.ownership === 'CONSIGNED';
  const canPurchase = !open && vehicle.status !== 'SCRAPPED' && vehicle.status !== 'LEASED';

  return (
    <Flex vertical gap={16}>
      <Flex gap={8} wrap justify="flex-end" data-testid="vehicle-deal-actions">
        {canSell && (
          <Button
            type="primary"
            onClick={() => navigate(newDealPath('SALE', vehicle.id))}
            data-testid="vehicle-deal-sell"
          >
            {t('vehicles.dealsTab.sell')}
          </Button>
        )}
        {canConsignSell && (
          <Button
            type="primary"
            onClick={() => navigate(newDealPath('CONSIGNMENT_SALE', vehicle.id))}
            data-testid="vehicle-deal-consign"
          >
            {t('vehicles.dealsTab.consignmentSale')}
          </Button>
        )}
        {canPurchase && (
          <Button
            onClick={() => navigate(newDealPath('PURCHASE', vehicle.id))}
            data-testid="vehicle-deal-purchase"
          >
            {t('vehicles.dealsTab.purchase')}
          </Button>
        )}
      </Flex>
      {query.isError ? (
        <LoadError error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <DealsTable
          data={query.data?.items}
          loading={query.isFetching}
          hide={['vehicle']}
          label={t('vehicles.detailTabs.deals')}
          data-testid="vehicle-deals-table"
          empty={<EmptyState compact description={t('vehicles.dealsTab.empty')} />}
        />
      )}
    </Flex>
  );
}
