import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../app/i18n';
import { I18nProvider } from '../../app/providers/I18nProvider';
import { ApiError } from '../lib/http';
import { useFormErrors } from './useFormErrors';

const wrapper = ({ children }: { children: ReactNode }) => <I18nProvider>{children}</I18nProvider>;

beforeEach(async () => {
  await act(() => i18n.changeLanguage('en'));
});

describe('useFormErrors', () => {
  it('puts field errors on the form and keeps the top-level message', () => {
    const setError = vi.fn();
    const { result } = renderHook(() => useFormErrors(setError), { wrapper });
    act(() =>
      result.current.handleError(
        new ApiError(409, 'errors.conflict', [
          { path: 'plateNo', message: 'validation.duplicate' },
        ]),
      ),
    );
    expect(setError).toHaveBeenCalledWith('plateNo', {
      type: 'server',
      message: 'validation.duplicate',
    });
    expect(result.current.formError).toBe('This record already exists');
  });

  it('shows errors on paths the form has no input for in the form-level message', () => {
    const setError = vi.fn();
    const fields = ['kind', 'title'] as const;
    const { result } = renderHook(() => useFormErrors(setError, { fields }), { wrapper });
    act(() =>
      result.current.handleError(
        new ApiError(400, 'errors.validation', [
          { path: 'file', message: 'validation.required' },
          { path: 'title', message: 'validation.required' },
        ]),
      ),
    );
    expect(setError).toHaveBeenCalledTimes(1);
    expect(setError).toHaveBeenCalledWith('title', expect.anything());
    expect(result.current.formError).toBe('This field is required');
  });
});
