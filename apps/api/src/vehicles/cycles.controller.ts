import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CycleReturnSchema } from '@renawi/shared';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { Audited } from '../common/audit/audit.decorator';
import { parseOptionalBody } from '../common/zod-body';
import { CyclesService } from './cycles.service';
import { ConsignDto, CycleReturnDto } from './dto';
import { CycleView, VehicleDetail } from './vehicle-views';

@ApiTags('cycles')
@ApiCookieAuth()
@Controller()
export class CyclesController {
  constructor(private readonly cycles: CyclesService) {}

  @Get('vehicles/:id/cycles')
  @ApiOperation({ summary: 'Inventory cycles, newest first, with consignor and expense totals' })
  list(@Param('id') vehicleId: string): Promise<CycleView[]> {
    return this.cycles.list(vehicleId);
  }

  @Post('vehicles/:id/consign')
  @HttpCode(HttpStatus.OK)
  @Audited('Vehicle')
  @ApiOperation({
    summary:
      'Consignment intake: opens a CONSIGNED cycle, vehicle becomes CONSIGNED / IN_STOCK, the ' +
      'consignor is tagged CONSIGNOR. Returns the vehicle file',
  })
  @ApiConflictResponse({ description: 'errors.cycleOpen | errors.vehicleLeased' })
  consign(
    @Param('id') vehicleId: string,
    @Body() dto: ConsignDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<VehicleDetail> {
    return this.cycles.consign(vehicleId, dto, user.id);
  }

  @Post('cycles/:id/return')
  @HttpCode(HttpStatus.OK)
  @Audited('InventoryCycle')
  @ApiBody({ type: CycleReturnDto, required: false })
  @ApiOperation({
    summary:
      'Return a consigned car: ends the open CONSIGNED cycle (RETURNED_TO_CONSIGNOR), vehicle ' +
      'status RETURNED. Returns the vehicle file',
  })
  @ApiConflictResponse({
    description:
      'errors.noOpenCycle (already ended) | errors.invalidTransition (OWNED cycle) | ' +
      'errors.dealPending (draft / pending deal on the cycle)',
  })
  returnToConsignor(
    @Param('id') cycleId: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<VehicleDetail> {
    return this.cycles.returnToConsignor(
      cycleId,
      parseOptionalBody(CycleReturnSchema, body),
      user.id,
    );
  }
}
