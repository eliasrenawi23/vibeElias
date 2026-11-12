/*
 * Creates the first admin user in production, or resets an existing user's password.
 *
 *   docker compose run --rm admin                                   create (ADMIN_* from .env)
 *   docker compose run --rm admin node create-admin.cjs --reset-password
 *
 * The production API image has no dev dependencies, so `prisma db seed` (tsx + demo data) cannot
 * run there. This script does what the seed does with SEED_DEMO=false for the user: same email
 * normalisation, password policy and argon2id parameters (the compiled dist/auth/password.js).
 * The business settings row is created by the API on first use with the same neutral defaults
 * the seed writes with SEED_DEMO=false (no legal ID, dealer licence, address, phone, e-mail or
 * sample clauses); fill in the real details under Settings -> Business details before printing.
 * A signed-in user changes a known password in the app (user menu -> My account); this script's
 * --reset-password is for a forgotten one.
 *
 * Mounted into the API image at /app/apps/api/create-admin.cjs by docker-compose.prod.yml.
 */
'use strict';

const { PrismaClient } = require('@prisma/client');
const { password: passwordPolicy } = require('@renawi/shared');
const { hashPassword } = require('./dist/auth/password');

async function main() {
  const args = process.argv.slice(2);
  const reset = args.includes('--reset-password');
  if (args.some((a) => a !== '--reset-password')) {
    throw new Error('Usage: node create-admin.cjs [--reset-password]');
  }

  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const plain = process.env.ADMIN_PASSWORD || '';
  const name = (process.env.ADMIN_NAME || '').trim() || 'Elias Renawi';
  if (!email || !plain) throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env');
  if (!passwordPolicy.safeParse(plain).success) {
    throw new Error('ADMIN_PASSWORD must be 8-128 characters with at least one letter and digit');
  }

  const prisma = new PrismaClient();
  try {
    const found = await prisma.user.findUnique({ where: { email } });
    if (found && !reset) {
      console.log(`User ${email} already exists; nothing changed (use --reset-password).`);
      return;
    }
    if (found) {
      // A new tokenVersion signs out every existing session of the user.
      await prisma.user.update({
        where: { id: found.id },
        data: {
          passwordHash: await hashPassword(plain),
          tokenVersion: { increment: 1 },
          isActive: true,
        },
      });
      console.log(`Password of ${email} reset; all of its sessions are signed out.`);
      return;
    }
    if (reset) throw new Error(`No user ${email} to reset (run without --reset-password).`);
    await prisma.user.create({
      data: {
        email,
        name,
        role: 'ADMIN',
        locale: 'he',
        theme: 'system',
        passwordHash: await hashPassword(plain),
      },
    });
    console.log(`Admin user ${email} (${name}) created. Sign in and keep the password private.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
