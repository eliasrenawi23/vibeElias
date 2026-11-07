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
import { ApiConflictResponse, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Paginated } from '@renawi/shared';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { Audited } from '../common/audit/audit.decorator';
import { VehicleCreateDto, VehicleQueryDto, VehicleStatusChangeDto, VehicleUpdateDto } from './dto';
import { VehicleDetail, VehicleListItem } from './vehicle-views';
import { VehiclesService } from './vehicles.service';

@ApiTags('vehicles')
@ApiCookieAuth()
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @Get()
  @ApiOperation({
    summary:
      'Paginated vehicles with registeredLicense, ownerDriver { id, name }, openCycle and ' +
      'computed alerts. q matches plate (any format) / VIN / make / model',
  })
  list(@Query() query: VehicleQueryDto): Promise<Paginated<VehicleListItem>> {
    return this.vehicles.list(query);
  }

  @Post()
  @Audited('Vehicle')
  @ApiOperation({
    summary:
      'Create a vehicle; OWNED + IN_STOCK/RESERVED/LEASED opens an OWNED inventory cycle. ' +
      'Duplicate plateNo / vin -> 409 validation.duplicate',
  })
  create(@Body() dto: VehicleCreateDto): Promise<VehicleDetail> {
    return this.vehicles.create(dto);
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Vehicle file: refs, cycles (+ expense totals), insurance, last 20 odometer readings, ' +
      'open-cycle expense summary, document count, alerts',
  })
  get(@Param('id') id: string): Promise<VehicleDetail> {
    return this.vehicles.get(id);
  }

  @Patch(':id')
  @Audited('Vehicle')
  @ApiOperation({
    summary: 'Partial update (status via POST /vehicles/:id/status, consignment via /consign)',
  })
  update(@Param('id') id: string, @Body() dto: VehicleUpdateDto): Promise<VehicleDetail> {
    return this.vehicles.update(id, dto);
  }

  @Post(':id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Manual status change: IN_STOCK<->RESERVED, IN_STOCK->SCRAPPED (closes the cycle), ' +
      'LEASED->IN_STOCK (no open lease segment), EXTERNAL->IN_STOCK (becomes OWNED, opens a cycle)',
  })
  @ApiConflictResponse({
    description: 'errors.invalidTransition | errors.useDeal (SOLD) | errors.vehicleLeased',
  })
  changeStatus(
    @Param('id') id: string,
    @Body() dto: VehicleStatusChangeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<VehicleDetail> {
    return this.vehicles.changeStatus(id, dto, user.id);
  }
}
