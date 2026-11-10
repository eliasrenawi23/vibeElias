import { Link } from 'react-router';
import { Ltr } from '../lib/bidi';
import { ToneTag } from './ToneTag';

export interface LicenseTagProps {
  /** Taxi licence ("green number") identifier. */
  licenseNo: string | null | undefined;
  /** Licence id: makes the tag a link to `/taxi-licenses/:id`. */
  id?: string | null;
}

/**
 * A taxi licence number in the brand's green licence tone, isolated left-to-right so it is
 * never reordered inside Hebrew / Arabic text.
 */
export function LicenseTag({ licenseNo, id }: LicenseTagProps) {
  if (!licenseNo) return <span className="rm-empty-value">—</span>;
  const tag = (
    <ToneTag tone="license" className="rm-license-tag" data-testid="license-tag">
      <Ltr className="rm-license-no">{licenseNo}</Ltr>
    </ToneTag>
  );
  if (!id) return tag;
  return (
    <Link
      to={`/taxi-licenses/${encodeURIComponent(id)}`}
      className="rm-license-link"
      aria-label={licenseNo}
    >
      {tag}
    </Link>
  );
}
