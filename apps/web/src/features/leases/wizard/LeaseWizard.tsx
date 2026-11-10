import { useMutation } from '@tanstack/react-query';
import { Alert, Button, Card, Flex, Steps } from 'antd';
import { useState, type ReactNode } from 'react';
import type { FieldPath } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useFormErrors } from '../../../shared/form/useFormErrors';
import { useZodForm } from '../../../shared/form/useZodForm';
import { useUnsavedChangesGuard } from '../../../shared/form/useUnsavedChangesGuard';
import { FormLayout } from '../../../shared/ui/FormLayout';
import { createLease, updateChecklists, type LeaseCreateBody } from '../api';
import type { LeaseDetail } from '../types';
import {
  defaultWizardValues,
  firstInvalidStep,
  LEASE_WIZARD_STEPS,
  LeaseWizardSchema,
  STEP_FIELDS,
  toLeaseCreateBody,
  validateLeaseStep,
  type LeaseWizardInput,
  type LeaseWizardStep,
} from './leaseWizardSchema';
import {
  DepositStep,
  DriverStep,
  LicenseStep,
  ReviewStep,
  TermsStep,
  VehicleStep,
  type StepProps,
  type WizardPicks,
} from './steps';

const STEP_COMPONENTS: Record<LeaseWizardStep, (props: StepProps) => ReactNode> = {
  driver: DriverStep,
  license: LicenseStep,
  vehicle: VehicleStep,
  terms: TermsStep,
  deposit: DepositStep,
  review: ReviewStep,
};

/** Which step owns an API error path (`taxiLicenseId` -> licence...). */
function stepOfPath(path: string): LeaseWizardStep {
  const top = path.split('.')[0] ?? path;
  return (
    LEASE_WIZARD_STEPS.find((s) => (STEP_FIELDS[s] as readonly string[]).includes(top)) ?? 'review'
  );
}

export interface LeaseWizardProps {
  /** Preselected driver (`/leases/new?driverId=`). */
  initialDriverId?: string | null;
  /** The DRAFT was created. */
  onCreated: (lease: LeaseDetail) => void;
  onCancel: () => void;
}

/**
 * New lease in steps: driver -> licence -> car -> terms -> deposit & handover -> review.
 * Each "next" validates only the current step; "create" posts the DRAFT with its first segment.
 */
export function LeaseWizard({ initialDriverId, onCreated, onCancel }: LeaseWizardProps) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [picks, setPicks] = useState<WizardPicks>({});
  const form = useZodForm(LeaseWizardSchema, {
    defaultValues: defaultWizardValues(initialDriverId),
  });
  const { formError, handleError, clearFormError } = useFormErrors(form.setError);
  const step = LEASE_WIZARD_STEPS[index] ?? 'driver';
  const last = index === LEASE_WIZARD_STEPS.length - 1;

  const mutation = useMutation({
    mutationFn: async (body: LeaseCreateBody) => {
      const created = await createLease(body);
      // The handover checklist travels with the draft; save it separately if it was not kept.
      if (body.handoverChecklist && !created.handoverChecklist) {
        return updateChecklists(created.id, { handoverChecklist: body.handoverChecklist });
      }
      return created;
    },
    onSuccess: onCreated,
  });

  const showIssues = (s: LeaseWizardStep) => {
    const issues = validateLeaseStep(s, form.getValues());
    form.clearErrors(STEP_FIELDS[s] as FieldPath<LeaseWizardInput>[]);
    for (const issue of issues) {
      form.setError(issue.path as FieldPath<LeaseWizardInput>, {
        type: 'step',
        message: issue.message,
      });
    }
    return issues.length === 0;
  };

  const next = () => {
    if (showIssues(step)) setIndex((i) => Math.min(i + 1, LEASE_WIZARD_STEPS.length - 1));
  };
  const back = () => setIndex((i) => Math.max(i - 1, 0));
  const goTo = (target: number) => {
    // Going back is always allowed; going forward validates every step in between.
    if (target <= index) return setIndex(target);
    for (let i = index; i < target; i++) {
      const s = LEASE_WIZARD_STEPS[i];
      if (s && !showIssues(s)) return setIndex(i);
    }
    setIndex(target);
  };

  const guard = useUnsavedChangesGuard(form.formState.isDirty);
  const submit = form.handleSubmit(
    async (values) => {
      clearFormError();
      try {
        await guard.submit(() => mutation.mutateAsync(toLeaseCreateBody(values)));
      } catch (error) {
        handleError(error);
        // Jump to the step showing the first field error, if any.
        const errors = form.formState.errors as Record<string, unknown>;
        const firstPath = Object.keys(errors)[0];
        if (firstPath) setIndex(LEASE_WIZARD_STEPS.indexOf(stepOfPath(firstPath)));
      }
    },
    () => {
      const bad = firstInvalidStep(form.getValues());
      if (bad) {
        setIndex(LEASE_WIZARD_STEPS.indexOf(bad));
        showIssues(bad);
      }
    },
  );

  const Step = STEP_COMPONENTS[step];
  const onPick = (p: Partial<WizardPicks>) => setPicks((prev) => ({ ...prev, ...p }));

  return (
    <Flex vertical gap={16} data-testid="lease-wizard">
      <Steps
        current={index}
        onChange={goTo}
        size="small"
        responsive
        items={LEASE_WIZARD_STEPS.map((s) => ({ key: s, title: t(`leases.wizard.steps.${s}`) }))}
        data-testid="lease-wizard-steps"
      />
      {formError && <Alert type="error" showIcon title={formError} />}
      <Card variant="borderless" title={t(`leases.wizard.steps.${step}`)} data-step={step}>
        <FormLayout
          aria-label={t(`leases.wizard.steps.${step}`)}
          onSubmit={(e) => {
            e.preventDefault();
            if (last) void submit();
            else next();
          }}
        >
          <Step form={form} picks={picks} onPick={onPick} />
          {/* Enter in an input moves to the next step. */}
          <button type="submit" tabIndex={-1} aria-hidden className="rm-visually-hidden" />
        </FormLayout>
        {guard.prompt}
      </Card>
      <Flex gap={8} justify="space-between" className="rm-form-actions">
        <Button onClick={() => guard.confirmDiscard(onCancel)} disabled={mutation.isPending}>
          {t('actions.cancel')}
        </Button>
        <Flex gap={8}>
          {index > 0 && (
            <Button onClick={back} disabled={mutation.isPending} data-testid="wizard-back">
              {t('actions.back')}
            </Button>
          )}
          {last ? (
            <Button
              type="primary"
              loading={mutation.isPending}
              onClick={() => void submit()}
              data-testid="wizard-create"
            >
              {t('leases.wizard.createDraft')}
            </Button>
          ) : (
            <Button type="primary" onClick={next} data-testid="wizard-next">
              {t('actions.next')}
            </Button>
          )}
        </Flex>
      </Flex>
    </Flex>
  );
}
