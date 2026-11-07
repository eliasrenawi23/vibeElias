import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '../i18n';
import { I18nProvider } from '../providers/I18nProvider';
import { UiProvider } from '../providers/UiProvider';
import { LangMenu } from './LangMenu';

function renderMenu() {
  return render(
    <I18nProvider>
      <UiProvider>
        <LangMenu />
      </UiProvider>
    </I18nProvider>,
  );
}

async function choose(name: string) {
  fireEvent.click(screen.getByTestId('lang-menu'));
  const item = await screen.findByRole('menuitem', { name });
  fireEvent.click(item);
}

describe('LangMenu', () => {
  beforeEach(async () => {
    await act(() => i18n.changeLanguage('he'));
  });

  it('starts in Hebrew, right-to-left', () => {
    renderMenu();
    expect(document.documentElement.lang).toBe('he');
    expect(document.dir).toBe('rtl');
    expect(screen.getByTestId('lang-menu')).toHaveTextContent('עברית');
  });

  it('flips document.dir when switching to English and back to Arabic', async () => {
    renderMenu();

    await choose('English');
    await waitFor(() => expect(document.dir).toBe('ltr'));
    expect(document.documentElement.lang).toBe('en');
    expect(i18n.resolvedLanguage).toBe('en');
    // AntD follows: the menu button is now an LTR component.
    expect(document.querySelector('.ant-btn-rtl')).toBeNull();

    await choose('العربية');
    await waitFor(() => expect(document.dir).toBe('rtl'));
    expect(document.documentElement.lang).toBe('ar');
    expect(document.querySelector('.ant-btn-rtl')).not.toBeNull();
  });

  it('remembers the choice in localStorage', async () => {
    renderMenu();
    await choose('English');
    await waitFor(() => expect(window.localStorage.getItem('rm.lang')).toBe('en'));
  });
});
