import { CheckCircleFilled, CloseCircleOutlined } from '@ant-design/icons';
import {
  HANDOVER_CHECKLIST_KEYS,
  RETURN_CHECKLIST_KEYS,
  type HandoverChecklist,
  type ReturnChecklist,
} from '@renawi/shared';
import { Descriptions, Flex, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { AutoDir } from '../../../shared/lib/bidi';
import { useEnumLabel } from '../../../shared/lib/enums';
import { DateText } from '../../../shared/ui/DateText';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { KmText } from '../../../shared/ui/KmText';
import { DESCRIPTION_COLUMNS_NARROW } from '../../../shared/ui/descriptionColumns';

export interface ChecklistViewProps {
  checklist: HandoverChecklist | ReturnChecklist | null | undefined;
  kind: 'handover' | 'return';
}

/** Read-only checklist: date, odometer, fuel, ticked / missing items, damages and notes. */
export function ChecklistView({ checklist, kind }: ChecklistViewProps) {
  const { t } = useTranslation();
  const enumLabel = useEnumLabel();
  if (!checklist) return <EmptyState compact description={t('leases.checklists.empty')} />;
  const keys = kind === 'handover' ? HANDOVER_CHECKLIST_KEYS : RETURN_CHECKLIST_KEYS;
  const values = checklist as Record<string, unknown>;
  const empty = <span className="rm-empty-value">—</span>;
  return (
    <Flex vertical gap={8} data-testid={`checklist-view-${kind}`}>
      <Descriptions
        size="small"
        column={DESCRIPTION_COLUMNS_NARROW}
        items={[
          {
            key: 'date',
            label: t('checklist.condition.date'),
            children: <DateText value={checklist.date} />,
          },
          {
            key: 'km',
            label: t('checklist.condition.km'),
            children: <KmText value={checklist.km} />,
          },
          {
            key: 'fuel',
            label: t('checklist.condition.fuelLevel'),
            children: checklist.fuelLevel ? enumLabel('FuelLevel', checklist.fuelLevel) : empty,
          },
        ]}
      />
      <Flex gap={12} wrap>
        {keys.map((key) => {
          const on = values[key] === true;
          return (
            <span
              key={key}
              className={on ? 'rm-check-on' : 'rm-check-off'}
              data-check={key}
              data-value={on}
            >
              {on ? <CheckCircleFilled /> : <CloseCircleOutlined />}{' '}
              {t(`checklist.condition.${key}`)}
            </span>
          );
        })}
      </Flex>
      {checklist.damages && (
        <Typography.Paragraph className="rm-pre-wrap" dir="auto">
          <Typography.Text type="secondary">{t('checklist.condition.damages')}: </Typography.Text>
          <AutoDir>{checklist.damages}</AutoDir>
        </Typography.Paragraph>
      )}
      {checklist.notes && (
        <Typography.Paragraph className="rm-pre-wrap" dir="auto">
          <Typography.Text type="secondary">{t('checklist.condition.notes')}: </Typography.Text>
          <AutoDir>{checklist.notes}</AutoDir>
        </Typography.Paragraph>
      )}
    </Flex>
  );
}
