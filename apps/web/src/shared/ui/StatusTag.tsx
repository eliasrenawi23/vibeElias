import type { EnumValue, LabelledEnumName } from '@renawi/shared';
import { Tag } from 'antd';
import { useDynamicT } from '../lib/i18n';

/** AntD preset colours by status value; anything not listed renders as a neutral tag. */
const STATUS_COLORS: Readonly<Record<string, string>> = {
  ACTIVE: 'success',
  COMPLETED: 'success',
  DONE: 'success',
  IN_STOCK: 'processing',
  LEASED: 'gold',
  RESERVED: 'warning',
  PENDING: 'warning',
  IN_PROGRESS: 'processing',
  TRANSFER_PENDING: 'warning',
  NEW: 'processing',
  SUSPENDED: 'error',
  BLACKLISTED: 'error',
  TERMINATED: 'error',
  CANCELLED: 'default',
  DRAFT: 'default',
  ENDED: 'default',
  SOLD: 'default',
};

export interface StatusTagProps<N extends LabelledEnumName> {
  /** Enum name as in `@renawi/shared` (`VehicleStatus`, `LeaseStatus`...). */
  enumName: N;
  value: EnumValue<N>;
  /** Override the colour (AntD preset or CSS colour). */
  color?: string;
}

/** Translated enum label (`enums.<Enum>.<value>`) as a coloured tag. */
export function StatusTag<N extends LabelledEnumName>({
  enumName,
  value,
  color,
}: StatusTagProps<N>) {
  const dynamicT = useDynamicT();
  const v = String(value);
  return (
    <Tag color={color ?? STATUS_COLORS[v]} className="rm-status-tag">
      {dynamicT(`enums.${enumName}.${v}`)}
    </Tag>
  );
}
