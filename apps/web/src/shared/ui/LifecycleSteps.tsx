import type { EnumValue } from '@renawi/shared';
import { Grid, Steps } from 'antd';
import { useTranslation } from 'react-i18next';
import { useEnumLabel } from '../lib/enums';
import {
  LIFECYCLES,
  lifecycleSteps,
  type LifecycleDef,
  type LifecycleName,
  type LifecycleStatus,
} from '../lib/lifecycles';

export interface LifecycleStepsProps<L extends LifecycleName> {
  lifecycle: L;
  status: LifecycleStatus<L>;
  /** Off-path statuses: the step it was reached from, when the page knows it. */
  reached?: LifecycleStatus<L>;
  /** Titles under the icons (narrow containers such as a drawer); phones are vertical anyway. */
  labelsBelow?: boolean;
  'data-testid'?: string;
}

/**
 * Where a record stands in its lifecycle: done / current / waiting steps on AntD `Steps`
 * (`size="small"`), a terminal off-path status (terminated, cancelled) as an error step that
 * replaces the remaining ones. The current step pulses softly (not under reduced motion) and is
 * marked `aria-current="step"`. Vertical below `md`.
 */
export function LifecycleSteps<L extends LifecycleName>({
  lifecycle,
  status,
  reached,
  labelsBelow = false,
  'data-testid': testId,
}: LifecycleStepsProps<L>) {
  const { t } = useTranslation();
  const enumLabel = useEnumLabel();
  const screens = Grid.useBreakpoint();
  // `screens` is empty until the first measurement; treat that as desktop.
  const narrow = screens.md === false;
  const def = LIFECYCLES[lifecycle] as LifecycleDef<string>;
  const steps = lifecycleSteps(def, status as string, reached as string | undefined);
  const label = t(`lifecycle.${lifecycle}`);

  return (
    <div
      role="group"
      aria-label={label}
      className={narrow ? 'rm-lifecycle rm-lifecycle-vertical' : 'rm-lifecycle'}
      data-testid={testId ?? `lifecycle-${lifecycle}`}
      data-status={String(status)}
    >
      <Steps
        size="small"
        orientation={narrow ? 'vertical' : 'horizontal'}
        titlePlacement={labelsBelow && !narrow ? 'vertical' : 'horizontal'}
        current={Math.max(
          0,
          steps.findIndex((s) => s.current),
        )}
        items={steps.map((step) => ({
          key: step.status,
          status: step.state,
          className: [
            'rm-lifecycle-step',
            step.current ? 'rm-lifecycle-current' : undefined,
            step.current && step.state === 'process' ? 'rm-lifecycle-pulse' : undefined,
          ]
            .filter(Boolean)
            .join(' '),
          title: (
            <span
              data-lifecycle-step={step.status}
              data-lifecycle-state={step.state}
              aria-current={step.current ? 'step' : undefined}
            >
              {enumLabel(def.enumName, step.status as EnumValue<typeof def.enumName>)}
              {step.current && (
                <span className="rm-visually-hidden"> ({t('lifecycle.current')})</span>
              )}
            </span>
          ),
        }))}
      />
    </div>
  );
}
