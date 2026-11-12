import { useTranslation } from 'react-i18next';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatAmount } from '../lib/money';
import { DataTable } from '../ui/DataTable';
import { Money } from '../ui/Money';
import { ChartTooltipBox } from './ChartTooltip';
import { formatAxisTick, formatChartAmount, formatPeriodLabel } from './format';
import { useChartPalette } from './palette';
import { RoundedBar, type BarShapeInput } from './RoundedBar';
import type { LegendItem } from './ChartCard';

/** One period of the profit chart (dashboard months, or the profit report's groups). */
export interface ProfitPoint {
  period: string;
  profit: number;
  leaseIncome: number;
  sales?: number;
  costs?: number;
}

/** Chart height (the axis band included; the card grows with it). */
export const PROFIT_CHART_HEIGHT = 280;

/** Period label in the UI language (`Nov 26`, `Q4 2026`, `2026`). */
export function usePeriodLabel(): (period: string, style?: 'short' | 'long') => string {
  const { t, i18n } = useTranslation();
  return (period, style = 'short') =>
    formatPeriodLabel(period, i18n.resolvedLanguage, {
      style,
      quarter: (q, year) => t('charts.quarter', { q, year }),
    });
}

/** Legend of the profit chart: profit bars (slot 1), lease income line (slot 3). */
export function useProfitLegend(): LegendItem[] {
  const { t } = useTranslation();
  const palette = useChartPalette();
  return [
    { key: 'profit', label: t('charts.series.profit'), color: palette.series[0] },
    {
      key: 'leaseIncome',
      label: t('charts.series.leaseIncome'),
      color: palette.series[2],
      shape: 'line',
    },
  ];
}

interface TooltipPayloadEntry {
  dataKey?: string | number;
  value?: number | string;
  payload?: ProfitPoint;
}

/**
 * Profit per period as thin columns (4 px rounded data end, square at the zero baseline, losses
 * below it) with lease income as a 2 px line, on one ILS axis. Time runs left to right in every
 * language (the plot is an LTR island); ticks, labels and tooltips use Latin digits. Only the
 * latest period is labelled; the tooltip and the table view carry the rest.
 */
export function ProfitChart({ data }: { data: readonly ProfitPoint[] }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage;
  const palette = useChartPalette();
  const periodLabel = usePeriodLabel();
  const values = data.flatMap((d) => [d.profit, d.leaseIncome]);
  const axisMax = Math.max(0, ...values.map(Math.abs));
  const lastIndex = data.length - 1;

  return (
    <div dir="ltr" className="rm-chart-plot" data-testid="profit-chart">
      <ResponsiveContainer width="100%" height={PROFIT_CHART_HEIGHT}>
        <ComposedChart
          data={[...data]}
          margin={{ top: 24, right: 16, bottom: 4, left: 4 }}
          barCategoryGap="28%"
        >
          <CartesianGrid vertical={false} stroke={palette.grid} />
          <XAxis
            dataKey="period"
            tickFormatter={(p: string) => periodLabel(p)}
            tick={{ fill: palette.tick, fontSize: 12 }}
            axisLine={{ stroke: palette.axis }}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={8}
          />
          <YAxis
            tickFormatter={(v: number) => formatAxisTick(v, axisMax, lang)}
            tick={{ fill: palette.tick, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <ReferenceLine y={0} stroke={palette.axis} />
          <Tooltip
            cursor={{ fill: palette.hover }}
            isAnimationActive={false}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const entries = payload as readonly TooltipPayloadEntry[];
              const valueOf = (key: string) =>
                Number(entries.find((e) => e.dataKey === key)?.value ?? 0);
              return (
                <ChartTooltipBox
                  heading={periodLabel(String(label), 'long')}
                  rows={[
                    {
                      key: 'profit',
                      name: t('charts.series.profit'),
                      value: formatAmount(valueOf('profit'), lang, { decimals: false }),
                      color: palette.series[0],
                    },
                    {
                      key: 'leaseIncome',
                      name: t('charts.series.leaseIncome'),
                      value: formatAmount(valueOf('leaseIncome'), lang, { decimals: false }),
                      color: palette.series[2],
                    },
                  ]}
                />
              );
            }}
          />
          <Bar
            dataKey="profit"
            name={t('charts.series.profit')}
            fill={palette.series[0]}
            maxBarSize={24}
            isAnimationActive={false}
            shape={(props: BarShapeInput & { payload?: ProfitPoint; isActive?: boolean }) => (
              <RoundedBar
                {...props}
                end={(props.payload?.profit ?? 0) < 0 ? 'bottom' : 'top'}
                active={props.isActive}
              />
            )}
          >
            <LabelList
              dataKey="profit"
              content={(props) => {
                const { index, x, y, width, height, value } = props as {
                  index?: number;
                  x?: number | string;
                  y?: number | string;
                  width?: number | string;
                  height?: number | string;
                  value?: number | string;
                };
                if (index !== lastIndex || value === undefined) return null;
                const amount = Number(value);
                const cx = Number(x ?? 0) + Number(width ?? 0) / 2;
                const top = Math.min(Number(y ?? 0), Number(y ?? 0) + Number(height ?? 0));
                const bottom = Math.max(Number(y ?? 0), Number(y ?? 0) + Number(height ?? 0));
                return (
                  <text
                    x={cx}
                    y={amount < 0 ? bottom + 14 : top - 6}
                    textAnchor="middle"
                    direction="ltr"
                    fill={palette.label}
                    fontSize={12}
                    className="rm-chart-value-label"
                  >
                    {formatChartAmount(amount, lang)}
                  </text>
                );
              }}
            />
          </Bar>
          <Line
            dataKey="leaseIncome"
            name={t('charts.series.leaseIncome')}
            type="monotone"
            stroke={palette.series[2]}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={false}
            activeDot={{ r: 4, fill: palette.series[2], stroke: palette.surface, strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Table view of the profit chart (every value without hovering). */
export function ProfitTable({ data }: { data: readonly ProfitPoint[] }) {
  const { t } = useTranslation();
  const periodLabel = usePeriodLabel();
  const hasDetail = data.some((d) => d.sales !== undefined || d.costs !== undefined);
  return (
    <DataTable<ProfitPoint>
      size="small"
      label={t('dashboard.charts.profitTitle')}
      rowKey={(d) => d.period}
      data={data}
      data-testid="profit-table"
      columns={[
        {
          key: 'period',
          title: t('charts.period'),
          mobile: 'title',
          render: (d) => periodLabel(d.period, 'long'),
        },
        ...(hasDetail
          ? [
              {
                key: 'sales',
                title: t('charts.series.sales'),
                align: 'end' as const,
                render: (d: ProfitPoint) => <Money amount={d.sales ?? null} decimals={false} />,
              },
              {
                key: 'costs',
                title: t('charts.series.costs'),
                align: 'end' as const,
                render: (d: ProfitPoint) => <Money amount={d.costs ?? null} decimals={false} />,
              },
            ]
          : []),
        {
          key: 'leaseIncome',
          title: t('charts.series.leaseIncome'),
          align: 'end',
          render: (d) => <Money amount={d.leaseIncome} decimals={false} />,
        },
        {
          key: 'profit',
          title: t('charts.series.profit'),
          align: 'end',
          render: (d) => <Money amount={d.profit} decimals={false} signColor />,
        },
      ]}
    />
  );
}
