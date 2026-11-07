import { Col, Flex, Row, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { BalanceText } from '../../../shared/ui/BalanceText';
import { Money } from '../../../shared/ui/Money';
import { StatCard } from '../../../shared/ui/StatCard';
import { AGEING_KEYS, type Ageing } from '../types';

export interface LedgerSummaryProps {
  balance: number | null | undefined;
  depositHeld: number | null | undefined;
  /** Open charges by days past due (driver level). */
  ageing?: Ageing | null;
  charged?: number | null;
  paid?: number | null;
}

/** Balance, deposit held and (for a driver) the overdue ageing buckets. */
export function LedgerSummary({ balance, depositHeld, ageing, charged, paid }: LedgerSummaryProps) {
  const { t } = useTranslation();
  return (
    <Row gutter={[12, 12]} data-testid="ledger-summary">
      <Col xs={12} md={6}>
        <StatCard title={t('ledger.fields.balance')} data-testid="summary-balance">
          <BalanceText amount={balance ?? 0} />
          <Typography.Text type="secondary" className="rm-stat-hint">
            {Number(balance ?? 0) > 0
              ? t('ledger.owesUs')
              : Number(balance ?? 0) < 0
                ? t('ledger.inCredit')
                : t('ledger.settled')}
          </Typography.Text>
        </StatCard>
      </Col>
      <Col xs={12} md={6}>
        <StatCard title={t('ledger.fields.depositHeld')} data-testid="summary-deposit">
          <Money amount={depositHeld ?? 0} />
        </StatCard>
      </Col>
      {charged !== undefined && charged !== null && (
        <Col xs={12} md={6}>
          <StatCard title={t('ledger.fields.charged')}>
            <Money amount={charged} />
          </StatCard>
        </Col>
      )}
      {paid !== undefined && paid !== null && (
        <Col xs={12} md={6}>
          <StatCard title={t('ledger.fields.paid')}>
            <Money amount={paid} />
          </StatCard>
        </Col>
      )}
      {ageing && (
        <Col xs={24} md={12}>
          <StatCard title={t('ledger.ageing.title')} data-testid="summary-ageing">
            <Flex gap={16} wrap>
              {AGEING_KEYS.map((k) => (
                <Flex key={k} vertical gap={0} data-bucket={k}>
                  <Typography.Text type="secondary" className="rm-stat-hint">
                    {t(`ledger.ageing.${k}`)}
                  </Typography.Text>
                  <span
                    className={
                      k !== 'current' && Number(ageing[k]) > 0 ? 'rm-text-error' : undefined
                    }
                  >
                    <Money amount={ageing[k] ?? 0} decimals={false} />
                  </span>
                </Flex>
              ))}
            </Flex>
          </StatCard>
        </Col>
      )}
    </Row>
  );
}
