import { DEFAULT_VAT_RATE } from '@renawi/shared';
import { useQuery } from '@tanstack/react-query';
import { fetchSettings } from '../../settings/api';
import { settingsKeys } from '../../settings/queryKeys';
import { fetchVehicle } from '../../vehicles/api';
import { openCycleOf } from '../../vehicles/lib/vehicleRules';
import { vehicleKeys } from '../../vehicles/queryKeys';
import type { InventoryCycle, VehicleDetail } from '../../vehicles/types';
import { fetchDeals } from '../api';
import { dealKeys } from '../queryKeys';
import type { DealListItem } from '../types';

/** VAT rate (percent) from the business settings; the legal default until they load. */
export function useVatRate(): number {
  const settings = useQuery({
    queryKey: settingsKeys.detail(),
    queryFn: ({ signal }) => fetchSettings(signal),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const rate = Number(settings.data?.vatRate);
  return Number.isFinite(rate) && settings.data ? rate : DEFAULT_VAT_RATE;
}

export interface VehicleFileState {
  vehicle: VehicleDetail | null;
  openCycle: InventoryCycle | null;
  loading: boolean;
}

/** The vehicle file of a picked car (cached under the vehicle detail key) and its open cycle. */
export function useVehicleFile(vehicleId: string | null | undefined): VehicleFileState {
  const query = useQuery({
    queryKey: vehicleKeys.detail(vehicleId ?? ''),
    queryFn: ({ signal }) => fetchVehicle(vehicleId ?? '', signal),
    enabled: Boolean(vehicleId),
    staleTime: 30_000,
  });
  const vehicle = vehicleId ? (query.data ?? null) : null;
  return {
    vehicle,
    openCycle: vehicle ? openCycleOf(vehicle) : null,
    loading: Boolean(vehicleId) && query.isPending,
  };
}

/**
 * The completed purchase that opened a car's current cycle (its price is the cost basis of the
 * margin VAT; `sellerIsVatBusiness` forces full VAT on the resale). Falls back to the latest
 * completed purchase of the car.
 */
export function useCyclePurchase(
  vehicleId: string | null | undefined,
  cycleId: string | null | undefined,
): { purchase: DealListItem | null; loading: boolean } {
  const filters = {
    vehicleId: vehicleId ?? '',
    type: 'PURCHASE',
    status: 'COMPLETED',
    pageSize: 20,
  };
  const query = useQuery({
    queryKey: dealKeys.list(filters),
    queryFn: ({ signal }) => fetchDeals(filters, signal),
    enabled: Boolean(vehicleId),
    staleTime: 30_000,
  });
  const items = vehicleId ? (query.data?.items ?? []) : [];
  const purchase = items.find((d) => cycleId && d.cycleId === cycleId) ?? items[0] ?? null;
  return { purchase, loading: Boolean(vehicleId) && query.isPending };
}
