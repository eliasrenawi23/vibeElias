import { Ltr } from '../lib/bidi';
import { displayPlate } from '../lib/plate';

export interface PlateNoProps {
  /** Canonical digits (or any typed form, it is normalised). */
  value: string | null | undefined;
  /** `plate` draws a small yellow Israeli plate; `text` is plain tabular text. */
  variant?: 'plate' | 'text';
  className?: string;
}

/** Licence plate (`12-345-67` / `123-45-678`), never mirrored inside RTL text. */
export function PlateNo({ value, variant = 'plate', className }: PlateNoProps) {
  if (!value) return <span className="rm-empty-value">—</span>;
  const classes = [variant === 'plate' ? 'rm-plate' : undefined, className]
    .filter(Boolean)
    .join(' ');
  return <Ltr className={classes}>{displayPlate(value)}</Ltr>;
}
