import { Module } from '@nestjs/common';
import { RemindersController } from './reminders.controller';
import { RemindersFeedService } from './reminders-feed.service';
import { RemindersService } from './reminders.service';

/** Reminders feed (computed from every dated obligation) and manual reminders. */
@Module({
  controllers: [RemindersController],
  providers: [RemindersFeedService, RemindersService],
  exports: [RemindersFeedService],
})
export class RemindersModule {}
