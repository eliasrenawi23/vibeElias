import {
  DealCancelRequestSchema,
  DealCompleteRequestSchema,
  DealCreateRequestSchema,
  DealDisclosureSchema,
  DealPaymentRequestSchema,
  DealQuerySchema,
  DealSummaryQuerySchema,
  DealTransferRequestSchema,
  DealUpdateRequestSchema,
} from '@renawi/shared';
import { createZodDto } from 'nestjs-zod';

export class DealQueryDto extends createZodDto(DealQuerySchema) {}
export class DealSummaryQueryDto extends createZodDto(DealSummaryQuerySchema) {}
/**
 * `POST /deals` body (discriminated union by `type`). A union cannot back a DTO class, so the
 * controller parses it with `parseBody`; this DTO only documents the body in Swagger.
 */
export const DealCreateDto = createZodDto(DealCreateRequestSchema);
export class DealUpdateDto extends createZodDto(DealUpdateRequestSchema) {}
export class DealDisclosureDto extends createZodDto(DealDisclosureSchema) {}
/** Body of `POST /deals/:id/complete` (optional; parsed with `parseOptionalBody`). */
export class DealCompleteDto extends createZodDto(DealCompleteRequestSchema) {}
/** Body of `POST /deals/:id/cancel` (optional; parsed with `parseOptionalBody`). */
export class DealCancelDto extends createZodDto(DealCancelRequestSchema) {}
export class DealPaymentDto extends createZodDto(DealPaymentRequestSchema) {}
export class DealTransferDto extends createZodDto(DealTransferRequestSchema) {}
