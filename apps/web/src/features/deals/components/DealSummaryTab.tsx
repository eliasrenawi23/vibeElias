import { Card, Col, Descriptions, Flex, Row, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { isolateLtr } from '../../../shared/lib/bidi';
import { instantToBusinessDate } from '../../../shared/lib/dates';
import { useEnumLabel } from '../../../shared/lib/enums';
import { formatCount } from '../../../shared/lib/money';
import { DateText } from '../../../shared/ui/DateText';
import { Money } from '../../../shared/ui/Money';
import { StatusTag } from '../../../shared/ui/StatusTag';
import { DESCRIPTION_COLUMNS_SINGLE } from '../../../shared/ui/descriptionColumns';
import { ToneTag } from '../../../shared/ui/ToneTag';
import { ContactLink } from '../../contacts/components/ContactLink';
import { cashDue, commissionPreview, dealPath } from '../lib/dealRules';
import type { DealDetail } from '../types';
import { CommissionRuleText } from './CommissionRuleText';
import { DealNo, DealVehicleCell, ListGapText } from './DealBits';

const empty = <span className="rm-empty-value">—</span>;

/** Price and list gap, VAT, trade-in link, consignment payout, warranty and the key dates. */
export function DealSummaryTab({ deal }: { deal: DealDetail }) {
  const { t, i18n } = useTranslation();
  const enumLabel = useEnumLabel();
  const tradeInValue = deal.tradeInDeal?.price ?? deal.tradeInValue ?? null;
  const vat = deal.vat;
  const consignment = deal.type === 'CONSIGNMENT_SALE';
  // Before completion the API has no commission yet: preview it from the cycle terms.
  const preview = consignment ? commissionPreview(deal.cycle, deal.price) : null;
  const commission = deal.commissionAmount ?? preview?.commission ?? null;
  const payout = deal.payoutAmount ?? preview?.payout ?? null;
  const pct = (n: number) =>
    isolateLtr(`${formatCount(n, i18n.resolvedLanguage, { maximumFractionDigits: 2 })}%`);

  return (
    <Row gutter={[16, 16]} data-testid="deal-summary">
      <Col xs={24} lg={12}>
        <Card variant="borderless" title={t('deals.summary.price')} data-testid="deal-price-card">
          <Descriptions
            size="small"
            column={DESCRIPTION_COLUMNS_SINGLE}
            items={[
              {
                key: 'price',
                label: t('deals.fields.price'),
                children: (
                  <span data-testid="deal-price">
                    <Money amount={deal.price} />
                  </span>
                ),
              },
              {
                key: 'list',
                label: t('deals.fields.listPrice'),
                children: deal.listPrice ? (
                  <Flex gap={8} wrap align="baseline">
                    <Money amount={deal.listPrice} />
                    <ListGapText price={deal.price} listPrice={deal.listPrice} />
                  </Flex>
                ) : (
                  empty
                ),
              },
              ...(deal.cycle?.purchasePrice !== undefined &&
              deal.cycle?.purchasePrice !== null &&
              deal.type === 'SALE'
                ? [
                    {
                      key: 'purchase',
                      label: t('deals.fields.purchasePrice'),
                      children: <Money amount={deal.cycle.purchasePrice} />,
                    },
                  ]
                : []),
              ...(tradeInValue
                ? [
                    {
                      key: 'tradeIn',
                      label: t('deals.fields.tradeInValue'),
                      children: <Money amount={tradeInValue} />,
                    },
                    {
                      key: 'cash',
                      label: t('deals.form.cashDue'),
                      children: (
                        <span data-testid="deal-cash-due">
                          <Money amount={cashDue(deal.price, tradeInValue)} />
                        </span>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        </Card>
      </Col>

      <Col xs={24} lg={12}>
        <Card variant="borderless" title={t('deals.summary.vat')} data-testid="deal-vat-card">
          <Descriptions
            size="small"
            column={DESCRIPTION_COLUMNS_SINGLE}
            items={[
              {
                key: 'mode',
                label: t('deals.fields.vatMode'),
                children: <ToneTag tone="neutral">{enumLabel('VatMode', vat?.mode ?? deal.vatMode)}</ToneTag>,
              },
              {
                key: 'rate',
                label: t('deals.fields.vatRate'),
                children: pct(vat?.rate ?? deal.vatRate),
              },
              {
                key: 'base',
                label: t('deals.fields.vatBase'),
                children: vat ? <Money amount={vat.base} /> : empty,
              },
              {
                key: 'amount',
                label: t('deals.fields.vatAmount'),
                children: vat ? (
                  <span data-testid="deal-vat-amount">
                    <Money amount={vat.amount} />
                  </span>
                ) : (
                  empty
                ),
              },
            ]}
          />
          {deal.type === 'PURCHASE' && deal.sellerIsVatBusiness && (
            <Typography.Paragraph type="secondary" className="rm-small-text">
              {t('deals.form.sellerVatHint')}
            </Typography.Paragraph>
          )}
        </Card>
      </Col>

      {deal.tradeInDeal && (
        <Col xs={24} lg={12}>
          <Card
            variant="borderless"
            title={t('deals.summary.tradeIn')}
            data-testid="deal-trade-in-card"
          >
            <Descriptions
              size="small"
              column={DESCRIPTION_COLUMNS_SINGLE}
              items={[
                {
                  key: 'deal',
                  label: t('deals.summary.tradeInDeal'),
                  children: (
                    <Flex gap={6} align="center" wrap>
                      <Link to={dealPath(deal.tradeInDeal.id)} data-testid="trade-in-deal-link">
                        <DealNo no={deal.tradeInDeal.dealNo} />
                      </Link>
                      <StatusTag enumName="DealStatus" value={deal.tradeInDeal.status} />
                    </Flex>
                  ),
                },
                {
                  key: 'vehicle',
                  label: t('deals.fields.vehicle'),
                  children: <DealVehicleCell vehicle={deal.tradeInDeal.vehicle} />,
                },
                {
                  key: 'value',
                  label: t('deals.fields.tradeInValue'),
                  children: <Money amount={deal.tradeInDeal.price} />,
                },
              ]}
            />
          </Card>
        </Col>
      )}

      {deal.tradeInFor && (
        <Col xs={24} lg={12}>
          <Card
            variant="borderless"
            title={t('deals.summary.tradeIn')}
            data-testid="deal-trade-in-for"
          >
            <Typography.Paragraph>
              {t('deals.summary.tradeInForText')}{' '}
              <Link to={dealPath(deal.tradeInFor.id)}>
                <DealNo no={deal.tradeInFor.dealNo} />
              </Link>
            </Typography.Paragraph>
          </Card>
        </Col>
      )}

      {consignment && (
        <Col xs={24} lg={12}>
          <Card
            variant="borderless"
            title={t('deals.summary.consignment')}
            data-testid="deal-consignment-card"
          >
            <Descriptions
              size="small"
              column={DESCRIPTION_COLUMNS_SINGLE}
              items={[
                {
                  key: 'consignor',
                  label: t('deals.fields.consignor'),
                  children: (
                    <ContactLink
                      id={deal.cycle?.consignor?.id}
                      name={deal.cycle?.consignor?.name}
                    />
                  ),
                },
                {
                  key: 'rule',
                  label: t('deals.fields.commissionRule'),
                  children: (
                    <CommissionRuleText
                      mode={deal.cycle?.commissionMode}
                      value={deal.cycle?.commissionValue}
                      minNet={deal.cycle?.minNetToConsignor}
                    />
                  ),
                },
                {
                  key: 'minNet',
                  label: t('deals.fields.minNet'),
                  children: <Money amount={deal.cycle?.minNetToConsignor ?? null} />,
                },
                {
                  key: 'commission',
                  label: t('deals.fields.commission'),
                  children: (
                    <span data-testid="deal-commission">
                      <Money amount={commission} />
                    </span>
                  ),
                },
                {
                  key: 'payout',
                  label: t('deals.fields.payout'),
                  children: (
                    <span data-testid="deal-payout">
                      <Money amount={payout} />
                    </span>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
      )}

      <Col xs={24} lg={12}>
        <Card variant="borderless" title={t('deals.summary.dates')} data-testid="deal-dates-card">
          <Descriptions
            size="small"
            column={DESCRIPTION_COLUMNS_SINGLE}
            items={[
              {
                key: 'date',
                label: t('deals.fields.date'),
                children: <DateText value={deal.date} />,
              },
              ...(deal.type !== 'PURCHASE'
                ? [
                    {
                      key: 'disclosure',
                      label: t('deals.fields.disclosureSignedAt'),
                      children: deal.disclosureSignedAt ? (
                        <DateText value={instantToBusinessDate(deal.disclosureSignedAt)} />
                      ) : (
                        <Typography.Text type="warning">
                          {t('deals.alerts.disclosureMissing')}
                        </Typography.Text>
                      ),
                    },
                  ]
                : []),
              {
                key: 'completed',
                label: t('deals.fields.completedAt'),
                children: deal.completedAt ? (
                  <DateText value={instantToBusinessDate(deal.completedAt)} />
                ) : (
                  empty
                ),
              },
              ...(deal.cancelledAt
                ? [
                    {
                      key: 'cancelled',
                      label: t('deals.fields.cancelledAt'),
                      children: <DateText value={instantToBusinessDate(deal.cancelledAt)} />,
                    },
                  ]
                : []),
              ...(deal.transferDueAt
                ? [
                    {
                      key: 'transferDue',
                      label: t('deals.fields.transferDueAt'),
                      children: <DateText value={deal.transferDueAt} />,
                    },
                  ]
                : []),
            ]}
          />
        </Card>
      </Col>

      {deal.type !== 'PURCHASE' && (
        <Col xs={24} lg={12}>
          <Card
            variant="borderless"
            title={t('deals.fields.warrantyText')}
            data-testid="deal-warranty"
          >
            {deal.warrantyText ? (
              <Typography.Paragraph className="rm-pre-wrap" dir="auto">
                {deal.warrantyText}
              </Typography.Paragraph>
            ) : (
              empty
            )}
          </Card>
        </Col>
      )}

      {deal.notes && (
        <Col xs={24} lg={12}>
          <Card variant="borderless" title={t('common.notes')}>
            <Typography.Paragraph className="rm-pre-wrap" dir="auto">
              {deal.notes}
            </Typography.Paragraph>
          </Card>
        </Col>
      )}
    </Row>
  );
}
