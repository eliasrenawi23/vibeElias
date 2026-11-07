import {
  DriverLedgerQuerySchema,
  LedgerAgeingQuerySchema,
  LedgerBalancesQuerySchema,
  LedgerChargeCreateSchema,
  LedgerCreditCreateSchema,
  LedgerPaymentCreateSchema,
  LedgerQuerySchema,
  LedgerVoidSchema,
} from '@renawi/shared';
import { createZodDto } from 'nestjs-zod';

export class LedgerQueryDto extends createZodDto(LedgerQuerySchema) {}
export class LedgerChargeCreateDto extends createZodDto(LedgerChargeCreateSchema) {}
export class LedgerPaymentCreateDto extends createZodDto(LedgerPaymentCreateSchema) {}
export class LedgerCreditCreateDto extends createZodDto(LedgerCreditCreateSchema) {}
export class LedgerVoidDto extends createZodDto(LedgerVoidSchema) {}
export class LedgerBalancesQueryDto extends createZodDto(LedgerBalancesQuerySchema) {}
export class LedgerAgeingQueryDto extends createZodDto(LedgerAgeingQuerySchema) {}
export class DriverLedgerQueryDto extends createZodDto(DriverLedgerQuerySchema) {}
