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
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  DealCancelRequestSchema,
  DealCompleteRequestSchema,
  DealCreateRequestSchema,
  type Paginated,
} from '@renawi/shared';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { Audited } from '../common/audit/audit.decorator';
import { parseBody, parseOptionalBody } from '../common/zod-body';
import { DealDetail, DealListItem } from './deal-views';
import { DealsService } from './deals.service';
import {
  DealCancelDto,
  DealCompleteDto,
  DealCreateDto,
  DealDisclosureDto,
  DealPaymentDto,
  DealQueryDto,
  DealTransferDto,
  DealUpdateDto,
} from './dto';

@ApiTags('deals')
@ApiCookieAuth()
@Controller()
export class DealsController {
  constructor(private readonly deals: DealsService) {}

  @Get('deals')
  @ApiOperation({
    summary:
      'Paginated deals (newest date first) with vehicle, counterparty { id, name }, paidIn / ' +
      'paidOut (TRADE_IN rows excluded), tradeInValue, balanceDue, payoutDue (consignment) and ' +
      'alerts (disclosureMissing, transferDue, transferOverdue, unpaid). q matches deal number, ' +
      'plate, counterparty name / phone, make / model',
  })
  list(@Query() query: DealQueryDto): Promise<Paginated<DealListItem>> {
    return this.deals.list(query);
  }

  @Post('deals')
  @Audited('Deal')
  @ApiBody({ type: DealCreateDto })
  @ApiOperation({
    summary:
      'Create a DRAFT deal, discriminated by type. PURCHASE: vehicle { id } | { create } (plate ' +
      'upsert, buy-back relinks), opens an OWNED cycle (or attaches to purchase-less stock), ' +
      'vatMode FULL when sellerIsVatBusiness else NONE. SALE: open OWNED cycle, car RESERVED, ' +
      'vatMode MARGIN (forced FULL after a VAT-business purchase); optional tradeIn creates a ' +
      'linked PURCHASE (isTradeIn, PENDING) with its own cycle and TRADE_IN payments on both ' +
      'deals. CONSIGNMENT_SALE: open CONSIGNED cycle, commission / payout from the cycle rule, ' +
      'vatMode NONE (VAT on our commission is accounted at business level). VAT rate = ' +
      'Settings.vatRate snapshot',
  })
  @ApiConflictResponse({
    description:
      'errors.cycleOpen | errors.noOpenCycle | errors.vehicleLeased | errors.dealPending | ' +
      'errors.conflict (validation.duplicate vin)',
  })
  create(@Body() body: unknown, @CurrentUser() user: AuthenticatedUser): Promise<DealDetail> {
    return this.deals.create(parseBody(DealCreateRequestSchema, body), user.id);
  }

  @Get('deals/:id')
  @ApiOperation({
    summary:
      'Deal file: vehicle, counterparty, cycle (purchase price, consignor, commission rule), ' +
      'tradeInDeal / tradeInFor, payments (+ contact), money summary, vat { mode, rate, base, ' +
      'amount }, transferChecklist (defaults merged; taxiLicenseDetached for taxis), ' +
      'documentCount, alerts',
  })
  get(@Param('id') id: string): Promise<DealDetail> {
    return this.deals.get(id);
  }

  @Patch('deals/:id')
  @Audited('Deal')
  @ApiOperation({
    summary:
      'DRAFT / PENDING: date, price, listPrice, counterpartyId, vatMode (type rules), ' +
      'warrantyText, notes, sellerIsVatBusiness (PURCHASE), status DRAFT <-> PENDING. ' +
      'COMPLETED: notes / warrantyText only. CANCELLED: nothing',
  })
  @ApiBadRequestResponse({
    description: 'vatMode not allowed for the type | price below the trade-in value',
  })
  @ApiConflictResponse({ description: 'errors.dealNotEditable (one entry per locked field)' })
  update(
    @Param('id') id: string,
    @Body() dto: DealUpdateDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DealDetail> {
    return this.deals.update(id, dto, user.id);
  }

  @Post('deals/:id/disclosure')
  @HttpCode(HttpStatus.OK)
  @Audited('Deal')
  @ApiOperation({
    summary: 'Record (or clear, while not completed) the signed disclosure form of a sale',
  })
  @ApiConflictResponse({
    description: 'errors.invalidTransition (purchase / cancelled) | errors.dealNotEditable',
  })
  disclosure(@Param('id') id: string, @Body() dto: DealDisclosureDto): Promise<DealDetail> {
    return this.deals.setDisclosure(id, dto);
  }

  @Post('deals/:id/complete')
  @HttpCode(HttpStatus.OK)
  @Audited('Deal')
  @ApiBody({ type: DealCompleteDto, required: false })
  @ApiOperation({
    summary:
      'Complete on date (default: the deal date). PURCHASE: cycle stays open. SALE / ' +
      'CONSIGNMENT_SALE: needs disclosureSignedAt; closes the cycle (SOLD), vehicle SOLD, ' +
      'transferDueAt = date + 6 working days (Sun-Thu), trade-in completed; consignment ' +
      'commission / payout recomputed',
  })
  @ApiConflictResponse({
    description:
      'errors.invalidTransition | errors.disclosureRequired | errors.vehicleLeased | ' +
      'errors.noOpenCycle',
  })
  complete(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DealDetail> {
    return this.deals.complete(id, parseOptionalBody(DealCompleteRequestSchema, body), user.id);
  }

  @Post('deals/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @Audited('Deal')
  @ApiBody({ type: DealCancelDto, required: false })
  @ApiOperation({
    summary:
      'Cancel a DRAFT / PENDING deal without manual payments. SALE: car IN_STOCK, trade-in ' +
      'deal + cycle cancelled, TRADE_IN payments removed. PURCHASE: its cycle cancelled (car ' +
      'EXTERNAL unless it has an earlier cycle) or detached from existing stock. ' +
      'CONSIGNMENT_SALE: car IN_STOCK',
  })
  @ApiConflictResponse({
    description:
      'errors.dealNotCancellable | errors.dealHasPayments | errors.dealPending | ' +
      'errors.vehicleLeased',
  })
  cancel(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DealDetail> {
    return this.deals.cancel(id, parseOptionalBody(DealCancelRequestSchema, body), user.id);
  }

  @Post('deals/:id/payments')
  @ApiOperation({
    summary:
      'Add a manual payment (not TRADE_IN / OFFSET) to a DRAFT / PENDING / COMPLETED deal; ' +
      'contact defaults to the counterparty (consignor for consignment payouts). Returns the deal',
  })
  @ApiConflictResponse({ description: 'errors.dealNotEditable (cancelled)' })
  addPayment(
    @Param('id') id: string,
    @Body() dto: DealPaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DealDetail> {
    return this.deals.addPayment(id, dto, user.id);
  }

  @Delete('deal-payments/:id')
  @HttpCode(HttpStatus.OK)
  @Audited('DealPayment')
  @ApiOperation({ summary: 'Delete a manual payment. Returns the deal' })
  @ApiConflictResponse({ description: 'errors.systemPayment (TRADE_IN) | errors.dealNotEditable' })
  removePayment(@Param('id') id: string): Promise<DealDetail> {
    return this.deals.removePayment(id);
  }

  @Patch('deals/:id/transfer')
  @Audited('Deal')
  @ApiOperation({
    summary:
      'Ownership transfer: merge checklist items; status rolls up (any ticked -> IN_PROGRESS, ' +
      'all applicable -> DONE, transferredAt defaults to today); transferStatus DONE or a ' +
      'transferredAt date force DONE',
  })
  @ApiConflictResponse({ description: 'errors.dealNotEditable (cancelled)' })
  transfer(@Param('id') id: string, @Body() dto: DealTransferDto): Promise<DealDetail> {
    return this.deals.updateTransfer(id, dto);
  }
}
