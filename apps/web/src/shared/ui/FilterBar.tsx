import { SearchOutlined } from '@ant-design/icons';
import {
  AutoComplete,
  Button,
  DatePicker,
  Flex,
  Input,
  InputNumber,
  Select,
  Switch,
  Tag,
} from 'antd';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { freeTextInputProps } from '../lib/bidi';
import { dayjsToIso, DISPLAY_DATE_FORMAT, isoToDayjs } from '../lib/dates';
import { readListParam, setOrDelete } from '../lib/listParams';

export interface FilterOption {
  value: string;
  label: ReactNode;
}

/** One control of the filter bar; each writes its own URL search param(s). */
export type FilterDef =
  | {
      type: 'select';
      key: string;
      label: string;
      options: FilterOption[];
      /** Multi-select, stored comma-separated (`status=A,B`). */
      multiple?: boolean;
      width?: number;
    }
  | { type: 'chips'; key: string; label: string; options: FilterOption[] }
  | {
      type: 'toggle';
      key: string;
      label: string;
      /** Value written when on (default `1`). */
      onValue?: string;
    }
  | {
      type: 'numberRange';
      keys: [string, string];
      labels: [string, string];
      min?: number;
      max?: number;
    }
  | { type: 'dateRange'; keys: [string, string]; label: string }
  | { type: 'autocomplete'; key: string; label: string; options: string[]; width?: number }
  | {
      /** Any control (e.g. a server-search picker) bound to one URL param. */
      type: 'custom';
      key: string;
      render: (value: string | null, onChange: (value: string | null) => void) => ReactNode;
    };

export interface FilterBarProps {
  /** URL param of the search box (default `q`); `null` hides the search box. */
  searchKey?: string | null;
  searchPlaceholder?: string;
  filters?: FilterDef[];
  /** Extra content on the trailing side (e.g. a "New" button). */
  extra?: ReactNode;
  /** Debounce of the search box in ms. */
  debounceMs?: number;
}

/** Every URL param a filter definition owns. */
function filterKeys(filters: FilterDef[]): string[] {
  return filters.flatMap((f) => ('keys' in f ? [...f.keys] : [f.key]));
}

/**
 * Search box + filter controls whose state lives in the URL search params. Any change resets the
 * list to page 1; history entries are replaced, not pushed.
 */
export function FilterBar({
  searchKey = 'q',
  searchPlaceholder,
  filters = [],
  extra,
  debounceMs = 300,
}: FilterBarProps) {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();

  const update = (changes: Record<string, string | null>) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(changes)) setOrDelete(next, key, value);
        next.delete('page');
        return next;
      },
      { replace: true },
    );
  };

  // Search box: local text, written to the URL after a pause in typing.
  const urlQuery = searchKey ? (params.get(searchKey) ?? '') : '';
  const [text, setText] = useState(urlQuery);
  const lastWritten = useRef(urlQuery);
  useEffect(() => {
    // The URL changed from outside (clear filters, back button): show it.
    if (urlQuery !== lastWritten.current) {
      lastWritten.current = urlQuery;
      setText(urlQuery);
    }
  }, [urlQuery]);
  useEffect(() => {
    if (!searchKey) return;
    const value = text.trim();
    if (value === lastWritten.current) return;
    const timer = window.setTimeout(() => {
      lastWritten.current = value;
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          setOrDelete(next, searchKey, value);
          next.delete('page');
          return next;
        },
        { replace: true },
      );
    }, debounceMs);
    return () => window.clearTimeout(timer);
  }, [text, searchKey, debounceMs, setParams]);

  const owned = [...(searchKey ? [searchKey] : []), ...filterKeys(filters)];
  const active = owned.some((k) => params.get(k));

  const renderFilter = (f: FilterDef) => {
    switch (f.type) {
      case 'select': {
        const value = f.multiple ? readListParam(params, f.key) : (params.get(f.key) ?? undefined);
        return (
          <Select
            key={f.key}
            aria-label={f.label}
            placeholder={f.label}
            mode={f.multiple ? 'multiple' : undefined}
            maxTagCount="responsive"
            allowClear
            value={value}
            options={f.options}
            style={{ minWidth: f.width ?? 160 }}
            showSearch={f.options.length > 8 ? { optionFilterProp: 'label' } : false}
            onChange={(v: string | string[] | undefined) =>
              update({ [f.key]: Array.isArray(v) ? v.join(',') : (v ?? null) })
            }
            data-testid={`filter-${f.key}`}
          />
        );
      }
      case 'chips': {
        const selected = readListParam(params, f.key);
        return (
          <Flex key={f.key} gap={4} wrap align="center" role="group" aria-label={f.label}>
            {f.options.map((o) => {
              const checked = selected.includes(o.value);
              return (
                <Tag.CheckableTag
                  key={o.value}
                  checked={checked}
                  onChange={(on) => {
                    const next = on
                      ? [...selected, o.value]
                      : selected.filter((v) => v !== o.value);
                    update({ [f.key]: next.join(',') });
                  }}
                  data-testid={`chip-${f.key}-${o.value}`}
                >
                  {o.label}
                </Tag.CheckableTag>
              );
            })}
          </Flex>
        );
      }
      case 'toggle': {
        const onValue = f.onValue ?? '1';
        return (
          <label key={f.key} className="rm-filter-toggle">
            <Switch
              size="small"
              checked={params.get(f.key) === onValue}
              onChange={(on) => update({ [f.key]: on ? onValue : null })}
              data-testid={`filter-${f.key}`}
            />
            <span>{f.label}</span>
          </label>
        );
      }
      case 'numberRange': {
        const [fromKey, toKey] = f.keys;
        const read = (k: string) => {
          const v = params.get(k);
          return v && /^\d+$/.test(v) ? Number(v) : null;
        };
        return (
          <Flex key={fromKey} gap={4} align="center">
            {([fromKey, toKey] as const).map((k, i) => (
              <InputNumber<number>
                key={k}
                aria-label={f.labels[i]}
                placeholder={f.labels[i]}
                value={read(k)}
                min={f.min}
                max={f.max}
                precision={0}
                controls={false}
                dir="ltr"
                inputMode="numeric"
                className="rm-tabular rm-filter-number"
                onChange={(v) => update({ [k]: v === null ? null : String(v) })}
                data-testid={`filter-${k}`}
              />
            ))}
          </Flex>
        );
      }
      case 'dateRange': {
        const [fromKey, toKey] = f.keys;
        return (
          <DatePicker.RangePicker
            key={fromKey}
            aria-label={f.label}
            format={DISPLAY_DATE_FORMAT}
            allowEmpty={[true, true]}
            className="rm-tabular"
            value={[isoToDayjs(params.get(fromKey)), isoToDayjs(params.get(toKey))]}
            onChange={(range) =>
              update({
                [fromKey]: dayjsToIso(range?.[0] ?? null),
                [toKey]: dayjsToIso(range?.[1] ?? null),
              })
            }
          />
        );
      }
      case 'custom': {
        return (
          <span key={f.key} className="rm-filter-custom">
            {f.render(params.get(f.key), (v) => update({ [f.key]: v }))}
          </span>
        );
      }
      case 'autocomplete': {
        return (
          <AutoCompleteFilter
            key={f.key}
            label={f.label}
            options={f.options}
            width={f.width}
            value={params.get(f.key) ?? ''}
            onCommit={(v) => update({ [f.key]: v || null })}
          />
        );
      }
      default:
        return null;
    }
  };

  return (
    <Flex className="rm-filter-bar" gap={8} wrap align="center" justify="space-between">
      <Flex gap={8} wrap align="center" className="rm-filter-controls">
        {searchKey && (
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder={searchPlaceholder ?? t('common.searchPlaceholder')}
            aria-label={searchPlaceholder ?? t('actions.search')}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="rm-filter-search"
            data-testid="filter-search"
            {...freeTextInputProps}
          />
        )}
        {filters.map(renderFilter)}
        {active && (
          <Button
            type="link"
            onClick={() => {
              setText('');
              update(Object.fromEntries(owned.map((k) => [k, null])));
            }}
          >
            {t('actions.clearFilters')}
          </Button>
        )}
      </Flex>
      {extra && (
        <Flex gap={8} wrap align="center">
          {extra}
        </Flex>
      )}
    </Flex>
  );
}

interface AutoCompleteFilterProps {
  label: string;
  options: string[];
  width?: number;
  value: string;
  onCommit: (value: string) => void;
}

/** Free text with suggestions; written to the URL on select, blur or Enter. */
function AutoCompleteFilter({ label, options, width, value, onCommit }: AutoCompleteFilterProps) {
  const [draft, setDraft] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setDraft(value);
  }
  const needle = draft.trim().toLowerCase();
  return (
    <AutoComplete
      aria-label={label}
      placeholder={label}
      value={draft}
      allowClear
      style={{ minWidth: width ?? 160 }}
      options={options
        .filter((o) => !needle || o.toLowerCase().includes(needle))
        .map((o) => ({ value: o, label: o }))}
      onChange={(v: string) => setDraft(v ?? '')}
      onSelect={(v: string) => onCommit(v)}
      onClear={() => onCommit('')}
      onBlur={() => {
        if (draft.trim() !== value) onCommit(draft.trim());
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onCommit(draft.trim());
      }}
    />
  );
}
