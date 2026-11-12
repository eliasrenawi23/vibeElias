import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import { useErrorMessage } from '../../shared/lib/i18n';
import { dashboardKeys } from '../dashboard/queryKeys';
import { markReminderDone, markReminderUndone } from './api';
import { reminderKeys } from './queryKeys';

/** Refresh everything a reminder change moves: the feed, the bell, the lists and the dashboard. */
export function useRefreshReminders(): () => void {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: reminderKeys.all });
    void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
  };
}

/** Mark a manual reminder done (`done = true`) or not done again; toasts the result. */
export function useToggleReminderDone() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const errorMessage = useErrorMessage();
  const refresh = useRefreshReminders();
  return useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      done ? markReminderDone(id) : markReminderUndone(id),
    onSuccess: (_saved, { done }) => {
      refresh();
      void message.success(
        done ? t('reminders.manual.markedDone') : t('reminders.manual.markedUndone'),
      );
    },
    onError: (error) => void message.error(errorMessage(error)),
  });
}
