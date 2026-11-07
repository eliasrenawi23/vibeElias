import { Module } from '@nestjs/common';
import { DealsModule } from '../deals/deals.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

/** Dashboard KPIs (milestone 5 extends it with activity and the reminders feed). */
@Module({
  imports: [DealsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
