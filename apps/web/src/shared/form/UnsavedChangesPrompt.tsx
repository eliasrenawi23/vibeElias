import { useCallback, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { useBlocker, type BlockerFunction } from 'react-router';
import { ConfirmDialog } from '../ui/ConfirmDialog';

export interface UnsavedChangesPromptProps {
  /** Block in-app navigation (dirty form inside the data router). */
  blockNavigation: boolean;
  /** True while / after a save: navigation passes. */
  releasedRef: RefObject<boolean>;
  /** A cancel / close asked to discard (`confirmDiscard`). */
  discardOpen: boolean;
  onDiscard: () => void;
  onKeepEditing: () => void;
}

/** The dialog of `useUnsavedChangesGuard` (navigation and cancel share one prompt). */
export function UnsavedChangesPrompt({
  blockNavigation,
  releasedRef,
  discardOpen,
  onDiscard,
  onKeepEditing,
}: UnsavedChangesPromptProps) {
  const { t } = useTranslation();
  return (
    <>
      {blockNavigation && <NavigationBlocker releasedRef={releasedRef} />}
      <ConfirmDialog
        open={discardOpen}
        title={t('unsaved.title')}
        content={t('unsaved.close')}
        confirmText={t('unsaved.discard')}
        cancelText={t('unsaved.stay')}
        danger
        onConfirm={onDiscard}
        onCancel={onKeepEditing}
      />
    </>
  );
}

/** Mounted only while the form is dirty, so a clean form never registers a blocker. */
function NavigationBlocker({ releasedRef }: { releasedRef: RefObject<boolean> }) {
  const { t } = useTranslation();
  const shouldBlock = useCallback<BlockerFunction>(
    ({ currentLocation, nextLocation }) =>
      !releasedRef.current &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search),
    [releasedRef],
  );
  const blocker = useBlocker(shouldBlock);
  return (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      title={t('unsaved.title')}
      content={t('unsaved.leave')}
      confirmText={t('unsaved.discard')}
      cancelText={t('unsaved.stay')}
      danger
      onConfirm={() => {
        releasedRef.current = true;
        blocker.proceed?.();
      }}
      onCancel={() => blocker.reset?.()}
    />
  );
}
