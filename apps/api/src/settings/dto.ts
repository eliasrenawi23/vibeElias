import { SettingsUpdateSchema } from '@renawi/shared';
import { createZodDto } from 'nestjs-zod';

export class SettingsUpdateDto extends createZodDto(SettingsUpdateSchema) {}
