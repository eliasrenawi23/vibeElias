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
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { LeaseActivationSchema, LeaseBillingRunSchema, type Paginated } from '@renawi/shared';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { Audited } from '../common/audit/audit.decorator';
import { parseOptionalBody } from '../common/zod-body';
import { LeaseBillingService, PreviewCharge } from './billing.service';
import {
  LeaseActivationDto,
  LeaseBillingPreviewQueryDto,
  LeaseBillingRunDto,
  LeaseChecklistsDto,
  LeaseCreateDto,
  LeaseDepositDto,
  LeaseEndDto,
  LeaseQueryDto,
  LeaseRenewDto,
  LeaseSegmentCreateDto,
  LeaseUpdateDto,
} from './dto';
import { LeaseDetail, LeaseListItem } from './lease-views';
import { LeasesService } from './leases.service';

@ApiTags('leases')
@ApiCookieAuth()
@Controller('leases')
export class LeasesController {
  constructor(
    private readonly leases: LeasesService,
    private readonly billing: LeaseBillingService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Paginated contracts with driver, currentSegment (licence, car, rent), driver-level ' +
      'balance { balance, depositHeld } and alerts (endingSoon, ended, overdue, draft)',
  })
  list(@Query() query: LeaseQueryDto): Promise<Paginated<LeaseListItem>> {
    return this.leases.list(query);
  }

  @Get('billing/preview')
  @ApiOperation({
    summary:
      'Rent charges the billing run would create up to period (default: this month); with ' +
      'contractId a DRAFT is previewed as if activated',
  })
  preview(
    @Query() query: LeaseBillingPreviewQueryDto,
  ): Promise<{ period: string; charges: PreviewCharge[] }> {
    return this.billing.preview(query.period, query.contractId);
  }

  @Post('billing/run')
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: LeaseBillingRunDto, required: false })
  @ApiOperation({
    summary:
      'Generate missing RENT charges up to period (default: this month) for every ACTIVE ' +
      'contract (or one contractId). Idempotent: { created, contracts, period }',
  })
  run(
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ created: number; contracts: number; period: string }> {
    const dto = parseOptionalBody(LeaseBillingRunSchema, body);
    return this.billing.run(dto.period ?? dto.upto, dto.contractId, user.id);
  }

  @Post()
  @Audited('LeaseContract')
  @ApiOperation({
    summary:
      'Create a DRAFT with its first segment (taxiLicenseId, vehicleId, monthlyRent); the open ' +
      'segment locks the licence / car. Responsibilities default from settings',
  })
  @ApiBadRequestResponse({
    description: 'validation.billingPeriodUnsupported (WEEKLY) | validation.endAfterStart',
  })
  @ApiConflictResponse({
    description:
      'errors.driverInactive | errors.licenseNotActive | errors.vehicleNotAvailable | ' +
      'errors.taxiAgeBlocked | errors.licenseInUse | errors.vehicleInUse',
  })
  create(@Body() dto: LeaseCreateDto): Promise<LeaseDetail> {
    return this.leases.create(dto);
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Contract file: driver, segments, currentSegment, balance, openCharges, lastPayment, ' +
      'checklists, renewal links, documentCount, alerts',
  })
  get(@Param('id') id: string): Promise<LeaseDetail> {
    return this.leases.get(id);
  }

  @Patch(':id')
  @Audited('LeaseContract')
  @ApiOperation({
    summary:
      'DRAFT: any field incl. the first segment. ACTIVE: endDate (>= today, re-bills), ' +
      'paymentDay, terms, responsibilities, notes',
  })
  @ApiConflictResponse({ description: 'errors.leaseNotEditable' })
  update(
    @Param('id') id: string,
    @Body() dto: LeaseUpdateDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LeaseDetail> {
    return this.leases.update(id, dto, user.id);
  }

  @Delete(':id')
  @Audited('LeaseContract')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Draft deleted with its segment and documents' })
  @ApiConflictResponse({ description: 'errors.leaseNotEditable (not a DRAFT)' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.leases.remove(id);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @Audited('LeaseContract')
  @ApiBody({ type: LeaseActivationDto, required: false })
  @ApiOperation({
    summary:
      'DRAFT -> ACTIVE: re-validates, car LEASED, DEPOSIT_IN (deposit.amount defaults to the ' +
      'contract depositAmount), rent charges up to this month',
  })
  @ApiConflictResponse({ description: 'errors.invalidTransition and the create checks' })
  activate(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LeaseDetail> {
    return this.leases.activate(id, parseOptionalBody(LeaseActivationSchema, body), user.id);
  }

  @Post(':id/segments')
  @HttpCode(HttpStatus.OK)
  @Audited('LeaseContract')
  @ApiOperation({
    summary:
      'Car swap / licence or rent change from startDate: closes the open segment the day ' +
      'before, opens the new one, flips car statuses, re-bills the touched months',
  })
  @ApiConflictResponse({
    description:
      'errors.leaseNotEditable (not ACTIVE) | errors.licenseInUse | errors.vehicleInUse | ' +
      'errors.vehicleNotAvailable | errors.taxiAgeBlocked | errors.licenseNotActive',
  })
  changeSegment(
    @Param('id') id: string,
    @Body() dto: LeaseSegmentCreateDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LeaseDetail> {
    return this.leases.changeSegment(id, dto, user.id);
  }

  @Post(':id/end')
  @HttpCode(HttpStatus.OK)
  @Audited('LeaseContract')
  @ApiOperation({
    summary:
      'End (EXPIRED / OTHER -> ENDED) or terminate (TERMINATED_BY_* -> TERMINATED): closes the ' +
      'segment, car IN_STOCK, CREDIT for charged days after actualEndDate, optional PENALTY, ' +
      'deposit HOLD / RETURN / APPLY',
  })
  @ApiConflictResponse({ description: 'errors.invalidTransition (not ACTIVE)' })
  end(
    @Param('id') id: string,
    @Body() dto: LeaseEndDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LeaseDetail> {
    return this.leases.end(id, dto, user.id);
  }

  @Post(':id/renew')
  @HttpCode(HttpStatus.OK)
  @Audited('LeaseContract')
  @ApiOperation({
    summary:
      'Renew: the contract ends (RENEWED) the day before startDate (default: endDate + 1); ' +
      'returns the NEW ACTIVE contract on the same licence / car',
  })
  @ApiConflictResponse({ description: 'errors.invalidTransition (not ACTIVE)' })
  renew(
    @Param('id') id: string,
    @Body() dto: LeaseRenewDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LeaseDetail> {
    return this.leases.renew(id, dto, user.id);
  }

  @Post(':id/deposit')
  @HttpCode(HttpStatus.OK)
  @Audited('LeaseContract')
  @ApiOperation({
    summary:
      'Deposit IN (DEPOSIT_IN) / OUT (DEPOSIT_OUT) / APPLY (DEPOSIT_APPLIED + PAYMENT OFFSET)',
  })
  @ApiConflictResponse({ description: 'errors.depositInsufficient | errors.invalidTransition' })
  deposit(
    @Param('id') id: string,
    @Body() dto: LeaseDepositDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LeaseDetail> {
    return this.leases.deposit(id, dto, user.id);
  }

  @Patch(':id/checklists')
  @Audited('LeaseContract')
  @ApiOperation({ summary: 'Handover / return checklists (validated, defaults filled in)' })
  checklists(@Param('id') id: string, @Body() dto: LeaseChecklistsDto): Promise<LeaseDetail> {
    return this.leases.checklists(id, dto);
  }
}
