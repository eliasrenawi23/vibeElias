import { CheckCircleOutlined } from '@ant-design/icons';
import type { TransferChecklistKey } from '@renawi/shared';
import { useMutation } from '@tanstack/react-query';
import { Alert, App, Button, Card, Checkbox, Descriptions, Flex, Progress, Typography } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isolateLtr } from '../../../shared/lib/bidi';
import { useErrorMessage } from '../../../shared/lib/i18n';
import { DateText } from '../../../shared/ui/DateText';
import { StatusTag } from '../../../shared/ui/StatusTag';
import { updateDealTransfer } from '../api';
import { TransferDoneDialog } from '../dialogs/DealDialogs';
import { transferProgress } from '../lib/dealRules';
import type { DealDetail, DealTransferBody, TransferChecklistValue } from '../types';
import { TransferCell } from './DealBits';
import { DESCRIPTION_COLUMNS } from '../../../shared/ui/descriptionColumns';

export interface TransferChecklistProps {
  deal: DealDetail;
  /** Every change answers with the full deal. */
  onSaved: (deal: DealDetail) => void;
}

/**
 * Ownership transfer of a completed sale: the checklist (each tick is saved at once), its roll-up,
 * the 6-working-day due date with an overdue badge, and "mark transferred".
 */
export function TransferChecklist({ deal, onSaved }: TransferChecklistProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const errorMessage = useErrorMessage();
  const [marking, setMarking] = useState(false);
  // Ticks show at once; they are reverted if saving fails.
  const [pending, setPending] = useState<TransferChecklistValue>({});
  const checklist: TransferChecklistValue = { ...deal.transferChecklist, ...pending };
  const progress = transferProgress(checklist);
  const done = deal.transferStatus === 'DONE';
  const percent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  const mutation = useMutation({
    mutationFn: (body: DealTransferBody) => updateDealTransfer(deal.id, body),
    onSuccess: (updated) => onSaved(updated),
    onError: (error) => void message.error(errorMessage(error)),
    onSettled: () => setPending({}),
  });
  const toggle = (key: TransferChecklistKey, on: boolean) => {
    setPending((prev) => ({ ...prev, [key]: on }));
    mutation.mutate({ checklist: { [key]: on } });
  };

  return (
    <Card
      variant="borderless"
      title={t('checklist.transferTitle')}
      data-testid="transfer-checklist"
      data-done={progress.done}
      data-total={progress.total}
      extra={
        !done && (
          <Button
            type={progress.complete ? 'primary' : 'default'}
            icon={<CheckCircleOutlined />}
            onClick={() => setMarking(true)}
            data-testid="transfer-mark-done"
          >
            {t('deals.transfer.markDone')}
          </Button>
        )
      }
    >
      <Flex vertical gap={12}>
        <Descriptions
          size="small"
          column={DESCRIPTION_COLUMNS}
          items={[
            {
              key: 'status',
              label: t('deals.fields.transferStatus'),
              children: <StatusTag enumName="TransferStatus" value={deal.transferStatus} />,
            },
            {
              key: 'due',
              label: t('deals.fields.transferDueAt'),
              children: deal.transferDueAt ? (
                done ? (
                  <DateText value={deal.transferDueAt} />
                ) : (
                  <TransferCell status={deal.transferStatus} dueAt={deal.transferDueAt} badgeOnly />
                )
              ) : (
                <span className="rm-empty-value">—</span>
              ),
            },
            {
              key: 'transferred',
              label: t('deals.fields.transferredAt'),
              children: <DateText value={deal.transferredAt} />,
            },
          ]}
        />
        {!done && <Typography.Text type="secondary">{t('deals.transfer.dueHint')}</Typography.Text>}
        <Flex gap={12} align="center" data-testid="transfer-progress">
          <Progress
            percent={percent}
            showInfo={false}
            size="small"
            status={progress.complete ? 'success' : 'normal'}
            className="rm-grow"
          />
          <Typography.Text data-testid="transfer-progress-text">
            {t('deals.transfer.progress', {
              done: isolateLtr(String(progress.done)),
              total: isolateLtr(String(progress.total)),
            })}
          </Typography.Text>
        </Flex>
        <Flex vertical gap={6} role="group" aria-label={t('checklist.transferTitle')}>
          {progress.keys.map((key) => {
            const on = checklist[key] === true;
            return (
              <Checkbox
                key={key}
                checked={on}
                disabled={mutation.isPending}
                onChange={(e) => toggle(key, e.target.checked)}
                data-check={key}
                data-value={on}
                className={on ? 'rm-check-on' : undefined}
              >
                {t(`checklist.transfer.${key}`)}
              </Checkbox>
            );
          })}
        </Flex>
        {done && (
          <Alert
            type="success"
            showIcon
            title={t('deals.transfer.doneNotice')}
            data-testid="transfer-done"
          />
        )}
      </Flex>
      {marking && (
        <TransferDoneDialog
          deal={deal}
          onClose={() => setMarking(false)}
          onSaved={(updated) => {
            setMarking(false);
            onSaved(updated);
            void message.success(t('deals.transfer.transferred'));
          }}
        />
      )}
    </Card>
  );
}
