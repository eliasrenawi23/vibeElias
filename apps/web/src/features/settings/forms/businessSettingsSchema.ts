import { percent, SettingsSchema, type SettingsResponse } from '@renawi/shared';
import type { z } from 'zod';

/**
 * The "Business details" part of `SettingsSchema`. `vatRate` drops the schema default so that
 * clearing the field is a validation error instead of silently saving 18.
 */
export const BusinessSettingsFormSchema = SettingsSchema.pick({
  businessName: true,
  legalId: true,
  dealerLicenseNo: true,
  address: true,
  phone: true,
  email: true,
}).extend({ vatRate: percent });

export type BusinessSettingsFormInput = z.input<typeof BusinessSettingsFormSchema>;
export type BusinessSettingsFormOutput = z.output<typeof BusinessSettingsFormSchema>;

/** Settings from the API to form values (null becomes '' so inputs stay controlled). */
export function toBusinessFormValues(settings: SettingsResponse): BusinessSettingsFormInput {
  return {
    businessName: { ...settings.businessName },
    legalId: settings.legalId ?? '',
    dealerLicenseNo: settings.dealerLicenseNo ?? '',
    address: settings.address ?? '',
    phone: settings.phone ?? '',
    email: settings.email ?? '',
    vatRate: settings.vatRate,
  };
}
