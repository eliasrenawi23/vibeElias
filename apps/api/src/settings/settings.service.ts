import { Injectable } from '@nestjs/common';
import { Prisma, Settings as SettingsRow } from '@prisma/client';
import {
  BusinessNameSchema,
  DEFAULT_SETTINGS,
  DefaultLeaseTermsSchema,
  ReminderLeadDaysSchema,
  type Settings,
  type SettingsUpdate,
} from '@renawi/shared';
import { PrismaService } from '../prisma/prisma.service';

export const SETTINGS_ID = 1;

/**
 * `GET /settings` payload before wire serialisation: `vatRate` is a `Prisma.Decimal` and
 * `updatedAt` a `Date`; the global interceptor turns them into a number and an ISO string,
 * matching the shared `SettingsResponseSchema`.
 */
export type SettingsView = Omit<Settings, 'vatRate'> & {
  vatRate: Prisma.Decimal;
  logoDocumentId: string | null;
  updatedAt: Date;
};

/** Defaults for the singleton row (business name, VAT 18, lead days, lease terms). */
function defaultRowData(): Prisma.SettingsCreateInput {
  return {
    id: SETTINGS_ID,
    businessName: { ...DEFAULT_SETTINGS.businessName },
    vatRate: new Prisma.Decimal(DEFAULT_SETTINGS.vatRate),
    reminderLeadDays: { ...DEFAULT_SETTINGS.reminderLeadDays },
    defaultLeaseTerms: {
      responsibilities: { ...DEFAULT_SETTINGS.defaultLeaseTerms.responsibilities },
      clauses: { ...DEFAULT_SETTINGS.defaultLeaseTerms.clauses },
    },
  };
}

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<SettingsView> {
    const row = await this.prisma.settings.upsert({
      where: { id: SETTINGS_ID },
      create: defaultRowData(),
      update: {},
    });
    return this.toView(row);
  }

  /** Partial update; nested JSON objects (businessName, lead days, lease terms) replace whole. */
  async update(dto: SettingsUpdate): Promise<SettingsView> {
    const data: Prisma.SettingsUpdateInput = {
      businessName: dto.businessName,
      legalId: dto.legalId,
      dealerLicenseNo: dto.dealerLicenseNo,
      address: dto.address,
      phone: dto.phone,
      email: dto.email,
      vatRate: dto.vatRate === undefined ? undefined : new Prisma.Decimal(dto.vatRate.toFixed(2)),
      reminderLeadDays: dto.reminderLeadDays,
      defaultLeaseTerms: dto.defaultLeaseTerms,
    };
    const provided = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined),
    ) as Partial<Prisma.SettingsCreateInput>;
    const row = await this.prisma.settings.upsert({
      where: { id: SETTINGS_ID },
      create: { ...defaultRowData(), ...provided },
      update: data,
    });
    return this.toView(row);
  }

  /** Current VAT rate (percent) for snapshots on deals. */
  async vatRate(): Promise<Prisma.Decimal> {
    return (await this.get()).vatRate;
  }

  private toView(row: SettingsRow): SettingsView {
    const businessName = BusinessNameSchema.safeParse(row.businessName);
    const leadDays = ReminderLeadDaysSchema.safeParse(row.reminderLeadDays ?? {});
    const leaseTerms = DefaultLeaseTermsSchema.safeParse(row.defaultLeaseTerms ?? {});
    return {
      businessName: businessName.success ? businessName.data : { ...DEFAULT_SETTINGS.businessName },
      legalId: row.legalId,
      dealerLicenseNo: row.dealerLicenseNo,
      address: row.address,
      phone: row.phone,
      email: row.email,
      vatRate: row.vatRate,
      reminderLeadDays: leadDays.success ? leadDays.data : { ...DEFAULT_SETTINGS.reminderLeadDays },
      defaultLeaseTerms: leaseTerms.success ? leaseTerms.data : DefaultLeaseTermsSchema.parse({}),
      logoDocumentId: row.logoDocumentId,
      updatedAt: row.updatedAt,
    };
  }
}
