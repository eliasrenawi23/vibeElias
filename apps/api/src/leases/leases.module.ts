import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { LedgerModule } from '../ledger/ledger.module';
import { LeaseBillingService } from './billing.service';
import { LeasesController } from './leases.controller';
import { LeasesService } from './leases.service';

/** Lease contracts: drafts, segments, activation, end / renewal, deposits, rent billing. */
@Module({
  imports: [LedgerModule, DocumentsModule],
  controllers: [LeasesController],
  providers: [LeasesService, LeaseBillingService],
  exports: [LeasesService, LeaseBillingService],
})
export class LeasesModule {}
