import { Card, Descriptions, Flex, Typography } from 'antd';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { AutoDir, Ltr } from '../../../shared/lib/bidi';
import { DataTable, type DataTableColumn } from '../../../shared/ui/DataTable';
import { DateText } from '../../../shared/ui/DateText';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ExpiryBadge } from '../../../shared/ui/ExpiryBadge';
import { PhoneText } from '../../../shared/ui/PhoneText';
import { PlateNo } from '../../../shared/ui/PlateNo';
import { StatusTag } from '../../../shared/ui/StatusTag';
import { YearText } from '../../../shared/ui/YearText';
import { contactName } from '../../contacts/lib';
import type { DriverDetail, OwnedVehicle } from '../types';

const empty = <span className="rm-empty-value">—</span>;
const text = (value: string | null | undefined): ReactNode =>
  value ? <AutoDir>{value}</AutoDir> : empty;

/** Driver permits and contact details, and the driver's own cars. */
export function DriverProfileTab({ driver: d }: { driver: DriverDetail }) {
  const { t } = useTranslation();
  const c = d.contact;

  const vehicleColumns: DataTableColumn<OwnedVehicle>[] = [
    {
      key: 'plate',
      title: t('vehicles.fields.plateNo'),
      mobile: 'title',
      render: (v) => (
        <Link to={`/vehicles/${encodeURIComponent(v.id)}`} aria-label={v.plateNo}>
          <PlateNo value={v.plateNo} />
        </Link>
      ),
    },
    {
      key: 'model',
      title: t('vehicles.makeModel'),
      render: (v) => text([v.make, v.model].filter(Boolean).join(' ') || null),
    },
    {
      key: 'year',
      title: t('vehicles.fields.year'),
      render: (v) => (v.year ? <YearText value={v.year} /> : empty),
    },
    {
      key: 'registration',
      title: t('vehicles.fields.registrationExpiry'),
      render: (v) => <ExpiryBadge value={v.registrationExpiry} />,
    },
  ];

  return (
    <Flex vertical gap={16}>
      <Card variant="borderless" title={t('drivers.sections.permits')}>
        <Descriptions
          column={{ xs: 1, sm: 2, lg: 3 }}
          size="small"
          items={[
            {
              key: 'status',
              label: t('common.status'),
              children: <StatusTag enumName="DriverStatus" value={d.status} />,
            },
            {
              key: 'licenseNo',
              label: t('drivers.fields.licenseNo'),
              children: d.licenseNo ? <Ltr>{d.licenseNo}</Ltr> : empty,
            },
            {
              key: 'licenseExpiry',
              label: t('drivers.fields.licenseExpiry'),
              children: <ExpiryBadge value={d.licenseExpiry} showValid />,
            },
            {
              key: 'taxiPermitNo',
              label: t('drivers.fields.taxiPermitNo'),
              children: d.taxiPermitNo ? <Ltr>{d.taxiPermitNo}</Ltr> : empty,
            },
            {
              key: 'taxiPermitExpiry',
              label: t('drivers.fields.taxiPermitExpiry'),
              children: <ExpiryBadge value={d.taxiPermitExpiry} showValid />,
            },
            {
              key: 'medicalExpiry',
              label: t('drivers.fields.medicalExpiry'),
              children: <ExpiryBadge value={d.medicalExpiry} showValid />,
            },
            {
              key: 'startedAt',
              label: t('drivers.fields.startedAt'),
              children: <DateText value={d.startedAt} />,
            },
            {
              key: 'emergencyName',
              label: t('drivers.fields.emergencyName'),
              children: text(d.emergencyName),
            },
            {
              key: 'emergencyPhone',
              label: t('drivers.fields.emergencyPhone'),
              children: <PhoneText value={d.emergencyPhone} />,
            },
            {
              key: 'notes',
              label: t('common.notes'),
              span: 'filled' as const,
              children: d.notes ? (
                <Typography.Paragraph className="rm-pre-wrap" dir="auto">
                  {d.notes}
                </Typography.Paragraph>
              ) : (
                empty
              ),
            },
          ]}
        />
      </Card>

      <Card
        variant="borderless"
        title={t('drivers.sections.contact')}
        extra={
          <Link
            to={`/contacts/${encodeURIComponent(c?.id ?? d.contactId)}`}
            data-testid="driver-contact-link"
          >
            {t('drivers.openContact')}
          </Link>
        }
      >
        <Descriptions
          column={{ xs: 1, sm: 2, lg: 3 }}
          size="small"
          items={[
            {
              key: 'name',
              label: t('contacts.fields.name'),
              children: text(c ? contactName(c) : d.name),
            },
            {
              key: 'idNumber',
              label: t('contacts.fields.idNumber'),
              children: c?.idNumber ? <Ltr>{c.idNumber}</Ltr> : empty,
            },
            {
              key: 'phones',
              label: t('contacts.fields.phones'),
              children: c?.phones?.length ? (
                <Flex vertical gap={2}>
                  {c.phones.map((p) => (
                    <PhoneText key={p} value={p} />
                  ))}
                </Flex>
              ) : (
                empty
              ),
            },
            {
              key: 'email',
              label: t('contacts.fields.email'),
              children: c?.email ? (
                <Ltr tabular={false}>
                  <a href={`mailto:${c.email}`}>{c.email}</a>
                </Ltr>
              ) : (
                empty
              ),
            },
            {
              key: 'lang',
              label: t('contacts.fields.preferredLang'),
              children: c ? t(`language.${c.preferredLang}`) : empty,
            },
          ]}
        />
      </Card>

      <Card variant="borderless" title={t('drivers.sections.ownedVehicles')}>
        <DataTable<OwnedVehicle>
          label={t('drivers.sections.ownedVehicles')}
          data-testid="driver-vehicles-table"
          rowKey={(v) => v.id}
          columns={vehicleColumns}
          data={d.ownedVehicles ?? []}
          size="small"
          empty={<EmptyState compact description={t('drivers.noOwnedVehicles')} />}
        />
      </Card>
    </Flex>
  );
}
