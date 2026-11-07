import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { DOCUMENT_OWNER_KEYS, DocKind, Locale } from '@renawi/shared';
import type { Request, Response } from 'express';
import { pipeline } from 'node:stream/promises';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { Audited } from '../common/audit/audit.decorator';
import { DocumentsService, DocumentView, UploadedFileLike } from './documents.service';
import { DocumentCreateDto, DocumentQueryDto, DocumentUpdateDto } from './dto';

/** RFC 6266 / 5987 `Content-Disposition` with an ASCII fallback and the UTF-8 file name. */
export function contentDisposition(type: 'inline' | 'attachment', fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(fileName).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

function isTruthyFlag(value: unknown): boolean {
  return value === '1' || value === 'true' || value === 'yes';
}

const UPLOAD_SCHEMA = {
  type: 'object',
  required: ['file', 'kind'],
  properties: {
    file: { type: 'string', format: 'binary', description: 'PDF, JPEG, PNG or WebP' },
    kind: { type: 'string', enum: [...DocKind.options] },
    title: { type: 'string' },
    lang: { type: 'string', enum: [...Locale.options] },
    expiresAt: { type: 'string', format: 'date' },
    ...Object.fromEntries(
      DOCUMENT_OWNER_KEYS.map((k) => [k, { type: 'string', description: 'exactly one owner' }]),
    ),
  },
};

@ApiTags('documents')
@ApiCookieAuth()
@Controller('documents')
export class DocumentsController {
  private readonly logger = new Logger(DocumentsController.name);

  constructor(private readonly documents: DocumentsService) {}

  @Post()
  @Audited('Document')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: UPLOAD_SCHEMA })
  @ApiOperation({
    summary:
      'Upload a file for exactly one owner. Type sniffed from content (pdf/jpeg/png/webp, else ' +
      '415 errors.unsupportedFileType); over MAX_UPLOAD_MB -> 413 errors.fileTooLarge; images ' +
      'get a 320px webp thumbnail',
  })
  upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: DocumentCreateDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DocumentView> {
    return this.documents.upload(file as UploadedFileLike | undefined, dto, user.id);
  }

  @Get()
  @ApiOperation({
    summary:
      'Documents newest first, filtered by at most one owner id, kind and expiringBefore. ' +
      'With an owner filter all matches are returned; without one, page/pageSize apply',
  })
  list(@Query() query: DocumentQueryDto): Promise<DocumentView[]> {
    return this.documents.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<DocumentView> {
    return this.documents.get(id);
  }

  @Get(':id/file')
  @ApiProduces('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
  @ApiQuery({
    name: 'download',
    required: false,
    description: '1 = Content-Disposition attachment',
  })
  @ApiOperation({
    summary: 'Stream the stored file (cookie auth works for <img>/<a> on the same origin)',
  })
  async file(
    @Param('id') id: string,
    @Query('download') download: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.send(id, 'file', isTruthyFlag(download), req, res);
  }

  @Get(':id/thumb')
  @ApiProduces('image/webp')
  @ApiOperation({ summary: 'Webp thumbnail of an image document (404 when there is none)' })
  async thumb(@Param('id') id: string, @Req() req: Request, @Res() res: Response): Promise<void> {
    await this.send(id, 'thumb', false, req, res);
  }

  @Patch(':id')
  @Audited('Document')
  @ApiOperation({ summary: 'Update kind / title / lang / expiresAt (the owner cannot change)' })
  update(@Param('id') id: string, @Body() dto: DocumentUpdateDto): Promise<DocumentView> {
    return this.documents.update(id, dto);
  }

  @Delete(':id')
  @Audited('Document')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Row deleted, then its files' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.documents.delete(id);
  }

  private async send(
    id: string,
    variant: 'file' | 'thumb',
    download: boolean,
    req: Request,
    res: Response,
  ): Promise<void> {
    const file = await this.documents.openFile(id, variant);
    res.setHeader('ETag', file.etag);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.headers['if-none-match'] === file.etag) {
      res.status(HttpStatus.NOT_MODIFIED).end();
      return;
    }
    res.status(HttpStatus.OK);
    res.setHeader('Content-Type', file.mime);
    res.setHeader('Content-Length', String(file.size));
    res.setHeader(
      'Content-Disposition',
      contentDisposition(download ? 'attachment' : 'inline', file.fileName),
    );
    const stream = await file.open();
    try {
      await pipeline(stream, res);
    } catch (e) {
      // Client went away or the disk read failed mid-stream; headers are already sent.
      this.logger.warn(`Streaming document ${id} aborted: ${(e as Error).message}`);
      res.destroy();
    }
  }
}
