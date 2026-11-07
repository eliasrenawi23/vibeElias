import { ContactCreateSchema, formatPhone, msg } from '@renawi/shared';
import { z } from 'zod';
import type { Contact } from '../types';

const base = ContactCreateSchema.innerType();

/**
 * `ContactCreateSchema` for the form: blank phone rows are dropped before validation, and the
 * "a name is required" error is shown on both the first-name and the company-name field (only
 * one of them is visible, depending on the person / company toggle).
 */
export const ContactFormSchema = base
  .extend({
    phones: z
      .array(z.string())
      .transform((list) => list.map((p) => p.trim()).filter(Boolean))
      .pipe(base.shape.phones),
  })
  .superRefine((v, ctx) => {
    if (!v.firstName && !v.lastName && !v.companyName) {
      for (const path of ['firstName', 'companyName']) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message: msg.nameRequired });
      }
    }
  });

export type ContactFormInput = z.input<typeof ContactFormSchema>;
export type ContactFormOutput = z.output<typeof ContactFormSchema>;

/** API contact (or nothing, for a new one) to form values; nulls become '' for the inputs. */
export function toContactFormValues(c?: Contact | null): ContactFormInput {
  return {
    tags: c?.tags ?? [],
    firstName: c?.firstName ?? '',
    lastName: c?.lastName ?? '',
    companyName: c?.companyName ?? '',
    idNumber: c?.idNumber ?? '',
    phones: c?.phones.length ? c.phones.map((p) => formatPhone(p)) : [''],
    email: c?.email ?? '',
    address: c?.address ?? '',
    city: c?.city ?? '',
    preferredLang: c?.preferredLang ?? 'he',
    source: c?.source ?? '',
    notes: c?.notes ?? '',
    followUpAt: c?.followUpAt ?? null,
  };
}
