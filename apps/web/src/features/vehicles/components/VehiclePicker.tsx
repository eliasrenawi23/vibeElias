import { useQuery } from '@tanstack/react-query';
import { Flex, Select, Spin, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AutoDir } from '../../../shared/lib/bidi';
import { displayPlate } from '../../../shared/lib/plate';
import { useDebouncedValue } from '../../../shared/lib/useDebouncedValue';
import { PlateNo } from '../../../shared/ui/PlateNo';
import { YearText } from '../../../shared/ui/YearText';
import { fetchVehicle, fetchVehicles } from '../api';
import { vehicleKeys } from '../queryKeys';
import type { VehicleListItem, VehicleListQuery } from '../types';
import { AlertBadges } from './AlertBadges';

export interface VehiclePickerProps {
  id?: string;
  value?: string | null;
  onChange?: (id: string | null, vehicle: VehicleListItem | null) => void;
  onBlur?: () => void;
  /** Fixed list filters, e.g. `{ isTaxi: true, status: 'IN_STOCK', ownership: 'OWNED' }`. */
  filters?: Omit<VehicleListQuery, 'q' | 'page' | 'pageSize'>;
  /** Options that cannot be chosen (e.g. taxis over the age limit). */
  isDisabled?: (vehicle: VehicleListItem) => boolean;
  placeholder?: string;
  allowClear?: boolean;
  disabled?: boolean;
  status?: 'error';
  'aria-label'?: string;
  'data-testid'?: string;
}

interface Option {
  value: string;
  label: string;
  disabled?: boolean;
  vehicle: VehicleListItem;
}

/** Vehicle select with server search by plate / make / model, showing age and expiry alerts. */
export function VehiclePicker({
  id,
  value,
  onChange,
  onBlur,
  filters,
  isDisabled,
  placeholder,
  allowClear = true,
  disabled,
  status,
  'aria-label': ariaLabel,
  'data-testid': testId = 'vehicle-picker',
}: VehiclePickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search.trim(), 300);
  const query: VehicleListQuery = { ...filters, q: q || undefined, pageSize: 50 };

  const results = useQuery({
    queryKey: [...vehicleKeys.lists(), 'picker', query],
    queryFn: ({ signal }) => fetchVehicles(query, signal),
    enabled: open || Boolean(value),
    staleTime: 30_000,
  });
  const inResults = results.data?.items.some((v) => v.id === value);
  const selected = useQuery({
    queryKey: vehicleKeys.detail(value ?? ''),
    queryFn: ({ signal }) => fetchVehicle(value ?? '', signal),
    enabled: Boolean(value) && results.isSuccess && !inResults,
    staleTime: 5 * 60_000,
  });

  const options = useMemo<Option[]>(() => {
    const list: VehicleListItem[] = [...(results.data?.items ?? [])];
    if (selected.data && !list.some((v) => v.id === selected.data.id)) list.unshift(selected.data);
    return list.map((v) => ({
      value: v.id,
      label: `${displayPlate(v.plateNo)} ${v.make} ${v.model}`,
      disabled: isDisabled?.(v) ?? false,
      vehicle: v,
    }));
  }, [results.data, selected.data, isDisabled]);

  return (
    <Select<string, Option>
      id={id}
      value={value ?? undefined}
      options={options}
      placeholder={placeholder ?? t('vehicles.picker.placeholder')}
      aria-label={ariaLabel}
      allowClear={allowClear}
      disabled={disabled}
      status={status}
      onBlur={onBlur}
      open={open}
      onOpenChange={setOpen}
      showSearch={{ filterOption: false, onSearch: setSearch, searchValue: search }}
      loading={results.isFetching}
      notFoundContent={results.isFetching ? <Spin size="small" /> : t('vehicles.picker.noResults')}
      onChange={(v, option) => {
        const opt = Array.isArray(option) ? option[0] : option;
        onChange?.(v ?? null, v ? (opt?.vehicle ?? null) : null);
        setSearch('');
      }}
      optionRender={(option) => {
        const v = option.data.vehicle;
        return (
          <Flex justify="space-between" align="center" gap={8} wrap>
            <Flex gap={8} align="center">
              <PlateNo value={v.plateNo} />
              <Typography.Text>
                <AutoDir>{`${v.make} ${v.model}`}</AutoDir> <YearText value={v.year} />
              </Typography.Text>
            </Flex>
            <AlertBadges alerts={v.alerts?.filter((a) => a.startsWith('taxiAge'))} hideEmpty />
          </Flex>
        );
      }}
      labelRender={(props) => {
        const v = options.find((o) => o.value === props.value)?.vehicle;
        return v ? (
          <Flex gap={6} align="center" component="span">
            <PlateNo value={v.plateNo} variant="text" />
            <AutoDir>{`${v.make} ${v.model}`}</AutoDir>
          </Flex>
        ) : (
          <span>{String(props.label ?? '')}</span>
        );
      }}
      data-testid={testId}
      className="rm-vehicle-picker"
      popupMatchSelectWidth={false}
    />
  );
}
