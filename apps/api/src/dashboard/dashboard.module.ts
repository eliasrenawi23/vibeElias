import { Module } from '@nestjs/common';
import { DealsModule } from '../deals/deals.module';
import { LedgerModule } from '../ledger/ledger.module';
import { RemindersModule } from '../reminders/reminders.module';
import { ReportsModule } from '../reports/reports.module';
import { ActivityService } from './activity.service';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

/** Dashboard KPIs, recent activity and charts. */
@Module({
  imports: [DealsModule, LedgerModule, RemindersModule, ReportsModule],
  controllers: [DashboardController],
  providers: [DashboardService, ActivityService],
})
export class DashboardModule {}
