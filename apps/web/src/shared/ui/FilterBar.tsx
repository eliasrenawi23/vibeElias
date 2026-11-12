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
import { useLocation, useSearchParams } from 'react-router';
import { freeTextInputProps } from '../lib/bidi';
import {
  activePreset,
  DATE_PRESETS,
  datePresetLabelKey,
  presetRange,
  type DatePreset,
} from '../lib/datePresets';
import { DATE_INPUT_FORMATS, dayjsToIso, isoToDayjs } from '../lib/dates';
import { clearListMemory, isListPath, sectionOf } from '../lib/listMemory';
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
  | {
      type: 'dateRange';
      keys: [string, string];
      label: string;
      /**
       * Period presets (this month, last month, year to date, last year, last 30 days; computed
       * in the business time zone): in the picker's panel and as quick chips beside it, the one
       * matching the current dates highlighted. `true` = all of them.
       */
      presets?: boolean | readonly DatePreset[];
    }
  | { type: 'date'; key: string; label: string }
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
  /**
   * Values a param has when it is absent (e.g. a horizon of `30` days). A param equal to its
   * default does not count as a filter, so "Clear filters" only shows when something differs.
   */
  defaults?: Readonly<Record<string, string>>;
}

/** Date range: shown as the first format, accepted typed or pasted in any of them. */
const DATE_FORMATS = [...DATE_INPUT_FORMATS];

/** Every URL param a filter definition owns. */
function filterKeys(filters: FilterDef[]): string[] {
  return filters.flatMap((f) => ('keys' in f ? [...f.keys] : [f.key]));
}

/**
 * Params of select / chips filters holding values that are not (or no longer) among the options,
 * with what is left of them (null = nothing). Filters without options are not checked.
 */
export function staleFilterValues(
  filters: readonly FilterDef[],
  params: URLSearchParams,
): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const f of filters) {
    if ((f.type !== 'select' && f.type !== 'chips') || f.options.length === 0) continue;
    const known = new Set(f.options.map((o) => o.value));
    const values = readListParam(params, f.key);
    const kept = values.filter((v) => known.has(v));
    if (kept.length !== values.length) out[f.key] = kept.length > 0 ? kept.join(',') : null;
  }
  return out;
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
  defaults,
}: FilterBarProps) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
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

  // Selections that dropped out of the options (an old bookmark, a renamed value) are cleared.
  const staleKey = JSON.stringify(staleFilterValues(filters, params));
  useEffect(() => {
    const changes = JSON.parse(staleKey) as Record<string, string | null>;
    if (Object.keys(changes).length === 0) return;
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(changes)) setOrDelete(next, key, value);
        return next;
      },
      { replace: true },
    );
  }, [staleKey, setParams]);

  const owned = [...(searchKey ? [searchKey] : []), ...filterKeys(filters)];
  const active = owned.some((k) => {
    const value = params.get(k);
    return Boolean(value) && value !== defaults?.[k];
  });

  const renderFilter = (f: FilterDef) => {
    switch (f.type) {
      case 'select': {
        const fallback = defaults?.[f.key];
        const value = f.multiple
          ? readListParam(params, f.key)
          : (params.get(f.key) ?? fallback ?? undefined);
        return (
          <Select
            key={f.key}
            aria-label={f.label}
            placeholder={f.label}
            mode={f.multiple ? 'multiple' : undefined}
            maxTagCount="responsive"
            // A single select with a default has nothing to clear back to.
            allowClear={f.multiple || fallback === undefined}
            value={value}
            options={f.options}
            style={{ minWidth: f.width ?? 160 }}
            showSearch={f.options.length > 8 ? { optionFilterProp: 'label' } : false}
            onChange={(v: string | string[] | undefined) =>
              update({
                [f.key]: Array.isArray(v)
                  ? v.join(',')
                  : v === undefined || v === fallback
                    ? null
                    : v,
              })
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
        const presets: readonly DatePreset[] =
          f.presets === true ? DATE_PRESETS : f.presets ? f.presets : [];
        const from = params.get(fromKey);
        const to = params.get(toKey);
        const current = presets.length > 0 ? activePreset(from, to, undefined, presets) : null;
        const picker = (
          <DatePicker.RangePicker
            key={fromKey}
            aria-label={f.label}
            format={DATE_FORMATS}
            allowEmpty={[true, true]}
            className="rm-tabular"
            value={[isoToDayjs(from), isoToDayjs(to)]}
            presets={presets.flatMap((p) => {
              const [pf, pt] = presetRange(p).map(isoToDayjs);
              return pf && pt ? [{ label: t(datePresetLabelKey(p)), value: [pf, pt] as const }] : [];
            })}
            onChange={(range) =>
              update({
                [fromKey]: dayjsToIso(range?.[0] ?? null),
                [toKey]: dayjsToIso(range?.[1] ?? null),
              })
            }
            data-testid={`filter-${fromKey}-${toKey}`}
          />
        );
        if (presets.length === 0) return picker;
        return (
          <Flex key={fromKey} gap={8} wrap align="center" className="rm-filter-period">
            <Flex
              gap={4}
              wrap
              align="center"
              role="group"
              aria-label={t('filters.presetsLabel')}
              className="rm-filter-presets"
            >
              {presets.map((p) => (
                <Tag.CheckableTag
                  key={p}
                  checked={current === p}
                  onChange={(on) => {
                    const [pf, pt] = on ? presetRange(p) : [null, null];
                    update({ [fromKey]: pf, [toKey]: pt });
                  }}
                  data-testid={`preset-${p}`}
                >
                  {t(datePresetLabelKey(p))}
                </Tag.CheckableTag>
              ))}
            </Flex>
            {picker}
          </Flex>
        );
      }
      case 'date': {
        return (
          <DatePicker
            key={f.key}
            aria-label={f.label}
            placeholder={f.label}
            format={DATE_FORMATS}
            className="rm-tabular"
            value={isoToDayjs(params.get(f.key))}
            onChange={(d) => update({ [f.key]: dayjsToIso(d) })}
            data-testid={`filter-${f.key}`}
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
              lastWritten.current = '';
              update(Object.fromEntries(owned.map((k) => [k, null])));
              // A list page also forgets its remembered filters (detail-page tabs keep them).
              if (isListPath(pathname)) clearListMemory(sectionOf(pathname));
            }}
            data-testid="filter-clear"
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
