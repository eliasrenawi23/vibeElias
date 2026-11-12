import { installValidationErrorMap } from '@renawi/shared';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../../app/i18n';
import { jsonResponse, renderWithProviders } from '../../../test/renderWithProviders';
import { ChangePasswordForm, ChangePasswordFormSchema, changePasswordBody } from './ChangePasswordForm';

beforeAll(() => installValidationErrorMap());

beforeEach(async () => {
  await act(() => i18n.changeLanguage('en'));
});

afterEach(() => {
  vi.restoreAllMocks();
});

const USER = {
  id: 'usr_admin',
  email: 'admin@renawi.local',
  name: 'Elias Renawi',
  role: 'ADMIN',
  locale: 'en',
  theme: 'system',
};

const messages = (values: Record<string, string>) => {
  const result = ChangePasswordFormSchema.safeParse(values);
  return result.success
    ? {}
    : Object.fromEntries(result.error.issues.map((i) => [i.path.join('.'), i.message]));
};

describe('ChangePasswordFormSchema', () => {
  it('needs all three fields, the shared policy, a matching confirmation and a new value', () => {
    expect(messages({ currentPassword: '', newPassword: '', confirmPassword: '' })).toMatchObject({
      currentPassword: 'validation.currentPasswordRequired',
      confirmPassword: 'validation.required',
    });
    // Shorter than 8 / no digit: the shared password policy.
    expect(
      messages({ currentPassword: 'Old12345', newPassword: 'abc1', confirmPassword: 'abc1' }),
    ).toHaveProperty('newPassword');
    expect(
      messages({ currentPassword: 'Old12345', newPassword: 'abcdefghij', confirmPassword: 'abcdefghij' })
        .newPassword,
    ).toBe('validation.passwordTooWeak');
    expect(
      messages({ currentPassword: 'Old12345', newPassword: 'New12345', confirmPassword: 'New12346' }),
    ).toEqual({ confirmPassword: 'auth.passwordMismatch' });
    expect(
      messages({ currentPassword: 'Same1234', newPassword: 'Same1234', confirmPassword: 'Same1234' }),
    ).toEqual({ newPassword: 'auth.passwordUnchanged' });
    expect(
      messages({ currentPassword: 'Old12345', newPassword: 'New12345', confirmPassword: 'New12345' }),
    ).toEqual({});
  });

  it('sends only the current and the new password', () => {
    expect(changePasswordBody({ currentPassword: 'Old12345', newPassword: 'New12345' })).toEqual({
      currentPassword: 'Old12345',
      newPassword: 'New12345',
    });
  });
});

describe('ChangePasswordForm', () => {
  const fill = (label: string, value: string) =>
    fireEvent.change(screen.getByLabelText(label), { target: { value } });

  it('PATCHes /auth/me with the passwords and clears the form', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => jsonResponse({ user: USER }));
    const onChanged = vi.fn();
    renderWithProviders(<ChangePasswordForm onChanged={onChanged} />);
    expect(screen.getByTestId('change-password-note')).toHaveTextContent(
      'every other device and browser signed in to this account is signed out',
    );

    fill('Current password', 'ChangeMe123!');
    fill('New password', 'NewSecret456');
    fill('Confirm new password', 'NewSecret456');
    fireEvent.click(screen.getByTestId('change-password-submit'));

    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(USER));
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('/api/auth/me');
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(String(init?.body))).toEqual({
      currentPassword: 'ChangeMe123!',
      newPassword: 'NewSecret456',
    });
    await waitFor(() => expect(screen.getByLabelText('Current password')).toHaveValue(''));
  });

  it('does not call the API when the confirmation differs', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    renderWithProviders(<ChangePasswordForm onChanged={vi.fn()} />);
    fill('Current password', 'ChangeMe123!');
    fill('New password', 'NewSecret456');
    fill('Confirm new password', 'NewSecret457');
    fireEvent.click(screen.getByTestId('change-password-submit'));
    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows a wrong current password on its field', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      jsonResponse(
        {
          statusCode: 400,
          message: 'errors.validation',
          errors: [{ path: 'currentPassword', message: 'auth.invalidCredentials' }],
        },
        400,
      ),
    );
    const onChanged = vi.fn();
    renderWithProviders(<ChangePasswordForm onChanged={onChanged} />);
    fill('Current password', 'not-it-1');
    fill('New password', 'NewSecret456');
    fill('Confirm new password', 'NewSecret456');
    fireEvent.click(screen.getByTestId('change-password-submit'));
    expect(await screen.findByText('The current password is wrong')).toBeInTheDocument();
    expect(screen.getByLabelText('Current password')).toHaveAttribute('aria-invalid', 'true');
    expect(onChanged).not.toHaveBeenCalled();
  });
});
