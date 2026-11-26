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
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { VehicleSummary, Paginated } from '@renawi/shared';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { Audited } from '../common/audit/audit.decorator';
import { ConversionService } from './conversion.service';
import {
  VehicleConversionUpdateDto,
  VehicleConvertDto,
  VehicleCreateDto,
  VehicleQueryDto,
  VehicleSummaryQueryDto,
  VehicleStatusChangeDto,
  VehicleUpdateDto,
} from './dto';
import { VehicleDetail, VehicleListItem } from './vehicle-views';
import { VehiclesService } from './vehicles.service';

@ApiTags('vehicles')
@ApiCookieAuth()
@Controller('vehicles')
export class VehiclesController {
  constructor(
    private readonly vehicles: VehiclesService,
    private readonly conversion: ConversionService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Paginated vehicles with registeredLicense, ownerDriver { id, name }, openCycle, ' +
      'formerTaxi, formerTaxiPlateNo, privatePriceEstimate and computed alerts. q matches plate ' +
      '(any format, also old plates such as the taxi plate of a converted car) / VIN / make / ' +
      'model; formerTaxi=true|false filters converted cars',
  })
  list(@Query() query: VehicleQueryDto): Promise<Paginated<VehicleListItem>> {
    return this.vehicles.list(query);
  }

  @Get('summary')
  @ApiOperation({
    summary:
      'Vehicle counts per status (every status present, 0 when none) under the list filters, ignoring status',
  })
  summary(@Query() query: VehicleSummaryQueryDto): Promise<VehicleSummary> {
    return this.vehicles.summary(query);
  }

  @Post()
  @Audited('Vehicle')
  @ApiOperation({
    summary:
      'Create a vehicle; OWNED + IN_STOCK/RESERVED/LEASED opens an OWNED inventory cycle. ' +
      "Duplicate plateNo / vin, or a plateNo that is any vehicle's old (retired) plate -> 409 " +
      'validation.duplicate. expectedConversionTax is kept for taxis only (null otherwise)',
  })
  create(@Body() dto: VehicleCreateDto): Promise<VehicleDetail> {
    return this.vehicles.create(dto);
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Vehicle file: refs, cycles (+ expense totals), insurance, last 20 odometer readings, ' +
      'open-cycle expense summary, document count, alerts, plateHistory (newest first: id, ' +
      'oldPlateNo, newPlateNo, changedAt, reason, conversionTax, expenseId, notes) and ' +
      'canConvert { allowed, blockers: error keys that currently block a taxi -> private ' +
      'conversion }',
  })
  get(@Param('id') id: string): Promise<VehicleDetail> {
    return this.vehicles.get(id);
  }

  @Patch(':id')
  @Audited('Vehicle')
  @ApiOperation({
    summary:
      'Partial update (status via POST /vehicles/:id/status, consignment via /consign). ' +
      'isTaxi cannot become true again after a conversion (409 errors.invalidTransition); ' +
      'expectedConversionTax is nulled when the car is not a taxi',
  })
  @ApiConflictResponse({
    description:
      'errors.invalidTransition | errors.cycleOpen | errors.conflict with validation.duplicate ' +
      'on plateNo / vin (old plates of any vehicle are retired)',
  })
  update(@Param('id') id: string, @Body() dto: VehicleUpdateDto): Promise<VehicleDetail> {
    return this.vehicles.update(id, dto);
  }

  @Post(':id/convert-to-private')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Taxi -> private conversion (one transaction): records the plate change (old taxi plate ' +
      'kept and retired), creates the CONVERSION_TAX expense on the open cycle when ' +
      'conversionTax > 0 (paid by us, no VAT), sets plateNo = newPlateNo, isTaxi = false, ' +
      'convertedAt, clears the meter and expectedConversionTax, listingPrice = listingPrice ?? ' +
      'current price + conversionTax. Returns the vehicle file',
  })
  @ApiBadRequestResponse({
    description:
      'errors.validation with field errors: newPlateNo validation.samePlate | ' +
      'validation.privatePlateExpected (taxi plate ending 25 / 26); convertedAt ' +
      'validation.dateInFuture | validation.outsideCycle (before the open cycle started)',
  })
  @ApiConflictResponse({
    description:
      'errors.vehicleNotTaxi | errors.vehicleNotAvailable (not OWNED) | errors.vehicleLeased ' +
      '(LEASED or open lease segment) | errors.invalidTransition (status not IN_STOCK / ' +
      'RESERVED) | errors.licenseStillRegistered | errors.conflict with validation.duplicate on ' +
      'newPlateNo (used by a vehicle or an old plate)',
  })
  @ApiNotFoundResponse({ description: 'errors.notFound (vehicle, or vendorId field error)' })
  convertToPrivate(
    @Param('id') id: string,
    @Body() dto: VehicleConvertDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<VehicleDetail> {
    return this.conversion.convert(id, dto, user.id);
  }

  @Patch(':id/conversion')
  @ApiOperation({
    summary:
      'Corrects the latest taxi -> private conversion (convertedAt, newPlateNo, ' +
      'conversionTax, notes); the vehicle plate / convertedAt and the customs expense follow ' +
      '(created or deleted when the customs move from / to 0). No revert. Returns the vehicle file',
  })
  @ApiBadRequestResponse({
    description:
      'errors.validation: newPlateNo validation.samePlate | validation.privatePlateExpected; ' +
      'convertedAt validation.dateInFuture | validation.outsideCycle',
  })
  @ApiConflictResponse({
    description: 'errors.conflict with validation.duplicate on newPlateNo | errors.expenseRebilled',
  })
  @ApiNotFoundResponse({ description: 'errors.notFound (vehicle missing or never converted)' })
  updateConversion(
    @Param('id') id: string,
    @Body() dto: VehicleConversionUpdateDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<VehicleDetail> {
    return this.conversion.updateConversion(id, dto, user.id);
  }

  @Post(':id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Manual status change: IN_STOCK<->RESERVED, IN_STOCK->SCRAPPED (closes the cycle), ' +
      'LEASED->IN_STOCK (no open lease segment), EXTERNAL->IN_STOCK (becomes OWNED, opens a cycle)',
  })
  @ApiConflictResponse({
    description:
      'errors.invalidTransition | errors.useDeal (SOLD) | errors.vehicleLeased | ' +
      'errors.dealPending (reserved by a draft / pending sale)',
  })
  changeStatus(
    @Param('id') id: string,
    @Body() dto: VehicleStatusChangeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<VehicleDetail> {
    return this.vehicles.changeStatus(id, dto, user.id);
  }
}
