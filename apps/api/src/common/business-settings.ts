import { Prisma } from '@prisma/client';
import {
  DEFAULT_LEASE_TERMS,
  DEFAULT_VAT_RATE,
  DEFAULT_REMINDER_LEAD_DAYS,
  DefaultLeaseTermsSchema,
  ReminderLeadDaysSchema,
  type ReminderLeadDays,
  type Responsibilities,
} from '@renawi/shared';

type Reader = Pick<Prisma.TransactionClient, 'settings'>;

/** `Settings.reminderLeadDays` (defaults when the row does not exist yet or is malformed). */
export async function readLeadDays(prisma: Reader): Promise<ReminderLeadDays> {
  const row = await prisma.settings.findUnique({
    where: { id: 1 },
    select: { reminderLeadDays: true },
  });
  const parsed = ReminderLeadDaysSchema.safeParse(row?.reminderLeadDays ?? {});
  return parsed.success ? parsed.data : { ...DEFAULT_REMINDER_LEAD_DAYS };
}

/** `Settings.vatRate` (percent; 18 when the row does not exist yet). Read-only. */
export async function readVatRate(prisma: Reader): Promise<Prisma.Decimal> {
  const row = await prisma.settings.findUnique({ where: { id: 1 }, select: { vatRate: true } });
  return row?.vatRate ?? new Prisma.Decimal(DEFAULT_VAT_RATE);
}

/** `Settings.defaultLeaseTerms.responsibilities` (default: the driver pays everything). */
export async function readDefaultResponsibilities(prisma: Reader): Promise<Responsibilities> {
  const row = await prisma.settings.findUnique({
    where: { id: 1 },
    select: { defaultLeaseTerms: true },
  });
  const parsed = DefaultLeaseTermsSchema.safeParse(row?.defaultLeaseTerms ?? {});
  return parsed.success
    ? parsed.data.responsibilities
    : { ...DEFAULT_LEASE_TERMS.responsibilities };
}

/** Expiry alert for a date: `expired` before today, `expiring` within `leadDays`, else null. */
export function expiryState(
  date: string | null,
  today: string,
  horizon: string,
): 'expired' | 'expiring' | null {
  if (!date) return null;
  if (date < today) return 'expired';
  if (date <= horizon) return 'expiring';
  return null;
}
