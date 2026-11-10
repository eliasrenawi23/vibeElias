import type { ReactNode } from 'react';

export interface Fact {
  key: string;
  icon: ReactNode;
  label: ReactNode;
  value: ReactNode;
}

export interface FactChipsProps {
  /** Facts in reading order; falsy entries are skipped (facts that do not apply). */
  facts: readonly (Fact | false | null | undefined)[];
  'data-testid'?: string;
}

/**
 * The key facts of a record under its title (plate, driver, monthly rent, balance): an icon tile
 * on primary-soft, the label and the value. A definition list, so screen readers pair label and
 * value. Two per row on phones, one wrapping row from `md` up.
 */
export function FactChips({ facts, 'data-testid': testId }: FactChipsProps) {
  const list = facts.filter((f): f is Fact => Boolean(f));
  if (list.length === 0) return null;
  return (
    <dl className="rm-fact-chips" data-testid={testId}>
      {list.map((f) => (
        <div key={f.key} className="rm-fact-chip" data-fact={f.key}>
          <dt className="rm-fact-term">
            <span className="rm-fact-icon" aria-hidden>
              {f.icon}
            </span>
            <span className="rm-fact-label">{f.label}</span>
          </dt>
          <dd className="rm-fact-value">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}
