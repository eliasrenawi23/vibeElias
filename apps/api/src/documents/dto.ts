import { DocumentCreateSchema, DocumentQuerySchema, DocumentUpdateSchema } from '@renawi/shared';
import { createZodDto } from 'nestjs-zod';

/** Metadata fields of the multipart `POST /documents` request (next to the `file` part). */
export class DocumentCreateDto extends createZodDto(DocumentCreateSchema) {}
export class DocumentUpdateDto extends createZodDto(DocumentUpdateSchema) {}
export class DocumentQueryDto extends createZodDto(DocumentQuerySchema) {}
