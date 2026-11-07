import { WarningOutlined } from '@ant-design/icons';
import { VehicleAlert } from '@renawi/shared';
import { Flex, Tag } from 'antd';
import { useTranslation } from 'react-i18next';

/** AntD preset colour per alert code: red = blocking / expired, amber = attention. */
export const ALERT_COLORS: Readonly<Record<VehicleAlert, string>> = {
  registrationExpired: 'error',
  registrationExpiring: 'warning',
  dealerRegistration11Months: 'orange',
  taxiAge10: 'gold',
  taxiAgeNearLimit: 'warning',
  taxiAgeBlocked: 'error',
};

export interface AlertBadgesProps {
  /** Alert codes from the API (`alerts` on vehicle items). */
  alerts: readonly string[] | null | undefined;
  /** Render nothing (instead of a dash) when there are no alerts. */
  hideEmpty?: boolean;
}

/** Vehicle alert codes as translated, coloured tags; unknown codes get a generic label. */
export function AlertBadges({ alerts, hideEmpty = false }: AlertBadgesProps) {
  const { t } = useTranslation();
  const list = alerts ?? [];
  if (list.length === 0) return hideEmpty ? null : <span className="rm-empty-value">—</span>;
  return (
    <Flex gap={4} wrap className="rm-alert-badges">
      {list.map((code) => {
        const known = VehicleAlert.safeParse(code);
        return known.success ? (
          <Tag
            key={code}
            color={ALERT_COLORS[known.data]}
            icon={<WarningOutlined />}
            data-alert={code}
          >
            {t(`vehicles.alerts.${known.data}`)}
          </Tag>
        ) : (
          <Tag key={code} icon={<WarningOutlined />} title={code} data-alert={code}>
            {t('vehicles.alerts.unknown')}
          </Tag>
        );
      })}
    </Flex>
  );
}
