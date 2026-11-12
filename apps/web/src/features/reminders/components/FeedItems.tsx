import {
  AlertOutlined,
  BellOutlined,
  CarOutlined,
  CheckOutlined,
  DollarOutlined,
  FileProtectOutlined,
  FileTextOutlined,
  HistoryOutlined,
  IdcardOutlined,
  MedicineBoxOutlined,
  PhoneOutlined,
  SafetyCertificateOutlined,
  SafetyOutlined,
  ShopOutlined,
  SwapOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import type { FeedItem, FeedKind, FeedSeverity } from '@renawi/shared';
import { Button, Typography } from 'antd';
import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { AutoDir, isolateLtr } from '../../../shared/lib/bidi';
import { toneClassName, toneOf } from '../../../shared/lib/statusTones';
import { DateText } from '../../../shared/ui/DateText';
import { ToneTag } from '../../../shared/ui/ToneTag';
import { daysLeftLabel, groupFeedBySeverity, isManualItem, safeFeedLink } from '../lib/feed';

/** One icon per feed kind (the object the date belongs to). */
export const FEED_KIND_ICONS: Readonly<Record<FeedKind, ComponentType>> = {
  vehicleRegistration: CarOutlined,
  insurance: SafetyOutlined,
  driverLicense: IdcardOutlined,
  taxiPermit: IdcardOutlined,
  medical: MedicineBoxOutlined,
  taxiLicenseFee: DollarOutlined,
  taxiLicenseRenewal: SafetyCertificateOutlined,
  leaseEnd: FileProtectOutlined,
  document: FileTextOutlined,
  contactFollowUp: PhoneOutlined,
  fineReassign: AlertOutlined,
  dealTransfer: SwapOutlined,
  dealerRegistration: ShopOutlined,
  taxiAge: HistoryOutlined,
  taxiSemiAnnual: ToolOutlined,
  manual: BellOutlined,
};

/** The kind's icon on a tile in the severity's tone (decorative: the row names the kind). */
export function FeedKindIcon({ kind, severity }: { kind: FeedKind; severity: FeedSeverity }) {
  const Icon = FEED_KIND_ICONS[kind] ?? BellOutlined;
  return (
    <span
      aria-hidden
      className={`rm-feed-icon ${toneClassName(toneOf('FeedSeverity', severity))}`}
      data-kind={kind}
    >
      <Icon />
    </span>
  );
}

/** "3 days overdue" / "Due today" / "In 12 days", in the severity's tone. */
export function DaysLeftTag({ daysLeft, severity }: { daysLeft: number; severity: FeedSeverity }) {
  const { t } = useTranslation();
  const { key, days } = daysLeftLabel(daysLeft);
  return (
    <ToneTag
      tone={toneOf('FeedSeverity', severity)}
      className="rm-days-left"
      data-severity={severity}
    >
      {t(key, { days: isolateLtr(String(days)) })}
    </ToneTag>
  );
}

export interface FeedItemListProps {
  items: readonly FeedItem[];
  /** Group under severity headings (overdue, due soon, upcoming). */
  grouped?: boolean;
  /** "Mark done" on manual reminders. */
  onMarkDone?: (item: FeedItem) => void;
  /** Id of the reminder being marked done (its button spins). */
  markingId?: string | null;
  /** Called when a link is followed (closes a popover / drawer). */
  onNavigate?: () => void;
  'data-testid'?: string;
}

/**
 * Feed items as a compact list (bell, dashboard): kind icon in the severity tone, the title as a
 * link to the record, the kind and detail, the due date and a days-left tag.
 */
export function FeedItemList({
  items,
  grouped = false,
  onMarkDone,
  markingId,
  onNavigate,
  'data-testid': testId = 'feed-list',
}: FeedItemListProps) {
  const { t } = useTranslation();
  const row = (item: FeedItem) => {
    const link = safeFeedLink(item.link);
    const title = <AutoDir>{item.title}</AutoDir>;
    return (
      <li key={item.id} className="rm-feed-item" data-testid="feed-item" data-kind={item.kind}>
        <FeedKindIcon kind={item.kind} severity={item.severity} />
        <div className="rm-feed-body">
          <div className="rm-feed-title">
            {link ? (
              <Link to={link} onClick={onNavigate}>
                {title}
              </Link>
            ) : (
              title
            )}
          </div>
          <Typography.Text type="secondary" className="rm-feed-meta">
            {t(`reminders.kinds.${item.kind}`)}
            {item.subtitle && (
              <>
                {' · '}
                <AutoDir>{item.subtitle}</AutoDir>
              </>
            )}
          </Typography.Text>
        </div>
        <div className="rm-feed-when">
          <DateText value={item.dueAt} />
          <DaysLeftTag daysLeft={item.daysLeft} severity={item.severity} />
          {onMarkDone && isManualItem(item) && (
            <Button
              size="small"
              icon={<CheckOutlined />}
              loading={markingId === item.entityId}
              onClick={() => onMarkDone(item)}
              data-testid="feed-mark-done"
            >
              {t('reminders.manual.markDone')}
            </Button>
          )}
        </div>
      </li>
    );
  };

  if (!grouped) {
    return (
      <ul className="rm-feed-list" data-testid={testId}>
        {items.map(row)}
      </ul>
    );
  }
  return (
    <div className="rm-feed-groups" data-testid={testId}>
      {groupFeedBySeverity(items).map((group) => (
        <section
          key={group.severity}
          className="rm-feed-group"
          aria-label={t(`reminders.severity.${group.severity}`)}
          data-severity={group.severity}
        >
          <h3 className="rm-feed-group-title">
            <span
              aria-hidden
              className={`rm-feed-group-dot ${toneClassName(toneOf('FeedSeverity', group.severity))}`}
            />
            {t(`reminders.severity.${group.severity}`)}
          </h3>
          <ul className="rm-feed-list">{group.items.map(row)}</ul>
        </section>
      ))}
    </div>
  );
}
