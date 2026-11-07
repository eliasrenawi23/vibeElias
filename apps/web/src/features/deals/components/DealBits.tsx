import type { DealType, TransferStatus } from '@renawi/shared';
import { todayInBusinessTz } from '@renawi/shared';
import { Flex, Tag, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { AutoDir, isolateLtr, Ltr } from '../../../shared/lib/bidi';
import { useEnumLabel } from '../../../shared/lib/enums';
import { formatCount } from '../../../shared/lib/money';
import { DateText } from '../../../shared/ui/DateText';
import { PlateNo } from '../../../shared/ui/PlateNo';
import { StatusTag } from '../../../shared/ui/StatusTag';
import { YearText } from '../../../shared/ui/YearText';
import { DEAL_TYPE_COLORS, listGapPercent } from '../lib/dealRules';
import type { DealVehicleRef } from '../types';

/** Deal number `#1024`, isolated left-to-right. */
export function DealNo({ no }: { no: number | null | undefined }) {
  if (no === null || no === undefined) return <span className="rm-empty-value">—</span>;
  return <Ltr className="rm-contract-no">{`#${no}`}</Ltr>;
}

/** Deal type as a coloured tag. */
export function DealTypeTag({ type }: { type: DealType }) {
  const enumLabel = useEnumLabel();
  return (
    <Tag color={DEAL_TYPE_COLORS[type]} className="rm-deal-type" data-deal-type={type}>
      {enumLabel('DealType', type)}
    </Tag>
  );
}

/** Plate plus make / model (and year) of a deal's car, linking to the vehicle file. */
export function DealVehicleCell({
  vehicle,
  link = true,
}: {
  vehicle: DealVehicleRef | null | undefined;
  link?: boolean;
}) {
  if (!vehicle) return <span className="rm-empty-value">—</span>;
  const body = (
    <Flex gap={6} align="center" wrap component="span">
      <PlateNo value={vehicle.plateNo} />
      <span>
        <AutoDir>{`${vehicle.make} ${vehicle.model}`}</AutoDir>
        {vehicle.year ? (
          <>
            {' '}
            <YearText value={vehicle.year} />
          </>
        ) : null}
      </span>
    </Flex>
  );
  if (!link) return body;
  return (
    <Link to={`/vehicles/${encodeURIComponent(vehicle.id)}`} className="rm-deal-vehicle">
      {body}
    </Link>
  );
}

export interface TransferCellProps {
  status: TransferStatus;
  dueAt: string | null | undefined;
  transferredAt?: string | null;
  /** Hide the status tag (only the due badge). */
  badgeOnly?: boolean;
}

/** Transfer status with its due date: red once overdue, blue while still due. */
export function TransferCell({
  status,
  dueAt,
  transferredAt,
  badgeOnly = false,
}: TransferCellProps) {
  const { t } = useTranslation();
  const today = todayInBusinessTz();
  const open = status !== 'DONE';
  const overdue = open && Boolean(dueAt && dueAt < today);
  return (
    <Flex gap={4} wrap align="center" data-testid="transfer-cell">
      {!badgeOnly && <StatusTag enumName="TransferStatus" value={status} />}
      {open && dueAt && (
        <Tag
          color={overdue ? 'error' : 'processing'}
          data-transfer-due={overdue ? 'overdue' : 'due'}
          className="rm-transfer-due"
        >
          {overdue ? t('deals.transfer.overdue') : t('deals.transfer.due')} ·{' '}
          <DateText value={dueAt} />
        </Tag>
      )}
      {!open && transferredAt && (
        <Typography.Text type="secondary">
          <DateText value={transferredAt} />
        </Typography.Text>
      )}
    </Flex>
  );
}

/** "8.0% below list" / "3.2% above list" next to a price, or nothing without a list price. */
export function ListGapText({
  price,
  listPrice,
}: {
  price: number | null | undefined;
  listPrice: number | null | undefined;
}) {
  const { t, i18n } = useTranslation();
  const gap = listGapPercent(price, listPrice);
  if (gap === null) return null;
  const pct = isolateLtr(
    `${formatCount(Math.abs(gap), i18n.resolvedLanguage, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`,
  );
  const text =
    gap === 0
      ? t('deals.gap.equal')
      : gap < 0
        ? t('deals.gap.below', { pct })
        : t('deals.gap.above', { pct });
  return (
    <Typography.Text type="secondary" className="rm-list-gap" data-testid="list-gap" data-gap={gap}>
      {text}
    </Typography.Text>
  );
}
