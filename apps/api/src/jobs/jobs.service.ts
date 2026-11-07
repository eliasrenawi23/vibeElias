import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DEFAULT_BUSINESS_TZ, todayInBusinessTz } from '@renawi/shared';

// Decorator options are evaluated at import time, so they read process.env directly
// (root scripts load .env through dotenv-cli before the process starts).
const BUSINESS_TZ = process.env.BUSINESS_TZ || DEFAULT_BUSINESS_TZ;
const CRON_DISABLED = ['false', '0', 'no'].includes((process.env.CRON_ENABLED ?? '').toLowerCase());

/**
 * Scheduled jobs, evaluated in the business time zone (Asia/Jerusalem) while the process runs
 * in UTC. Milestone 1 only logs; milestone 3 adds rent-charge generation for ACTIVE leases
 * (`LeaseBillingService.ensureCharges`) and the expiry-feed refresh.
 */
@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  @Cron('0 2 * * *', { name: 'nightly', timeZone: BUSINESS_TZ, disabled: CRON_DISABLED })
  nightly(): void {
    const today = todayInBusinessTz(BUSINESS_TZ);
    this.logger.log(`Nightly job for ${today} (${BUSINESS_TZ}): billing arrives in milestone 3`);
  }
}
