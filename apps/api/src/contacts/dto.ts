import { ContactCreateSchema, ContactQuerySchema, ContactUpdateSchema } from '@renawi/shared';
import { createZodDto } from 'nestjs-zod';

export class ContactCreateDto extends createZodDto(ContactCreateSchema) {}
export class ContactUpdateDto extends createZodDto(ContactUpdateSchema) {}
export class ContactQueryDto extends createZodDto(ContactQuerySchema) {}
