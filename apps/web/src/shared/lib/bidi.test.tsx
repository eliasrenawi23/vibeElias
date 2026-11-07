import { hasBidiMarks } from '@renawi/shared';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '../../app/i18n';
import { Money } from '../ui/Money';
import { PhoneText } from '../ui/PhoneText';
import { PlateNo } from '../ui/PlateNo';
import { AutoDir, Ltr } from './bidi';

describe('bidi rendering', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('he');
  });

  it('isolates LTR content in <bdi dir="ltr">', () => {
    render(
      <p dir="rtl">
        מספר <Ltr>VIN-123</Ltr> סוף
      </p>,
    );
    const el = screen.getByText('VIN-123');
    expect(el.tagName).toBe('BDI');
    expect(el).toHaveAttribute('dir', 'ltr');
    expect(el).toHaveClass('rm-ltr', 'rm-tabular');
  });

  it('renders a plate inside an RTL container without mirroring it', () => {
    const { container } = render(
      <div dir="rtl" lang="he">
        רכב <PlateNo value="12345678" /> במלאי
      </div>,
    );
    const plate = container.querySelector('bdi');
    expect(plate).not.toBeNull();
    // Isolated left-to-right, digits in logical order, no invisible reordering characters.
    expect(plate).toHaveAttribute('dir', 'ltr');
    expect(plate?.textContent).toBe('123-45-678');
    expect(hasBidiMarks(plate?.textContent ?? '')).toBe(false);
    expect(plate?.closest('[dir="rtl"]')).not.toBeNull();
    expect(plate).toHaveClass('rm-plate');
  });

  it('renders money with Latin digits inside an isolate in Arabic', async () => {
    await i18n.changeLanguage('ar');
    const { container } = render(
      <div dir="rtl">
        <Money amount={1234.5} />
      </div>,
    );
    const money = container.querySelector('bdi');
    expect(money).toHaveAttribute('dir', 'ltr');
    expect(money?.textContent).toMatch(/1,234\.50/);
    expect(money?.textContent).not.toMatch(/[٠-٩]/);
  });

  it('renders phones as LTR tel: links', () => {
    render(
      <div dir="rtl">
        <PhoneText value="0501234567" />
      </div>,
    );
    const link = screen.getByRole('link', { name: '050-123-4567' });
    expect(link).toHaveAttribute('href', 'tel:+972501234567');
    expect(link.closest('bdi')).toHaveAttribute('dir', 'ltr');
  });

  it('uses dir="auto" for free text', () => {
    render(<AutoDir>شادي</AutoDir>);
    expect(screen.getByText('شادي')).toHaveAttribute('dir', 'auto');
  });

  it('shows a placeholder dash for empty values', () => {
    render(<PlateNo value={null} />);
    expect(screen.getByText('—')).toHaveClass('rm-empty-value');
  });
});
