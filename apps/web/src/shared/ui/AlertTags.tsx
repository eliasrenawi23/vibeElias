import { WarningOutlined } from '@ant-design/icons';
import { Flex } from 'antd';
import { useDynamicT } from '../lib/i18n';
import { hasTone, toneOf, type AlertEnumName } from '../lib/statusTones';
import { ToneTag } from './ToneTag';

/** Locale group holding the labels of each alert enum (label = `<group>.<code>`). */
const ALERT_LABEL_GROUPS: Readonly<Record<AlertEnumName, string>> = {
  VehicleAlert: 'vehicles.alerts',
  TaxiLicenseAlert: 'taxiLicenses.alerts',
  DriverAlert: 'drivers.alerts',
  LeaseAlert: 'leases.alerts',
  FineAlert: 'fines.alerts',
  DealAlert: 'deals.alerts',
};

export interface AlertTagsProps {
  /** Which alert enum the codes belong to (`VehicleAlert`, `LeaseAlert`...). */
  enumName: AlertEnumName;
  /** Alert codes computed by the API (`alerts` on list items and details). */
  alerts: readonly string[] | null | undefined;
  /** Render nothing (instead of a dash) when there are no alerts. */
  hideEmpty?: boolean;
}

/**
 * Alert codes as translated tags with a warning icon, in the tone the registry gives each code.
 * Codes this build does not know (a newer API) get the generic "needs attention" in neutral.
 */
export function AlertTags({ enumName, alerts, hideEmpty = false }: AlertTagsProps) {
  const dynamicT = useDynamicT();
  const list = alerts ?? [];
  if (list.length === 0) return hideEmpty ? null : <span className="rm-empty-value">—</span>;
  const group = ALERT_LABEL_GROUPS[enumName];
  return (
    <Flex gap={4} wrap className="rm-alert-badges">
      {list.map((code) =>
        hasTone(enumName, code) ? (
          <ToneTag
            key={code}
            tone={toneOf(enumName, code)}
            icon={<WarningOutlined />}
            data-alert={code}
          >
            {dynamicT(`${group}.${code}`, 'vehicles.alerts.unknown')}
          </ToneTag>
        ) : (
          <ToneTag key={code} tone="neutral" icon={<WarningOutlined />} title={code} data-alert={code}>
            {dynamicT('vehicles.alerts.unknown')}
          </ToneTag>
        ),
      )}
    </Flex>
  );
}
