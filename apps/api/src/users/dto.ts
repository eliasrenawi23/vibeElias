import { UserCreateSchema, UserQuerySchema, UserUpdateSchema } from '@renawi/shared';
import { createZodDto } from 'nestjs-zod';

export class UserCreateDto extends createZodDto(UserCreateSchema) {}
export class UserUpdateDto extends createZodDto(UserUpdateSchema) {}
export class UserQueryDto extends createZodDto(UserQuerySchema) {}
