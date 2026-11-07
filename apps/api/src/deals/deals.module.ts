import { Module } from '@nestjs/common';
import { ContactsModule } from '../contacts/contacts.module';
import { DealsController } from './deals.controller';
import { DealsService } from './deals.service';
import { LicensePnlController, VehiclePnlController } from './pnl.controller';
import { PnlService } from './pnl.service';

/** Deals (purchase / sale / trade-in / consignment), payments, transfer, vehicle & licence P&L. */
@Module({
  imports: [ContactsModule],
  controllers: [DealsController, VehiclePnlController, LicensePnlController],
  providers: [DealsService, PnlService],
  exports: [DealsService, PnlService],
})
export class DealsModule {}
