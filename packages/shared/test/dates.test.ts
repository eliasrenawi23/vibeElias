import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  addWorkingDays,
  daysInMonth,
  dealerRegistrationStatus,
  diffDays,
  dueDateInPeriod,
  fineReassignDeadline,
  formatDate,
  isValidIsoDate,
  isWorkingDay,
  monthsBetween,
  overlapDays,
  overlapDaysInPeriod,
  periodEnd,
  taxiAgeStatus,
  todayInBusinessTz,
  wholeMonthsBetween,
  workingDaysAfter,
} from '../src/index.js';

describe('todayInBusinessTz', () => {
  it('uses the business time zone, not UTC', () => {
    // 22:30 UTC on Nov 6 is already Nov 7 in Israel (UTC+2 in winter).
    const instant = new Date('2026-11-06T22:30:00Z');
    expect(todayInBusinessTz('Asia/Jerusalem', instant)).toBe('2026-11-07');
    expect(todayInBusinessTz('UTC', instant)).toBe('2026-11-06');
  });

  it('defaults to Asia/Jerusalem', () => {
    expect(todayInBusinessTz(undefined, new Date('2026-07-01T21:30:00Z'))).toBe('2026-07-02');
  });
});

describe('calendar arithmetic', () => {
  it('validates ISO dates', () => {
    expect(isValidIsoDate('2028-02-29')).toBe(true);
    expect(isValidIsoDate('2026-02-29')).toBe(false);
    expect(isValidIsoDate('2026-13-01')).toBe(false);
    expect(isValidIsoDate('2026-1-01')).toBe(false);
  });

  it('adds days and months (clamped to month end)', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(diffDays('2026-01-01', '2026-12-31')).toBe(364);
    expect(fineReassignDeadline('2026-01-01')).toBe('2026-04-01');
  });

  it('knows month lengths and periods', () => {
    expect(daysInMonth('2028-02')).toBe(29);
    expect(daysInMonth('2026-02-10')).toBe(28);
    expect(periodEnd('2026-04')).toBe('2026-04-30');
    expect(dueDateInPeriod('2026-02', 28)).toBe('2026-02-28');
    expect(dueDateInPeriod('2026-02', 1)).toBe('2026-02-01');
  });

  it('lists billing periods between two dates', () => {
    expect(monthsBetween('2026-11-15', '2027-02-01')).toEqual([
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
    ]);
    expect(monthsBetween('2026-05', '2026-05')).toEqual(['2026-05']);
    expect(monthsBetween('2026-06-01', '2026-05-31')).toEqual([]);
  });

  it('counts whole months', () => {
    expect(wholeMonthsBetween('2026-01-15', '2026-02-14')).toBe(0);
    expect(wholeMonthsBetween('2026-01-15', '2026-02-15')).toBe(1);
  });
});

describe('overlapDays', () => {
  it('counts inclusive overlap', () => {
    expect(overlapDays('2026-01-16', '2026-01-31', '2026-01-01', '2026-01-31')).toBe(16);
    expect(overlapDays('2026-01-01', '2026-01-31', '2026-01-10', '2026-02-20')).toBe(22);
    expect(overlapDays('2026-01-05', '2026-01-05', '2026-01-05', '2026-01-05')).toBe(1);
  });

  it('treats null ends as open-ended', () => {
    expect(overlapDays('2026-01-16', null, '2026-01-01', '2026-01-31')).toBe(16);
    expect(overlapDaysInPeriod('2026-03', '2026-02-10', null)).toBe(31);
  });

  it('returns 0 when ranges do not touch', () => {
    expect(overlapDays('2026-01-01', '2026-01-10', '2026-01-11', '2026-01-31')).toBe(0);
  });
});

describe('Israeli working days (Sunday-Thursday)', () => {
  it('identifies weekends', () => {
    expect(isWorkingDay('2026-11-06')).toBe(false); // Friday
    expect(isWorkingDay('2026-11-07')).toBe(false); // Saturday
    expect(isWorkingDay('2026-11-08')).toBe(true); // Sunday
    expect(isWorkingDay('2026-11-12')).toBe(true); // Thursday
  });

  it('applies the 6-working-day transfer rule', () => {
    expect(addWorkingDays('2026-11-05', 6)).toBe('2026-11-15'); // Thu -> Sun
    expect(workingDaysAfter('2026-11-08', 6)).toBe('2026-11-16'); // Sun -> Mon
    expect(addWorkingDays('2026-11-06', 1)).toBe('2026-11-08'); // Fri -> Sun
    expect(addWorkingDays('2026-11-07', 0)).toBe('2026-11-07');
    expect(addWorkingDays('2026-11-08', -1)).toBe('2026-11-05');
  });
});

describe('taxiAgeStatus', () => {
  it('requires semi-annual tests from year 10', () => {
    expect(taxiAgeStatus(2016, '2025-12-31')).toMatchObject({
      ageYears: 9,
      semiAnnualTest: false,
      blocked: false,
    });
    expect(taxiAgeStatus(2016, '2026-01-01')).toMatchObject({
      ageYears: 10,
      semiAnnualTest: true,
      blocked: false,
      nearLimit: false,
    });
  });

  it('warns at 11.5 years and blocks at 12', () => {
    expect(taxiAgeStatus(2015, '2026-06-30').nearLimit).toBe(false);
    expect(taxiAgeStatus(2015, '2026-07-01').nearLimit).toBe(true);
    expect(taxiAgeStatus(2014, '2026-01-01')).toMatchObject({
      ageYears: 12,
      blocked: true,
      nearLimit: false,
      blockedFrom: '2026-01-01',
    });
  });
});

describe('dealerRegistrationStatus', () => {
  it('alerts at 11 months and expires at 12', () => {
    expect(dealerRegistrationStatus('2025-11-07', '2026-10-07')).toEqual({
      monthsElapsed: 11,
      alert: true,
      expired: false,
      expiresAt: '2026-11-07',
    });
    expect(dealerRegistrationStatus('2025-11-07', '2026-11-07').expired).toBe(true);
  });
});

describe('formatDate', () => {
  it('formats with Latin digits and no bidi marks', () => {
    expect(formatDate('2026-11-07', 'he')).toBe('07.11.2026');
    expect(formatDate('2026-11-07', 'ar')).toBe('07/11/2026');
    expect(formatDate('2026-11-07', 'en')).toBe('07/11/2026');
  });
});
