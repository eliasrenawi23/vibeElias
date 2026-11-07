import type { ReactNode } from 'react';

/** One row of a chart tooltip. */
export interface TooltipRow {
  key: string;
  /** Series name (secondary). */
  name: ReactNode;
  /** Formatted value (leads, strong). */
  value: string;
  color: string;
}

export interface ChartTooltipBoxProps {
  heading?: ReactNode;
  rows: readonly TooltipRow[];
}

/**
 * Tooltip body shared by the charts: the value leads (strong), the series name follows, keyed by
 * a short stroke of the series colour. Plain React text nodes only (labels are data).
 */
export function ChartTooltipBox({ heading, rows }: ChartTooltipBoxProps) {
  if (rows.length === 0) return null;
  return (
    <div className="rm-chart-tooltip" role="status" data-testid="chart-tooltip">
      {heading && <div className="rm-chart-tooltip-heading">{heading}</div>}
      <ul className="rm-chart-tooltip-rows">
        {rows.map((row) => (
          <li key={row.key} className="rm-chart-tooltip-row">
            <span aria-hidden className="rm-chart-key" style={{ background: row.color }} />
            <bdi dir="ltr" className="rm-chart-tooltip-value">
              {row.value}
            </bdi>
            <span className="rm-chart-tooltip-name">{row.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
