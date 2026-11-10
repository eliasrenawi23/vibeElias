import { PlusOutlined } from '@ant-design/icons';
import { Button, Card, Descriptions, Flex, Typography } from 'antd';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { AutoDir, Ltr } from '../../../shared/lib/bidi';
import { useEnumLabel } from '../../../shared/lib/enums';
import { DataTable, type DataTableColumn } from '../../../shared/ui/DataTable';
import { DateText } from '../../../shared/ui/DateText';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ExpiryBadge } from '../../../shared/ui/ExpiryBadge';
import { KmText } from '../../../shared/ui/KmText';
import { Money } from '../../../shared/ui/Money';
import { PlateNo } from '../../../shared/ui/PlateNo';
import { StatusTag } from '../../../shared/ui/StatusTag';
import { YearText } from '../../../shared/ui/YearText';
import type { OdometerEntry, VehicleDetail } from '../types';
import { CyclesTimeline } from './CyclesTimeline';
import { DESCRIPTION_COLUMNS } from '../../../shared/ui/descriptionColumns';

export interface VehicleInfoTabProps {
  vehicle: VehicleDetail;
  onAddOdometer: () => void;
}

const empty = <span className="rm-empty-value">—</span>;
const text = (value: string | null | undefined): ReactNode =>
  value ? <AutoDir>{value}</AutoDir> : empty;

/** Vehicle details, odometer log and inventory cycles. */
export function VehicleInfoTab({ vehicle: v, onAddOdometer }: VehicleInfoTabProps) {
  const { t } = useTranslation();
  const enumLabel = useEnumLabel();

  const odometerColumns: DataTableColumn<OdometerEntry>[] = [
    {
      key: 'date',
      title: t('vehicles.odometer.date'),
      mobile: 'title',
      render: (o) => <DateText value={o.date} />,
    },
    {
      key: 'km',
      title: t('vehicles.odometer.km'),
      align: 'end',
      render: (o) => <KmText value={o.km} />,
    },
    { key: 'source', title: t('vehicles.odometer.source'), render: (o) => text(o.source) },
  ];

  const items = [
    { key: 'plate', label: t('vehicles.fields.plateNo'), children: <PlateNo value={v.plateNo} /> },
    {
      key: 'vin',
      label: t('vehicles.fields.vin'),
      children: v.vin ? <Ltr className="rm-vin">{v.vin}</Ltr> : empty,
    },
    { key: 'make', label: t('vehicles.fields.make'), children: text(v.make) },
    { key: 'model', label: t('vehicles.fields.model'), children: text(v.model) },
    { key: 'trim', label: t('vehicles.fields.trim'), children: text(v.trim) },
    { key: 'year', label: t('vehicles.fields.year'), children: <YearText value={v.year} /> },
    { key: 'color', label: t('vehicles.fields.color'), children: text(v.color) },
    {
      key: 'fuel',
      label: t('vehicles.fields.fuel'),
      children: v.fuel ? enumLabel('Fuel', v.fuel) : empty,
    },
    {
      key: 'gearbox',
      label: t('vehicles.fields.gearbox'),
      children: v.gearbox ? enumLabel('Gearbox', v.gearbox) : empty,
    },
    {
      key: 'engineCc',
      label: t('vehicles.fields.engineCc'),
      children:
        v.engineCc !== null && v.engineCc !== undefined ? (
          <span>
            <Ltr>{String(v.engineCc)}</Ltr> {t('units.cc')}
          </span>
        ) : (
          empty
        ),
    },
    {
      key: 'hand',
      label: t('vehicles.fields.hand'),
      children: v.hand !== null && v.hand !== undefined ? <Ltr>{String(v.hand)}</Ltr> : empty,
    },
    { key: 'km', label: t('vehicles.fields.currentKm'), children: <KmText value={v.currentKm} /> },
    {
      key: 'status',
      label: t('vehicles.fields.status'),
      children: <StatusTag enumName="VehicleStatus" value={v.status} />,
    },
    {
      key: 'ownership',
      label: t('vehicles.fields.ownership'),
      children: enumLabel('VehicleOwnership', v.ownership),
    },
    ...(v.ownership === 'THIRD_PARTY' || v.ownerDriver
      ? [
          {
            key: 'ownerDriver',
            label: t('vehicles.fields.ownerDriver'),
            children: v.ownerDriver ? (
              <Link to={`/drivers/${encodeURIComponent(v.ownerDriver.id)}`}>
                <AutoDir>{v.ownerDriver.name}</AutoDir>
              </Link>
            ) : (
              empty
            ),
          },
        ]
      : []),
    {
      key: 'isTaxi',
      label: t('vehicles.fields.isTaxi'),
      children: v.isTaxi ? t('actions.yes') : t('actions.no'),
    },
    ...(v.isTaxi || v.registeredLicense
      ? [
          {
            key: 'license',
            label: t('vehicles.fields.registeredLicense'),
            children: v.registeredLicense ? (
              <Link
                to={`/taxi-licenses/${encodeURIComponent(v.registeredLicense.id)}`}
                className="rm-license-link"
              >
                <Ltr>{v.registeredLicense.licenseNo}</Ltr>
              </Link>
            ) : (
              empty
            ),
          },
        ]
      : []),
    ...(v.isTaxi
      ? [
          {
            key: 'meterSerial',
            label: t('vehicles.fields.meterSerial'),
            children: v.meterSerial ? <Ltr>{v.meterSerial}</Ltr> : empty,
          },
          {
            key: 'meterSealedAt',
            label: t('vehicles.fields.meterSealedAt'),
            children: <DateText value={v.meterSealedAt} />,
          },
        ]
      : []),
    {
      key: 'registrationExpiry',
      label: t('vehicles.fields.registrationExpiry'),
      children: <ExpiryBadge value={v.registrationExpiry} showValid />,
    },
    {
      key: 'dealerRegisteredAt',
      label: t('vehicles.fields.dealerRegisteredAt'),
      children: <DateText value={v.dealerRegisteredAt} />,
    },
    { key: 'location', label: t('vehicles.fields.location'), children: text(v.location) },
    {
      key: 'listingPrice',
      label: t('vehicles.fields.listingPrice'),
      children: <Money amount={v.listingPrice} decimals={false} />,
    },
    {
      key: 'notes',
      label: t('vehicles.fields.notes'),
      span: 'filled' as const,
      children: v.notes ? (
        <Typography.Paragraph className="rm-pre-wrap" dir="auto">
          {v.notes}
        </Typography.Paragraph>
      ) : (
        empty
      ),
    },
  ];

  return (
    <Flex vertical gap={16}>
      <Card variant="borderless" title={t('common.details')}>
        <Descriptions column={DESCRIPTION_COLUMNS} size="small" items={items} />
      </Card>

      <Card
        variant="borderless"
        title={t('vehicles.odometer.title')}
        extra={
          <Button size="small" icon={<PlusOutlined />} onClick={onAddOdometer}>
            {t('actions.add')}
          </Button>
        }
      >
        <DataTable<OdometerEntry>
          data-testid="odometer-table"
          label={t('vehicles.odometer.title')}
          rowKey={(o) => o.id}
          columns={odometerColumns}
          data={v.odometer ?? []}
          size="small"
          empty={<EmptyState compact description={t('vehicles.odometer.empty')} />}
        />
      </Card>

      <Card variant="borderless" title={t('vehicles.cycles.title')}>
        <CyclesTimeline cycles={v.cycles ?? []} />
      </Card>
    </Flex>
  );
}
