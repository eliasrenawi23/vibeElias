import * as shared from '@renawi/shared';
import { describe, expect, it } from 'vitest';
import {
  hasTone,
  TONE_DOT_COLORS,
  TONE_REGISTRY,
  TONES,
  toneClassName,
  toneOf,
  type ToneEnumName,
} from './statusTones';

/** Registry enums that are not a zod enum of `@renawi/shared` (web-only). */
const WEB_ONLY: Readonly<Partial<Record<ToneEnumName, readonly string[]>>> = {
  ExpiryState: ['expired', 'soon', 'valid'],
};

/** The values of a registry enum, read from the shared zod enum of the same name. */
function enumOptions(name: ToneEnumName): readonly string[] {
  const webOnly = WEB_ONLY[name];
  if (webOnly) return webOnly;
  const schema = (shared as unknown as Record<string, { options?: readonly string[] }>)[name];
  if (!schema?.options) throw new Error(`@renawi/shared exports no enum ${name}`);
  return schema.options;
}

const NAMES = Object.keys(TONE_REGISTRY) as ToneEnumName[];

describe('TONE_REGISTRY', () => {
  it.each(NAMES)('%s maps every enum value, and nothing else, to a known tone', (name) => {
    const options = enumOptions(name);
    const map = TONE_REGISTRY[name] as Readonly<Record<string, string>>;
    expect(Object.keys(map).sort()).toEqual([...options].sort());
    for (const value of options) expect(TONES).toContain(map[value]);
  });

  it('covers every status, category and alert enum the UI paints', () => {
    // A new coloured enum joins the registry (and this list) on purpose.
    expect([...NAMES].sort()).toEqual(
      [
        'ChargeKind',
        'ContactTag',
        'CycleKind',
        'DealAlert',
        'DealStatus',
        'DealType',
        'Direction',
        'DriverAlert',
        'DriverStatus',
        'ExpenseCategory',
        'ExpiryState',
        'FeedSeverity',
        'FineAlert',
        'FineStatus',
        'LeaseAlert',
        'LeaseStatus',
        'LeaseType',
        'LedgerType',
        'ResponsibleParty',
        'TaxiLicenseAlert',
        'TaxiLicenseStatus',
        'TransferStatus',
        'VehicleAlert',
        'VehicleOwnership',
        'VehicleStatus',
      ].sort(),
    );
  });

  it('keeps the owner-confirmed status mapping', () => {
    expect(TONE_REGISTRY.VehicleStatus).toEqual({
      IN_STOCK: 'info',
      RESERVED: 'warning',
      LEASED: 'accent',
      SOLD: 'neutral',
      RETURNED: 'purple',
      SCRAPPED: 'neutral',
      EXTERNAL: 'neutral',
    });
    expect(TONE_REGISTRY.CycleKind).toEqual({ OWNED: 'accent', CONSIGNED: 'purple' });
    expect(TONE_REGISTRY.FineStatus.PAID_BY_US).toBe('purple');
    expect(TONE_REGISTRY.LeaseStatus.TERMINATED).toBe('error');
    expect(TONE_REGISTRY.DealStatus.CANCELLED).toBe('neutral');
    expect(TONE_REGISTRY.Direction).toEqual({ IN: 'success', OUT: 'warning' });
  });

  it('gives every tone a dot colour from the brand tokens', () => {
    for (const tone of TONES) {
      expect(TONE_DOT_COLORS[tone]).toMatch(/^var\(--rm-color-[a-z-]+\)$/);
    }
  });
});

describe('toneOf / hasTone', () => {
  it('reads the tone per enum, so the same value can differ between enums', () => {
    expect(toneOf('DealStatus', 'CANCELLED')).toBe('neutral');
    expect(toneOf('FineStatus', 'NEW')).toBe('warning');
    expect(toneOf('LeaseStatus', 'ACTIVE')).toBe('success');
  });

  it('falls back to neutral for values this build does not know', () => {
    expect(hasTone('VehicleStatus', 'FLYING')).toBe(false);
    expect(toneOf('VehicleStatus', 'FLYING')).toBe('neutral');
    expect(toneOf('VehicleStatus', null)).toBe('neutral');
    // Inherited object keys are not values.
    expect(hasTone('VehicleStatus', 'toString')).toBe(false);
  });

  it('builds the tone class names', () => {
    expect(toneClassName('purple')).toBe('rm-tone rm-tone-purple');
  });
});
