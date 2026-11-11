import {
  ReminderCreateSchema,
  ReminderQuerySchema,
  RemindersFeedQuerySchema,
  ReminderUpdateSchema,
} from '@renawi/shared';
import { createZodDto } from 'nestjs-zod';

export class RemindersFeedQueryDto extends createZodDto(RemindersFeedQuerySchema) {}
export class ReminderQueryDto extends createZodDto(ReminderQuerySchema) {}
export class ReminderCreateDto extends createZodDto(ReminderCreateSchema) {}
export class ReminderUpdateDto extends createZodDto(ReminderUpdateSchema) {}
