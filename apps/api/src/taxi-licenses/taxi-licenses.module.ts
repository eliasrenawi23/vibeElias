import { Module } from '@nestjs/common';
import { TaxiLicensesController } from './taxi-licenses.controller';
import { TaxiLicensesService } from './taxi-licenses.service';

/** Taxi licences ("green numbers"): register, registered car, lease history, alerts. */
@Module({
  controllers: [TaxiLicensesController],
  providers: [TaxiLicensesService],
  exports: [TaxiLicensesService],
})
export class TaxiLicensesModule {}
