import { Controller, Get, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  DashboardActivityQuerySchema,
  DashboardChartsQuerySchema,
  type ActivityItem,
  type DashboardCharts,
} from '@renawi/shared';
import { createZodDto } from 'nestjs-zod';
import { DashboardKpis, DashboardService } from './dashboard.service';

class DashboardActivityQueryDto extends createZodDto(DashboardActivityQuerySchema) {}
class DashboardChartsQueryDto extends createZodDto(DashboardChartsQuerySchema) {}

@ApiTags('dashboard')
@ApiCookieAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('kpis')
  @ApiOperation({
    summary:
      'Headline numbers (shared DashboardKpisSchema): vehiclesInStock, activeLeases, ' +
      'receivables, monthProfit, openDeals, transfersOverdue, expiring { overdue, due } (feed, ' +
      '30 days), finesOpen (NEW + REASSIGN_SUBMITTED), receivablesOverdue (open charges past due)',
  })
  kpis(): Promise<DashboardKpis> {
    return this.dashboard.kpis();
  }

  @Get('activity')
  @ApiOperation({
    summary: 'Latest audit rows (newest first) with user, label, English summary, changes, link',
  })
  activity(@Query() q: DashboardActivityQueryDto): Promise<ActivityItem[]> {
    return this.dashboard.activity(q.limit);
  }

  @Get('charts')
  @ApiOperation({
    summary:
      'Charts (shared DashboardChartsSchema): profitByMonth for the last `months` months, ' +
      'receivables ageing totals, inventory counts',
  })
  charts(@Query() q: DashboardChartsQueryDto): Promise<DashboardCharts> {
    return this.dashboard.charts(q.months);
  }
}
