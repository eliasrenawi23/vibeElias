import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { LeasesModule } from '../leases/leases.module';
import { JobsService } from './jobs.service';

@Module({
  imports: [ScheduleModule.forRoot(), LeasesModule],
  providers: [JobsService],
})
export class JobsModule {}
