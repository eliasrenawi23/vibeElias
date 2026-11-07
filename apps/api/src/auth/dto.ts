import { LoginSchema, MeUpdateSchema } from '@renawi/shared';
import { createZodDto } from 'nestjs-zod';

export class LoginDto extends createZodDto(LoginSchema) {}
export class MeUpdateDto extends createZodDto(MeUpdateSchema) {}
