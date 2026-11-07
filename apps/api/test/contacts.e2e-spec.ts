import request from 'supertest';
import { daysFromToday, expectError, israeliId, Session, startSession } from './helpers';

describe('Contacts (e2e)', () => {
  let s: Session;
  const idDana = israeliId('03741596');
  const idKhoury = israeliId('20587341');

  beforeAll(async () => {
    s = await startSession();
  });

  afterAll(async () => {
    await s.t.app.close();
  });

  async function create(body: Record<string, unknown>) {
    const res = await s.api.post('/api/contacts').send(body);
    expect(res.status).toBe(201);
    return res.body as { id: string } & Record<string, unknown>;
  }

  it('requires authentication', async () => {
    await request(s.t.http).get('/api/contacts').expect(401);
  });

  it('creates a contact with normalised phones / ID and returns the detail shape', async () => {
    const res = await s.api
      .post('/api/contacts')
      .send({
        tags: ['LEAD', 'LEAD', 'BUYER'],
        firstName: 'דנה',
        lastName: 'אברהם',
        idNumber: idDana.replace(/^0/, ''), // printed without the leading zero
        phones: ['+972 58-661-2300', '050-123-4567'],
        email: ' Dana@Example.COM ',
        city: 'מגדל העמק',
        source: 'yad2',
        followUpAt: daysFromToday(3),
      })
      .expect(201);

    expect(res.body).toMatchObject({
      tags: ['LEAD', 'BUYER'],
      firstName: 'דנה',
      lastName: 'אברהם',
      idNumber: idDana,
      phones: ['0586612300', '0501234567'],
      email: 'dana@example.com',
      preferredLang: 'he',
      followUpAt: daysFromToday(3),
      archivedAt: null,
      driver: null,
      counts: { deals: 0, documents: 0 },
    });
    const audit = await s.t.prisma.auditLog.findFirst({
      where: { entity: 'Contact', entityId: res.body.id, action: 'CREATE' },
    });
    expect(audit).not.toBeNull();
  });

  it('requires some name', async () => {
    const res = await s.api.post('/api/contacts').send({ phones: ['0501112233'] });
    expectError(res, 400, 'errors.validation', [
      { path: 'firstName', message: 'validation.nameRequired' },
    ]);
  });

  it('rejects a duplicate ID number with 409 validation.duplicate', async () => {
    const res = await s.api
      .post('/api/contacts')
      .send({ companyName: 'Same person Ltd', idNumber: idDana });
    expectError(res, 409, 'errors.conflict', [
      { path: 'idNumber', message: 'validation.duplicate' },
    ]);
  });

  it('PATCH: duplicate ID -> 409, removing every name -> 400, other fields update', async () => {
    const other = await create({ firstName: 'أحمد', lastName: 'خوري', idNumber: idKhoury });

    const dup = await s.api.patch(`/api/contacts/${other.id}`).send({ idNumber: idDana });
    expectError(dup, 409, 'errors.conflict', [
      { path: 'idNumber', message: 'validation.duplicate' },
    ]);

    const noName = await s.api
      .patch(`/api/contacts/${other.id}`)
      .send({ firstName: '', lastName: null });
    expectError(noName, 400, 'errors.validation', [
      { path: 'firstName', message: 'validation.nameRequired' },
    ]);

    const ok = await s.api
      .patch(`/api/contacts/${other.id}`)
      .send({ idNumber: idKhoury, city: 'كفر كنا', phones: ['053-345-6789'], tags: ['LEAD'] })
      .expect(200);
    expect(ok.body).toMatchObject({ city: 'كفر كنا', phones: ['0533456789'], tags: ['LEAD'] });
  });

  it('GET /:id returns the driver profile and counts; unknown id -> 404', async () => {
    const c = await create({ firstName: 'خالد', lastName: 'عودة', tags: ['DRIVER'] });
    const driver = await s.t.prisma.driver.create({ data: { contactId: c.id } });
    await s.t.prisma.document.create({
      data: {
        kind: 'ID',
        fileKey: 'x/y.pdf',
        fileName: 'id.pdf',
        mime: 'application/pdf',
        size: 10,
        contactId: c.id,
      },
    });

    const res = await s.api.get(`/api/contacts/${c.id}`).expect(200);
    expect(res.body.driver).toEqual({ id: driver.id, status: 'ACTIVE' });
    expect(res.body.counts).toEqual({ deals: 0, documents: 1 });

    expectError(await s.api.get('/api/contacts/nope'), 404, 'errors.notFound');
  });

  describe('list', () => {
    beforeAll(async () => {
      await create({
        tags: ['GARAGE', 'SUPPLIER'],
        companyName: 'מוסך אבו סאלח',
        phones: ['046557812'],
        followUpAt: daysFromToday(-2),
      });
      await create({
        tags: ['INSURER'],
        companyName: 'Galil Insurance',
        email: 'noy@galil.example',
      });
    });

    it('paginates with total and sorts', async () => {
      const res = await s.api
        .get('/api/contacts?page=1&pageSize=2&sort=createdAt&order=asc')
        .expect(200);
      expect(res.body).toMatchObject({ page: 1, pageSize: 2, total: 5 });
      expect(res.body.items).toHaveLength(2);
      expect(res.body.items[0].firstName).toBe('דנה');
      const page3 = await s.api.get('/api/contacts?page=3&pageSize=2&order=asc').expect(200);
      expect(page3.body.items).toHaveLength(1);
    });

    it('searches name, "first last", company, email, ID and partial phone', async () => {
      const q = async (term: string) => {
        const res = await s.api.get(`/api/contacts?q=${encodeURIComponent(term)}`).expect(200);
        return (res.body.items as { firstName: string | null; companyName: string | null }[]).map(
          (c) => c.firstName ?? c.companyName,
        );
      };
      expect(await q('דנה')).toEqual(['דנה']);
      expect(await q('דנה אברהם')).toEqual(['דנה']);
      expect(await q('دنه')).toEqual([]);
      expect(await q('סאלח')).toEqual(['מוסך אבו סאלח']);
      expect(await q('GALIL')).toEqual(['Galil Insurance']);
      expect(await q(idKhoury.slice(0, 6))).toEqual(['أحمد']);
      expect(await q('050-123')).toEqual(['דנה']);
      expect(await q('+972 58 661')).toEqual(['דנה']);
      expect(await q('6557812')).toEqual(['מוסך אבו סאלח']);
    });

    it('filters by tag (any of) and follow-up date', async () => {
      const tags = async (query: string) => {
        const res = await s.api.get(`/api/contacts?${query}`).expect(200);
        return res.body.total as number;
      };
      expect(await tags('tag=GARAGE')).toBe(1);
      expect(await tags('tag=LEAD')).toBe(2);
      expect(await tags('tag=LEAD,INSURER')).toBe(3);
      expect(await tags('tag=INSURER&tag=GARAGE')).toBe(2);
      expect(await tags(`followUpBefore=${daysFromToday(0)}`)).toBe(1);
      expect(await tags(`followUpBefore=${daysFromToday(5)}`)).toBe(2);
      const bad = await s.api.get('/api/contacts?tag=NOPE');
      expect(bad.status).toBe(400);
    });
  });

  it('archives and restores; lists honour archived / includeArchived', async () => {
    const c = await create({ firstName: 'To', lastName: 'Archive' });
    const count = async (query = '') =>
      (await s.api.get(`/api/contacts?pageSize=200${query}`).expect(200)).body.total as number;
    const activeBefore = await count();

    const archived = await s.api.post(`/api/contacts/${c.id}/archive`).expect(200);
    expect(archived.body.archivedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    // Archiving again keeps the first timestamp.
    const again = await s.api.post(`/api/contacts/${c.id}/archive`).send({}).expect(200);
    expect(again.body.archivedAt).toBe(archived.body.archivedAt);

    expect(await count()).toBe(activeBefore - 1);
    expect(await count('&archived=false')).toBe(activeBefore - 1);
    expect(await count('&archived=true')).toBe(1);
    expect(await count('&includeArchived=true')).toBe(activeBefore);

    const restored = await s.api.post(`/api/contacts/${c.id}/unarchive`).expect(200);
    expect(restored.body.archivedAt).toBeNull();
    expect(await count()).toBe(activeBefore);

    await s.api.post(`/api/contacts/${c.id}/archive`).expect(200);
    const viaBody = await s.api
      .post(`/api/contacts/${c.id}/archive`)
      .send({ archived: false })
      .expect(200);
    expect(viaBody.body.archivedAt).toBeNull();

    const audits = await s.t.prisma.auditLog.count({
      where: { entity: 'Contact', entityId: c.id, action: 'UPDATE' },
    });
    expect(audits).toBeGreaterThanOrEqual(3);
  });
});
