import { DollarOutlined } from '@ant-design/icons';
import { FineStatus } from '@renawi/shared';
import { useMutation } from '@tanstack/react-query';
import {
  Alert,
  App,
  Button,
  Descriptions,
  Divider,
  Drawer,
  Flex,
  Form,
  Select,
  Typography,
} from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { AutoDir, Ltr } from '../../../shared/lib/bidi';
import { useEnumOptions } from '../../../shared/lib/enums';
import { useErrorMessage } from '../../../shared/lib/i18n';
import { AlertTags } from '../../../shared/ui/AlertTags';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog';
import { DateText } from '../../../shared/ui/DateText';
import { DateTimeText } from '../../../shared/ui/DateTimeText';
import { LifecycleSteps } from '../../../shared/ui/LifecycleSteps';
import { Money } from '../../../shared/ui/Money';
import { PlateNo } from '../../../shared/ui/PlateNo';
import { StatusTag } from '../../../shared/ui/StatusTag';
import { ToneTag } from '../../../shared/ui/ToneTag';
import { DESCRIPTION_COLUMNS_SINGLE } from '../../../shared/ui/descriptionColumns';
import { DriverPicker } from '../../drivers/components/DriverPicker';
import { rebillFine, updateFine, type FineUpdateBody } from '../api';
import type { TrafficFine } from '../types';

export interface FineDrawerProps {
  fine: TrafficFine;
  onClose: () => void;
  /** Every action answers with the updated fine. */
  onSaved: (fine: TrafficFine) => void;
}

/** Fine details, status change, driver override and "rebill to the driver". */
export function FineDrawer({ fine, onClose, onSaved }: FineDrawerProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const errorMessage = useErrorMessage();
  const statusOptions = useEnumOptions('FineStatus', FineStatus.options);
  const [status, setStatus] = useState<FineStatus>(fine.status);
  const [driverId, setDriverId] = useState<string | null>(fine.driverId);
  const [confirmRebill, setConfirmRebill] = useState(false);
  const [prevFine, setPrevFine] = useState(fine);
  if (fine !== prevFine) {
    setPrevFine(fine);
    setStatus(fine.status);
    setDriverId(fine.driverId);
  }

  const update = useMutation({
    mutationFn: (body: FineUpdateBody) => updateFine(fine.id, body),
    onSuccess: (updated) => {
      onSaved(updated);
      void message.success(t('common.saved'));
    },
  });
  const rebill = useMutation({
    mutationFn: () => rebillFine(fine.id, {}),
    onSuccess: (updated) => {
      setConfirmRebill(false);
      onSaved(updated);
      void message.success(t('fines.rebilled'));
    },
    onError: () => setConfirmRebill(false),
  });
  const error = update.error ?? rebill.error;
  const rebilled = Boolean(fine.chargeEntryId);
  const empty = <span className="rm-empty-value">—</span>;

  return (
    <Drawer
      open
      onClose={onClose}
      title={
        <Flex gap={8} align="center">
          {t('fines.drawerTitle')} <PlateNo value={fine.vehicle?.plateNo} />
        </Flex>
      }
      size={480}
      destroyOnHidden
      data-testid="fine-drawer"
    >
      <Flex vertical gap={12}>
        {error && <Alert type="error" showIcon title={errorMessage(error)} />}
        <LifecycleSteps lifecycle="fine" status={fine.status} labelsBelow />
        <Descriptions
          size="small"
          column={DESCRIPTION_COLUMNS_SINGLE}
          bordered
          items={[
            {
              key: 'vehicle',
              label: t('fines.fields.vehicle'),
              children: (
                <Link
                  to={`/vehicles/${encodeURIComponent(fine.vehicleId)}`}
                  aria-label={fine.vehicle?.plateNo}
                >
                  <PlateNo value={fine.vehicle?.plateNo} />
                </Link>
              ),
            },
            {
              key: 'offence',
              label: t('fines.fields.offenceAt'),
              children: <DateTimeText value={fine.offenceAt} />,
            },
            {
              key: 'received',
              label: t('fines.fields.receivedAt'),
              children: <DateText value={fine.receivedAt} />,
            },
            {
              key: 'amount',
              label: t('fines.fields.amount'),
              children: <Money amount={fine.amount} />,
            },
            {
              key: 'fineNo',
              label: t('fines.fields.fineNo'),
              children: fine.fineNo ? <Ltr>{fine.fineNo}</Ltr> : empty,
            },
            {
              key: 'authority',
              label: t('fines.fields.authority'),
              children: fine.authority ? <AutoDir>{fine.authority}</AutoDir> : empty,
            },
            {
              key: 'status',
              label: t('common.status'),
              children: <StatusTag enumName="FineStatus" value={fine.status} />,
            },
            {
              key: 'deadline',
              label: t('fines.fields.reassignDeadline'),
              children: (
                <Flex gap={6} wrap align="center">
                  <DateText value={fine.reassignDeadline} />
                  <AlertTags enumName="FineAlert" alerts={fine.alerts} hideEmpty />
                </Flex>
              ),
            },
            {
              key: 'driver',
              label: t('fines.fields.driver'),
              children: fine.driver ? (
                <Link to={`/drivers/${encodeURIComponent(fine.driver.id)}`}>
                  <AutoDir>{fine.driver.name}</AutoDir>
                </Link>
              ) : (
                <Typography.Text type="warning">{t('fines.noDriver')}</Typography.Text>
              ),
            },
            ...(fine.contractId
              ? [
                  {
                    key: 'contract',
                    label: t('fines.fields.contract'),
                    children: (
                      <Link to={`/leases/${encodeURIComponent(fine.contractId)}`}>
                        {t('fines.openContract')}
                      </Link>
                    ),
                  },
                ]
              : []),
            {
              key: 'rebilled',
              label: t('fines.fields.rebilled'),
              children: rebilled ? (
                <ToneTag tone="success">{t('fines.rebilledTag')}</ToneTag>
              ) : (
                empty
              ),
            },
            {
              key: 'notes',
              label: t('common.notes'),
              children: fine.notes ? (
                <Typography.Paragraph className="rm-pre-wrap" dir="auto">
                  {fine.notes}
                </Typography.Paragraph>
              ) : (
                empty
              ),
            },
          ]}
        />

        <Divider className="rm-drawer-divider" />
        <Form layout="vertical" component={false}>
          <Form.Item label={t('fines.changeStatus')}>
            <Flex gap={8}>
              <Select<FineStatus>
                value={status}
                onChange={setStatus}
                options={statusOptions}
                className="rm-grow"
                aria-label={t('fines.changeStatus')}
                data-testid="fine-status"
              />
              <Button
                onClick={() => update.mutate({ status })}
                disabled={status === fine.status}
                loading={update.isPending && update.variables?.status !== undefined}
                data-testid="fine-status-save"
              >
                {t('actions.save')}
              </Button>
            </Flex>
          </Form.Item>
          <Form.Item label={t('fines.overrideDriver')} help={t('fines.overrideDriverHelp')}>
            <Flex gap={8}>
              <div className="rm-grow">
                <DriverPicker
                  value={driverId}
                  onChange={(id) => setDriverId(id)}
                  activeOnly={false}
                  aria-label={t('fines.overrideDriver')}
                  data-testid="fine-driver"
                />
              </div>
              <Button
                onClick={() => update.mutate({ driverId })}
                disabled={driverId === fine.driverId}
                loading={update.isPending && update.variables?.driverId !== undefined}
                data-testid="fine-driver-save"
              >
                {t('actions.save')}
              </Button>
            </Flex>
          </Form.Item>
        </Form>
        <Button
          type="primary"
          icon={<DollarOutlined />}
          disabled={!fine.driverId || rebilled}
          onClick={() => setConfirmRebill(true)}
          data-testid="fine-rebill"
        >
          {t('fines.rebill')}
        </Button>
        {!fine.driverId && (
          <Typography.Text type="secondary">{t('fines.rebillNeedsDriver')}</Typography.Text>
        )}
      </Flex>
      <ConfirmDialog
        open={confirmRebill}
        title={t('fines.rebill')}
        content={t('fines.rebillConfirm')}
        confirmText={t('fines.rebill')}
        loading={rebill.isPending}
        onConfirm={() => rebill.mutate()}
        onCancel={() => setConfirmRebill(false)}
      />
    </Drawer>
  );
}
