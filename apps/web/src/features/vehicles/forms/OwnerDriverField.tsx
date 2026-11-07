import { useQueryClient } from '@tanstack/react-query';
import { Typography } from 'antd';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useController, type Control } from 'react-hook-form';
import { isolateAuto } from '../../../shared/lib/bidi';
import { FieldShell } from '../../../shared/ui/FieldShell';
import { fetchContact } from '../../contacts/api';
import { ContactPicker } from '../../contacts/components/ContactPicker';
import { contactKeys } from '../../contacts/queryKeys';
import type { Contact } from '../../contacts/types';
import type { NamedRef } from '../types';
import type { VehicleFormInput, VehicleFormOutput } from './vehicleFormSchema';

/** Milestone that brings driver profiles (`GET /drivers`). */
const DRIVERS_MILESTONE = 3;

export interface OwnerDriverFieldProps {
  control: Control<VehicleFormInput, unknown, VehicleFormOutput>;
  /** The stored owner (edit mode). */
  current?: NamedRef | null;
}

/**
 * `ownerDriverId` of a THIRD_PARTY vehicle. Drivers are picked as contacts tagged DRIVER; the
 * field takes the contact's driver profile id. A contact without a profile cannot be chosen yet
 * (profiles arrive with the drivers module) and the field explains why.
 */
export function OwnerDriverField({ control, current }: OwnerDriverFieldProps) {
  const { t } = useTranslation();
  const id = useId();
  const queryClient = useQueryClient();
  const { field, fieldState } = useController({ control, name: 'ownerDriverId' });
  const [contactId, setContactId] = useState<string | null>(null);
  const [noProfile, setNoProfile] = useState(false);

  const pick = async (pickedId: string | null, contact: Contact | null) => {
    setContactId(pickedId);
    setNoProfile(false);
    if (!pickedId) {
      field.onChange(current?.id ?? null);
      return;
    }
    let driver = contact?.driver;
    if (driver === undefined) {
      try {
        const detail = await queryClient.fetchQuery({
          queryKey: contactKeys.detail(pickedId),
          queryFn: ({ signal }) => fetchContact(pickedId, signal),
        });
        driver = detail.driver;
      } catch {
        driver = null;
      }
    }
    if (driver) {
      field.onChange(driver.id);
    } else {
      field.onChange(null);
      setNoProfile(true);
    }
  };

  const help = noProfile ? (
    <Typography.Text type="warning">
      {t('vehicles.form.ownerDriverNoProfile', { n: DRIVERS_MILESTONE })}
    </Typography.Text>
  ) : current && field.value === current.id && !contactId ? (
    t('vehicles.form.ownerDriverCurrent', { name: isolateAuto(current.name) })
  ) : (
    t('vehicles.form.ownerDriverHint')
  );

  return (
    <FieldShell
      id={id}
      label={t('vehicles.fields.ownerDriver')}
      required
      help={help}
      error={fieldState.error}
    >
      <ContactPicker
        id={id}
        tag="DRIVER"
        value={contactId}
        onChange={(value, contact) => void pick(value, contact)}
        onBlur={field.onBlur}
        status={fieldState.error ? 'error' : undefined}
      />
    </FieldShell>
  );
}
