import {
  TaxiLicenseCreateSchema,
  TaxiLicenseQuerySchema,
  TaxiLicenseRegisterVehicleSchema,
  TaxiLicenseUpdateSchema,
} from '@renawi/shared';
import { createZodDto } from 'nestjs-zod';

export class TaxiLicenseCreateDto extends createZodDto(TaxiLicenseCreateSchema) {}
export class TaxiLicenseUpdateDto extends createZodDto(TaxiLicenseUpdateSchema) {}
export class TaxiLicenseQueryDto extends createZodDto(TaxiLicenseQuerySchema) {}
export class TaxiLicenseRegisterVehicleDto extends createZodDto(TaxiLicenseRegisterVehicleSchema) {}
