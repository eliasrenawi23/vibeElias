import type { VehicleCreate } from '@renawi/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Badge, Button, Card, Flex, Skeleton, Tabs, Tag } from 'antd';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router';
import { AutoDir } from '../../../shared/lib/bidi';
import { useEnumLabel } from '../../../shared/lib/enums';
import { LicenseTag } from '../../../shared/ui/LicenseTag';
import { LoadError } from '../../../shared/ui/LoadError';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { PlaceholderPage } from '../../../shared/ui/PlaceholderPage';
import { PlateNo } from '../../../shared/ui/PlateNo';
import { StatusTag } from '../../../shared/ui/StatusTag';
import { YearText } from '../../../shared/ui/YearText';
import { EntityDocuments } from '../../documents/components/EntityDocuments';
import { fetchVehicle, updateVehicle } from '../api';
import { AlertBadges } from '../components/AlertBadges';
import { VehicleActions, type VehicleActionKey } from '../components/VehicleActions';
import { VehicleExpensesTab } from '../components/VehicleExpensesTab';
import { VehicleFinesTab } from '../components/VehicleFinesTab';
import { VehicleInfoTab } from '../components/VehicleInfoTab';
import { VehicleInsuranceTab } from '../components/VehicleInsuranceTab';
import { VehicleLeasesTab } from '../components/VehicleLeasesTab';
import { VehiclesBackLink } from '../components/VehiclesBackLink';
import { ConsignDialog } from '../dialogs/ConsignDialog';
import { ExpenseDialog } from '../dialogs/ExpenseDialog';
import { OdometerDialog } from '../dialogs/OdometerDialog';
import { ReturnCycleDialog } from '../dialogs/ReturnCycleDialog';
import { StatusDialog } from '../dialogs/StatusDialog';
import { VehicleForm } from '../forms/VehicleForm';
import { toVehicleUpdateBody } from '../forms/vehicleFormSchema';
import { canConsign, returnableCycle } from '../lib/vehicleRules';
import { vehicleKeys } from '../queryKeys';
import type { VehicleDetail } from '../types';

const TAB_KEYS = [
  'info',
  'expenses',
  'insurance',
  'documents',
  'deals',
  'leases',
  'fines',
  'pnl',
] as const;
type VehicleTab = (typeof TAB_KEYS)[number];

function isTab(value: string | null): value is VehicleTab {
  return TAB_KEYS.includes(value as VehicleTab);
}

/** Milestone that delivers the placeholder tabs (see the plan). */
const DEALS_MILESTONE = 4;

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
  const [params, setParams] = useSearchParams();
  const rawTab = params.get('tab');
  const tab: VehicleTab = isTab(rawTab) ? rawTab : 'info';
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
  const saved = (text: string, updated?: VehicleDetail) => {
    setDialog(null);
    void (updated ? applyVehicle(updated) : refresh());
    void message.success(text);
  };

  if (query.isPending) {
    return (
      <Card variant="borderless">
        <Skeleton active paragraph={{ rows: 8 }} />
      </Card>
    );
  }
  if (query.isError) {
    return (
      <LoadError
        error={query.error}
        title={t('vehicles.loadError')}
        notFoundTitle={t('vehicles.notFound')}
        onRetry={() => void query.refetch()}
        extra={<VehiclesBackLink />}
      />
    );
  }

  const vehicle = query.data;
  const returnCycle = returnableCycle(vehicle);

  const onAction = (key: VehicleActionKey) => {
    if (key === 'edit') setEditing(true);
    else setDialog(key);
  };

  return (
    <Flex vertical gap={16} className="rm-vehicle-page" data-testid="vehicle-detail">
      <VehiclesBackLink />
      <VehicleHeader
        vehicle={vehicle}
        actions={!editing && <VehicleActions vehicle={vehicle} onAction={onAction} />}
      />

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

      {editing ? (
        <VehicleForm
          vehicle={vehicle}
          onSubmit={(values) => update.mutateAsync(values)}
          submitting={update.isPending}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <Tabs
          className="rm-detail-tabs"
          // Tabs that do not fit (phones) go to the overflow menu; it opens on tap, not hover.
          more={{ trigger: ['click'] }}
          activeKey={tab}
          // Each tab keeps its own filters in the URL: switching starts from a clean URL.
          onChange={(key) => setParams(key === 'info' ? {} : { tab: key }, { replace: true })}
          destroyOnHidden
          items={[
            {
              key: 'info',
              label: t('vehicles.detailTabs.info'),
              children: (
                <VehicleInfoTab vehicle={vehicle} onAddOdometer={() => setDialog('odometer')} />
              ),
            },
            {
              key: 'expenses',
              label: t('vehicles.detailTabs.expenses'),
              children: (
                <VehicleExpensesTab
                  vehicleId={vehicle.id}
                  onAdd={() => setDialog('expense')}
                  onChanged={() => void refresh()}
                />
              ),
            },
            {
              key: 'insurance',
              label: t('vehicles.detailTabs.insurance'),
              children: <VehicleInsuranceTab vehicle={vehicle} onChanged={() => void refresh()} />,
            },
            {
              key: 'documents',
              label: (
                <Flex gap={6} align="center">
                  {t('vehicles.detailTabs.documents')}
                  {vehicle.documentCount > 0 && (
                    <Badge count={vehicle.documentCount} size="small" color="gray" />
                  )}
                </Flex>
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
              children: (
                <PlaceholderPage
                  descriptionKey="placeholder.vehicleDeals"
                  milestone={DEALS_MILESTONE}
                />
              ),
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
              children: (
                <PlaceholderPage
                  descriptionKey="placeholder.vehiclePnl"
                  milestone={DEALS_MILESTONE}
                />
              ),
            },
          ]}
        />
      )}

      {dialog === 'status' && (
        <StatusDialog
          vehicleId={vehicle.id}
          status={vehicle.status}
          onClose={() => setDialog(null)}
          onSaved={(v) => saved(t('vehicles.status.changed'), v)}
        />
      )}
      {dialog === 'consign' && (
        <ConsignDialog
          vehicleId={vehicle.id}
          listingPrice={vehicle.listingPrice}
          onClose={() => setDialog(null)}
          onSaved={(v) => saved(t('vehicles.cycles.consigned'), v)}
        />
      )}
      {dialog === 'return' && returnCycle && (
        <ReturnCycleDialog
          cycleId={returnCycle.id}
          onClose={() => setDialog(null)}
          onSaved={(v) => saved(t('vehicles.cycles.returned'), v)}
        />
      )}
      {dialog === 'expense' && (
        <ExpenseDialog
          vehicleId={vehicle.id}
          onClose={() => setDialog(null)}
          onSaved={() => saved(t('vehicles.expenses.added'))}
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
    </Flex>
  );
}

interface VehicleHeaderProps {
  vehicle: VehicleDetail;
  actions?: ReactNode;
}

/** Plate, make / model / year, then status, ownership, taxi and alert tags. */
function VehicleHeader({ vehicle: v, actions }: VehicleHeaderProps) {
  const { t } = useTranslation();
  const enumLabel = useEnumLabel();
  return (
    <Flex vertical gap={8}>
      <PageHeader
        title={
          <Flex gap={12} align="center" wrap component="span" className="rm-vehicle-title">
            <PlateNo value={v.plateNo} className="rm-plate-lg" />
            <span>
              <AutoDir>{`${v.make} ${v.model}`}</AutoDir> <YearText value={v.year} />
            </span>
          </Flex>
        }
        extra={actions}
      />
      <Flex gap={6} wrap align="center" data-testid="vehicle-tags">
        <StatusTag enumName="VehicleStatus" value={v.status} />
        <Tag>{enumLabel('VehicleOwnership', v.ownership)}</Tag>
        {v.isTaxi && <Tag color="gold">{t('vehicles.taxi')}</Tag>}
        {v.registeredLicense && (
          <LicenseTag licenseNo={v.registeredLicense.licenseNo} id={v.registeredLicense.id} />
        )}
        <AlertBadges alerts={v.alerts} hideEmpty />
      </Flex>
    </Flex>
  );
}
