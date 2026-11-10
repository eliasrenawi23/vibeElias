import { Flex, Tag, Timeline, Typography } from 'antd';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Ltr } from '../../../shared/lib/bidi';
import { useEnumLabel } from '../../../shared/lib/enums';
import { TONE_DOT_COLORS } from '../../../shared/lib/statusTones';
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

/** Inventory cycles, newest first: kind, dates, end reason, expenses and consignment terms. */
export function CyclesTimeline({ cycles }: { cycles: readonly InventoryCycle[] }) {
  const { t } = useTranslation();
  const enumLabel = useEnumLabel();
  if (cycles.length === 0) return <EmptyState compact description={t('vehicles.cycles.empty')} />;

  return (
    <Timeline
      className="rm-cycles-timeline"
      data-testid="cycles-timeline"
      items={cycles.map((c) => {
        const open = !c.endedAt;
        return {
          key: c.id,
          color: TONE_DOT_COLORS[open ? 'success' : 'neutral'],
          content: (
            <Flex vertical gap={4} data-testid="cycle-item">
              <Flex gap={6} wrap align="center">
                <StatusTag enumName="CycleKind" value={c.kind} />
                {open ? (
                  <ToneTag tone="success">{t('vehicles.cycles.open')}</ToneTag>
                ) : (
                  c.endReason && <Tag>{enumLabel('CycleEndReason', c.endReason)}</Tag>
                )}
                <span className="rm-cycle-dates">
                  <DateText value={c.startedAt} />
                  {' – '}
                  {open ? t('vehicles.cycles.now') : <DateText value={c.endedAt} />}
                </span>
              </Flex>
              <Flex gap={16} wrap>
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
                    <Term label={t('vehicles.cycles.consignor')}>
                      <ContactLink id={c.consignorId} name={c.consignor?.name} />
                    </Term>
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
