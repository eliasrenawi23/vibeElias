import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { OdometerLog } from '@prisma/client';
import { Audited } from '../common/audit/audit.decorator';
import { OdometerCreateDto, OdometerQueryDto } from './dto';
import { OdometerService } from './odometer.service';

@ApiTags('odometer')
@ApiCookieAuth()
@Controller('vehicles/:id/odometer')
export class OdometerController {
  constructor(private readonly odometer: OdometerService) {}

  @Get()
  @ApiOperation({ summary: 'Odometer readings, newest first (optional from / to; no paging)' })
  list(@Param('id') vehicleId: string, @Query() query: OdometerQueryDto): Promise<OdometerLog[]> {
    return this.odometer.list(vehicleId, query);
  }

  @Post()
  @Audited('OdometerLog', { idFromResult: true })
  @ApiOperation({
    summary: 'Record a reading; the latest by date becomes vehicle.currentKm',
  })
  @ApiBadRequestResponse({ description: 'km: validation.odometerDecreasing' })
  create(@Param('id') vehicleId: string, @Body() dto: OdometerCreateDto): Promise<OdometerLog> {
    return this.odometer.create(vehicleId, dto);
  }
}
