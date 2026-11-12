import type { DashboardCharts } from '@renawi/shared';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TKey } from '../lib/i18n';
import { formatAmount } from '../lib/money';
import { DataTable } from '../ui/DataTable';
import { Money } from '../ui/Money';
import { ChartTooltipBox } from './ChartTooltip';
import { formatAxisTick, formatChartAmount, formatShare } from './format';
import { useChartPalette } from './palette';
import { RoundedBar, type BarShapeInput } from './RoundedBar';

export type AgeingBuckets = DashboardCharts['receivablesAgeing'];

/** Buckets from not yet due to the oldest (an ordered scale: the one-hue ramp, darker = older). */
export const AGEING_BUCKETS = ['current', 'd1_30', 'd31_60', 'd61_90', 'd90_plus'] as const;
export type AgeingBucket = (typeof AGEING_BUCKETS)[number];

export const AGEING_LABEL_KEYS: Readonly<Record<AgeingBucket, TKey>> = {
  current: 'charts.ageing.current',
  d1_30: 'charts.ageing.d1_30',
  d31_60: 'charts.ageing.d31_60',
  d61_90: 'charts.ageing.d61_90',
  d90_plus: 'charts.ageing.d90_plus',
};

interface AgeingRow {
  bucket: AgeingBucket;
  label: string;
  amount: number;
}

function useAgeingRows(ageing: AgeingBuckets): AgeingRow[] {
  const { t } = useTranslation();
  return AGEING_BUCKETS.map((bucket) => ({
    bucket,
    label: t(AGEING_LABEL_KEYS[bucket]),
    amount: Number(ageing[bucket] ?? 0),
  }));
}

/** Total of the ageing buckets. */
export function ageingTotal(ageing: AgeingBuckets): number {
  return AGEING_BUCKETS.reduce((sum, b) => sum + Number(ageing[b] ?? 0), 0);
}

export const AGEING_CHART_HEIGHT = 240;

/**
 * Open driver charges by days past due: five thin columns on the ordinal ramp (older = darker),
 * the largest one labelled at its cap; the tooltip and the table view give every amount.
 */
export function AgeingChart({ ageing }: { ageing: AgeingBuckets }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage;
  const palette = useChartPalette();
  const rows = useAgeingRows(ageing);
  const max = Math.max(0, ...rows.map((r) => r.amount));
  const maxIndex = rows.findIndex((r) => r.amount === max && max > 0);

  return (
    <div dir="ltr" className="rm-chart-plot" data-testid="ageing-chart">
      <ResponsiveContainer width="100%" height={AGEING_CHART_HEIGHT}>
        <BarChart data={rows} margin={{ top: 24, right: 8, bottom: 4, left: 4 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke={palette.grid} />
          <XAxis
            dataKey="label"
            tick={{ fill: palette.tick, fontSize: 12 }}
            axisLine={{ stroke: palette.axis }}
            tickLine={false}
            interval={0}
          />
          <YAxis
            tickFormatter={(v: number) => formatAxisTick(v, max, lang)}
            tick={{ fill: palette.tick, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip
            cursor={{ fill: palette.hover }}
            isAnimationActive={false}
            content={({ active, payload }) => {
              const row = (payload?.[0] as { payload?: AgeingRow } | undefined)?.payload;
              if (!active || !row) return null;
              const index = AGEING_BUCKETS.indexOf(row.bucket);
              return (
                <ChartTooltipBox
                  heading={row.label}
                  rows={[
                    {
                      key: row.bucket,
                      name: t('charts.amount'),
                      value: formatAmount(row.amount, lang, { decimals: false }),
                      color: palette.ordinal[index] ?? palette.series[0],
                    },
                  ]}
                />
              );
            }}
          />
          <Bar
            dataKey="amount"
            maxBarSize={24}
            isAnimationActive={false}
            shape={(props: BarShapeInput & { isActive?: boolean }) => (
              <RoundedBar {...props} end="top" active={props.isActive} />
            )}
          >
            {rows.map((row, i) => (
              <Cell key={row.bucket} fill={palette.ordinal[i]} />
            ))}
            <LabelList
              dataKey="amount"
              content={(props) => {
                const { index, x, y, width, value } = props as {
                  index?: number;
                  x?: number | string;
                  y?: number | string;
                  width?: number | string;
                  value?: number | string;
                };
                if (index !== maxIndex || value === undefined) return null;
                return (
                  <text
                    x={Number(x ?? 0) + Number(width ?? 0) / 2}
                    y={Number(y ?? 0) - 6}
                    textAnchor="middle"
                    direction="ltr"
                    fill={palette.label}
                    fontSize={12}
                    className="rm-chart-value-label"
                  >
                    {formatChartAmount(Number(value), lang)}
                  </text>
                );
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Table view of the ageing chart. */
export function AgeingTable({ ageing }: { ageing: AgeingBuckets }) {
  const { t, i18n } = useTranslation();
  const rows = useAgeingRows(ageing);
  const total = ageingTotal(ageing);
  return (
    <DataTable<AgeingRow>
      size="small"
      label={t('dashboard.charts.ageingTitle')}
      rowKey={(r) => r.bucket}
      data={rows}
      data-testid="ageing-table"
      columns={[
        { key: 'bucket', title: t('charts.period'), mobile: 'title', render: (r) => r.label },
        {
          key: 'amount',
          title: t('charts.amount'),
          align: 'end',
          render: (r) => <Money amount={r.amount} decimals={false} />,
        },
        {
          key: 'share',
          title: t('charts.share'),
          align: 'end',
          render: (r) => (
            <bdi dir="ltr" className="rm-tabular">
              {formatShare(r.amount, total, i18n.resolvedLanguage)}
            </bdi>
          ),
        },
      ]}
    />
  );
}
