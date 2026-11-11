import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Paginated, RemindersFeed } from '@renawi/shared';
import { Audited } from '../common/audit/audit.decorator';
import {
  ReminderCreateDto,
  ReminderQueryDto,
  RemindersFeedQueryDto,
  ReminderUpdateDto,
} from './dto';
import { RemindersFeedService } from './reminders-feed.service';
import { ReminderRow, RemindersService } from './reminders.service';

@ApiTags('reminders')
@ApiCookieAuth()
@Controller('reminders')
export class RemindersController {
  constructor(
    private readonly feedService: RemindersFeedService,
    private readonly reminders: RemindersService,
  ) {}

  @Get('feed')
  @ApiOperation({
    summary:
      'Reminders feed (shared RemindersFeedSchema): every expiry / deadline / follow-up / open ' +
      'manual reminder due up to `days` ahead (default 30; items inside their kind lead days ' +
      'always included) plus everything overdue, sorted by dueAt. severity: overdue (date ' +
      'passed) | due (within the kind lead days from Settings.reminderLeadDays, today included) ' +
      '| upcoming. counts are per severity after days/kinds, before severity and pagination.',
  })
  feed(@Query() query: RemindersFeedQueryDto): Promise<RemindersFeed> {
    return this.feedService.feed(query);
  }

  @Get()
  @ApiOperation({
    summary:
      'Manual reminders (shared ReminderSchema items), earliest due first unless sort is ' +
      'given (dueAt | createdAt | title | doneAt); done=false lists the open ones',
  })
  list(@Query() query: ReminderQueryDto): Promise<Paginated<ReminderRow>> {
    return this.reminders.list(query);
  }

  @Post()
  @Audited('Reminder')
  @ApiOperation({
    summary:
      'Create a manual reminder; entityType + entityId (both or neither) link it to a record ' +
      '(404 errors.notFound on entityId when the record does not exist)',
  })
  create(@Body() dto: ReminderCreateDto): Promise<ReminderRow> {
    return this.reminders.create(dto);
  }

  @Get(':id')
  @ApiNotFoundResponse({ description: 'errors.notFound' })
  get(@Param('id') id: string): Promise<ReminderRow> {
    return this.reminders.get(id);
  }

  @Patch(':id')
  @Audited('Reminder')
  @ApiOperation({ summary: 'Update title / due date / notes / linked record' })
  update(@Param('id') id: string, @Body() dto: ReminderUpdateDto): Promise<ReminderRow> {
    return this.reminders.update(id, dto);
  }

  @Post(':id/done')
  @HttpCode(HttpStatus.OK)
  @Audited('Reminder')
  @ApiOperation({ summary: 'Mark done (idempotent: keeps the first doneAt); leaves the feed' })
  done(@Param('id') id: string): Promise<ReminderRow> {
    return this.reminders.done(id);
  }

  @Post(':id/undone')
  @HttpCode(HttpStatus.OK)
  @Audited('Reminder')
  @ApiOperation({ summary: 'Reopen a done reminder (doneAt = null); back in the feed' })
  undone(@Param('id') id: string): Promise<ReminderRow> {
    return this.reminders.undone(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audited('Reminder')
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiNotFoundResponse({ description: 'errors.notFound' })
  remove(@Param('id') id: string): Promise<void> {
    return this.reminders.remove(id);
  }
}
