import { zodResolver } from '@hookform/resolvers/zod';
import {
  useForm,
  type FieldPath,
  type FieldValues,
  type UseFormProps,
  type UseFormReturn,
  type UseFormSetError,
} from 'react-hook-form';
import type { z } from 'zod';
import { apiFieldErrors } from '../lib/http';

/**
 * `useForm` wired to a shared zod schema. Values are the schema *input* (what the inputs hold,
 * e.g. '' for an empty optional field); `handleSubmit` receives the parsed *output* (trimmed,
 * normalised, '' turned into null), ready to send to the API.
 *
 * Validation messages are i18n keys from `@renawi/shared`; the `Form*` fields translate them.
 */
export function useZodForm<S extends z.ZodTypeAny>(
  schema: S,
  props?: Omit<UseFormProps<z.input<S>, unknown, z.output<S>>, 'resolver'>,
): UseFormReturn<z.input<S>, unknown, z.output<S>> {
  return useForm<z.input<S>, unknown, z.output<S>>({
    mode: 'onTouched',
    ...props,
    resolver: zodResolver(schema),
  });
}

/**
 * Copy field errors from an API validation error onto the form. Returns true if any field error
 * was applied (so the caller can skip a generic toast).
 */
export function applyApiErrors<T extends FieldValues>(
  setError: UseFormSetError<T>,
  error: unknown,
): boolean {
  const fieldErrors = apiFieldErrors(error);
  for (const { path, message } of fieldErrors) {
    setError(path as FieldPath<T>, { type: 'server', message });
  }
  return fieldErrors.length > 0;
}
