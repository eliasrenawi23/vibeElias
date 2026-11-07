import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DEFAULT_BUSINESS_TZ, periodOf, todayInBusinessTz } from '@renawi/shared';
import { LeaseBillingService } from '../leases/billing.service';

// Decorator options are evaluated at import time, so they read process.env directly
// (root scripts load .env through dotenv-cli before the process starts).
const BUSINESS_TZ = process.env.BUSINESS_TZ || DEFAULT_BUSINESS_TZ;
const CRON_DISABLED = ['false', '0', 'no'].includes((process.env.CRON_ENABLED ?? '').toLowerCase());

/**
 * Scheduled jobs, evaluated in the business time zone (Asia/Jerusalem) while the process runs
 * in UTC. Disabled with `CRON_ENABLED=false` (tests, one-off scripts).
 */
@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(private readonly billing: LeaseBillingService) {}

  /**
   * 03:00 every night: rent charges of the current month for every ACTIVE contract (and ended
   * ones still running out their last month). Idempotent, so a missed night is caught up.
   */
  @Cron('0 3 * * *', { name: 'rent-billing', timeZone: BUSINESS_TZ, disabled: CRON_DISABLED })
  async nightlyBilling(): Promise<void> {
    const today = todayInBusinessTz(BUSINESS_TZ);
    try {
      const result = await this.billing.run(periodOf(today));
      this.logger.log(
        `Rent billing ${result.period} (${today} ${BUSINESS_TZ}): ${result.created} charges ` +
          `created on ${result.contracts} contracts`,
      );
    } catch (e) {
      this.logger.error(`Rent billing failed: ${(e as Error).stack ?? String(e)}`);
    }
  }
}
