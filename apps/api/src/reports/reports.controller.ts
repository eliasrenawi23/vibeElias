import { Controller, Get, Query, StreamableFile } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import {
  DEFAULT_LOCALE,
  ReportName,
  type Locale,
  type ReportFormat,
  type ReportResult,
} from '@renawi/shared';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { Clock } from '../common/clock';
import { contentDisposition } from '../common/content-disposition';
import {
  ExpensesReportQueryDto,
  FinesReportQueryDto,
  InventoryAgeingQueryDto,
  LeaseIncomeReportQueryDto,
  ProfitReportQueryDto,
  ReceivablesReportQueryDto,
  TradeBookQueryDto,
} from './dto';
import {
  CSV_MIME,
  exportFileName,
  reportToCsv,
  reportToXlsx,
  XLSX_MIME,
  type ExportOptions,
} from './report-export';
import { translator } from './report-i18n';
import { REPORT_PARAM_KINDS, ReportsService } from './reports.service';

const FORMAT_NOTE =
  ' format=json (shared ReportResultSchema; column labels are i18n keys reports.columns.<key>) ' +
  '| csv (UTF-8 BOM, CRLF, translated header row) | xlsx ("Report context" sheet + data ' +
  'sheet, RTL for he/ar, typed cells, n/a for missing values); lang = he|ar|en for csv / ' +
  'xlsx (default: the user locale); file name renawi-<report>-YYYY-MM-DD.<ext>.';

@ApiTags('reports')
@ApiCookieAuth()
@ApiProduces('application/json', CSV_MIME, XLSX_MIME)
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly clock: Clock,
  ) {}

  @Get('profit')
  @ApiOperation({
    summary:
      'Profit by month | quarter | year: cycles closed in the period (salesRevenue, ' +
      'purchaseCost, expenses net of rebills, vatOnMargin, commission) + leaseIncome (driver ' +
      'charges - credits by entry date) = profit.' +
      FORMAT_NOTE,
  })
  async profit(@Query() q: ProfitReportQueryDto, @CurrentUser() user?: AuthenticatedUser) {
    return this.respond(await this.reports.profit(q), q.format, q.lang, user);
  }

  @Get('inventory-ageing')
  @ApiOperation({
    summary:
      'Stock on asOf (open cycles, car not on a lease that day): plate, vehicle, ownership, ' +
      'purchase date / price, expenses, listing price, days in stock, bucket 0-30 | 31-60 | ' +
      '61-90 | 90+ (summary.buckets counts).' +
      FORMAT_NOTE,
  })
  async inventoryAgeing(
    @Query() q: InventoryAgeingQueryDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.respond(await this.reports.inventoryAgeing(q), q.format, q.lang, user);
  }

  @Get('receivables')
  @ApiOperation({
    summary:
      'Driver balances on asOf: driver, phone, latest contract, balance, deposit held, ageing ' +
      'buckets and overdue.' +
      FORMAT_NOTE,
  })
  async receivables(
    @Query() q: ReceivablesReportQueryDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.respond(await this.reports.receivables(q), q.format, q.lang, user);
  }

  @Get('expenses')
  @ApiOperation({
    summary:
      'Vehicle expenses by category | vehicle | month: count, amount, paid by us, VAT ' +
      'reclaimable, net cost.' +
      FORMAT_NOTE,
  })
  async expenses(@Query() q: ExpensesReportQueryDto, @CurrentUser() user?: AuthenticatedUser) {
    return this.respond(await this.reports.expenses(q), q.format, q.lang, user);
  }

  @Get('lease-income')
  @ApiOperation({
    summary:
      'Driver ledger by month | license | driver: rent charged, other charges, credits, net, ' +
      'payments received (n/a per licence: payments are driver-level).' +
      FORMAT_NOTE,
  })
  async leaseIncome(
    @Query() q: LeaseIncomeReportQueryDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.respond(await this.reports.leaseIncome(q), q.format, q.lang, user);
  }

  @Get('trade-book')
  @ApiOperation({
    summary:
      'Trade book (sefer sachar): one row per inventory cycle bought or sold in the period - ' +
      'vehicle, purchase date, seller + ID, purchase price, repairs, sale date, buyer + ID, ' +
      'sale price, VAT on margin, profit, consignment flag.' +
      FORMAT_NOTE,
  })
  async tradeBook(@Query() q: TradeBookQueryDto, @CurrentUser() user?: AuthenticatedUser) {
    return this.respond(await this.reports.tradeBook(q), q.format, q.lang, user);
  }

  @Get('fines')
  @ApiOperation({
    summary: 'Fines register by received date (optional status filter).' + FORMAT_NOTE,
  })
  async fines(@Query() q: FinesReportQueryDto, @CurrentUser() user?: AuthenticatedUser) {
    return this.respond(await this.reports.fines(q), q.format, q.lang, user);
  }

  /** JSON as is; CSV / XLSX rendered in the requested (or the user's) language. */
  private async respond(
    result: ReportResult,
    format: ReportFormat,
    lang: Locale | undefined,
    user: AuthenticatedUser | undefined,
  ): Promise<ReportResult | StreamableFile> {
    if (format === 'json') return result;
    const language = lang ?? user?.locale ?? DEFAULT_LOCALE;
    const report = ReportName.parse(result.report);
    const options: ExportOptions = {
      report,
      lang: language,
      t: translator(language),
      exportedAt: new Date(),
      timeZone: this.clock.timeZone,
      paramKinds: REPORT_PARAM_KINDS[report],
    };
    const fileName = exportFileName(report, format, this.clock.today());
    const body = format === 'csv' ? reportToCsv(result, options) : await reportToXlsx(result, options);
    return new StreamableFile(body, {
      type: format === 'csv' ? CSV_MIME : XLSX_MIME,
      disposition: contentDisposition('attachment', fileName),
      length: body.length,
    });
  }
}
