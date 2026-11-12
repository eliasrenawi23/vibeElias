import {
  ACTIVITY_ENTITY_NAMES,
  buildActivitySummary,
  changedFields,
  labelFromSnapshot,
  snapshotOf,
} from './activity';

const update = (changes: Record<string, { from: unknown; to: unknown }>) => ({ changes });

describe('changedFields', () => {
  it('lists changed fields of an UPDATE, ignoring timestamps', () => {
    const diff = update({
      phones: { from: [], to: ['0501234567'] },
      updatedAt: { from: 'a', to: 'b' },
      followUpAt: { from: null, to: '2026-11-20' },
    });
    expect(changedFields('UPDATE', diff)).toEqual(['phones', 'followUpAt']);
  });

  it('is empty for CREATE / DELETE and malformed diffs', () => {
    expect(changedFields('CREATE', update({ a: { from: 1, to: 2 } }))).toEqual([]);
    expect(changedFields('DELETE', null)).toEqual([]);
    expect(changedFields('UPDATE', null)).toEqual([]);
    expect(changedFields('UPDATE', { changes: [1, 2] })).toEqual([]);
  });
});

describe('snapshots and labels', () => {
  it('snapshotOf: after of a CREATE, before of a DELETE', () => {
    expect(snapshotOf({ after: { id: 'x' } })).toEqual({ id: 'x' });
    expect(snapshotOf({ before: { id: 'y' } })).toEqual({ id: 'y' });
    expect(snapshotOf('nope')).toBeNull();
  });

  it('labelFromSnapshot per entity', () => {
    expect(labelFromSnapshot('Vehicle', { plateNo: '31245625' })).toBe('312-45-625');
    expect(labelFromSnapshot('Deal', { dealNo: 12 })).toBe('#12');
    expect(labelFromSnapshot('LeaseContract', { contractNo: 3 })).toBe('#3');
    expect(labelFromSnapshot('TaxiLicense', { licenseNo: ' 24718 ' })).toBe('24718');
    expect(
      labelFromSnapshot('Contact', { firstName: 'רונית', lastName: 'לוי', companyName: null }),
    ).toBe('רונית לוי');
    expect(labelFromSnapshot('Document', { title: '', fileName: 'scan.pdf' })).toBe('scan.pdf');
    expect(labelFromSnapshot('Reminder', { title: 'להתקשר' })).toBe('להתקשר');
    expect(labelFromSnapshot('TrafficFine', { fineNo: 'F-1' })).toBe('F-1');
    expect(labelFromSnapshot('InsurancePolicy', { insurer: 'Galil' })).toBe('Galil');
    expect(labelFromSnapshot('Vehicle', { plateNo: 7 })).toBeNull();
    expect(labelFromSnapshot('Deal', null)).toBeNull();
    expect(labelFromSnapshot('Settings', { id: 1 })).toBeNull();
  });
});

describe('buildActivitySummary', () => {
  it('create / delete', () => {
    expect(
      buildActivitySummary({
        entity: 'Vehicle',
        action: 'CREATE',
        label: '84-731-26',
        changes: [],
        diff: null,
      }),
    ).toBe('Vehicle 84-731-26 created');
    expect(
      buildActivitySummary({
        entity: 'VehicleExpense',
        action: 'DELETE',
        label: null,
        changes: [],
        diff: null,
      }),
    ).toBe('Expense deleted');
  });

  it('status changes win over the field list', () => {
    const diff = update({
      status: { from: 'PENDING', to: 'COMPLETED' },
      notes: { from: null, to: 'x' },
    });
    expect(
      buildActivitySummary({
        entity: 'Deal',
        action: 'UPDATE',
        label: '#12',
        changes: ['status', 'notes'],
        diff,
      }),
    ).toBe('Deal #12 status → COMPLETED (+1 more)');
    expect(
      buildActivitySummary({
        entity: 'Deal',
        action: 'UPDATE',
        label: '#12',
        changes: ['status'],
        diff: update({ status: { from: 'DRAFT', to: 'PENDING' } }),
      }),
    ).toBe('Deal #12 status → PENDING');
  });

  it('reminders marked done / reopened', () => {
    const done = update({ doneAt: { from: null, to: '2026-11-12T08:00:00.000Z' } });
    const reopened = update({ doneAt: { from: '2026-11-12T08:00:00.000Z', to: null } });
    const base = {
      entity: 'Reminder',
      action: 'UPDATE' as const,
      label: 'Call',
      changes: ['doneAt'],
    };
    expect(buildActivitySummary({ ...base, diff: done })).toBe('Reminder Call marked done');
    expect(buildActivitySummary({ ...base, diff: reopened })).toBe('Reminder Call reopened');
  });

  it('field lists are capped at three', () => {
    const base = { entity: 'Contact', action: 'UPDATE' as const, label: 'Dana Levi', diff: null };
    expect(buildActivitySummary({ ...base, changes: [] })).toBe('Contact Dana Levi updated');
    expect(buildActivitySummary({ ...base, changes: ['phones', 'followUpAt'] })).toBe(
      'Contact Dana Levi updated: phones, followUpAt',
    );
    expect(buildActivitySummary({ ...base, changes: ['a', 'b', 'c', 'd', 'e'] })).toBe(
      'Contact Dana Levi updated: a, b, c +2 more',
    );
  });

  it('unknown entities use their model name', () => {
    expect(ACTIVITY_ENTITY_NAMES.Widget).toBeUndefined();
    expect(
      buildActivitySummary({
        entity: 'Widget',
        action: 'CREATE',
        label: null,
        changes: [],
        diff: null,
      }),
    ).toBe('Widget created');
  });
});
