import { useCallback, useState } from 'react';
import type { FieldValues, UseFormSetError } from 'react-hook-form';
import { useErrorMessage } from '../lib/i18n';
import { applyApiErrors } from './useZodForm';

/**
 * Error handling for forms that submit to the API: field errors go onto the fields, and the
 * translated top-level message is kept for an `<Alert>` (or a dialog's error slot).
 */
export function useFormErrors<T extends FieldValues>(setError: UseFormSetError<T>) {
  const errorMessage = useErrorMessage();
  const [formError, setFormError] = useState<string | null>(null);

  const handleError = useCallback(
    (error: unknown) => {
      applyApiErrors(setError, error);
      setFormError(errorMessage(error));
    },
    [setError, errorMessage],
  );

  const clearFormError = useCallback(() => setFormError(null), []);

  return { formError, handleError, clearFormError };
}
