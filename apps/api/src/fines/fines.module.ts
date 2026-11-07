import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { FinesController } from './fines.controller';
import { FinesService } from './fines.service';

/** Traffic fines: auto-matched driver, 90-day reassignment deadline, rebill to the driver. */
@Module({
  imports: [LedgerModule],
  controllers: [FinesController],
  providers: [FinesService],
  exports: [FinesService],
})
export class FinesModule {}
