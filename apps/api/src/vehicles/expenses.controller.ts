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
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Audited } from '../common/audit/audit.decorator';
import { ExpenseCreateDto, ExpenseQueryDto, ExpenseUpdateDto } from './dto';
import { ExpenseList, ExpensesService, ExpenseView } from './expenses.service';

@ApiTags('expenses')
@ApiCookieAuth()
@Controller()
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get('vehicles/:id/expenses')
  @ApiOperation({
    summary:
      'Expenses of a vehicle, newest first, filtered by from/to/category/paidBy/cycleId ' +
      '(no paging) + summary { total, paidByUs, count, byCategory }',
  })
  list(@Param('id') vehicleId: string, @Query() query: ExpenseQueryDto): Promise<ExpenseList> {
    return this.expenses.list(vehicleId, query);
  }

  @Post('vehicles/:id/expenses')
  @Audited('VehicleExpense', { idFromResult: true })
  @ApiOperation({ summary: 'Add an expense; without cycleId it joins the open inventory cycle' })
  create(@Param('id') vehicleId: string, @Body() dto: ExpenseCreateDto): Promise<ExpenseView> {
    return this.expenses.create(vehicleId, dto);
  }

  @Get('expenses/:id')
  get(@Param('id') id: string): Promise<ExpenseView> {
    return this.expenses.get(id);
  }

  @Patch('expenses/:id')
  @Audited('VehicleExpense')
  @ApiConflictResponse({ description: 'errors.expenseRebilled (amount of a rebilled expense)' })
  update(@Param('id') id: string, @Body() dto: ExpenseUpdateDto): Promise<ExpenseView> {
    return this.expenses.update(id, dto);
  }

  @Delete('expenses/:id')
  @Audited('VehicleExpense')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Deleted together with its documents' })
  @ApiConflictResponse({ description: 'errors.expenseRebilled (passed on to a driver)' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.expenses.delete(id);
  }
}
