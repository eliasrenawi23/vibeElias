import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiConflictResponse, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Paginated } from '@renawi/shared';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { Audited } from '../common/audit/audit.decorator';
import { DriverLedgerQueryDto } from '../ledger/dto';
import type { DriverStatement } from '../ledger/ledger.service';
import { DriverCreateDto, DriverQueryDto, DriverUpdateDto } from './dto';
import { DriverDetail, DriverListItem, DriversService } from './drivers.service';

@ApiTags('drivers')
@ApiCookieAuth()
@Controller('drivers')
export class DriversController {
  constructor(private readonly drivers: DriversService) {}

  @Get()
  @ApiOperation({
    summary:
      'Paginated drivers with contact, name, activeContract, balance { charged, paid, credited, ' +
      'balance, depositHeld } and alerts (document expiries, overdue)',
  })
  list(@Query() query: DriverQueryDto): Promise<Paginated<DriverListItem>> {
    return this.drivers.list(query);
  }

  @Post()
  @Audited('Driver')
  @ApiOperation({
    summary:
      'Create a driver for an existing contact (contactId) or a new one (contact); the contact ' +
      'gets the DRIVER tag',
  })
  @ApiConflictResponse({ description: 'errors.alreadyDriver | validation.duplicate (idNumber)' })
  create(
    @Body() dto: DriverCreateDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DriverDetail> {
    return this.drivers.create(dto, user.id);
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Driver file: contact, contracts, balance, ageing buckets, own cars, document count, alerts',
  })
  get(@Param('id') id: string): Promise<DriverDetail> {
    return this.drivers.get(id);
  }

  @Patch(':id')
  @Audited('Driver')
  @ApiOperation({ summary: 'Driver fields (an optional contact block updates the contact)' })
  update(@Param('id') id: string, @Body() dto: DriverUpdateDto): Promise<DriverDetail> {
    return this.drivers.update(id, dto);
  }

  @Get(':id/ledger')
  @ApiOperation({
    summary:
      'Statement oldest first with runningBalance (deposit rows do not move it), allocated / ' +
      'remaining on charges, openingBalance (before from), closingBalance, balance, depositHeld',
  })
  ledger(@Param('id') id: string, @Query() query: DriverLedgerQueryDto): Promise<DriverStatement> {
    return this.drivers.statement(id, query);
  }
}
