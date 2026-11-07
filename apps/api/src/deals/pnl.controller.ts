import { Controller, Get, Param } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LicensePnl, PnlService, VehiclePnl } from './pnl.service';

@ApiTags('vehicles')
@ApiCookieAuth()
@Controller('vehicles')
export class VehiclePnlController {
  constructor(private readonly pnl: PnlService) {}

  @Get(':id/pnl')
  @ApiOperation({
    summary:
      'Profit & loss per inventory cycle (newest first, cancelled cycles left out). revenue: ' +
      'sale price (OWNED) or commission (CONSIGNED) + leaseIncome (non-void charges minus ' +
      'credits attributed to the car within the cycle) + rebilled (expenses passed on to ' +
      'drivers). costs: purchase + expenses paid by us (net of reclaimable VAT) + vatOnMargin ' +
      '(sale VAT minus input VAT of a FULL-VAT purchase; consignment VAT is on the commission ' +
      'at business level). An open cycle uses the listing price as proxy sale (unrealised)',
  })
  vehicle(@Param('id') id: string): Promise<VehiclePnl> {
    return this.pnl.vehiclePnl(id);
  }
}

@ApiTags('taxi-licenses')
@ApiCookieAuth()
@Controller('taxi-licenses')
export class LicensePnlController {
  constructor(private readonly pnl: PnlService) {}

  @Get(':id/pnl')
  @ApiOperation({
    summary:
      'Licence P&L: acquisition / sale price, income per year from non-void ledger entries ' +
      '(rentIncome = RENT charges - credits, otherIncome = other charges; rebilled expenses ' +
      'excluded), totalIncome, net = totalIncome + salePrice - acquisitionPrice',
  })
  license(@Param('id') id: string): Promise<LicensePnl> {
    return this.pnl.licensePnl(id);
  }
}
