import { EditOutlined } from '@ant-design/icons';
import { Button, Card, Flex, Timeline, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { AutoDir } from '../../../shared/lib/bidi';
import { useEnumLabel } from '../../../shared/lib/enums';
import { DateText } from '../../../shared/ui/DateText';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { Money } from '../../../shared/ui/Money';
import { PlateNo } from '../../../shared/ui/PlateNo';
import type { PlateChange } from '../types';

export interface PlateHistoryCardProps {
  /** Plate changes, newest first. */
  history: readonly PlateChange[];
  /** Opens the "correct conversion details" dialog; the button shows when a conversion exists. */
  onCorrect?: () => void;
}

/** The plate numbers the car has carried: date, old to new plate, reason, customs and notes. */
export function PlateHistoryCard({ history, onCorrect }: PlateHistoryCardProps) {
  const { t } = useTranslation();
  const enumLabel = useEnumLabel();
  const canCorrect = Boolean(onCorrect) && history.some((c) => c.reason === 'TAXI_TO_PRIVATE');
  return (
    <Card
      variant="borderless"
      title={t('vehicles.plateHistory.title')}
      data-testid="plate-history"
      extra={
        canCorrect && (
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={onCorrect}
            data-testid="plate-history-correct"
          >
            {t('vehicles.plateHistory.correct')}
          </Button>
        )
      }
    >
      {history.length === 0 ? (
        <EmptyState compact description={t('vehicles.plateHistory.empty')} />
      ) : (
        <Timeline
          items={history.map((c) => ({
            key: c.id,
            content: (
              <Flex vertical gap={4} data-testid="plate-change" data-change={c.id}>
                <Flex gap={8} align="center" wrap>
                  <DateText value={c.changedAt} />
                  <PlateNo value={c.oldPlateNo} />
                  <span aria-label={t('vehicles.plateHistory.arrow')} className="rm-flip-rtl">
                    →
                  </span>
                  <PlateNo value={c.newPlateNo} />
                </Flex>
                <Typography.Text type="secondary">
                  {enumLabel('PlateChangeReason', c.reason)}
                  {c.conversionTax ? (
                    <>
                      {' · '}
                      {t('vehicles.plateHistory.customs')} <Money amount={c.conversionTax} />
                    </>
                  ) : null}
                </Typography.Text>
                {c.notes && (
                  <Typography.Text type="secondary" className="rm-pre-wrap">
                    <AutoDir>{c.notes}</AutoDir>
                  </Typography.Text>
                )}
              </Flex>
            ),
          }))}
        />
      )}
    </Card>
  );
}
