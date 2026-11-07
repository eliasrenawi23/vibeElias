import { formatPhone } from '@renawi/shared';
import { useQuery } from '@tanstack/react-query';
import { Flex, Select, Spin, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AutoDir, Ltr } from '../../../shared/lib/bidi';
import { useDebouncedValue } from '../../../shared/lib/useDebouncedValue';
import { fetchDriver, fetchDrivers } from '../api';
import { driverKeys } from '../queryKeys';
import type { DriverListItem } from '../types';

export interface DriverPickerProps {
  id?: string;
  value?: string | null;
  onChange?: (id: string | null, driver: DriverListItem | null) => void;
  onBlur?: () => void;
  /** Only ACTIVE drivers (default true). */
  activeOnly?: boolean;
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
  driver: DriverListItem;
}

/** Driver select with server search (`GET /drivers?q&status=ACTIVE`). */
export function DriverPicker({
  id,
  value,
  onChange,
  onBlur,
  activeOnly = true,
  placeholder,
  allowClear = true,
  disabled,
  status,
  'aria-label': ariaLabel,
  'data-testid': testId = 'driver-picker',
}: DriverPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search.trim(), 300);

  const results = useQuery({
    queryKey: [...driverKeys.picker(q), activeOnly],
    queryFn: ({ signal }) =>
      fetchDrivers(
        { q: q || undefined, status: activeOnly ? 'ACTIVE' : undefined, pageSize: 20 },
        signal,
      ),
    enabled: open || Boolean(value),
    staleTime: 30_000,
  });
  const inResults = results.data?.items.some((d) => d.id === value);
  const selected = useQuery({
    queryKey: driverKeys.detail(value ?? ''),
    queryFn: ({ signal }) => fetchDriver(value ?? '', signal),
    enabled: Boolean(value) && results.isSuccess && !inResults,
    staleTime: 5 * 60_000,
  });

  const options = useMemo<Option[]>(() => {
    const list = [...(results.data?.items ?? [])];
    if (selected.data && !list.some((d) => d.id === selected.data.id)) list.unshift(selected.data);
    return list.map((d) => ({ value: d.id, label: d.name || '—', driver: d }));
  }, [results.data, selected.data]);

  return (
    <Select<string, Option>
      id={id}
      value={value ?? undefined}
      options={options}
      placeholder={placeholder ?? t('drivers.picker.placeholder')}
      aria-label={ariaLabel}
      allowClear={allowClear}
      disabled={disabled}
      status={status}
      onBlur={onBlur}
      open={open}
      onOpenChange={setOpen}
      showSearch={{ filterOption: false, onSearch: setSearch, searchValue: search }}
      loading={results.isFetching}
      notFoundContent={results.isFetching ? <Spin size="small" /> : t('drivers.picker.noResults')}
      onChange={(v, option) => {
        const opt = Array.isArray(option) ? option[0] : option;
        onChange?.(v ?? null, v ? (opt?.driver ?? null) : null);
        setSearch('');
      }}
      optionRender={(option) => {
        const d = option.data.driver;
        const phone = d.contact?.phones?.[0];
        return (
          <Flex vertical>
            <AutoDir>{option.data.label}</AutoDir>
            {phone && (
              <Typography.Text type="secondary" className="rm-picker-sub">
                <Ltr>{formatPhone(phone)}</Ltr>
              </Typography.Text>
            )}
          </Flex>
        );
      }}
      labelRender={(props) => <AutoDir>{String(props.label ?? '')}</AutoDir>}
      data-testid={testId}
      className="rm-driver-picker"
    />
  );
}
