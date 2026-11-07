import { Module } from '@nestjs/common';
import { ContactsModule } from '../contacts/contacts.module';
import { LedgerModule } from '../ledger/ledger.module';
import { DriversController } from './drivers.controller';
import { DriversService } from './drivers.service';

/** Drivers (a contact with a driver profile): documents, contracts, balance, statement. */
@Module({
  imports: [ContactsModule, LedgerModule],
  controllers: [DriversController],
  providers: [DriversService],
  exports: [DriversService],
})
export class DriversModule {}
