import {
  LeaseActivationSchema,
  LeaseBillingPreviewQuerySchema,
  LeaseBillingRunSchema,
  LeaseChecklistsSchema,
  LeaseDepositRequestSchema,
  LeaseDraftCreateSchema,
  LeaseDraftUpdateSchema,
  LeaseEndRequestSchema,
  LeaseQuerySchema,
  LeaseSummaryQuerySchema,
  LeaseRenewSchema,
  LeaseSegmentCreateSchema,
} from '@renawi/shared';
import { createZodDto } from 'nestjs-zod';

export class LeaseCreateDto extends createZodDto(LeaseDraftCreateSchema) {}
export class LeaseUpdateDto extends createZodDto(LeaseDraftUpdateSchema) {}
export class LeaseQueryDto extends createZodDto(LeaseQuerySchema) {}
export class LeaseSummaryQueryDto extends createZodDto(LeaseSummaryQuerySchema) {}
/** Body of `POST /leases/:id/activate` (optional; parsed with `parseOptionalBody`). */
export class LeaseActivationDto extends createZodDto(LeaseActivationSchema) {}
export class LeaseSegmentCreateDto extends createZodDto(LeaseSegmentCreateSchema) {}
export class LeaseEndDto extends createZodDto(LeaseEndRequestSchema) {}
export class LeaseRenewDto extends createZodDto(LeaseRenewSchema) {}
export class LeaseDepositDto extends createZodDto(LeaseDepositRequestSchema) {}
export class LeaseChecklistsDto extends createZodDto(LeaseChecklistsSchema) {}
export class LeaseBillingPreviewQueryDto extends createZodDto(LeaseBillingPreviewQuerySchema) {}
/** Body of `POST /leases/billing/run` (optional). */
export class LeaseBillingRunDto extends createZodDto(LeaseBillingRunSchema) {}
