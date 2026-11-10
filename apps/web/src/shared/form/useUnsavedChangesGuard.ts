import {
  createElement,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { UNSAFE_DataRouterContext } from 'react-router';
import { UnsavedChangesPrompt } from './UnsavedChangesPrompt';

export interface UnsavedChangesGuard {
  /** Render once in the form's component: the "discard unsaved changes?" dialog. */
  prompt: ReactNode;
  /**
   * Wrap the save: leaving the page is allowed while it runs, so the `navigate()` of a
   * successful save is not blocked. The guard stays off after success (until the form is clean
   * again, e.g. reset to the saved values) and is back on after a failure.
   */
  submit: <T>(run: () => Promise<T>) => Promise<T>;
  /** Run `action` (cancel, close) at once when the form is clean, after confirming when dirty. */
  confirmDiscard: (action: () => void) => void;
}

/**
 * Warns before unsaved form input is lost: in-app navigation (react-router `useBlocker`, needs
 * the data router of `app/router.tsx`), closing or reloading the tab (`beforeunload`) and the
 * form's own cancel button (`confirmDiscard`). The prompt is `ConfirmDialog`.
 *
 *   const guard = useUnsavedChangesGuard(form.formState.isDirty);
 *   const submit = form.handleSubmit((v) => guard.submit(() => onSubmit(v)));
 *   <Button onClick={() => guard.confirmDiscard(onCancel)}>…</Button>
 *   {guard.prompt}
 */
export function useUnsavedChangesGuard(dirty: boolean): UnsavedChangesGuard {
  const releasedRef = useRef(false);
  const [pending, setPending] = useState<{ action: () => void } | null>(null);
  // `useBlocker` throws outside a data router (unit tests with `MemoryRouter`): skip it there.
  const inDataRouter = useContext(UNSAFE_DataRouterContext) !== null;

  // A clean form (fresh, or reset to the saved values) arms the guard again.
  useEffect(() => {
    if (!dirty) releasedRef.current = false;
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (releasedRef.current) return;
      event.preventDefault();
      // Older browsers need returnValue set to show their (generic) prompt.
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const submit = useCallback(async <T>(run: () => Promise<T>): Promise<T> => {
    releasedRef.current = true;
    try {
      return await run();
    } catch (error) {
      releasedRef.current = false;
      throw error;
    }
  }, []);

  const confirmDiscard = useCallback(
    (action: () => void) => {
      if (!dirty || releasedRef.current) action();
      else setPending({ action });
    },
    [dirty],
  );

  const onDiscard = useCallback(() => {
    const action = pending?.action;
    setPending(null);
    // The action may navigate (cancel on a /new page): do not ask a second time.
    releasedRef.current = true;
    action?.();
  }, [pending]);

  const prompt = createElement(UnsavedChangesPrompt, {
    blockNavigation: inDataRouter && dirty,
    releasedRef,
    discardOpen: pending !== null,
    onDiscard,
    onKeepEditing: () => setPending(null),
  });

  return { prompt, submit, confirmDiscard };
}
