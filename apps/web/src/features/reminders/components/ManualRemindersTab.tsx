import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { todayInBusinessTz, type ReminderView } from '@renawi/shared';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { App, Button, Checkbox, Flex, Tooltip, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { AutoDir } from '../../../shared/lib/bidi';
import { useEnumLabel } from '../../../shared/lib/enums';
import { useErrorMessage } from '../../../shared/lib/i18n';
import { useListParams } from '../../../shared/lib/listParams';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog';
import { DataTable, type DataTableColumn } from '../../../shared/ui/DataTable';
import { DateText } from '../../../shared/ui/DateText';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { FilterBar } from '../../../shared/ui/FilterBar';
import { LoadError } from '../../../shared/ui/LoadError';
import { deleteReminder, fetchReminders, type ReminderListQuery } from '../api';
import { ReminderDialog } from '../dialogs/ReminderDialog';
import { useRefreshReminders, useToggleReminderDone } from '../hooks';
import { safeFeedLink } from '../lib/feed';
import { reminderKeys } from '../queryKeys';

/** "Manual reminders": open ones (or all with "Show completed"), done toggle, add, edit, delete. */
export function ManualRemindersTab() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const errorMessage = useErrorMessage();
  const enumLabel = useEnumLabel();
  const refresh = useRefreshReminders();
  const toggleDone = useToggleReminderDone();
  const { page, pageSize, searchParams, setTableParams } = useListParams();
  const [editing, setEditing] = useState<ReminderView | 'new' | null>(null);
  const [deleting, setDeleting] = useState<ReminderView | null>(null);
  const today = todayInBusinessTz();

  const showDone = searchParams.get('showDone') === '1';
  const query = useMemo<ReminderListQuery>(
    () => ({ done: showDone ? undefined : false, page, pageSize }),
    [showDone, page, pageSize],
  );
  const list = useQuery({
    queryKey: reminderKeys.list(query),
    queryFn: ({ signal }) => fetchReminders(query, signal),
    placeholderData: keepPreviousData,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteReminder(id),
    onSuccess: () => {
      setDeleting(null);
      refresh();
      void message.success(t('reminders.manual.deleted'));
    },
    onError: (error) => void message.error(errorMessage(error)),
  });

  const columns: DataTableColumn<ReminderView>[] = [
    {
      key: 'done',
      title: t('reminders.fields.done'),
      width: 72,
      render: (r) => (
        <Checkbox
          checked={Boolean(r.doneAt)}
          disabled={toggleDone.isPending && toggleDone.variables?.id === r.id}
          onChange={(e) => toggleDone.mutate({ id: r.id, done: e.target.checked })}
          aria-label={r.doneAt ? t('reminders.manual.markUndone') : t('reminders.manual.markDone')}
          data-testid={`reminder-done-${r.id}`}
        />
      ),
    },
    {
      key: 'title',
      title: t('reminders.fields.title'),
      mobile: 'title',
      render: (r) => (
        <Flex vertical className={r.doneAt ? 'rm-reminder-done' : undefined}>
          <span className="rm-strong-link">
            <AutoDir>{r.title}</AutoDir>
          </span>
          {r.notes && (
            <Typography.Text type="secondary" className="rm-small-text rm-cell-text" ellipsis>
              <AutoDir>{r.notes}</AutoDir>
            </Typography.Text>
          )}
        </Flex>
      ),
    },
    {
      key: 'dueAt',
      title: t('reminders.fields.dueAt'),
      render: (r) => (
        <span className={!r.doneAt && r.dueAt < today ? 'rm-overdue' : undefined}>
          <DateText value={r.dueAt} />
        </span>
      ),
    },
    {
      key: 'linked',
      title: t('reminders.fields.linkedTo'),
      render: (r) => {
        const link = r.entityType ? safeFeedLink(r.link) : null;
        if (!r.entityType) return <span className="rm-empty-value">—</span>;
        const label = enumLabel('EntityType', r.entityType);
        return link ? <Link to={link}>{label}</Link> : label;
      },
    },
    {
      key: 'actions',
      title: t('common.actions'),
      align: 'end',
      render: (r) => (
        <Flex gap={4} justify="flex-end">
          <Tooltip title={t('actions.edit')}>
            <Button
              size="small"
              type="text"
              icon={<EditOutlined />}
              aria-label={t('actions.edit')}
              onClick={() => setEditing(r)}
              data-testid={`reminder-edit-${r.id}`}
            />
          </Tooltip>
          <Tooltip title={t('actions.delete')}>
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              aria-label={t('actions.delete')}
              onClick={() => setDeleting(r)}
              data-testid={`reminder-delete-${r.id}`}
            />
          </Tooltip>
        </Flex>
      ),
    },
  ];

  const addButton = (
    <Button
      type="primary"
      icon={<PlusOutlined />}
      onClick={() => setEditing('new')}
      data-testid="reminder-add"
    >
      {t('reminders.manual.add')}
    </Button>
  );

  return (
    <Flex vertical gap={16}>
      <FilterBar
        searchKey={null}
        filters={[{ type: 'toggle', key: 'showDone', label: t('reminders.manual.showDone') }]}
        extra={addButton}
      />
      {list.isError ? (
        <LoadError
          error={list.error}
          title={t('reminders.bell.loadError')}
          onRetry={() => void list.refetch()}
        />
      ) : (
        <DataTable<ReminderView>
          label={t('reminders.manual.label')}
          data-testid="reminders-table"
          rowKey={(r) => r.id}
          columns={columns}
          data={list.data?.items}
          total={list.data?.total ?? 0}
          page={page}
          pageSize={pageSize}
          loading={list.isFetching}
          onChange={setTableParams}
          rowClassName={(r) => (r.doneAt ? 'rm-row-archived' : undefined)}
          empty={
            <EmptyState
              title={t('reminders.manual.empty')}
              description={t('reminders.manual.emptyHint')}
              action={addButton}
            />
          }
        />
      )}
      {editing && (
        <ReminderDialog
          reminder={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        title={t('reminders.manual.deleteTitle')}
        content={t('reminders.manual.deleteConfirm')}
        confirmText={t('actions.delete')}
        danger
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onCancel={() => setDeleting(null)}
      />
    </Flex>
  );
}
