import {
  FineCreateSchema,
  FineQuerySchema,
  FineSummaryQuerySchema,
  FineRebillSchema,
  FineUpdateSchema,
} from '@renawi/shared';
import { createZodDto } from 'nestjs-zod';

export class FineCreateDto extends createZodDto(FineCreateSchema) {}
export class FineUpdateDto extends createZodDto(FineUpdateSchema) {}
export class FineQueryDto extends createZodDto(FineQuerySchema) {}
export class FineSummaryQueryDto extends createZodDto(FineSummaryQuerySchema) {}
/** Body of `POST /fines/:id/rebill` (optional; parsed with `parseOptionalBody`). */
export class FineRebillDto extends createZodDto(FineRebillSchema) {}
