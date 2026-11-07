import type { ReactNode } from 'react';

export { isolateAuto, isolateLtr, isolateRtl, stripBidiMarks } from '@renawi/shared';

/**
 * Bidi building blocks. Plates, VINs, phones, IDs and amounts are left-to-right islands inside
 * Hebrew/Arabic text: wrap them in `<Ltr>` (`<bdi dir="ltr">`) so they are never mirrored or
 * reordered by the surrounding RTL text. Free text whose direction is unknown (names, notes)
 * uses `<AutoDir>` / `dir="auto"`.
 */

function cx(...names: (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(' ');
}

export interface LtrProps {
  children: ReactNode;
  className?: string;
  /** Use tabular figures (amounts, plates, counters). Default true. */
  tabular?: boolean;
  title?: string;
}

/** Left-to-right isolate: `<bdi dir="ltr">`. */
export function Ltr({ children, className, tabular = true, title }: LtrProps) {
  return (
    <bdi dir="ltr" className={cx('rm-ltr', tabular && 'rm-tabular', className)} title={title}>
      {children}
    </bdi>
  );
}

/** Direction from the first strong character: `<bdi dir="auto">` (user-entered text). */
export function AutoDir({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <bdi dir="auto" className={className}>
      {children}
    </bdi>
  );
}

/** Props for free-text inputs (names, addresses, notes): direction follows what is typed. */
export const freeTextInputProps = { dir: 'auto' } as const;

/** Props for e-mail / password / URL inputs: always left-to-right. */
export const ltrInputProps = { dir: 'ltr', spellCheck: false } as const;

/** Props for numeric inputs (IDs, licence numbers): left-to-right, numeric keypad. */
export const numericInputProps = { dir: 'ltr', inputMode: 'numeric', spellCheck: false } as const;

/** Props for phone inputs: left-to-right, phone keypad (keeps `+` for +972). */
export const phoneInputProps = {
  dir: 'ltr',
  inputMode: 'tel',
  autoComplete: 'tel',
  spellCheck: false,
} as const;
