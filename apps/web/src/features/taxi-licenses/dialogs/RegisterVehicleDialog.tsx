import { useMutation } from '@tanstack/react-query';
import { Alert, Form, Modal } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useErrorMessage } from '../../../shared/lib/i18n';
import { PlateNo } from '../../../shared/ui/PlateNo';
import { VehiclePicker } from '../../vehicles/components/VehiclePicker';
import { registerVehicle } from '../api';
import type { TaxiLicenseDetail } from '../types';

export interface RegisterVehicleDialogProps {
  license: TaxiLicenseDetail;
  onClose: () => void;
  onSaved: (license: TaxiLicenseDetail) => void;
}

/**
 * The car registered under the licence at the Ministry of Transport (assignment form, meter
 * resealed). Taxis over the age limit cannot be chosen; clearing the field detaches the car.
 */
export function RegisterVehicleDialog({ license, onClose, onSaved }: RegisterVehicleDialogProps) {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const current = license.registeredVehicle;
  const [vehicleId, setVehicleId] = useState<string | null>(current?.id ?? null);
  const mutation = useMutation({
    mutationFn: (id: string | null) => registerVehicle(license.id, id),
    onSuccess: onSaved,
  });
  const unchanged = vehicleId === (current?.id ?? null);
  const detaching = !vehicleId && Boolean(current);

  return (
    <Modal
      open
      title={t('taxiLicenses.register.title')}
      onCancel={onClose}
      onOk={() => mutation.mutate(vehicleId)}
      okText={detaching ? t('taxiLicenses.register.detach') : t('taxiLicenses.register.submit')}
      okButtonProps={{ loading: mutation.isPending, disabled: unchanged, danger: detaching }}
      cancelText={t('actions.cancel')}
      destroyOnHidden
      data-testid="register-vehicle-dialog"
    >
      {mutation.isError && (
        <Alert
          type="error"
          showIcon
          title={errorMessage(mutation.error)}
          className="rm-dialog-error"
        />
      )}
      <Alert
        type="info"
        showIcon
        className="rm-dialog-note"
        title={t('taxiLicenses.register.hint')}
      />
      {current && (
        <p>
          {t('taxiLicenses.register.current')}: <PlateNo value={current.plateNo} />
        </p>
      )}
      <Form layout="vertical" component={false}>
        <Form.Item
          label={t('taxiLicenses.register.vehicle')}
          help={t('taxiLicenses.register.clearHelp')}
        >
          <VehiclePicker
            value={vehicleId}
            onChange={(id) => setVehicleId(id)}
            filters={{ isTaxi: true }}
            isDisabled={(v) => v.alerts?.includes('taxiAgeBlocked') ?? false}
            aria-label={t('taxiLicenses.register.vehicle')}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
