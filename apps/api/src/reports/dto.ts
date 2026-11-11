import {
  ExpensesReportQuerySchema,
  FinesReportQuerySchema,
  InventoryAgeingQuerySchema,
  LeaseIncomeReportQuerySchema,
  ProfitReportQuerySchema,
  ReceivablesReportQuerySchema,
  TradeBookQuerySchema,
} from '@renawi/shared';
import { createZodDto } from 'nestjs-zod';

export class ProfitReportQueryDto extends createZodDto(ProfitReportQuerySchema) {}
export class InventoryAgeingQueryDto extends createZodDto(InventoryAgeingQuerySchema) {}
export class ReceivablesReportQueryDto extends createZodDto(ReceivablesReportQuerySchema) {}
export class ExpensesReportQueryDto extends createZodDto(ExpensesReportQuerySchema) {}
export class LeaseIncomeReportQueryDto extends createZodDto(LeaseIncomeReportQuerySchema) {}
export class TradeBookQueryDto extends createZodDto(TradeBookQuerySchema) {}
export class FinesReportQueryDto extends createZodDto(FinesReportQuerySchema) {}
