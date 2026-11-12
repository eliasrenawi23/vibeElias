import { ArrowDownOutlined, ArrowUpOutlined, InfoCircleOutlined, MinusOutlined } from '@ant-design/icons';
import { Button, Card, Statistic, Tooltip } from 'antd';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { formatCountValue, formatKpiAmount } from '../../../shared/charts/format';
import { toneClassName, type Tone } from '../../../shared/lib/statusTones';
import { PROFIT_CLASSES, profitState } from '../../../shared/ui/ProfitText';

export type KpiFormat = 'count' | 'money' | 'profit';

/** Change against a named earlier period (e.g. last month). */
export interface KpiTrend {
  direction: 'up' | 'down' | 'flat';
  /** Says what changed and against what ("Up ₪1,200 from last month"). */
  label: ReactNode;
  /** Whether the change is good news (success), bad (error) or neither (neutral). */
  tone: Tone;
}

export interface KpiCardProps {
  title: ReactNode;
  /** `null` / `undefined` = not available: shown as "—" with `sub` (or a default reason). */
  value: number | null | undefined;
  icon: ReactNode;
  format?: KpiFormat;
  /** What the number means (an info tooltip next to the title). */
  info?: ReactNode;
  trend?: KpiTrend | null;
  /** A secondary line (e.g. "₪1,200 overdue"); the reason when the value is missing. */
  sub?: ReactNode;
  /** Tone of the secondary line. */
  subTone?: Tone;
  /** Highlight a number that needs attention (overdue transfers, expired documents). */
  alert?: boolean;
  loading?: boolean;
  'data-testid'?: string;
}

const TREND_ICONS = { up: ArrowUpOutlined, down: ArrowDownOutlined, flat: MinusOutlined } as const;

/**
 * Stat tile of the dashboard: label (with an info tooltip), value (auto-compact amounts, Latin
 * digits in every language), optional trend and secondary line. A missing value is "—" with the
 * reason, never a fake 0.
 */
export function KpiCard({
  title,
  value,
  icon,
  format = 'count',
  info,
  trend,
  sub,
  subTone,
  alert = false,
  loading,
  'data-testid': testId,
}: KpiCardProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage;
  const missing = value === null || value === undefined || !Number.isFinite(value);

  const formatter = () => {
    if (missing) return <span className="rm-kpi-missing">—</span>;
    const text = format === 'count' ? formatCountValue(value, lang) : formatKpiAmount(value, lang);
    const number = (
      <bdi dir="ltr" className="rm-kpi-number">
        {text}
      </bdi>
    );
    if (format !== 'profit') return number;
    const state = profitState(value);
    return (
      <span className={PROFIT_CLASSES[state]} data-profit={state} data-testid="kpi-profit">
        {number}
      </span>
    );
  };

  const TrendIcon = trend ? TREND_ICONS[trend.direction] : null;
  const subLine = missing ? (sub ?? t('dashboard.kpiSub.notAvailable')) : sub;

  return (
    <Card
      variant="borderless"
      className={['rm-kpi-card', alert && !missing && value > 0 ? 'rm-kpi-alert' : undefined]
        .filter(Boolean)
        .join(' ')}
      data-testid={testId}
      data-missing={missing || undefined}
    >
      <div className="rm-kpi-icon" aria-hidden>
        {icon}
      </div>
      <Statistic
        title={
          <span className="rm-kpi-title">
            <span>{title}</span>
            {info && (
              <Tooltip title={info} trigger={['hover', 'focus']}>
                <Button
                  type="text"
                  size="small"
                  className="rm-kpi-info"
                  icon={<InfoCircleOutlined />}
                  aria-label={t('dashboard.kpiInfoLabel')}
                />
              </Tooltip>
            )}
          </span>
        }
        value={missing ? 0 : value}
        loading={loading}
        formatter={formatter}
      />
      {!loading && trend && TrendIcon && (
        <div className={`rm-kpi-trend ${toneClassName(trend.tone)}`} data-trend={trend.direction}>
          <TrendIcon aria-hidden />
          <span>{trend.label}</span>
        </div>
      )}
      {!loading && subLine && (
        <div
          className={['rm-kpi-sub', subTone ? toneClassName(subTone) : undefined]
            .filter(Boolean)
            .join(' ')}
          data-testid={testId ? `${testId}-sub` : undefined}
        >
          {subLine}
        </div>
      )}
    </Card>
  );
}
