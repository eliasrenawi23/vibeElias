import { useCallback, useState } from 'react';
import type { FieldPath, FieldValues, UseFormSetError } from 'react-hook-form';
import { apiFieldErrors } from '../lib/http';
import { useDynamicT, useErrorMessage } from '../lib/i18n';

export interface UseFormErrorsOptions {
  /**
   * Top-level fields the form shows. API field errors on other paths (e.g. `file`, an owner id)
   * are shown in the form-level message instead, since no input would display them. Omit to put
   * every field error on the form.
   */
  fields?: readonly string[];
}

/**
 * Error handling for forms that submit to the API: field errors go onto the fields, and the
 * translated top-level message is kept for an `<Alert>` (or a dialog's error slot).
 */
export function useFormErrors<T extends FieldValues>(
  setError: UseFormSetError<T>,
  options: UseFormErrorsOptions = {},
) {
  const errorMessage = useErrorMessage();
  const dynamicT = useDynamicT();
  const [formError, setFormError] = useState<string | null>(null);
  const fields = options.fields;

  const handleError = useCallback(
    (error: unknown) => {
      const all = apiFieldErrors(error);
      const shown = (path: string) => !fields || fields.includes(path.split('.')[0] ?? path);
      for (const { path, message } of all) {
        if (shown(path)) setError(path as FieldPath<T>, { type: 'server', message });
      }
      const hidden = all.filter((e) => !shown(e.path));
      setFormError(
        hidden.length > 0
          ? [...new Set(hidden.map((e) => dynamicT(e.message, 'validation.invalidValue')))].join(
              ' ',
            )
          : errorMessage(error),
      );
    },
    [setError, errorMessage, dynamicT, fields],
  );

  const clearFormError = useCallback(() => setFormError(null), []);

  return { formError, handleError, clearFormError };
}
