import type { DashboardCharts } from '@renawi/shared';
import { Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import type { TKey } from '../lib/i18n';
import { DataTable } from '../ui/DataTable';
import type { LegendItem } from './ChartCard';
import { formatCountValue, formatShare } from './format';
import { useChartPalette } from './palette';

export type InventoryCounts = DashboardCharts['inventory'];

/** Parts of the inventory bar, in fixed order (each keeps its categorical slot). */
export const INVENTORY_PARTS = ['inStock', 'reserved', 'leased', 'consigned'] as const;
export type InventoryPart = (typeof INVENTORY_PARTS)[number];

const LABEL_KEYS: Readonly<Record<InventoryPart, TKey>> = {
  inStock: 'charts.inventory.inStock',
  reserved: 'charts.inventory.reserved',
  leased: 'charts.inventory.leased',
  consigned: 'charts.inventory.consigned',
};

/** A part's share is printed inside its block only from this share up (narrower ones do not fit). */
const MIN_LABEL_SHARE = 0.12;

interface Part {
  key: InventoryPart;
  label: string;
  count: number;
  color: string;
}

function useParts(inventory: InventoryCounts): Part[] {
  const { t } = useTranslation();
  const palette = useChartPalette();
  return INVENTORY_PARTS.map((key, i) => ({
    key,
    label: t(LABEL_KEYS[key]),
    count: Math.max(0, Number(inventory[key] ?? 0)),
    color: palette.series[i] ?? palette.series[0],
  }));
}

/** Total cars of the inventory bar. */
export function inventoryTotal(inventory: InventoryCounts): number {
  return INVENTORY_PARTS.reduce((sum, k) => sum + Math.max(0, Number(inventory[k] ?? 0)), 0);
}

/** Legend of the inventory bar: names only, in block order. */
export function useInventoryLegend(inventory: InventoryCounts): LegendItem[] {
  return useParts(inventory).map((p) => ({ key: p.key, label: p.label, color: p.color }));
}

/**
 * One whole split into its parts: a tall (28 px) segmented bar, each part a block with 4 px
 * corners and a 2 px surface gap, its share printed inside at the leading edge where it fits
 * (white on the categorical fill). Every block is focusable with a tooltip giving the name,
 * count and share; the bar's accessible name lists them all.
 */
export function InventoryBar({ inventory }: { inventory: InventoryCounts }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage;
  const palette = useChartPalette();
  const parts = useParts(inventory).filter((p) => p.count > 0);
  const total = parts.reduce((s, p) => s + p.count, 0);
  const describe = (p: Part) =>
    `${p.label}: ${formatCountValue(p.count, lang)} (${formatShare(p.count, total, lang)})`;

  return (
    <div className="rm-inventory" data-testid="inventory-chart">
      <div className="rm-inventory-total">
        <bdi dir="ltr" className="rm-inventory-total-value">
          {formatCountValue(total, lang)}
        </bdi>{' '}
        <span className="rm-inventory-total-label">{t('charts.cars')}</span>
      </div>
      <div
        className="rm-segmented-bar"
        role="img"
        aria-label={t('charts.inventoryLabel', {
          total: formatCountValue(total, lang),
          parts: parts.map(describe).join(', '),
        })}
      >
        {parts.map((p) => {
          const share = total > 0 ? p.count / total : 0;
          return (
            <Tooltip key={p.key} title={describe(p)}>
              <span
                className="rm-segment"
                style={{ flexGrow: p.count, background: p.color, color: palette.onSeries }}
                tabIndex={0}
                aria-label={describe(p)}
                data-part={p.key}
                data-count={p.count}
              >
                {share >= MIN_LABEL_SHARE && (
                  <bdi dir="ltr" className="rm-segment-label" aria-hidden>
                    {formatShare(p.count, total, lang)}
                  </bdi>
                )}
              </span>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

/** Table view of the inventory bar. */
export function InventoryTable({ inventory }: { inventory: InventoryCounts }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage;
  const parts = useParts(inventory);
  const total = inventoryTotal(inventory);
  return (
    <DataTable<Part>
      size="small"
      label={t('dashboard.charts.inventoryTitle')}
      rowKey={(p) => p.key}
      data={parts}
      data-testid="inventory-table"
      columns={[
        { key: 'status', title: t('common.status'), mobile: 'title', render: (p) => p.label },
        {
          key: 'count',
          title: t('charts.cars'),
          align: 'end',
          render: (p) => (
            <bdi dir="ltr" className="rm-tabular">
              {formatCountValue(p.count, lang)}
            </bdi>
          ),
        },
        {
          key: 'share',
          title: t('charts.share'),
          align: 'end',
          render: (p) => (
            <bdi dir="ltr" className="rm-tabular">
              {formatShare(p.count, total, lang)}
            </bdi>
          ),
        },
      ]}
    />
  );
}
