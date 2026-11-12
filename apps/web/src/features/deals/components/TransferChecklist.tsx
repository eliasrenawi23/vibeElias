import { CheckCircleOutlined } from '@ant-design/icons';
import { TransferChecklistSchema, type TransferChecklistKey } from '@renawi/shared';
import { useMutation } from '@tanstack/react-query';
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Col,
  Descriptions,
  Divider,
  Flex,
  Progress,
  Row,
  Typography,
} from 'antd';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormErrors } from '../../../shared/form/useFormErrors';
import { useZodForm } from '../../../shared/form/useZodForm';
import { isolateLtr } from '../../../shared/lib/bidi';
import { useErrorMessage } from '../../../shared/lib/i18n';
import { DateText } from '../../../shared/ui/DateText';
import { FormDateField } from '../../../shared/ui/FormDateField';
import { FormLayout } from '../../../shared/ui/FormLayout';
import { FormMoneyField } from '../../../shared/ui/FormMoneyField';
import { FormTextAreaField } from '../../../shared/ui/FormTextAreaField';
import { Money } from '../../../shared/ui/Money';
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
            {
              key: 'filedAt',
              label: t('checklist.transfer.filedAt'),
              children: <DateText value={deal.transferChecklist?.filedAt ?? null} />,
            },
            {
              key: 'fee',
              label: t('checklist.transfer.transferFee'),
              children: (
                <span data-testid="transfer-fee-value">
                  <Money amount={deal.transferChecklist?.transferFee ?? null} />
                </span>
              ),
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
        <Divider className="rm-divider-tight" />
        <TransferDetailsForm deal={deal} onSaved={onSaved} />
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

/** Fee, filing date and notes of the transfer (stored in the deal's transfer checklist JSON). */
export const TransferDetailsSchema = TransferChecklistSchema.pick({
  transferFee: true,
  filedAt: true,
  notes: true,
});

function detailValues(deal: DealDetail) {
  const c = deal.transferChecklist;
  return { transferFee: c?.transferFee ?? null, filedAt: c?.filedAt ?? null, notes: c?.notes ?? '' };
}

/**
 * Transfer details saved together with one button (unlike the ticks, which save at once). Only
 * these three fields are sent; the API merges them into the stored checklist.
 */
function TransferDetailsForm({ deal, onSaved }: TransferChecklistProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const form = useZodForm(TransferDetailsSchema, { defaultValues: detailValues(deal) });
  const { reset, formState } = form;
  useEffect(() => {
    reset(detailValues(deal));
  }, [deal, reset]);
  const { formError, handleError } = useFormErrors(form.setError, {
    fields: ['transferFee', 'filedAt', 'notes'],
  });
  const mutation = useMutation({
    mutationFn: (body: DealTransferBody) => updateDealTransfer(deal.id, body),
  });
  const submit = form.handleSubmit(async (v) => {
    try {
      const updated = await mutation.mutateAsync({
        checklist: { transferFee: v.transferFee, filedAt: v.filedAt, notes: v.notes },
      });
      onSaved(updated);
      void message.success(t('deals.transfer.detailsSaved'));
    } catch (error) {
      handleError(error);
    }
  });

  return (
    <FormLayout onSubmit={submit} aria-label={t('deals.transfer.details')}>
      <Flex vertical gap={8} data-testid="transfer-details">
        <Typography.Text strong>{t('deals.transfer.details')}</Typography.Text>
        {formError && <Alert type="error" showIcon title={formError} />}
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <FormMoneyField
              control={form.control}
              name="transferFee"
              label={t('checklist.transfer.transferFee')}
              help={t('deals.transfer.feeHelp')}
              min={0}
            />
          </Col>
          <Col xs={24} sm={12}>
            <FormDateField
              control={form.control}
              name="filedAt"
              label={t('checklist.transfer.filedAt')}
            />
          </Col>
          <Col xs={24}>
            <FormTextAreaField
              control={form.control}
              name="notes"
              label={t('checklist.transfer.notes')}
              maxLength={2000}
            />
          </Col>
        </Row>
        <Flex justify="flex-end" gap={8}>
          <Button
            onClick={() => reset(detailValues(deal))}
            disabled={!formState.isDirty || mutation.isPending}
          >
            {t('actions.reset')}
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            loading={mutation.isPending}
            disabled={!formState.isDirty}
            data-testid="transfer-details-save"
          >
            {t('deals.transfer.saveDetails')}
          </Button>
        </Flex>
      </Flex>
    </FormLayout>
  );
}
