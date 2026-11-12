import type { EnumValue, StatusSummary } from '@renawi/shared';
import { keepPreviousData, useQuery, type QueryKey } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { useEnumLabel } from '../lib/enums';
import { readListParam } from '../lib/listParams';
import { formatCount } from '../lib/money';
import { toneClassName, toneOf } from '../lib/statusTones';

/** Status enums with a `GET /<list>/summary` endpoint. */
export type SummaryEnumName = 'VehicleStatus' | 'LeaseStatus' | 'DealStatus' | 'FineStatus';

export interface StatusSummaryCardsProps<N extends SummaryEnumName> {
  enumName: N;
  /** Cards in this order (usually every value of the enum). */
  statuses: readonly EnumValue<N>[];
  /** Query key of the summary under the list's current filters except status. */
  queryKey: QueryKey;
  /** `GET /<list>/summary` with the list's current filters except status. */
  load: (signal: AbortSignal) => Promise<StatusSummary<EnumValue<N> & string>>;
  /** URL param of the multi-select status filter (`status=A,B`). */
  paramKey?: string;
  'data-testid'?: string;
}

/**
 * Quick filters above a list's `FilterBar`: one card per status with its count under the other
 * filters (so each card shows what clicking it gives). A card is a toggle button
 * (`aria-pressed`) that adds or removes its status in the URL's multi-select `status` param;
 * active cards are highlighted. Tone bar on the inline-start edge; the row scrolls sideways on
 * phones. Hidden when the summary cannot be loaded (the list and its filters still work).
 */
export function StatusSummaryCards<N extends SummaryEnumName>({
  enumName,
  statuses,
  queryKey,
  load,
  paramKey = 'status',
  'data-testid': testId = 'status-summary',
}: StatusSummaryCardsProps<N>) {
  const { t, i18n } = useTranslation();
  const enumLabel = useEnumLabel();
  const [params, setParams] = useSearchParams();
  const selected = readListParam(params, paramKey);

  const summary = useQuery({
    queryKey,
    queryFn: ({ signal }) => load(signal),
    placeholderData: keepPreviousData,
  });
  if (summary.isError) return null;
  const counts = summary.data?.counts as Partial<Record<string, number>> | undefined;

  const toggle = (status: string) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        const current = readListParam(next, paramKey);
        const values = current.includes(status)
          ? current.filter((v) => v !== status)
          : [...current, status];
        if (values.length > 0) next.set(paramKey, values.join(','));
        else next.delete(paramKey);
        next.delete('page');
        return next;
      },
      { replace: true },
    );
  };

  return (
    <div
      role="group"
      aria-label={t('summary.label')}
      aria-busy={summary.isPending || undefined}
      className="rm-summary-cards"
      data-testid={testId}
    >
      {statuses.map((status) => {
        const value = String(status);
        const active = selected.includes(value);
        const count = counts?.[value];
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            className={[
              'rm-summary-card',
              toneClassName(toneOf(enumName, value)),
              active ? 'rm-summary-card-active' : undefined,
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => toggle(value)}
            data-testid={`summary-card-${value}`}
            data-count={count ?? undefined}
          >
            <bdi dir="ltr" className="rm-summary-count rm-tabular">
              {count === undefined ? '–' : formatCount(count, i18n.resolvedLanguage)}
            </bdi>
            <span className="rm-summary-label">{enumLabel(enumName, status)}</span>
          </button>
        );
      })}
    </div>
  );
}
