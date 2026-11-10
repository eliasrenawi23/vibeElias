import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FineRebillSchema, type Paginated, type FineSummary } from '@renawi/shared';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { Audited } from '../common/audit/audit.decorator';
import { parseOptionalBody } from '../common/zod-body';
import {
  FineCreateDto,
  FineQueryDto,
  FineSummaryQueryDto,
  FineRebillDto,
  FineUpdateDto,
} from './dto';
import { FinesService, FineView } from './fines.service';

@ApiTags('fines')
@ApiCookieAuth()
@Controller('fines')
export class FinesController {
  constructor(private readonly fines: FinesService) {}

  @Get()
  @ApiOperation({
    summary:
      'Paginated fines (newest offence first) with vehicle, driver, contract and alerts ' +
      '(reassignDueSoon within 14 days, reassignOverdue; NEW fines only)',
  })
  list(@Query() query: FineQueryDto): Promise<Paginated<FineView>> {
    return this.fines.list(query);
  }

  @Get('summary')
  @ApiOperation({
    summary:
      'Fine counts per status (every status present, 0 when none) under the list filters, ignoring status',
  })
  summary(@Query() query: FineSummaryQueryDto): Promise<FineSummary> {
    return this.fines.summary(query);
  }

  @Post()
  @Audited('TrafficFine')
  @ApiOperation({
    summary:
      'Record a fine: driver / contract auto-matched from the lease segment holding the car on ' +
      'the offence date; reassignDeadline = receivedAt + 90 days',
  })
  create(@Body() dto: FineCreateDto): Promise<FineView> {
    return this.fines.create(dto);
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<FineView> {
    return this.fines.get(id);
  }

  @Patch(':id')
  @Audited('TrafficFine')
  @ApiOperation({
    summary:
      'Update status / driver override / amounts / notes (a changed car or offence time ' +
      're-matches the driver)',
  })
  @ApiConflictResponse({ description: 'errors.alreadyRebilled (amount of a rebilled fine)' })
  update(@Param('id') id: string, @Body() dto: FineUpdateDto): Promise<FineView> {
    return this.fines.update(id, dto);
  }

  @Post(':id/rebill')
  @HttpCode(HttpStatus.OK)
  @Audited('TrafficFine')
  @ApiBody({ type: FineRebillDto, required: false })
  @ApiOperation({
    summary:
      'We paid it: VehicleExpense (FINE, paid by US) + CHARGE (FINE) on the driver, status ' +
      'PAID_BY_US',
  })
  @ApiConflictResponse({ description: 'errors.fineNoDriver | errors.alreadyRebilled' })
  rebill(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FineView> {
    return this.fines.rebill(id, parseOptionalBody(FineRebillSchema, body), user.id);
  }
}
