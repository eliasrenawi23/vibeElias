import type { EnumValue } from '@renawi/shared';
import { useEnumLabel } from '../lib/enums';
import { toneOf, type LabelledToneEnumName } from '../lib/statusTones';
import { ToneTag, type ToneTagProps } from './ToneTag';

export interface StatusTagProps<N extends LabelledToneEnumName>
  extends Omit<ToneTagProps, 'tone' | 'children'> {
  /** Enum name as in `@renawi/shared` (`VehicleStatus`, `LeaseStatus`...). */
  enumName: N;
  value: EnumValue<N>;
}

/**
 * Translated enum label (`enums.<Enum>.<value>`) as a tag in the tone the registry gives that
 * value of that enum (`shared/lib/statusTones.ts`), so `CANCELLED` can differ per enum.
 */
export function StatusTag<N extends LabelledToneEnumName>({
  enumName,
  value,
  className,
  ...rest
}: StatusTagProps<N>) {
  const enumLabel = useEnumLabel();
  return (
    <ToneTag
      data-status={String(value)}
      {...rest}
      tone={toneOf(enumName, String(value))}
      className={className ? `rm-status-tag ${className}` : 'rm-status-tag'}
    >
      {enumLabel(enumName, value)}
    </ToneTag>
  );
}
