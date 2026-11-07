import { Ltr } from '../../../shared/lib/bidi';

/** Contract number `#1024`, isolated left-to-right. */
export function ContractNo({ no }: { no: number | null | undefined }) {
  if (no === null || no === undefined) return <span className="rm-empty-value">—</span>;
  return <Ltr className="rm-contract-no">{`#${no}`}</Ltr>;
}
