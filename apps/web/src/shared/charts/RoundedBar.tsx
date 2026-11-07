/** Side of a bar that carries the data (the end away from the baseline). */
export type BarEnd = 'top' | 'bottom' | 'left' | 'right';

/** Corner radius of a bar's data end (the baseline end stays square). */
export const BAR_RADIUS = 4;

/**
 * SVG path of a bar with rounded corners on its data end only. Accepts negative width / height
 * (Recharts passes them for negative values and reversed axes). Empty for a zero-size bar.
 */
export function barPath(
  x: number,
  y: number,
  width: number,
  height: number,
  end: BarEnd,
  radius: number = BAR_RADIUS,
): string {
  const left = Math.min(x, x + width);
  const top = Math.min(y, y + height);
  const w = Math.abs(width);
  const h = Math.abs(height);
  if (w < 0.5 || h < 0.5) return '';
  const right = left + w;
  const bottom = top + h;
  const vertical = end === 'top' || end === 'bottom';
  const r = Math.max(0, Math.min(radius, vertical ? w / 2 : h / 2, vertical ? h : w));
  switch (end) {
    case 'top':
      return `M${left},${bottom}V${top + r}A${r},${r} 0 0 1 ${left + r},${top}H${right - r}A${r},${r} 0 0 1 ${right},${top + r}V${bottom}Z`;
    case 'bottom':
      return `M${left},${top}H${right}V${bottom - r}A${r},${r} 0 0 1 ${right - r},${bottom}H${left + r}A${r},${r} 0 0 1 ${left},${bottom - r}Z`;
    case 'right':
      return `M${left},${top}H${right - r}A${r},${r} 0 0 1 ${right},${top + r}V${bottom - r}A${r},${r} 0 0 1 ${right - r},${bottom}H${left}Z`;
    case 'left':
      return `M${right},${top}V${bottom}H${left + r}A${r},${r} 0 0 1 ${left},${bottom - r}V${top + r}A${r},${r} 0 0 1 ${left + r},${top}Z`;
  }
}

/** Geometry Recharts hands to a custom bar `shape`. */
export interface BarShapeInput {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  fill?: string;
}

const num = (v: number | string | undefined) => (typeof v === 'number' ? v : Number(v ?? 0));

export interface RoundedBarProps extends BarShapeInput {
  end: BarEnd;
  /** Hovered / focused: the mark lifts slightly. */
  active?: boolean;
}

/** A Recharts bar mark: thin, 4px rounded data end, square at the baseline. */
export function RoundedBar({ x, y, width, height, fill, end, active = false }: RoundedBarProps) {
  const d = barPath(num(x), num(y), num(width), num(height), end);
  if (!d) return null;
  return <path d={d} fill={fill} fillOpacity={active ? 0.82 : 1} className="rm-chart-bar" />;
}
