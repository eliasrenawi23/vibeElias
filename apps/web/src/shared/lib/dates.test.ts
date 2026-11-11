import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import {
  DATE_INPUT_FORMATS,
  DATE_TIME_INPUT_FORMATS,
  DISPLAY_DATE_FORMAT,
  DISPLAY_DATE_TIME_FORMAT,
  parseDateInput,
} from './dates';

/** Days that tell day-first from month-first and padded from unpadded. */
const DAYS = ['2026-11-07', '2026-01-31', '2027-12-25', '2026-02-28'];

describe('DATE_INPUT_FORMATS', () => {
  it('starts with the display format', () => {
    expect(DATE_INPUT_FORMATS[0]).toBe(DISPLAY_DATE_FORMAT);
    expect(DATE_TIME_INPUT_FORMATS[0]).toBe(DISPLAY_DATE_TIME_FORMAT);
  });

  it.each(DATE_INPUT_FORMATS)(
    '%s: the same day typed this way parses to the same ISO date',
    (format) => {
      for (const iso of DAYS) {
        const typed = dayjs(iso).format(format);
        expect(parseDateInput(typed), `${typed} (${format})`).toBe(iso);
      }
    },
  );

  it('reads the common ways of typing 7 November 2026 as that day', () => {
    const typed = [
      '07/11/2026',
      '7/11/2026',
      '07.11.2026',
      '7.11.2026',
      '07-11-2026',
      '07112026',
      '2026-11-07',
      ' 7/11/2026 ',
    ];
    for (const text of typed) expect(parseDateInput(text), text).toBe('2026-11-07');
  });

  it('rejects impossible or partial dates', () => {
    for (const text of ['31/02/2026', '32/01/2026', '13/13/2026', '7/11', '', 'tomorrow']) {
      expect(parseDateInput(text), text).toBeNull();
    }
  });

  it('pairs every date entry with a 24-hour time for the date-time picker', () => {
    expect(DATE_TIME_INPUT_FORMATS).toEqual(DATE_INPUT_FORMATS.map((f) => `${f} HH:mm`));
    for (const format of DATE_TIME_INPUT_FORMATS) {
      const typed = dayjs('2026-11-07T14:30').format(format);
      const parsed = dayjs(typed, format, true);
      expect(parsed.isValid(), typed).toBe(true);
      expect(parsed.format('YYYY-MM-DDTHH:mm')).toBe('2026-11-07T14:30');
    }
  });
});
