import { EditOutlined } from '@ant-design/icons';
import { RESPONSIBILITY_KEYS, todayInBusinessTz } from '@renawi/shared';
import { Button, Card, Col, Descriptions, Flex, Row, Tag, Timeline, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { AutoDir } from '../../../shared/lib/bidi';
import { useEnumLabel } from '../../../shared/lib/enums';
import { DataTable, type DataTableColumn } from '../../../shared/ui/DataTable';
import { DateText } from '../../../shared/ui/DateText';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { LicenseTag } from '../../../shared/ui/LicenseTag';
import { Money } from '../../../shared/ui/Money';
import { MonthText } from '../../../shared/ui/MonthText';
import { PlateNo } from '../../../shared/ui/PlateNo';
import { LedgerTypeTag } from '../../ledger/components/LedgerTable';
import { leasePath } from '../lib/leaseRules';
import type { LeaseDetail, OpenCharge } from '../types';
import { ChecklistView } from './ChecklistView';

export interface LeaseOverviewTabProps {
  lease: LeaseDetail;
  /** Opens the checklist editor (omitted: read only). */
  onEditChecklist?: (kind: 'handover' | 'return') => void;
}

/** Terms, responsibilities, segment history, open charges and the checklists of a contract. */
export function LeaseOverviewTab({ lease: l, onEditChecklist }: LeaseOverviewTabProps) {
  const { t } = useTranslation();
  const enumLabel = useEnumLabel();
  const today = todayInBusinessTz();
  const empty = <span className="rm-empty-value">—</span>;

  const chargeColumns: DataTableColumn<OpenCharge>[] = [
    {
      key: 'kind',
      title: t('ledger.fields.type'),
      mobile: 'title',
      render: (c) => <LedgerTypeTag entry={{ type: 'CHARGE', chargeKind: c.chargeKind }} />,
    },
    {
      key: 'period',
      title: t('ledger.fields.period'),
      render: (c) => <MonthText value={c.rentPeriod} />,
    },
    {
      key: 'due',
      title: t('ledger.fields.dueDate'),
      render: (c) => (
        <span className={c.dueDate && c.dueDate < today ? 'rm-overdue' : undefined}>
          <DateText value={c.dueDate} />
        </span>
      ),
    },
    {
      key: 'amount',
      title: t('ledger.fields.amount'),
      align: 'end',
      render: (c) => <Money amount={c.amount} />,
    },
    {
      key: 'remaining',
      title: t('ledger.fields.remaining'),
      align: 'end',
      render: (c) => (
        <span className="rm-text-error">
          <Money amount={c.remaining} />
        </span>
      ),
    },
  ];

  return (
    <Flex vertical gap={16}>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card variant="borderless" title={t('leases.sections.terms')} className="rm-full-height">
            <Descriptions
              size="small"
              column={{ xs: 1, sm: 2 }}
              items={[
                {
                  key: 'type',
                  label: t('leases.fields.type'),
                  children: enumLabel('LeaseType', l.type),
                },
                {
                  key: 'period',
                  label: t('leases.fields.period'),
                  children: (
                    <span className="rm-nowrap">
                      <DateText value={l.startDate} /> – <DateText value={l.endDate} />
                    </span>
                  ),
                },
                ...(l.actualEndDate
                  ? [
                      {
                        key: 'actual',
                        label: t('leases.fields.actualEndDate'),
                        children: <DateText value={l.actualEndDate} />,
                      },
                      {
                        key: 'reason',
                        label: t('leases.fields.endReason'),
                        children: l.endReason ? enumLabel('LeaseEndReason', l.endReason) : empty,
                      },
                    ]
                  : []),
                {
                  key: 'rent',
                  label: t('leases.fields.monthlyRent'),
                  children: (
                    <span>
                      <Money amount={l.currentSegment?.monthlyRent ?? null} />{' '}
                      <Typography.Text type="secondary">
                        {l.rentIncludesVat ? t('money.includingVat') : t('money.excludingVat')}
                      </Typography.Text>
                    </span>
                  ),
                },
                {
                  key: 'paymentDay',
                  label: t('leases.fields.paymentDay'),
                  children: <span className="rm-tabular">{l.paymentDay}</span>,
                },
                {
                  key: 'billing',
                  label: t('leases.fields.billingPeriod'),
                  children: enumLabel('BillingPeriod', l.billingPeriod),
                },
                {
                  key: 'penalty',
                  label: t('leases.fields.earlyExitPenaltyMonths'),
                  children: (
                    <span>
                      <span className="rm-tabular">{l.earlyExitPenaltyMonths}</span>{' '}
                      {t('units.months')}
                    </span>
                  ),
                },
                {
                  key: 'deposit',
                  label: t('leases.fields.depositAmount'),
                  children: (
                    <span>
                      <Money amount={l.depositAmount} /> · {enumLabel('DepositKind', l.depositKind)}
                    </span>
                  ),
                },
                {
                  key: 'held',
                  label: t('ledger.fields.depositHeld'),
                  children: <Money amount={l.balance?.depositHeld ?? 0} />,
                },
                {
                  key: 'signed',
                  label: t('leases.fields.signedAt'),
                  children: l.signedAt ? <DateText value={l.signedAt.slice(0, 10)} /> : empty,
                },
                {
                  key: 'lastPayment',
                  label: t('leases.fields.lastPayment'),
                  children: l.lastPayment ? (
                    <span>
                      <Money amount={l.lastPayment.amount} /> ·{' '}
                      <DateText value={l.lastPayment.date} />
                    </span>
                  ) : (
                    empty
                  ),
                },
                ...(l.renewedFromId
                  ? [
                      {
                        key: 'renewedFrom',
                        label: t('leases.fields.renewedFrom'),
                        children: (
                          <Link to={leasePath(l.renewedFromId)}>
                            {t('leases.previousContract')}
                          </Link>
                        ),
                      },
                    ]
                  : []),
                {
                  key: 'terms',
                  label: t('leases.fields.terms'),
                  span: 'filled' as const,
                  children: l.terms ? (
                    <Typography.Paragraph className="rm-pre-wrap" dir="auto">
                      {l.terms}
                    </Typography.Paragraph>
                  ) : (
                    empty
                  ),
                },
                ...(l.notes
                  ? [
                      {
                        key: 'notes',
                        label: t('common.notes'),
                        span: 'filled' as const,
                        children: (
                          <Typography.Paragraph className="rm-pre-wrap" dir="auto">
                            {l.notes}
                          </Typography.Paragraph>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Flex vertical gap={16}>
            <Card variant="borderless" title={t('leases.fields.responsibilities')}>
              <Flex vertical gap={6} data-testid="lease-responsibilities">
                {RESPONSIBILITY_KEYS.map((k) => {
                  const party = l.responsibilities?.[k] ?? 'DRIVER';
                  return (
                    <Flex key={k} justify="space-between" align="center">
                      <span>{t(`responsibility.${k}`)}</span>
                      <Tag color={party === 'US' ? 'gold' : 'default'}>
                        {enumLabel('ResponsibleParty', party)}
                      </Tag>
                    </Flex>
                  );
                })}
              </Flex>
            </Card>
            <Card variant="borderless" title={t('leases.sections.segments')}>
              {l.segments?.length ? (
                <Timeline
                  data-testid="lease-segments"
                  items={l.segments.map((s) => ({
                    key: s.id,
                    color: s.endDate ? 'gray' : 'green',
                    content: (
                      <Flex vertical gap={4} data-testid="segment-item">
                        <Flex gap={6} wrap align="center">
                          <LicenseTag licenseNo={s.taxiLicense.licenseNo} id={s.taxiLicense.id} />
                          {s.vehicle && <PlateNo value={s.vehicle.plateNo} />}
                          <Money amount={s.monthlyRent} />
                        </Flex>
                        <span className="rm-nowrap">
                          <DateText value={s.startDate} /> –{' '}
                          {s.endDate ? <DateText value={s.endDate} /> : t('vehicles.cycles.now')}
                        </span>
                        {s.reason && (
                          <Typography.Text type="secondary">
                            <AutoDir>{s.reason}</AutoDir>
                          </Typography.Text>
                        )}
                      </Flex>
                    ),
                  }))}
                />
              ) : (
                <EmptyState compact description={t('leases.noSegments')} />
              )}
            </Card>
          </Flex>
        </Col>
      </Row>

      <Card variant="borderless" title={t('leases.sections.openCharges')}>
        <DataTable<OpenCharge>
          label={t('leases.sections.openCharges')}
          data-testid="lease-open-charges"
          rowKey={(c) => c.id}
          columns={chargeColumns}
          data={l.openCharges ?? []}
          size="small"
          empty={<EmptyState compact description={t('leases.noOpenCharges')} />}
        />
      </Card>

      {l.type === 'CAR_AND_NUMBER' && (
        <Row gutter={[16, 16]}>
          {(['handover', 'return'] as const).map((kind) => (
            <Col xs={24} lg={12} key={kind}>
              <Card
                variant="borderless"
                title={
                  kind === 'handover' ? t('checklist.handoverTitle') : t('checklist.returnTitle')
                }
                extra={
                  onEditChecklist && (
                    <Button
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => onEditChecklist(kind)}
                      data-testid={`edit-checklist-${kind}`}
                    >
                      {t('actions.edit')}
                    </Button>
                  )
                }
              >
                <ChecklistView
                  kind={kind}
                  checklist={kind === 'handover' ? l.handoverChecklist : l.returnChecklist}
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </Flex>
  );
}
