import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { enumLabelKey, enumValues, isEnumValue, prismaEnums } from '../src/index.js';

/** Enum names listed in the approved plan's Prisma schema. */
const PLAN_ENUMS = [
  'Role',
  'ContactTag',
  'DriverStatus',
  'VehicleStatus',
  'VehicleOwnership',
  'Fuel',
  'Gearbox',
  'CycleKind',
  'CycleEndReason',
  'CommissionMode',
  'ExpenseCategory',
  'InsuranceType',
  'InsuranceScope',
  'PaidBy',
  'TaxiLicenseStatus',
  'LeaseType',
  'BillingPeriod',
  'LeaseStatus',
  'LeaseEndReason',
  'DepositKind',
  'LedgerType',
  'ChargeKind',
  'PaymentMethod',
  'DealType',
  'DealStatus',
  'VatMode',
  'TransferStatus',
  'Direction',
  'FineStatus',
  'DocKind',
  'AuditAction',
];

/** Reads `enum X { ... }` blocks from apps/api/prisma (single schema file or schema folder). */
function readPrismaEnums(): Map<string, string[]> | null {
  const prismaDir = fileURLToPath(new URL('../../../apps/api/prisma/', import.meta.url));
  const files: string[] = [];
  if (existsSync(join(prismaDir, 'schema.prisma'))) files.push(join(prismaDir, 'schema.prisma'));
  const folder = join(prismaDir, 'schema');
  if (existsSync(folder)) {
    for (const f of readdirSync(folder)) if (f.endsWith('.prisma')) files.push(join(folder, f));
  }
  if (files.length === 0) return null;
  const out = new Map<string, string[]>();
  for (const file of files) {
    const src = readFileSync(file, 'utf8').replace(/\/\/.*$/gm, '');
    for (const m of src.matchAll(/^\s*enum\s+(\w+)\s*\{([^}]*)\}/gm)) {
      const values = (m[2] ?? '')
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t && !t.startsWith('@'));
      out.set(m[1] as string, values);
    }
  }
  return out;
}

describe('enums', () => {
  it('mirror every enum of the plan, and only those', () => {
    expect(Object.keys(prismaEnums).sort()).toEqual([...PLAN_ENUMS].sort());
  });

  const prisma = readPrismaEnums();
  it.skipIf(prisma === null)(
    'match apps/api/prisma/schema.prisma exactly (names, values, order)',
    () => {
      const p = prisma as Map<string, string[]>;
      expect([...p.keys()].sort()).toEqual(Object.keys(prismaEnums).sort());
      for (const [name, values] of p) {
        expect(prismaEnums[name as keyof typeof prismaEnums]?.options, name).toEqual(values);
      }
    },
  );

  it('expose helpers', () => {
    expect(enumValues('VatMode')).toEqual(['NONE', 'FULL', 'MARGIN']);
    expect(enumValues('FuelLevel')).toContain('HALF');
    expect(isEnumValue('VehicleStatus', 'SOLD')).toBe(true);
    expect(isEnumValue('VehicleStatus', 'sold')).toBe(false);
    expect(isEnumValue('VehicleStatus', 42)).toBe(false);
    expect(enumLabelKey('DealType', 'SALE')).toBe('enums.DealType.SALE');
  });
});
