import express from 'express';
import request from 'supertest';
import { EnvSchema } from './env';
import { DEFAULT_PROXY_HOPS, parseTrustProxy } from './trust-proxy';

describe('parseTrustProxy', () => {
  it('empty and false-like values turn it off', () => {
    for (const raw of [undefined, null, '', '  ', 'false', 'FALSE', 'no', 'off', '0']) {
      expect(parseTrustProxy(raw)).toBe(false);
    }
  });

  it('true-like values trust the two hops of the production stack (Caddy + nginx)', () => {
    expect(DEFAULT_PROXY_HOPS).toBe(2);
    for (const raw of ['true', 'TRUE', ' yes ', 'on']) {
      expect(parseTrustProxy(raw)).toBe(DEFAULT_PROXY_HOPS);
    }
  });

  it('a whole number is a hop count (Express semantics)', () => {
    expect(parseTrustProxy('1')).toBe(1);
    expect(parseTrustProxy(' 3 ')).toBe(3);
    expect(() => parseTrustProxy('25')).toThrow(/not plausible/);
  });

  it('passes presets, addresses and subnets through (normalised)', () => {
    expect(parseTrustProxy('loopback,uniquelocal')).toBe('loopback,uniquelocal');
    expect(parseTrustProxy(' Loopback , 10.0.0.0/8, 172.18.0.5 ')).toBe(
      'loopback,10.0.0.0/8,172.18.0.5',
    );
    expect(parseTrustProxy('fd00::/8,::1')).toBe('fd00::/8,::1');
    expect(parseTrustProxy('192.168.0.0/255.255.0.0')).toBe('192.168.0.0/255.255.0.0');
  });

  it('rejects anything Express could not compile', () => {
    expect(() => parseTrustProxy('maybe')).toThrow(/"maybe"/);
    expect(() => parseTrustProxy('loopback,10.0.0.0/33')).toThrow(/"10.0.0.0\/33"/);
    expect(() => parseTrustProxy('loopback,,uniquelocal')).toThrow(/TRUST_PROXY/);
    expect(() => parseTrustProxy('-1')).toThrow(/TRUST_PROXY/);
  });

  it('the env schema parses the variable and reports a bad value as a config problem', () => {
    const base = {
      DATABASE_URL: 'postgresql://x',
      JWT_ACCESS_SECRET: 'a'.repeat(32),
      JWT_REFRESH_SECRET: 'b'.repeat(32),
    };
    expect(EnvSchema.parse({ ...base, TRUST_PROXY: 'true' }).TRUST_PROXY).toBe(2);
    expect(EnvSchema.parse(base).TRUST_PROXY).toBe(false);
    const bad = EnvSchema.safeParse({ ...base, TRUST_PROXY: 'nginx' });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0]).toMatchObject({ path: ['TRUST_PROXY'] });
  });

  it('every accepted value is accepted by Express and gives the client address', async () => {
    // Client -> Caddy (172.18.0.2) -> nginx (socket peer, loopback here) -> app.
    const xff = '203.0.113.7, 172.18.0.2';
    const ipWith = async (raw: string) => {
      const app = express();
      const setting = parseTrustProxy(raw);
      if (setting !== false) app.set('trust proxy', setting);
      app.get('/', (req, res) => {
        res.json({ ip: req.ip });
      });
      const res = await request(app).get('/').set('X-Forwarded-For', xff).expect(200);
      return (res.body as { ip: string }).ip;
    };
    expect(await ipWith('true')).toBe('203.0.113.7');
    expect(await ipWith('2')).toBe('203.0.113.7');
    expect(await ipWith('loopback,uniquelocal')).toBe('203.0.113.7');
    // One hop trusts only nginx: the address Caddy connected from.
    expect(await ipWith('1')).toBe('172.18.0.2');
    // Off: the socket address.
    expect(await ipWith('false')).toMatch(/127\.0\.0\.1|::1/);
  });
});
