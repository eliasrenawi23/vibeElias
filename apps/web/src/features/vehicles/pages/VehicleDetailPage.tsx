import {
  BellOutlined,
  DashboardOutlined,
  DollarOutlined,
  EditOutlined,
  FilePdfOutlined,
  CarOutlined,
  PlusOutlined,
  RollbackOutlined,
  SafetyCertificateOutlined,
  SolutionOutlined,
  SwapOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { VehicleCreate } from '@renawi/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Flex } from 'antd';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { AutoDir } from '../../../shared/lib/bidi';
import { GeneratePdfDialog, usePdfTemplateName } from '../../documents/components/GeneratePdf';
import { consignmentPdfChoice } from '../../documents/pdf';
import { ReminderDialog } from '../../reminders/dialogs/ReminderDialog';
import type { ActionDef } from '../../../shared/ui/ActionBar';
import { AlertTags } from '../../../shared/ui/AlertTags';
import { DetailPageLayout } from '../../../shared/ui/DetailPageLayout';
import { FactChips } from '../../../shared/ui/FactChips';
import { KmText } from '../../../shared/ui/KmText';
import { LicenseTag } from '../../../shared/ui/LicenseTag';
import { Money } from '../../../shared/ui/Money';
import { PlateNo } from '../../../shared/ui/PlateNo';
import { StatusTag } from '../../../shared/ui/StatusTag';
import { TabLabel } from '../../../shared/ui/TabLabel';
import { ToneTag } from '../../../shared/ui/ToneTag';
import { YearText } from '../../../shared/ui/YearText';
import { EntityDocuments } from '../../documents/components/EntityDocuments';
import { driverPath } from '../../drivers/lib/driverRules';
import { fetchVehicle, updateVehicle } from '../api';
import { VehicleDealsTab } from '../components/VehicleDealsTab';
import { VehicleExpensesTab } from '../components/VehicleExpensesTab';
import { VehicleFinesTab } from '../components/VehicleFinesTab';
import { ConversionBlockers } from '../components/ConversionBlockers';
import { VehicleInfoTab } from '../components/VehicleInfoTab';
import { VehicleInsuranceTab } from '../components/VehicleInsuranceTab';
import { VehicleLeasesTab } from '../components/VehicleLeasesTab';
import { VehiclePnlTab } from '../components/VehiclePnlTab';
import { ConsignDialog } from '../dialogs/ConsignDialog';
import { ConversionCorrectionDialog } from '../dialogs/ConversionCorrectionDialog';
import { ConvertToPrivateDialog } from '../dialogs/ConvertToPrivateDialog';
import { ExpenseDialog } from '../dialogs/ExpenseDialog';
import { OdometerDialog } from '../dialogs/OdometerDialog';
import { ReturnCycleDialog } from '../dialogs/ReturnCycleDialog';
import { StatusDialog } from '../dialogs/StatusDialog';
import { VehicleForm } from '../forms/VehicleForm';
import { toVehicleUpdateBody } from '../forms/vehicleFormSchema';
import { canConsign, latestConversion, returnableCycle } from '../lib/vehicleRules';
import { vehicleKeys } from '../queryKeys';
import type { VehicleDetail } from '../types';

export type VehicleActionKey =
  | 'edit'
  | 'status'
  | 'consign'
  | 'return'
  | 'expense'
  | 'odometer'
  | 'consignmentPdf'
  | 'reminder'
  | 'convert'
  | 'correctConversion';

/** `/vehicles/:id`: header with actions, and the vehicle file in tabs. */
export function VehicleDetailPage() {
  const { id } = useParams();
  return <VehicleView key={id} id={id ?? ''} />;
}

type Dialog = Exclude<VehicleActionKey, 'edit'> | null;

function VehicleView({ id }: { id: string }) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const templateName = usePdfTemplateName();
  const [editing, setEditing] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);

  const query = useQuery({
    queryKey: vehicleKeys.detail(id),
    queryFn: ({ signal }) => fetchVehicle(id, signal),
    enabled: Boolean(id),
  });

  /** Refresh the vehicle, its sub-lists (they hang under the detail key) and the lists. */
  const refresh = () => queryClient.invalidateQueries({ queryKey: vehicleKeys.all });

  /**
   * Status change, consign, return and PATCH answer with the full vehicle file: put it in the
   * cache and refresh everything else about vehicles (lists, counts, the expense list).
   */
  const applyVehicle = (updated: VehicleDetail) => {
    const detailKey = vehicleKeys.detail(id);
    queryClient.setQueryData(detailKey, updated);
    return queryClient.invalidateQueries({
      queryKey: vehicleKeys.all,
      // Everything except the detail itself (its sub-lists are longer keys and do refresh).
      predicate: (q) =>
        q.queryKey.length !== detailKey.length ||
        detailKey.some((part, i) => q.queryKey[i] !== part),
    });
  };

  const update = useMutation({
    mutationFn: (values: VehicleCreate) => updateVehicle(id, toVehicleUpdateBody(values)),
    onSuccess: async (updated) => {
      await applyVehicle(updated);
      setEditing(false);
      void message.success(t('common.saved'));
    },
  });

  /** A dialog saved: close it, refresh, and confirm. */
  const saved = (text: ReactNode, updated?: VehicleDetail) => {
    setDialog(null);
    void (updated ? applyVehicle(updated) : refresh());
    void message.success(text);
  };

  /** Converted to private: close, refresh, and remind the user to upload the customs receipt. */
  const converted = (updated: VehicleDetail) => {
    saved(
      <span data-testid="convert-done">
        {t('vehicles.convert.done')}. {t('vehicles.convert.receiptHint')}{' '}
        <Button
          type="link"
          size="small"
          className="rm-inline-link"
          onClick={() => navigate('?tab=documents')}
        >
          {t('vehicles.convert.receiptAction')}
        </Button>
      </span>,
      updated,
    );
  };

  const section = { title: t('nav.vehicles'), to: '/vehicles' };
  if (query.isPending || query.isError) {
    return (
      <DetailPageLayout
        testId="vehicle"
        breadcrumbs={[section]}
        loading={query.isPending}
        error={query.error}
        errorTitle={t('vehicles.loadError')}
        notFoundTitle={t('vehicles.notFound')}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const vehicle = query.data;
  const v = vehicle;
  const returnCycle = returnableCycle(vehicle);
  const consignmentPdf = consignmentPdfChoice(vehicle.openCycle);
  const conversion = latestConversion(vehicle);

  const actions: ActionDef<VehicleActionKey>[] = [
    { key: 'edit', label: t('actions.edit'), icon: <EditOutlined /> },
    { key: 'status', label: t('vehicles.actions.changeStatus'), icon: <SwapOutlined /> },
    ...(canConsign(vehicle)
      ? [
          {
            key: 'consign' as const,
            label: t('vehicles.actions.consign'),
            icon: <SolutionOutlined />,
          },
        ]
      : []),
    ...(returnCycle
      ? [
          {
            key: 'return' as const,
            label: t('vehicles.actions.returnToConsignor'),
            icon: <RollbackOutlined className="rm-flip-rtl" />,
          },
        ]
      : []),
    ...(vehicle.isTaxi
      ? [
          {
            key: 'convert' as const,
            label: t('vehicles.actions.convertToPrivate'),
            icon: <CarOutlined />,
            disabled: vehicle.canConvert ? !vehicle.canConvert.allowed : false,
          },
        ]
      : []),
    { key: 'expense', label: t('vehicles.actions.addExpense'), icon: <PlusOutlined /> },
    { key: 'odometer', label: t('vehicles.actions.addOdometer'), icon: <DashboardOutlined /> },
    // The consignment agreement of the open consignment cycle.
    ...(consignmentPdf
      ? [
          {
            key: 'consignmentPdf' as const,
            label: templateName(consignmentPdf.template),
            icon: <FilePdfOutlined />,
          },
        ]
      : []),
    { key: 'reminder', label: t('reminders.manual.add'), icon: <BellOutlined /> },
  ];

  const onAction = (key: VehicleActionKey) => {
    if (key === 'edit') setEditing(true);
    else setDialog(key);
  };

  return (
    <DetailPageLayout
      testId="vehicle"
      breadcrumbs={[section, { title: <PlateNo value={v.plateNo} variant="text" /> }]}
      title={
        <Flex gap={12} align="center" wrap component="span" className="rm-vehicle-title">
          <PlateNo value={v.plateNo} className="rm-plate-lg" />
          <span>
            <AutoDir>{`${v.make} ${v.model}`}</AutoDir> <YearText value={v.year} />
          </span>
        </Flex>
      }
      tags={
        <>
          <StatusTag enumName="VehicleStatus" value={v.status} />
          <StatusTag enumName="VehicleOwnership" value={v.ownership} />
          {v.isTaxi && <ToneTag tone="accent">{t('vehicles.taxi')}</ToneTag>}
          {v.formerTaxi && (
            <ToneTag tone="neutral" data-testid="former-taxi-tag">
              {t('vehicles.formerTaxi')}
            </ToneTag>
          )}
          <AlertTags enumName="VehicleAlert" alerts={v.alerts} hideEmpty />
        </>
      }
      actions={
        editing
          ? null
          : {
              actions,
              onAction,
              menuLabel: t('vehicles.actions.menu'),
              testIdPrefix: 'vehicle-action',
            }
      }
      facts={
        !editing && (
          <FactChips
            facts={[
              {
                key: 'km',
                icon: <DashboardOutlined />,
                label: t('vehicles.fields.currentKm'),
                value: <KmText value={v.currentKm} />,
              },
              Boolean(v.formerTaxiPlateNo) && {
                key: 'formerTaxiPlate',
                icon: <CarOutlined />,
                label: t('vehicles.taxiPlate'),
                value: <PlateNo value={v.formerTaxiPlateNo} />,
              },
              v.listingPrice !== null && {
                key: 'listingPrice',
                icon: <DollarOutlined />,
                label: v.isTaxi ? t('vehicles.priceAsTaxi') : t('vehicles.fields.listingPrice'),
                value: <Money amount={v.listingPrice} decimals={false} />,
              },
              v.registeredLicense && {
                key: 'license',
                icon: <SafetyCertificateOutlined />,
                label: t('vehicles.fields.registeredLicense'),
                value: (
                  <LicenseTag
                    licenseNo={v.registeredLicense.licenseNo}
                    id={v.registeredLicense.id}
                  />
                ),
              },
              v.ownerDriver && {
                key: 'owner',
                icon: <UserOutlined />,
                label: t('vehicles.fields.ownerDriver'),
                value: (
                  <Link to={driverPath(v.ownerDriver.id)}>
                    <AutoDir>{v.ownerDriver.name}</AutoDir>
                  </Link>
                ),
              },
            ]}
          />
        )
      }
      tabs={
        editing
          ? null
          : [
              {
                key: 'info',
                label: t('vehicles.detailTabs.info'),
                children: (
                  <VehicleInfoTab
                    vehicle={vehicle}
                    onAddOdometer={() => setDialog('odometer')}
                    onCorrectConversion={() => setDialog('correctConversion')}
                  />
                ),
              },
              {
                key: 'expenses',
                label: t('vehicles.detailTabs.expenses'),
                children: (
                  <VehicleExpensesTab
                    vehicleId={vehicle.id}
                    isTaxi={vehicle.isTaxi}
                    onAdd={() => setDialog('expense')}
                    onChanged={() => void refresh()}
                  />
                ),
              },
              {
                key: 'insurance',
                label: t('vehicles.detailTabs.insurance'),
                children: (
                  <VehicleInsuranceTab vehicle={vehicle} onChanged={() => void refresh()} />
                ),
              },
              {
                key: 'documents',
                label: (
                  <TabLabel
                    label={t('vehicles.detailTabs.documents')}
                    count={vehicle.documentCount}
                  />
                ),
                children: (
                  <EntityDocuments
                    owner={{ vehicleId: vehicle.id }}
                    onChange={() => void refresh()}
                  />
                ),
              },
              {
                key: 'deals',
                label: t('vehicles.detailTabs.deals'),
                children: <VehicleDealsTab vehicle={vehicle} />,
              },
              {
                key: 'leases',
                label: t('vehicles.detailTabs.leases'),
                children: <VehicleLeasesTab vehicleId={vehicle.id} />,
              },
              {
                key: 'fines',
                label: t('vehicles.detailTabs.fines'),
                children: <VehicleFinesTab vehicleId={vehicle.id} />,
              },
              {
                key: 'pnl',
                label: t('vehicles.detailTabs.pnl'),
                children: <VehiclePnlTab vehicleId={vehicle.id} />,
              },
            ]
      }
    >
      {!editing && vehicle.isTaxi && <ConversionBlockers vehicle={vehicle} />}

      {!editing &&
        vehicle.ownership === 'CONSIGNED' &&
        vehicle.status === 'IN_STOCK' &&
        canConsign(vehicle) && (
          <Alert
            type="info"
            showIcon
            title={t('vehicles.cycles.noAgreement')}
            action={
              <Button size="small" onClick={() => setDialog('consign')}>
                {t('vehicles.actions.consign')}
              </Button>
            }
          />
        )}

      {editing && (
        <VehicleForm
          vehicle={vehicle}
          onSubmit={(values) => update.mutateAsync(values)}
          submitting={update.isPending}
          onCancel={() => setEditing(false)}
        />
      )}

      {dialog === 'status' && (
        <StatusDialog
          vehicleId={vehicle.id}
          status={vehicle.status}
          onClose={() => setDialog(null)}
          onSaved={(updated) => saved(t('vehicles.status.changed'), updated)}
        />
      )}
      {dialog === 'convert' && vehicle.isTaxi && (
        <ConvertToPrivateDialog
          vehicle={vehicle}
          onClose={() => setDialog(null)}
          onSaved={converted}
        />
      )}
      {dialog === 'correctConversion' && conversion && (
        <ConversionCorrectionDialog
          vehicleId={vehicle.id}
          change={conversion}
          onClose={() => setDialog(null)}
          onSaved={(updated) => saved(t('vehicles.convert.corrected'), updated)}
        />
      )}
      {dialog === 'consign' && (
        <ConsignDialog
          vehicleId={vehicle.id}
          listingPrice={vehicle.listingPrice}
          onClose={() => setDialog(null)}
          onSaved={(updated) => saved(t('vehicles.cycles.consigned'), updated)}
        />
      )}
      {dialog === 'return' && returnCycle && (
        <ReturnCycleDialog
          cycleId={returnCycle.id}
          onClose={() => setDialog(null)}
          onSaved={(updated) => saved(t('vehicles.cycles.returned'), updated)}
        />
      )}
      {dialog === 'expense' && (
        <ExpenseDialog
          vehicleId={vehicle.id}
          onClose={() => setDialog(null)}
          onSaved={() => saved(t('vehicles.expenses.added'))}
        />
      )}
      {dialog === 'consignmentPdf' && consignmentPdf && (
        <GeneratePdfDialog
          choices={[consignmentPdf]}
          onClose={() => setDialog(null)}
          onGenerated={() => void refresh()}
        />
      )}
      {dialog === 'reminder' && (
        <ReminderDialog
          entityType="VEHICLE"
          entityId={vehicle.id}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'odometer' && (
        <OdometerDialog
          vehicleId={vehicle.id}
          currentKm={vehicle.currentKm}
          onClose={() => setDialog(null)}
          onSaved={() => saved(t('vehicles.odometer.added'))}
        />
      )}
    </DetailPageLayout>
  );
}
