import { Injectable, Logger } from '@nestjs/common';
import { Document, Prisma } from '@prisma/client';
import {
  DOCUMENT_ONE_OWNER_REQUIRED,
  DOCUMENT_OWNER_KEYS,
  msg,
  type DocumentCreate,
  type DocumentOwnerKey,
  type DocumentQuery,
  type DocumentUpdate,
} from '@renawi/shared';
import type { Readable } from 'node:stream';
import { dbDate, dbDateOpt } from '../common/dates';
import { AppException } from '../common/errors/app-exception';
import { PrismaService } from '../prisma/prisma.service';
import { makeThumbnail, sniffFileType } from './file-type';
import { newStorageKey, StorageService, thumbKeyOf } from './storage/storage.service';

/** Document as returned by the API: the row without the storage key, plus download URLs. */
export type DocumentView = Omit<Document, 'fileKey'> & {
  url: string;
  thumbUrl: string | null;
};

/** The parts of a Multer file the service needs (memory storage). */
export interface UploadedFileLike {
  buffer: Buffer;
  originalname: string;
  size: number;
}

/** An opened stored file, ready to stream. */
export interface OpenedFile {
  doc: Document;
  mime: string;
  size: number;
  fileName: string;
  etag: string;
  open: () => Promise<Readable>;
}

/** Owner foreign key -> Prisma model delegate. */
const OWNER_MODELS: Record<DocumentOwnerKey, string> = {
  vehicleId: 'vehicle',
  driverId: 'driver',
  contactId: 'contact',
  dealId: 'deal',
  contractId: 'leaseContract',
  taxiLicenseId: 'taxiLicense',
  expenseId: 'vehicleExpense',
  ledgerEntryId: 'ledgerEntry',
};

interface ExistsDelegate {
  findUnique(args: { where: { id: string }; select: { id: true } }): Promise<unknown>;
}

/** URL prefix of the document routes (global prefix included). */
const DOCUMENTS_URL = '/api/documents';

/** File name safe to store and echo in headers: no paths, control or bidi characters. */
export function sanitizeFileName(name: string, fallbackBase: string, ext: string): string {
  const base = (name.split(/[\\/]/).pop() ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f‎‏‪-‮⁦-⁩"<>|?*:]/g, '')
    .trim()
    .slice(0, 200);
  const safe = base && base !== '.' && base !== '..' ? base : `${fallbackBase}.${ext}`;
  return /\.[A-Za-z0-9]{1,5}$/.test(safe) ? safe : `${safe}.${ext}`;
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  toView(doc: Document): DocumentView {
    const { fileKey: _fileKey, ...rest } = doc;
    return {
      ...rest,
      url: `${DOCUMENTS_URL}/${doc.id}/file`,
      thumbUrl: doc.hasThumb ? `${DOCUMENTS_URL}/${doc.id}/thumb` : null,
    };
  }

  /** Stores an uploaded file (+ thumbnail for images) and creates its Document row. */
  async upload(
    file: UploadedFileLike | undefined,
    dto: DocumentCreate,
    userId: string | null,
  ): Promise<DocumentView> {
    if (!file?.buffer?.length) throw AppException.fieldError('file', msg.required);
    const type = sniffFileType(file.buffer);
    if (!type) throw AppException.unsupportedMediaType();

    const owner = this.ownerOf(dto);
    await this.assertOwnerExists(owner.key, owner.id);

    let thumb: Buffer | null = null;
    if (type.isImage) {
      try {
        thumb = await makeThumbnail(file.buffer);
      } catch {
        // Right magic bytes, but not a decodable image.
        throw AppException.unsupportedMediaType();
      }
    }

    const key = newStorageKey(type.ext);
    const written: string[] = [];
    try {
      await this.storage.put(file.buffer, key, type.mime);
      written.push(key);
      if (thumb) {
        await this.storage.put(thumb, thumbKeyOf(key), 'image/webp');
        written.push(thumbKeyOf(key));
      }
      const doc = await this.prisma.document.create({
        data: {
          kind: dto.kind,
          fileKey: key,
          fileName: sanitizeFileName(file.originalname, dto.kind.toLowerCase(), type.ext),
          mime: type.mime,
          size: file.buffer.length,
          hasThumb: thumb !== null,
          title: dto.title ?? null,
          lang: dto.lang ?? null,
          expiresAt: dto.expiresAt ? dbDate(dto.expiresAt) : null,
          [owner.key]: owner.id,
          uploadedById: userId,
        },
      });
      return this.toView(doc);
    } catch (e) {
      await this.removeKeys(written);
      throw e;
    }
  }

  /** Documents of one owner (all, newest first) or across owners (paginated by page/pageSize). */
  async list(query: DocumentQuery): Promise<DocumentView[]> {
    const where: Prisma.DocumentWhereInput = {};
    let hasOwner = false;
    for (const key of DOCUMENT_OWNER_KEYS) {
      const value = query[key];
      if (value) {
        where[key] = value;
        hasOwner = true;
      }
    }
    if (query.kind?.length) where.kind = { in: query.kind };
    if (query.expiringBefore) where.expiresAt = { lte: dbDate(query.expiringBefore) };
    const rows = await this.prisma.document.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(hasOwner ? {} : { skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    });
    return rows.map((d) => this.toView(d));
  }

  async getRow(id: string): Promise<Document> {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw AppException.notFound();
    return doc;
  }

  async get(id: string): Promise<DocumentView> {
    return this.toView(await this.getRow(id));
  }

  async update(id: string, dto: DocumentUpdate): Promise<DocumentView> {
    await this.getRow(id);
    const doc = await this.prisma.document.update({
      where: { id },
      data: {
        kind: dto.kind,
        title: dto.title,
        lang: dto.lang,
        expiresAt: dbDateOpt(dto.expiresAt),
      },
    });
    return this.toView(doc);
  }

  /** Deletes the row first (so a failure leaves no dangling row), then its files. */
  async delete(id: string): Promise<void> {
    const doc = await this.getRow(id);
    await this.prisma.document.delete({ where: { id } });
    await this.removeFiles([doc]);
  }

  /** The original file or its thumbnail, with the metadata needed for the HTTP response. */
  async openFile(id: string, variant: 'file' | 'thumb'): Promise<OpenedFile> {
    const doc = await this.getRow(id);
    if (variant === 'thumb' && !doc.hasThumb) throw AppException.notFound();
    const key = variant === 'thumb' ? thumbKeyOf(doc.fileKey) : doc.fileKey;
    const info = await this.storage.stat(key);
    if (!info) {
      this.logger.warn(`File of document ${doc.id} is missing from storage (${key})`);
      throw AppException.notFound();
    }
    const fileName =
      variant === 'thumb' ? `${doc.fileName.replace(/\.[^.]+$/, '')}.webp` : doc.fileName;
    return {
      doc,
      mime: variant === 'thumb' ? 'image/webp' : doc.mime,
      size: info.size,
      fileName,
      etag: `"${doc.id}${variant === 'thumb' ? '-thumb' : ''}-${info.size}"`,
      open: () => this.storage.getStream(key),
    };
  }

  /** Best-effort removal of the stored files of already-deleted Document rows. */
  async removeFiles(docs: Pick<Document, 'fileKey' | 'hasThumb'>[]): Promise<void> {
    await this.removeKeys(
      docs.flatMap((d) => (d.hasThumb ? [d.fileKey, thumbKeyOf(d.fileKey)] : [d.fileKey])),
    );
  }

  private async removeKeys(keys: string[]): Promise<void> {
    for (const key of keys) {
      try {
        await this.storage.delete(key);
      } catch (e) {
        this.logger.error(`Could not delete stored file ${key}: ${(e as Error).message}`);
      }
    }
  }

  private ownerOf(dto: DocumentCreate): { key: DocumentOwnerKey; id: string } {
    const owners = DOCUMENT_OWNER_KEYS.flatMap((key) => {
      const id = dto[key];
      return id ? [{ key, id }] : [];
    });
    const [owner] = owners;
    if (owners.length !== 1 || !owner) {
      throw AppException.fieldError(DOCUMENT_OWNER_KEYS[0], DOCUMENT_ONE_OWNER_REQUIRED);
    }
    return owner;
  }

  private async assertOwnerExists(key: DocumentOwnerKey, id: string): Promise<void> {
    const delegate = (this.prisma as unknown as Record<string, ExistsDelegate>)[OWNER_MODELS[key]];
    const found = await delegate?.findUnique({ where: { id }, select: { id: true } });
    if (!found) throw AppException.notFoundField(key);
  }
}
