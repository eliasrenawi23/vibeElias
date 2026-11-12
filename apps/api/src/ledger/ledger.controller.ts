import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiConflictResponse, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Paginated } from '@renawi/shared';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { Audited } from '../common/audit/audit.decorator';
import {
  LedgerAgeingQueryDto,
  LedgerBalancesQueryDto,
  LedgerChargeCreateDto,
  LedgerCreditCreateDto,
  LedgerPaymentCreateDto,
  LedgerQueryDto,
  LedgerVoidDto,
} from './dto';
import type { AgeingView, LedgerEntryView } from './ledger-views';
import { AgeingListItem, BalanceListItem, LedgerList, LedgerService } from './ledger.service';

@ApiTags('ledger')
@ApiCookieAuth()
@Controller('ledger')
export class LedgerController {
  constructor(private readonly ledger: LedgerService) {}

  @Get()
  @ApiOperation({
    summary:
      'Ledger entries (newest first by default) with driver { id, name } and documentCount ' +
      '(generated confirmations, listed by GET /documents?ledgerEntryId=); charges carry ' +
      'allocated / remaining. totals { charged, paid, credited } over all matching non-voided rows',
  })
  list(@Query() query: LedgerQueryDto): Promise<LedgerList> {
    return this.ledger.list(query);
  }

  @Get('balances')
  @ApiOperation({
    summary:
      'Per-driver balances (driver_balance_v) with ageing buckets (driver_ageing_v), highest ' +
      'balance first; debtorsOnly / overdueOnly filters',
  })
  balances(@Query() query: LedgerBalancesQueryDto): Promise<Paginated<BalanceListItem>> {
    return this.ledger.balances(query);
  }

  @Get('ageing')
  @ApiOperation({
    summary:
      'Open receivables by days past due per driver (driver_ageing_v) + grand totals: ' +
      'current, d1_30, d31_60, d61_90, d90_plus, total',
  })
  ageing(
    @Query() query: LedgerAgeingQueryDto,
  ): Promise<{ items: AgeingListItem[]; totals: AgeingView }> {
    return this.ledger.ageing(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One ledger entry' })
  get(@Param('id') id: string): Promise<LedgerEntryView> {
    return this.ledger.entryView(id);
  }

  @Post('charges')
  @Audited('LedgerEntry')
  @ApiOperation({
    summary:
      'Manual charge (not RENT). dueDate defaults to date; with contractId the vehicle / licence ' +
      'attribution defaults from the contract. Re-runs the FIFO allocation',
  })
  createCharge(
    @Body() dto: LedgerChargeCreateDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LedgerEntryView> {
    return this.ledger.createCharge(dto, user.id);
  }

  @Post('payments')
  @Audited('LedgerEntry')
  @ApiOperation({
    summary: 'Payment (FIFO allocation to open charges; allocateTo lists charges to settle first)',
  })
  createPayment(
    @Body() dto: LedgerPaymentCreateDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LedgerEntryView> {
    return this.ledger.createPayment(dto, user.id);
  }

  @Post('credits')
  @Audited('LedgerEntry')
  @ApiOperation({ summary: 'Credit (goodwill, corrections); allocated like a payment' })
  createCredit(
    @Body() dto: LedgerCreditCreateDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LedgerEntryView> {
    return this.ledger.createCredit(dto, user.id);
  }

  @Post(':id/void')
  @HttpCode(HttpStatus.OK)
  @Audited('LedgerEntry')
  @ApiOperation({
    summary:
      'Void an entry (a deposit application voids its OFFSET payment too); re-runs the allocation',
  })
  @ApiConflictResponse({ description: 'errors.alreadyVoided' })
  void(@Param('id') id: string, @Body() dto: LedgerVoidDto): Promise<LedgerEntryView> {
    return this.ledger.void(id, dto.reason);
  }
}
