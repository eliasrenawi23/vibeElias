import { Flex, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import { DateText } from '../../../shared/ui/DateText';
import { annualFeeState } from '../lib/licenseRules';

/** Annual operating-licence fee due date with a "due" / "overdue" badge from the alert codes. */
export function AnnualFeeText({
  date,
  alerts,
}: {
  date: string | null;
  alerts: readonly string[];
}) {
  const { t } = useTranslation();
  const state = annualFeeState(alerts ?? []);
  return (
    <Flex gap={6} align="center" wrap data-fee-state={state ?? 'ok'}>
      <DateText value={date} />
      {state && (
        <Tag color={state === 'overdue' ? 'error' : 'warning'}>
          {state === 'overdue' ? t('expiry.overdue') : t('taxiLicenses.feeDue')}
        </Tag>
      )}
    </Flex>
  );
}
