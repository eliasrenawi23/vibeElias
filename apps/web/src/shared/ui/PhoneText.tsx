import { formatPhone, phoneToE164 } from '@renawi/shared';
import { Ltr } from '../lib/bidi';

/** Phone number as a `tel:` link, isolated left-to-right (`050-123-4567`). */
export function PhoneText({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="rm-empty-value">—</span>;
  return (
    <Ltr>
      <a href={`tel:${phoneToE164(value)}`}>{formatPhone(value)}</a>
    </Ltr>
  );
}
