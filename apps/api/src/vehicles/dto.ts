import {
  BusinessInsuranceCreateSchema,
  ConsignSchema,
  CycleReturnSchema,
  ExpenseCreateSchema,
  ExpenseQuerySchema,
  ExpenseUpdateSchema,
  InsuranceCreateSchema,
  InsuranceQuerySchema,
  InsuranceUpdateSchema,
  OdometerCreateSchema,
  OdometerQuerySchema,
  VehicleCreateSchema,
  VehicleQuerySchema,
  VehicleStatusChangeSchema,
  VehicleUpdateSchema,
} from '@renawi/shared';
import { createZodDto } from 'nestjs-zod';

export class VehicleCreateDto extends createZodDto(VehicleCreateSchema) {}
export class VehicleUpdateDto extends createZodDto(VehicleUpdateSchema) {}
export class VehicleQueryDto extends createZodDto(VehicleQuerySchema) {}
export class VehicleStatusChangeDto extends createZodDto(VehicleStatusChangeSchema) {}

export class ExpenseCreateDto extends createZodDto(ExpenseCreateSchema) {}
export class ExpenseUpdateDto extends createZodDto(ExpenseUpdateSchema) {}
export class ExpenseQueryDto extends createZodDto(ExpenseQuerySchema) {}

export class InsuranceCreateDto extends createZodDto(InsuranceCreateSchema) {}
export class BusinessInsuranceCreateDto extends createZodDto(BusinessInsuranceCreateSchema) {}
export class InsuranceUpdateDto extends createZodDto(InsuranceUpdateSchema) {}
export class InsuranceQueryDto extends createZodDto(InsuranceQuerySchema) {}

export class OdometerCreateDto extends createZodDto(OdometerCreateSchema) {}
export class OdometerQueryDto extends createZodDto(OdometerQuerySchema) {}

export class ConsignDto extends createZodDto(ConsignSchema) {}
/** Body of `POST /cycles/:id/return` (optional; parsed with `parseOptionalBody`). */
export class CycleReturnDto extends createZodDto(CycleReturnSchema) {}
