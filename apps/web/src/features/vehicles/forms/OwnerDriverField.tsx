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
  /** The picked contact has no driver profile (the form cannot be saved). */
  noProfile: boolean;
  onNoProfileChange: (noProfile: boolean) => void;
}

/**
 * `ownerDriverId` of a THIRD_PARTY vehicle. Drivers are picked as contacts tagged DRIVER; the
 * field takes the contact's driver profile id. A contact without a profile cannot be chosen yet
 * (profiles arrive with the drivers module): the field explains why and the form blocks saving.
 */
export function OwnerDriverField({
  control,
  current,
  noProfile,
  onNoProfileChange,
}: OwnerDriverFieldProps) {
  const { t } = useTranslation();
  const id = useId();
  const queryClient = useQueryClient();
  const { field, fieldState } = useController({ control, name: 'ownerDriverId' });
  const [contactId, setContactId] = useState<string | null>(null);

  const pick = async (pickedId: string | null, contact: Contact | null) => {
    setContactId(pickedId);
    onNoProfileChange(false);
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
      onNoProfileChange(true);
    }
  };

  const help =
    noProfile && contactId ? (
      <Typography.Text type="warning" data-testid="owner-driver-no-profile">
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
      error={noProfile && contactId ? undefined : fieldState.error}
    >
      <div data-testid="owner-driver-field">
        <ContactPicker
          id={id}
          tag="DRIVER"
          value={contactId}
          onChange={(value, contact) => void pick(value, contact)}
          onBlur={field.onBlur}
          status={fieldState.error || (noProfile && contactId) ? 'error' : undefined}
        />
      </div>
    </FieldShell>
  );
}
