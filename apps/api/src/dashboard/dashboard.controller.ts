import { Controller, Get } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DashboardKpis, DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiCookieAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('kpis')
  @ApiOperation({
    summary:
      'Headline numbers: vehiclesInStock (IN_STOCK), activeLeases, receivables (sum of positive ' +
      'driver balances), monthProfit (cycles closed this month, Asia/Jerusalem, via the P&L ' +
      'rules), openDeals (DRAFT + PENDING), transfersOverdue',
  })
  kpis(): Promise<DashboardKpis> {
    return this.dashboard.kpis();
  }
}
