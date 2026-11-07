import { WarningOutlined } from '@ant-design/icons';
import { Flex, Tag } from 'antd';
import { useDynamicT } from '../lib/i18n';

export interface AlertTagsProps {
  /** Alert codes computed by the API (`alerts` on list items and details). */
  alerts: readonly string[] | null | undefined;
  /** Locale group holding the labels, e.g. `drivers.alerts` (label = `<group>.<code>`). */
  group: string;
  /** AntD preset colour per known code; other codes are neutral. */
  colors?: Readonly<Record<string, string>>;
  /** Render nothing (instead of a dash) when there are no alerts. */
  hideEmpty?: boolean;
}

/** Alert codes as translated, coloured tags (unknown codes get the generic "needs attention"). */
export function AlertTags({ alerts, group, colors = {}, hideEmpty = false }: AlertTagsProps) {
  const dynamicT = useDynamicT();
  const list = alerts ?? [];
  if (list.length === 0) return hideEmpty ? null : <span className="rm-empty-value">—</span>;
  return (
    <Flex gap={4} wrap className="rm-alert-badges">
      {list.map((code) => (
        <Tag key={code} color={colors[code]} icon={<WarningOutlined />} data-alert={code}>
          {dynamicT(`${group}.${code}`, 'vehicles.alerts.unknown')}
        </Tag>
      ))}
    </Flex>
  );
}
