import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import sharp from 'sharp';
import request from 'supertest';
import { binaryParser, daysFromToday, expectError, Session, startSession, today } from './helpers';
import { XHR } from './utils';

interface DocBody {
  id: string;
  kind: string;
  fileName: string;
  mime: string;
  size: number;
  hasThumb: boolean;
  title: string | null;
  lang: string | null;
  expiresAt: string | null;
  url: string;
  thumbUrl: string | null;
  vehicleId: string | null;
  contactId: string | null;
  expenseId: string | null;
  [key: string]: unknown;
}

async function makePdf(text: string): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText(text, { x: 48, y: 780, size: 14, font });
  return Buffer.from(await pdf.save());
}

function makeImage(format: 'png' | 'jpeg' | 'webp', width = 800, height = 500): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 245, g: 197, b: 24 } },
  })
    .toFormat(format)
    .toBuffer();
}

/** Every file under the upload root (relative paths). */
function storedFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  const walk = (dir: string, prefix: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full, `${prefix}${name}/`);
      else out.push(`${prefix}${name}`);
    }
  };
  walk(root, '');
  return out.sort();
}

describe('Documents (e2e)', () => {
  let s: Session;
  let uploadRoot: string;
  let vehicleId: string;
  let contactId: string;
  let pdf: Buffer;
  let png: Buffer;

  beforeAll(async () => {
    s = await startSession();
    uploadRoot = resolve(process.env.UPLOAD_DIR as string);
    vehicleId = (
      await s.api
        .post('/api/vehicles')
        .send({ plateNo: '31-245-625', make: 'Toyota', model: 'Corolla', year: 2023, isTaxi: true })
        .expect(201)
    ).body.id as string;
    contactId = (
      await s.api.post('/api/contacts').send({ firstName: 'خالد', lastName: 'عودة' }).expect(201)
    ).body.id as string;
    pdf = await makePdf('Vehicle licence 312-45-625');
    png = await makeImage('png');
  });

  afterAll(async () => {
    await s.t.app.close();
  });

  function upload(
    file: Buffer | null,
    fields: Record<string, string>,
    fileName = 'file.bin',
    contentType = 'application/octet-stream',
  ) {
    const req = s.api.post('/api/documents');
    for (const [k, v] of Object.entries(fields)) req.field(k, v);
    if (file) req.attach('file', file, { filename: fileName, contentType });
    return req;
  }

  async function fileKeyOf(id: string): Promise<string> {
    return (await s.t.prisma.document.findUniqueOrThrow({ where: { id } })).fileKey;
  }

  describe('upload', () => {
    it('requires authentication and the X-Requested-With header', async () => {
      await request(s.t.http)
        .post('/api/documents')
        .set(XHR)
        .field('kind', 'PHOTO')
        .field('vehicleId', vehicleId)
        .attach('file', png, 'a.png')
        .expect(401);
      await request(s.t.http)
        .post('/api/documents')
        .set('Cookie', s.cookie)
        .field('kind', 'PHOTO')
        .field('vehicleId', vehicleId)
        .attach('file', png, 'a.png')
        .expect(403);
      expect(storedFiles(uploadRoot)).toEqual([]);
    });

    it('stores a PDF under yyyy/mm/<uuid>.pdf and returns the document with its url', async () => {
      const res = await upload(
        pdf,
        {
          kind: 'CAR_LICENSE',
          vehicleId,
          title: 'רישיון רכב',
          lang: 'he',
          expiresAt: daysFromToday(150),
        },
        'רישיון רכב 2026.pdf',
        'application/pdf',
      ).expect(201);
      const doc = res.body as DocBody;
      expect(doc).toMatchObject({
        kind: 'CAR_LICENSE',
        fileName: 'רישיון רכב 2026.pdf',
        mime: 'application/pdf',
        size: pdf.length,
        hasThumb: false,
        title: 'רישיון רכב',
        lang: 'he',
        expiresAt: daysFromToday(150),
        vehicleId,
        contactId: null,
        url: `/api/documents/${doc.id}/file`,
        thumbUrl: null,
      });
      expect(doc).not.toHaveProperty('fileKey');

      const key = await fileKeyOf(doc.id);
      expect(key).toMatch(/^\d{4}\/\d{2}\/[0-9a-f-]{36}\.pdf$/);
      expect(statSync(join(uploadRoot, key)).size).toBe(pdf.length);

      const audit = await s.t.prisma.auditLog.findFirst({
        where: { entity: 'Document', entityId: doc.id, action: 'CREATE' },
      });
      expect(audit).not.toBeNull();
    });

    it('sniffs images by content and stores a webp thumbnail of at most 320px', async () => {
      // Declared as a binary blob with a misleading name: the magic bytes decide.
      const res = await upload(png, { kind: 'PHOTO', vehicleId }, 'IMG_0001.bin').expect(201);
      const doc = res.body as DocBody;
      expect(doc).toMatchObject({
        mime: 'image/png',
        hasThumb: true,
        thumbUrl: `/api/documents/${doc.id}/thumb`,
        lang: null,
        expiresAt: null,
      });
      expect(doc.fileName).toBe('IMG_0001.bin');
      const key = await fileKeyOf(doc.id);
      expect(key).toMatch(/\.png$/);
      expect(existsSync(join(uploadRoot, `${key}.thumb.webp`))).toBe(true);

      const thumb = await s.api
        .get(`/api/documents/${doc.id}/thumb`)
        .buffer(true)
        .parse(binaryParser)
        .expect(200);
      expect(thumb.headers['content-type']).toBe('image/webp');
      const meta = await sharp(thumb.body as Buffer).metadata();
      expect(meta).toMatchObject({ format: 'webp', width: 320, height: 200 });

      for (const [format, ext] of [
        ['jpeg', 'jpg'],
        ['webp', 'webp'],
      ] as const) {
        const other = await upload(
          await makeImage(format, 200, 120),
          { kind: 'PHOTO', contactId },
          `scan-${format}`,
        ).expect(201);
        expect(other.body).toMatchObject({
          mime: `image/${format}`,
          hasThumb: true,
          contactId,
          // No extension in the upload name: the sniffed one is appended.
          fileName: `scan-${format}.${ext}`,
        });
        // Small images are never enlarged.
        const t = await s.api
          .get(other.body.thumbUrl as string)
          .buffer(true)
          .parse(binaryParser)
          .expect(200);
        expect(await sharp(t.body as Buffer).metadata()).toMatchObject({ width: 200, height: 120 });
      }
    });

    it('rejects content that is not pdf / jpeg / png / webp with 415 (renamed text file)', async () => {
      const before = storedFiles(uploadRoot);
      const text = Buffer.from('This is not a PDF, just text renamed to .pdf\n', 'utf8');
      const res = await upload(text, { kind: 'OTHER', vehicleId }, 'notes.pdf', 'application/pdf');
      expectError(res, 415, 'errors.unsupportedFileType');

      // Right PNG signature, undecodable body.
      const fakePng = Buffer.concat([png.subarray(0, 8), Buffer.alloc(64, 7)]);
      const res2 = await upload(fakePng, { kind: 'PHOTO', vehicleId }, 'x.png', 'image/png');
      expectError(res2, 415, 'errors.unsupportedFileType');

      const gif = Buffer.from('GIF89a\x01\x00\x01\x00\x00\x00\x00;', 'latin1');
      expectError(
        await upload(gif, { kind: 'PHOTO', vehicleId }, 'a.gif'),
        415,
        'errors.unsupportedFileType',
      );
      expect(storedFiles(uploadRoot)).toEqual(before);
    });

    it('rejects files over MAX_UPLOAD_MB with 413 errors.fileTooLarge', async () => {
      const before = storedFiles(uploadRoot);
      // MAX_UPLOAD_MB=1 in the e2e environment.
      const big = Buffer.concat([pdf, Buffer.alloc(1024 * 1024 + 10, 0x20)]);
      const res = await upload(big, { kind: 'OTHER', vehicleId }, 'big.pdf', 'application/pdf');
      expectError(res, 413, 'errors.fileTooLarge');
      expect(storedFiles(uploadRoot)).toEqual(before);
    });

    it('needs exactly one existing owner, a kind and a file', async () => {
      const before = storedFiles(uploadRoot);
      expectError(await upload(pdf, { kind: 'OTHER' }), 400, 'errors.validation', [
        { path: 'vehicleId', message: 'validation.oneOwnerRequired' },
      ]);
      expectError(
        await upload(pdf, { kind: 'OTHER', vehicleId, contactId }),
        400,
        'errors.validation',
        [{ path: 'vehicleId', message: 'validation.oneOwnerRequired' }],
      );
      expectError(
        await upload(pdf, { kind: 'OTHER', vehicleId: 'no-such-vehicle' }),
        404,
        'errors.notFound',
        [{ path: 'vehicleId', message: 'errors.notFound' }],
      );
      expectError(
        await upload(pdf, { kind: 'OTHER', dealId: 'no-such-deal' }),
        404,
        'errors.notFound',
        [{ path: 'dealId', message: 'errors.notFound' }],
      );
      expectError(await upload(null, { kind: 'OTHER', vehicleId }), 400, 'errors.validation', [
        { path: 'file', message: 'validation.required' },
      ]);
      expectError(await upload(pdf, { vehicleId }), 400, 'errors.validation', [
        { path: 'kind', message: 'validation.required' },
      ]);
      expectError(await upload(pdf, { kind: 'SELFIE', vehicleId }), 400, 'errors.validation', [
        { path: 'kind', message: 'validation.invalidOption' },
      ]);
      expect(
        (await upload(pdf, { kind: 'OTHER', vehicleId, expiresAt: '2026-02-30' })).status,
      ).toBe(400);
      expect(storedFiles(uploadRoot)).toEqual(before);
    });
  });

  describe('download', () => {
    let doc: DocBody;

    beforeAll(async () => {
      doc = (
        await upload(pdf, { kind: 'INSURANCE', vehicleId }, 'פוליסה "מקיף" (2026).pdf').expect(201)
      ).body as DocBody;
    });

    it('streams the file inline with RFC 5987 filename, caching headers and ETag', async () => {
      const res = await s.api
        .get(`/api/documents/${doc.id}/file`)
        .buffer(true)
        .parse(binaryParser)
        .expect(200);
      expect(Buffer.compare(res.body as Buffer, pdf)).toBe(0);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-length']).toBe(String(pdf.length));
      expect(res.headers['cache-control']).toBe('private, max-age=3600');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers.etag).toMatch(/^".+"$/);
      // Quotes are dropped from the stored name; the header carries an ASCII fallback plus the
      // percent-encoded UTF-8 name (RFC 5987), with ( ) encoded too.
      expect(doc.fileName).toBe('פוליסה מקיף (2026).pdf');
      expect(res.headers['content-disposition']).toBe(
        `inline; filename="______ ____ (2026).pdf"; filename*=UTF-8''` +
          '%D7%A4%D7%95%D7%9C%D7%99%D7%A1%D7%94%20%D7%9E%D7%A7%D7%99%D7%A3%20%282026%29.pdf',
      );

      const attachment = await s.api
        .get(`/api/documents/${doc.id}/file?download=1`)
        .buffer(true)
        .parse(binaryParser)
        .expect(200);
      expect(attachment.headers['content-disposition']).toMatch(/^attachment; filename="/);

      const cached = await s.api
        .get(`/api/documents/${doc.id}/file`)
        .set('If-None-Match', res.headers.etag as string);
      expect(cached.status).toBe(304);
    });

    it('needs authentication; 404 for an unknown id or a missing thumbnail', async () => {
      await request(s.t.http).get(`/api/documents/${doc.id}/file`).expect(401);
      expectError(await s.api.get(`/api/documents/${doc.id}/thumb`), 404, 'errors.notFound');
      expectError(await s.api.get('/api/documents/nope/file'), 404, 'errors.notFound');
      expectError(await s.api.get('/api/documents/nope'), 404, 'errors.notFound');
      const one = await s.api.get(`/api/documents/${doc.id}`).expect(200);
      expect(one.body).toMatchObject({ id: doc.id, kind: 'INSURANCE', url: doc.url });
    });

    it('404 (not 500) when the stored file vanished', async () => {
      const orphan = (await upload(pdf, { kind: 'OTHER', contactId }).expect(201)).body as DocBody;
      const { rmSync } = await import('node:fs');
      rmSync(join(uploadRoot, await fileKeyOf(orphan.id)));
      expectError(await s.api.get(`/api/documents/${orphan.id}/file`), 404, 'errors.notFound');
      await s.api.del(`/api/documents/${orphan.id}`).expect(204);
    });
  });

  describe('list, update, delete', () => {
    let listVehicleId: string;
    let license: DocBody;
    let insurance: DocBody;
    let photo: DocBody;

    beforeAll(async () => {
      listVehicleId = (
        await s.api
          .post('/api/vehicles')
          .send({ plateNo: '84-731-26', make: 'Skoda', model: 'Octavia', year: 2016 })
          .expect(201)
      ).body.id as string;
      license = (
        await upload(pdf, {
          kind: 'CAR_LICENSE',
          vehicleId: listVehicleId,
          expiresAt: daysFromToday(25),
        }).expect(201)
      ).body as DocBody;
      insurance = (
        await upload(pdf, {
          kind: 'INSURANCE',
          vehicleId: listVehicleId,
          expiresAt: daysFromToday(90),
        }).expect(201)
      ).body as DocBody;
      photo = (
        await upload(png, { kind: 'PHOTO', vehicleId: listVehicleId }, 'side.png').expect(201)
      ).body as DocBody;
    });

    const listIds = async (query: string) => {
      const res = await s.api.get(`/api/documents?${query}`).expect(200);
      return (res.body as DocBody[]).map((d) => d.id);
    };

    it('lists one owner newest first, filtered by kind and expiringBefore', async () => {
      expect(await listIds(`vehicleId=${listVehicleId}`)).toEqual([
        photo.id,
        insurance.id,
        license.id,
      ]);
      expect(await listIds(`vehicleId=${listVehicleId}&kind=PHOTO,CAR_LICENSE`)).toEqual([
        photo.id,
        license.id,
      ]);
      expect(
        await listIds(`vehicleId=${listVehicleId}&expiringBefore=${daysFromToday(30)}`),
      ).toEqual([license.id]);
      expect(await listIds(`vehicleId=${listVehicleId}&expiringBefore=${today()}`)).toEqual([]);
      // Other owners' documents are not mixed in.
      expect(await listIds(`contactId=${contactId}`)).toHaveLength(2);
      expect(await listIds(`expiringBefore=${daysFromToday(30)}`)).toEqual([license.id]);

      const res = await s.api.get(`/api/documents?vehicleId=${listVehicleId}`).expect(200);
      expect(res.body[0]).toMatchObject({ url: `/api/documents/${photo.id}/file`, hasThumb: true });
      expectError(
        await s.api.get(`/api/documents?vehicleId=${listVehicleId}&contactId=${contactId}`),
        400,
        'errors.validation',
        [{ path: 'vehicleId', message: 'validation.oneOwnerRequired' }],
      );

      const vehicle = await s.api.get(`/api/vehicles/${listVehicleId}`).expect(200);
      expect(vehicle.body.documentCount).toBe(3);
      const contact = await s.api.get(`/api/contacts/${contactId}`).expect(200);
      expect(contact.body.counts.documents).toBe(2);
    });

    it('PATCH updates kind / title / lang / expiresAt (empty clears)', async () => {
      const res = await s.api
        .patch(`/api/documents/${insurance.id}`)
        .send({ kind: 'RECEIPT', title: 'קבלה', lang: 'ar', expiresAt: daysFromToday(10) })
        .expect(200);
      expect(res.body).toMatchObject({
        kind: 'RECEIPT',
        title: 'קבלה',
        lang: 'ar',
        expiresAt: daysFromToday(10),
        vehicleId: listVehicleId,
      });
      const cleared = await s.api
        .patch(`/api/documents/${insurance.id}`)
        .send({ expiresAt: '', title: '' })
        .expect(200);
      expect(cleared.body).toMatchObject({ expiresAt: null, title: null, kind: 'RECEIPT' });
      expect(
        (await s.api.patch(`/api/documents/${insurance.id}`).send({ lang: 'fr' })).status,
      ).toBe(400);
      expectError(
        await s.api.patch('/api/documents/nope').send({ title: 'x' }),
        404,
        'errors.notFound',
      );
    });

    it('DELETE removes the row, then the file and its thumbnail', async () => {
      const key = await fileKeyOf(photo.id);
      expect(existsSync(join(uploadRoot, key))).toBe(true);
      expect(existsSync(join(uploadRoot, `${key}.thumb.webp`))).toBe(true);

      await s.api.del(`/api/documents/${photo.id}`).expect(204);
      expect(await s.t.prisma.document.findUnique({ where: { id: photo.id } })).toBeNull();
      expect(existsSync(join(uploadRoot, key))).toBe(false);
      expect(existsSync(join(uploadRoot, `${key}.thumb.webp`))).toBe(false);
      expectError(await s.api.get(`/api/documents/${photo.id}/file`), 404, 'errors.notFound');
      expectError(await s.api.del(`/api/documents/${photo.id}`), 404, 'errors.notFound');
      expect(
        await s.t.prisma.auditLog.count({
          where: { entity: 'Document', entityId: photo.id, action: 'DELETE' },
        }),
      ).toBe(1);
    });

    it('deleting an expense removes the files of its documents', async () => {
      const expense = await s.api
        .post(`/api/vehicles/${listVehicleId}/expenses`)
        .send({ category: 'REPAIR', date: today(), amount: 420 })
        .expect(201);
      const receipt = (
        await upload(await makeImage('jpeg'), {
          kind: 'RECEIPT',
          expenseId: expense.body.id,
        }).expect(201)
      ).body as DocBody;
      expect(receipt.expenseId).toBe(expense.body.id);
      const key = await fileKeyOf(receipt.id);

      await s.api.del(`/api/expenses/${expense.body.id}`).expect(204);
      expect(await s.t.prisma.document.findUnique({ where: { id: receipt.id } })).toBeNull();
      expect(existsSync(join(uploadRoot, key))).toBe(false);
      expect(existsSync(join(uploadRoot, `${key}.thumb.webp`))).toBe(false);
    });
  });
});
