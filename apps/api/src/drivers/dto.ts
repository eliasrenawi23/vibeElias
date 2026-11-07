import { DriverCreateSchema, DriverQuerySchema, DriverUpdateSchema } from '@renawi/shared';
import { createZodDto } from 'nestjs-zod';

export class DriverCreateDto extends createZodDto(DriverCreateSchema) {}
export class DriverUpdateDto extends createZodDto(DriverUpdateSchema) {}
export class DriverQueryDto extends createZodDto(DriverQuerySchema) {}
