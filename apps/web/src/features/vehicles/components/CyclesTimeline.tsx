import { Flex, Grid, Timeline, Typography } from 'antd';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Ltr } from '../../../shared/lib/bidi';
import { useEnumLabel } from '../../../shared/lib/enums';
import { TONE_DOT_COLORS, type Tone } from '../../../shared/lib/statusTones';
import { DateText } from '../../../shared/ui/DateText';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { Money } from '../../../shared/ui/Money';
import { StatusTag } from '../../../shared/ui/StatusTag';
import { ToneTag } from '../../../shared/ui/ToneTag';
import { ContactLink } from '../../contacts/components/ContactLink';
import type { InventoryCycle } from '../types';

/** One "label: value" pair of a cycle. */
function Term({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <span className="rm-cycle-term">
      <Typography.Text type="secondary">{label}:</Typography.Text> {children}
    </span>
  );
}

/** Commission of a consignment cycle: amount, percentage, or "surplus over the minimum". */
function Commission({ cycle }: { cycle: InventoryCycle }) {
  const enumLabel = useEnumLabel();
  if (!cycle.commissionMode) return <span className="rm-empty-value">—</span>;
  if (cycle.commissionMode === 'PERCENT') {
    return <Ltr>{`${cycle.commissionValue ?? 0}%`}</Ltr>;
  }
  if (cycle.commissionMode === 'FIXED')
    return <Money amount={cycle.commissionValue} decimals={false} />;
  return <span>{enumLabel('CommissionMode', cycle.commissionMode)}</span>;
}

/** Start – end of a cycle ("now" while it is open). */
function CycleDates({ cycle }: { cycle: InventoryCycle }) {
  const { t } = useTranslation();
  return (
    <span className="rm-cycle-dates rm-nowrap">
      <DateText value={cycle.startedAt} />
      {' – '}
      {cycle.endedAt ? <DateText value={cycle.endedAt} /> : t('vehicles.cycles.now')}
    </span>
  );
}

/**
 * Inventory cycles, newest first, on AntD `Timeline`: the dates in their own column (from `md`
 * up; above the event on phones), then the event (kind, open / end reason), who it was with
 * (the consignor) and the money terms. Dots take their tone from the registry: the open cycle is
 * the current one (success, ringed), closed cycles are done (neutral).
 */
export function CyclesTimeline({ cycles }: { cycles: readonly InventoryCycle[] }) {
  const { t } = useTranslation();
  const enumLabel = useEnumLabel();
  const screens = Grid.useBreakpoint();
  // `screens` is empty until the first measurement; treat that as desktop.
  const wide = screens.md !== false;
  if (cycles.length === 0) return <EmptyState compact description={t('vehicles.cycles.empty')} />;

  return (
    <Timeline
      className="rm-cycles-timeline"
      data-testid="cycles-timeline"
      titleSpan={wide ? 6 : undefined}
      items={cycles.map((c) => {
        const open = !c.endedAt;
        const tone: Tone = open ? 'success' : 'neutral';
        return {
          key: c.id,
          color: TONE_DOT_COLORS[tone],
          className: open
            ? 'rm-timeline-item rm-timeline-current'
            : 'rm-timeline-item rm-timeline-done',
          title: wide ? <CycleDates cycle={c} /> : undefined,
          content: (
            <Flex vertical gap={4} data-testid="cycle-item" data-state={open ? 'current' : 'done'}>
              {!wide && <CycleDates cycle={c} />}
              <Flex gap={6} wrap align="center" className="rm-timeline-event">
                <StatusTag enumName="CycleKind" value={c.kind} />
                {open ? (
                  <ToneTag tone="success">{t('vehicles.cycles.open')}</ToneTag>
                ) : (
                  c.endReason && (
                    <ToneTag tone="neutral">{enumLabel('CycleEndReason', c.endReason)}</ToneTag>
                  )
                )}
              </Flex>
              {c.kind === 'CONSIGNED' && (
                <span className="rm-timeline-who">
                  <Term label={t('vehicles.cycles.consignor')}>
                    <ContactLink id={c.consignorId} name={c.consignor?.name} />
                  </Term>
                </span>
              )}
              <Flex gap={16} wrap className="rm-timeline-terms">
                <Term label={t('vehicles.cycles.expenseTotal')}>
                  <Money amount={c.expenseTotal ?? 0} />
                </Term>
                {c.expensePaidByUs !== null &&
                  c.expensePaidByUs !== undefined &&
                  Number(c.expensePaidByUs) !== Number(c.expenseTotal ?? 0) && (
                    <Term label={t('vehicles.expenses.paidByUs')}>
                      <Money amount={c.expensePaidByUs} />
                    </Term>
                  )}
                {c.kind === 'CONSIGNED' && (
                  <>
                    <Term label={t('vehicles.cycles.askingPrice')}>
                      <Money amount={c.askingPrice} decimals={false} />
                    </Term>
                    {c.minNetToConsignor !== null && c.minNetToConsignor !== undefined && (
                      <Term label={t('vehicles.cycles.minNetToConsignor')}>
                        <Money amount={c.minNetToConsignor} decimals={false} />
                      </Term>
                    )}
                    <Term label={t('vehicles.cycles.commissionValue')}>
                      <Commission cycle={c} />
                    </Term>
                    {c.agreementEndsAt && (
                      <Term label={t('vehicles.cycles.agreementEndsAt')}>
                        <DateText value={c.agreementEndsAt} />
                      </Term>
                    )}
                  </>
                )}
              </Flex>
            </Flex>
          ),
        };
      })}
    />
  );
}
