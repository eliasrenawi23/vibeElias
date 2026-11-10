import {
  Direction,
  idString,
  isoDate,
  nonNegativeMoney,
  optionalIsoDate,
  optionalText,
  PaymentMethod,
  positiveMoney,
  todayInBusinessTz,
} from '@renawi/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Col, Row, Typography } from 'antd';
import { useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useFormErrors } from '../../../shared/form/useFormErrors';
import { useZodForm } from '../../../shared/form/useZodForm';
import { businessDateToInstant, instantToBusinessDate } from '../../../shared/lib/dates';
import { useEnumOptions } from '../../../shared/lib/enums';
import { DateText } from '../../../shared/ui/DateText';
import { FormCheckboxField } from '../../../shared/ui/FormCheckboxField';
import { FormDateField } from '../../../shared/ui/FormDateField';
import { FormDialog } from '../../../shared/ui/FormDialog';
import { FormMoneyField } from '../../../shared/ui/FormMoneyField';
import { FormRadioField } from '../../../shared/ui/FormRadioField';
import { FormSelect } from '../../../shared/ui/FormSelect';
import { FormTextAreaField } from '../../../shared/ui/FormTextAreaField';
import { FormTextField } from '../../../shared/ui/FormTextField';
import { Money } from '../../../shared/ui/Money';
import { FormContactField } from '../../contacts/components/FormContactField';
import { fetchVehicle } from '../../vehicles/api';
import { vehicleKeys } from '../../vehicles/queryKeys';
import {
  addDealPayment,
  cancelDeal,
  completeDeal,
  recordDisclosure,
  updateDeal,
  updateDealTransfer,
} from '../api';
import { ListGapText } from '../components/DealBits';
import {
  completionBlockers,
  counterpartyLabelKey,
  defaultPaymentDirection,
  isOpenDeal,
  suggestedPaymentAmount,
  transferDueDate,
} from '../lib/dealRules';
import type { DealDetail, DealPaymentBody, DealUpdateBody } from '../types';

interface DealDialogProps {
  deal: DealDetail;
  onClose: () => void;
  /** The action endpoints answer with the full deal. */
  onSaved: (deal: DealDetail) => void;
}

const nullableText = (max: number) => optionalText(max).transform((v) => v ?? null);

/* ---- Edit ---------------------------------------------------------------------------------- */

const DealEditSchema = z.object({
  date: isoDate,
  price: z.preprocess((v) => (v === null ? undefined : v), positiveMoney),
  listPrice: nonNegativeMoney.nullish().transform((v) => v ?? null),
  counterpartyId: z.preprocess((v) => (v === null || v === '' ? undefined : v), idString),
  vatMode: z.enum(['NONE', 'MARGIN', 'FULL']),
  sellerIsVatBusiness: z.boolean(),
  warrantyText: nullableText(5000),
  notes: nullableText(5000),
});
type DealEditOutput = z.output<typeof DealEditSchema>;

/**
 * PATCH body: a draft / pending deal sends its terms (VAT mode for sales, the seller's VAT
 * status for purchases); a completed deal only the warranty and notes.
 */
export function toDealUpdateBody(deal: DealDetail, v: DealEditOutput): DealUpdateBody {
  const sale = deal.type !== 'PURCHASE';
  const texts: DealUpdateBody = {
    ...(sale ? { warrantyText: v.warrantyText } : {}),
    notes: v.notes,
  };
  if (!isOpenDeal(deal.status)) return texts;
  return {
    date: v.date,
    price: v.price,
    listPrice: v.listPrice,
    counterpartyId: v.counterpartyId,
    ...(deal.type === 'SALE' ? { vatMode: v.vatMode } : {}),
    ...(deal.type === 'PURCHASE' ? { sellerIsVatBusiness: v.sellerIsVatBusiness } : {}),
    ...texts,
  };
}

/** Edit the deal: its terms while draft / pending, the warranty and notes once completed. */
export function DealEditDialog({ deal, onClose, onSaved }: DealDialogProps) {
  const { t } = useTranslation();
  const open = isOpenDeal(deal.status);
  const sale = deal.type !== 'PURCHASE';
  const form = useZodForm(DealEditSchema, {
    defaultValues: {
      date: deal.date,
      price: deal.price,
      listPrice: deal.listPrice,
      counterpartyId: deal.counterpartyId,
      vatMode: deal.vatMode,
      sellerIsVatBusiness: deal.sellerIsVatBusiness,
      warrantyText: deal.warrantyText ?? '',
      notes: deal.notes ?? '',
    },
  });
  const [price, listPrice] = useWatch({ control: form.control, name: ['price', 'listPrice'] });
  const { formError, handleError } = useFormErrors(form.setError, {
    fields: ['date', 'price', 'listPrice', 'counterpartyId', 'vatMode', 'warrantyText', 'notes'],
  });
  const mutation = useMutation({
    mutationFn: (body: DealUpdateBody) => updateDeal(deal.id, body),
    onSuccess: onSaved,
  });
  const submit = form.handleSubmit(async (v) => {
    try {
      await mutation.mutateAsync(toDealUpdateBody(deal, v));
    } catch (error) {
      handleError(error);
    }
  });

  return (
    <FormDialog
      open
      dirty={form.formState.isDirty}
      title={t('deals.edit.title')}
      onSubmit={submit}
      onCancel={onClose}
      submitting={mutation.isPending}
      error={formError}
      width={720}
    >
      {!open && (
        <Alert
          type="info"
          showIcon
          className="rm-dialog-note"
          title={t('deals.edit.completedHint')}
        />
      )}
      <Row gutter={12}>
        {open && (
          <>
            <Col xs={24} md={12}>
              <FormContactField
                control={form.control}
                name="counterpartyId"
                label={t(counterpartyLabelKey(deal.type))}
                required
                tag={deal.type === 'PURCHASE' ? 'SELLER' : 'BUYER'}
              />
            </Col>
            <Col xs={24} sm={12} md={12}>
              <FormDateField
                control={form.control}
                name="date"
                label={t('deals.fields.date')}
                required
                allowClear={false}
              />
            </Col>
            <Col xs={24} sm={12}>
              <FormMoneyField
                control={form.control}
                name="price"
                label={t('deals.fields.price')}
                required
                min={0}
              />
            </Col>
            <Col xs={24} sm={12}>
              <FormMoneyField
                control={form.control}
                name="listPrice"
                label={t('deals.fields.listPrice')}
                min={0}
                help={
                  typeof price === 'number' && listPrice ? (
                    <ListGapText price={price} listPrice={listPrice} />
                  ) : undefined
                }
              />
            </Col>
            {deal.type === 'SALE' && (
              <Col xs={24}>
                <FormRadioField
                  control={form.control}
                  name="vatMode"
                  label={t('deals.fields.vatMode')}
                  optionType="button"
                  options={[
                    { value: 'MARGIN', label: t('enums.VatMode.MARGIN') },
                    { value: 'FULL', label: t('enums.VatMode.FULL') },
                  ]}
                />
              </Col>
            )}
            {deal.type === 'PURCHASE' && (
              <Col xs={24}>
                <FormCheckboxField
                  control={form.control}
                  name="sellerIsVatBusiness"
                  label={t('deals.fields.sellerIsVatBusiness')}
                  help={t('deals.form.sellerVatHint')}
                />
              </Col>
            )}
          </>
        )}
        {sale && (
          <Col xs={24} md={12}>
            <FormTextAreaField
              control={form.control}
              name="warrantyText"
              label={t('deals.fields.warrantyText')}
              minRows={3}
              maxLength={5000}
            />
          </Col>
        )}
        <Col xs={24} md={sale ? 12 : 24}>
          <FormTextAreaField
            control={form.control}
            name="notes"
            label={t('common.notes')}
            minRows={3}
            maxLength={5000}
          />
        </Col>
      </Row>
    </FormDialog>
  );
}

/* ---- Disclosure ---------------------------------------------------------------------------- */

const DisclosureSchema = z.object({ signedDate: isoDate });

/** The buyer countersigned the disclosure form (required before a sale is completed). */
export function DisclosureDialog({ deal, onClose, onSaved }: DealDialogProps) {
  const { t } = useTranslation();
  const form = useZodForm(DisclosureSchema, {
    defaultValues: {
      signedDate: deal.disclosureSignedAt
        ? instantToBusinessDate(deal.disclosureSignedAt)
        : todayInBusinessTz(),
    },
  });
  const { formError, handleError } = useFormErrors(form.setError, { fields: ['signedDate'] });
  const mutation = useMutation({
    mutationFn: (signedAt: string) => recordDisclosure(deal.id, { signedAt }),
    onSuccess: onSaved,
  });
  const submit = form.handleSubmit(async (v) => {
    try {
      await mutation.mutateAsync(businessDateToInstant(v.signedDate));
    } catch (error) {
      handleError(error);
    }
  });
  return (
    <FormDialog
      open
      dirty={form.formState.isDirty}
      title={t('deals.disclosure.title')}
      onSubmit={submit}
      onCancel={onClose}
      submitting={mutation.isPending}
      error={formError}
      okText={t('deals.disclosure.confirm')}
    >
      <Typography.Paragraph>{t('deals.disclosure.intro')}</Typography.Paragraph>
      <FormDateField
        control={form.control}
        name="signedDate"
        label={t('deals.disclosure.signedAt')}
        required
        allowClear={false}
      />
      <Alert
        type="info"
        showIcon
        title={t('deals.disclosure.uploadHint')}
        data-testid="disclosure-upload-hint"
      />
    </FormDialog>
  );
}

/* ---- Complete ------------------------------------------------------------------------------ */

const CompleteSchema = z.object({ date: optionalIsoDate });

/** Confirm completion: lists what still blocks it; an optional completion date. */
export function CompleteDialog({ deal, onClose, onSaved }: DealDialogProps) {
  const { t } = useTranslation();
  // The deal carries the car status; older payloads without it fall back to the vehicle file.
  const knownStatus = deal.vehicle?.status;
  const vehicle = useQuery({
    queryKey: vehicleKeys.detail(deal.vehicleId),
    queryFn: ({ signal }) => fetchVehicle(deal.vehicleId, signal),
    enabled: deal.type !== 'PURCHASE' && !knownStatus,
    staleTime: 30_000,
  });
  const blockers = completionBlockers(deal, knownStatus ?? vehicle.data?.status);
  // The API completes on the deal date by default.
  const form = useZodForm(CompleteSchema, { defaultValues: { date: deal.date } });
  const date = useWatch({ control: form.control, name: 'date' });
  const { formError, handleError } = useFormErrors(form.setError, { fields: ['date'] });
  const mutation = useMutation({
    mutationFn: (body: { date?: string }) => completeDeal(deal.id, body),
    onSuccess: onSaved,
  });
  const submit = form.handleSubmit(async (v) => {
    try {
      await mutation.mutateAsync(v.date ? { date: v.date } : {});
    } catch (error) {
      handleError(error);
    }
  });
  const sale = deal.type !== 'PURCHASE';
  return (
    <FormDialog
      open
      dirty={form.formState.isDirty}
      title={t('deals.complete.title')}
      onSubmit={submit}
      onCancel={onClose}
      submitting={mutation.isPending}
      error={formError}
      okText={t('deals.complete.confirm')}
      okDisabled={blockers.length > 0}
    >
      <Typography.Paragraph>
        {sale ? t('deals.complete.saleIntro') : t('deals.complete.purchaseIntro')}
      </Typography.Paragraph>
      {blockers.length > 0 && (
        <Alert
          type="warning"
          showIcon
          className="rm-dialog-note"
          data-testid="complete-blockers"
          title={t('deals.complete.blockersTitle')}
          description={
            <ul className="rm-plain-list">
              {blockers.map((b) => (
                <li key={b} data-blocker={b}>
                  {t(`deals.complete.blockers.${b}`)}
                </li>
              ))}
            </ul>
          }
        />
      )}
      <FormDateField control={form.control} name="date" label={t('deals.complete.date')} />
      {sale && date && (
        <Typography.Text type="secondary" data-testid="complete-transfer-due">
          {t('deals.complete.transferDue')} <DateText value={transferDueDate(date)} />
        </Typography.Text>
      )}
    </FormDialog>
  );
}

/* ---- Cancel -------------------------------------------------------------------------------- */

const CancelSchema = z.object({ reason: nullableText(1000) });

/** Cancel a draft / pending deal with an optional reason. */
export function CancelDealDialog({ deal, onClose, onSaved }: DealDialogProps) {
  const { t } = useTranslation();
  const form = useZodForm(CancelSchema, { defaultValues: { reason: '' } });
  const { formError, handleError } = useFormErrors(form.setError, { fields: ['reason'] });
  const mutation = useMutation({
    mutationFn: (body: { reason?: string }) => cancelDeal(deal.id, body),
    onSuccess: onSaved,
  });
  const submit = form.handleSubmit(async (v) => {
    try {
      await mutation.mutateAsync(v.reason ? { reason: v.reason } : {});
    } catch (error) {
      handleError(error);
    }
  });
  return (
    <FormDialog
      open
      dirty={form.formState.isDirty}
      title={t('deals.cancel.title')}
      onSubmit={submit}
      onCancel={onClose}
      submitting={mutation.isPending}
      error={formError}
      okText={t('deals.cancel.confirm')}
      okDanger
    >
      <Typography.Paragraph>{t('deals.cancel.intro')}</Typography.Paragraph>
      <FormTextAreaField
        control={form.control}
        name="reason"
        label={t('deals.cancel.reason')}
        maxLength={1000}
      />
    </FormDialog>
  );
}

/* ---- Payment ------------------------------------------------------------------------------- */

/** Methods a user can record (trade-in rows are created by the system, offsets by the ledger). */
export const DEAL_PAYMENT_METHODS = PaymentMethod.options.filter(
  (m) => m !== 'OFFSET' && m !== 'TRADE_IN',
);

const DealPaymentSchema = z.object({
  direction: Direction,
  amount: z.preprocess((v) => (v === null ? undefined : v), positiveMoney),
  date: isoDate,
  method: PaymentMethod,
  reference: nullableText(100),
  contactId: idString.nullish(),
  notes: nullableText(1000),
});

/** Money in from the buyer, out to the seller or the consignor. */
export function DealPaymentDialog({ deal, onClose, onSaved }: DealDialogProps) {
  const { t } = useTranslation();
  const methodOptions = useEnumOptions('PaymentMethod', DEAL_PAYMENT_METHODS);
  const initial = defaultPaymentDirection(deal);
  const form = useZodForm(DealPaymentSchema, {
    defaultValues: {
      direction: initial,
      amount: suggestedPaymentAmount(deal, initial) ?? undefined,
      date: todayInBusinessTz(),
      method: 'CASH',
      reference: '',
      contactId: null,
      notes: '',
    },
  });
  const direction = useWatch({ control: form.control, name: 'direction' });
  const { formError, handleError } = useFormErrors(form.setError, {
    fields: ['direction', 'amount', 'date', 'method', 'reference', 'contactId', 'notes'],
  });
  const mutation = useMutation({
    mutationFn: (body: DealPaymentBody) => addDealPayment(deal.id, body),
    onSuccess: onSaved,
  });
  const submit = form.handleSubmit(async (v) => {
    try {
      await mutation.mutateAsync({
        direction: v.direction,
        date: v.date,
        amount: v.amount,
        method: v.method,
        reference: v.reference,
        notes: v.notes,
        ...(v.contactId ? { contactId: v.contactId } : {}),
      });
    } catch (error) {
      handleError(error);
    }
  });
  const suggested = suggestedPaymentAmount(deal, direction);
  return (
    <FormDialog
      open
      dirty={form.formState.isDirty}
      title={t('deals.payments.addTitle')}
      onSubmit={submit}
      onCancel={onClose}
      submitting={mutation.isPending}
      error={formError}
    >
      <Row gutter={12}>
        <Col xs={24}>
          <FormRadioField
            control={form.control}
            name="direction"
            label={t('deals.payments.direction')}
            optionType="button"
            options={Direction.options.map((d) => ({
              value: d,
              label: t(`deals.payments.directions.${d}`),
            }))}
          />
        </Col>
        <Col xs={24} sm={12}>
          <FormMoneyField
            control={form.control}
            name="amount"
            label={t('ledger.fields.amount')}
            required
            min={0}
            help={
              suggested ? (
                <span data-testid="payment-still-due">
                  {t('deals.payments.stillDue')} <Money amount={suggested} />
                </span>
              ) : undefined
            }
          />
        </Col>
        <Col xs={24} sm={12}>
          <FormDateField
            control={form.control}
            name="date"
            label={t('ledger.fields.date')}
            required
            allowClear={false}
          />
        </Col>
        <Col xs={24} sm={12}>
          <FormSelect
            control={form.control}
            name="method"
            label={t('ledger.fields.method')}
            options={methodOptions}
            required
          />
        </Col>
        <Col xs={24} sm={12}>
          <FormTextField
            control={form.control}
            name="reference"
            label={t('ledger.fields.reference')}
            inputProps={{ dir: 'ltr' }}
          />
        </Col>
        <Col xs={24}>
          <FormContactField
            control={form.control}
            name="contactId"
            label={t('deals.payments.contact')}
            help={t('deals.payments.contactHelp')}
          />
        </Col>
        <Col xs={24}>
          <FormTextAreaField
            control={form.control}
            name="notes"
            label={t('common.notes')}
            maxLength={1000}
          />
        </Col>
      </Row>
    </FormDialog>
  );
}

/* ---- Transfer done ------------------------------------------------------------------------- */

const TransferDoneSchema = z.object({ transferredAt: isoDate });

/** Mark the ownership transfer as done on a date. */
export function TransferDoneDialog({ deal, onClose, onSaved }: DealDialogProps) {
  const { t } = useTranslation();
  const form = useZodForm(TransferDoneSchema, {
    defaultValues: { transferredAt: deal.transferredAt ?? todayInBusinessTz() },
  });
  const { formError, handleError } = useFormErrors(form.setError, { fields: ['transferredAt'] });
  const mutation = useMutation({
    mutationFn: (transferredAt: string) =>
      updateDealTransfer(deal.id, { transferStatus: 'DONE', transferredAt }),
    onSuccess: onSaved,
  });
  const submit = form.handleSubmit(async (v) => {
    try {
      await mutation.mutateAsync(v.transferredAt);
    } catch (error) {
      handleError(error);
    }
  });
  return (
    <FormDialog
      open
      dirty={form.formState.isDirty}
      title={t('deals.transfer.markTitle')}
      onSubmit={submit}
      onCancel={onClose}
      submitting={mutation.isPending}
      error={formError}
      okText={t('deals.transfer.markDone')}
    >
      <FormDateField
        control={form.control}
        name="transferredAt"
        label={t('deals.fields.transferredAt')}
        required
        allowClear={false}
      />
    </FormDialog>
  );
}
