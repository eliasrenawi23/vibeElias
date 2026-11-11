import { Module } from '@nestjs/common';
import { DealsModule } from '../deals/deals.module';
import { LedgerModule } from '../ledger/ledger.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

/** Reports (profit, inventory ageing, receivables, expenses, lease income, trade book, fines). */
@Module({
  imports: [DealsModule, LedgerModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
