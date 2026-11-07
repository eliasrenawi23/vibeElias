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
import { ApiCookieAuth, ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { InsurancePolicy } from '@prisma/client';
import { Audited } from '../common/audit/audit.decorator';
import {
  BusinessInsuranceCreateDto,
  InsuranceCreateDto,
  InsuranceQueryDto,
  InsuranceUpdateDto,
} from './dto';
import { InsuranceListItem, InsuranceService } from './insurance.service';

@ApiTags('insurance')
@ApiCookieAuth()
@Controller()
export class InsuranceController {
  constructor(private readonly insurance: InsuranceService) {}

  @Get('vehicles/:id/insurance')
  @ApiOperation({ summary: 'Policies of a vehicle, newest first' })
  listForVehicle(@Param('id') vehicleId: string): Promise<InsurancePolicy[]> {
    return this.insurance.listForVehicle(vehicleId);
  }

  @Post('vehicles/:id/insurance')
  @Audited('InsurancePolicy', { idFromResult: true })
  @ApiOperation({
    summary:
      'Add a VEHICLE-scope policy (endDate after startDate; hasTaxiExtension kept only for ' +
      'COMPREHENSIVE)',
  })
  createForVehicle(
    @Param('id') vehicleId: string,
    @Body() dto: InsuranceCreateDto,
  ): Promise<InsurancePolicy> {
    return this.insurance.createForVehicle(vehicleId, dto);
  }

  @Get('insurance')
  @ApiOperation({
    summary:
      'All policies newest first: ?scope=BUSINESS|VEHICLE&activeOnly&type&vehicleId&endingBefore ' +
      '(no paging); items carry vehicle { id, plateNo, make, model } | null',
  })
  list(@Query() query: InsuranceQueryDto): Promise<InsuranceListItem[]> {
    return this.insurance.list(query);
  }

  @Post('insurance')
  @Audited('InsurancePolicy')
  @ApiOperation({ summary: 'Add a BUSINESS policy (TRADE / LOT, vehicleId must be empty)' })
  createBusiness(@Body() dto: BusinessInsuranceCreateDto): Promise<InsurancePolicy> {
    return this.insurance.createBusiness(dto);
  }

  @Get('insurance/:id')
  get(@Param('id') id: string): Promise<InsurancePolicy> {
    return this.insurance.get(id);
  }

  @Patch('insurance/:id')
  @Audited('InsurancePolicy')
  @ApiOperation({ summary: 'Partial update validated on the merged values; scope is fixed' })
  update(@Param('id') id: string, @Body() dto: InsuranceUpdateDto): Promise<InsurancePolicy> {
    return this.insurance.update(id, dto);
  }

  @Delete('insurance/:id')
  @Audited('InsurancePolicy')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async remove(@Param('id') id: string): Promise<void> {
    await this.insurance.delete(id);
  }
}
