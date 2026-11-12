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
import {
  TaxiLicenseCreateDto,
  TaxiLicenseFeePaidDto,
  TaxiLicenseQueryDto,
  TaxiLicenseRegisterVehicleDto,
  TaxiLicenseUpdateDto,
} from './dto';
import {
  TaxiLicenseDetail,
  TaxiLicenseListItem,
  TaxiLicensesService,
} from './taxi-licenses.service';

@ApiTags('taxi-licenses')
@ApiCookieAuth()
@Controller('taxi-licenses')
export class TaxiLicensesController {
  constructor(private readonly licenses: TaxiLicensesService) {}

  @Get()
  @ApiOperation({
    summary:
      'Paginated licences with registeredVehicle, currentSegment (open segment: contract, ' +
      'driver, car, rent) and alerts (annualFeeDue/Overdue, renewalDue/Overdue, idle). q matches ' +
      'licence number, holder, registered plate',
  })
  list(@Query() query: TaxiLicenseQueryDto): Promise<Paginated<TaxiLicenseListItem>> {
    return this.licenses.list(query);
  }

  @Post()
  @Audited('TaxiLicense')
  @ApiOperation({
    summary:
      'Create a licence (annualFeeDueAt defaults to 31 Dec of this year). Duplicate licenseNo ' +
      '-> 409 validation.duplicate',
  })
  create(@Body() dto: TaxiLicenseCreateDto): Promise<TaxiLicenseDetail> {
    return this.licenses.create(dto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Licence + registeredVehicle + currentSegment + segments history + documentCount',
  })
  get(@Param('id') id: string): Promise<TaxiLicenseDetail> {
    return this.licenses.get(id);
  }

  @Patch(':id')
  @Audited('TaxiLicense')
  update(@Param('id') id: string, @Body() dto: TaxiLicenseUpdateDto): Promise<TaxiLicenseDetail> {
    return this.licenses.update(id, dto);
  }

  @Post(':id/register-vehicle')
  @HttpCode(HttpStatus.OK)
  @Audited('TaxiLicense')
  @ApiOperation({
    summary:
      'Register the car carrying this licence at the MoT (vehicleId null detaches). The car must ' +
      'be a taxi under 12 years old and carry no other licence',
  })
  @ApiConflictResponse({
    description: 'errors.vehicleNotTaxi | errors.taxiAgeBlocked | errors.vehicleAlreadyRegistered',
  })
  registerVehicle(
    @Param('id') id: string,
    @Body() dto: TaxiLicenseRegisterVehicleDto,
  ): Promise<TaxiLicenseDetail> {
    return this.licenses.registerVehicle(id, dto);
  }

  @Post(':id/fee-paid')
  @HttpCode(HttpStatus.OK)
  @Audited('TaxiLicense')
  @ApiOperation({
    summary:
      'Annual fee paid: annualFeeDueAt -> 31 Dec of the year after the current due date (none: ' +
      'after paidAt, default today). With amount and a registered car, records a LICENSE_FEE ' +
      'expense paid by US on that car (note = description). Returns the full licence',
  })
  @ApiConflictResponse({ description: 'errors.licenseNotActive (the licence is sold)' })
  feePaid(
    @Param('id') id: string,
    @Body() dto: TaxiLicenseFeePaidDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TaxiLicenseDetail> {
    return this.licenses.feePaid(id, dto, user.id);
  }
}
