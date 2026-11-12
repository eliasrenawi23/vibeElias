import { describe, expect, it } from 'vitest';
import { activePreset, DATE_PRESETS, presetRange } from './datePresets';

describe('date presets', () => {
  const today = '2026-11-12';

  it('turns each preset into a closed range of dates', () => {
    expect(presetRange('thisMonth', today)).toEqual(['2026-11-01', '2026-11-12']);
    expect(presetRange('lastMonth', today)).toEqual(['2026-10-01', '2026-10-31']);
    expect(presetRange('yearToDate', today)).toEqual(['2026-01-01', '2026-11-12']);
    expect(presetRange('lastYear', today)).toEqual(['2025-01-01', '2025-12-31']);
    expect(presetRange('last30Days', today)).toEqual(['2026-10-14', '2026-11-12']);
  });

  it('handles month and year boundaries', () => {
    expect(presetRange('lastMonth', '2026-01-15')).toEqual(['2025-12-01', '2025-12-31']);
    expect(presetRange('lastMonth', '2026-03-31')).toEqual(['2026-02-01', '2026-02-28']);
    expect(presetRange('last30Days', '2026-03-01')).toEqual(['2026-01-31', '2026-03-01']);
  });

  it('derives the active preset from the dates (a hand-picked range has none)', () => {
    for (const preset of DATE_PRESETS) {
      const [from, to] = presetRange(preset, today);
      expect(activePreset(from, to, today)).toBe(preset);
    }
    expect(activePreset('2026-11-02', '2026-11-12', today)).toBeNull();
    expect(activePreset(null, '2026-11-12', today)).toBeNull();
    // In January "this month" and "year to date" coincide: the first one listed wins.
    expect(activePreset('2026-01-01', '2026-01-20', '2026-01-20')).toBe('thisMonth');
    expect(activePreset('2026-01-01', '2026-01-20', '2026-01-20', ['yearToDate'])).toBe(
      'yearToDate',
    );
  });
});
