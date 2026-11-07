import { Module } from '@nestjs/common';
import { ContactsModule } from '../contacts/contacts.module';
import { DocumentsModule } from '../documents/documents.module';
import { CyclesController } from './cycles.controller';
import { CyclesService } from './cycles.service';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { InsuranceController } from './insurance.controller';
import { InsuranceService } from './insurance.service';
import { OdometerController } from './odometer.controller';
import { OdometerService } from './odometer.service';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';

/** Vehicles with their expenses, insurance (incl. business policies), odometer and cycles. */
@Module({
  imports: [ContactsModule, DocumentsModule],
  controllers: [
    VehiclesController,
    ExpensesController,
    InsuranceController,
    OdometerController,
    CyclesController,
  ],
  providers: [VehiclesService, ExpensesService, InsuranceService, OdometerService, CyclesService],
  exports: [VehiclesService],
})
export class VehiclesModule {}
