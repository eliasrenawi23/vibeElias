import {
  ArrowLeftOutlined,
  EditOutlined,
  IdcardOutlined,
  InboxOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { todayInBusinessTz, type ContactCreate } from '@renawi/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Descriptions, Flex, Skeleton, Tag, Typography } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { AutoDir, Ltr } from '../../../shared/lib/bidi';
import { useErrorMessage } from '../../../shared/lib/i18n';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog';
import { DateText } from '../../../shared/ui/DateText';
import { LoadError } from '../../../shared/ui/LoadError';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { PhoneText } from '../../../shared/ui/PhoneText';
import { EntityDocuments } from '../../documents/components/EntityDocuments';
import {
  archiveContact,
  createContact,
  fetchContact,
  unarchiveContact,
  updateContact,
} from '../api';
import { ContactTags } from '../components/ContactTags';
import { ContactForm } from '../forms/ContactForm';
import { contactName, isCompany } from '../lib';
import { contactKeys } from '../queryKeys';
import type { ContactDetail } from '../types';

/** `/contacts/new` (create) and `/contacts/:id` (view, edit, archive, documents). */
export function ContactDetailPage() {
  const { id } = useParams();
  return id ? <ContactView key={id} id={id} /> : <NewContact />;
}

function BackLink() {
  const { t } = useTranslation();
  return (
    <Link to="/contacts" className="rm-back-link">
      <ArrowLeftOutlined className="rm-flip-rtl" /> {t('common.backToList')}
    </Link>
  );
}

function NewContact() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: createContact,
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: contactKeys.all });
      void message.success(t('contacts.created'));
      navigate(`/contacts/${encodeURIComponent(created.id)}`, { replace: true });
    },
  });
  return (
    <Flex vertical gap={16}>
      <BackLink />
      <ContactForm
        onSubmit={(values) => mutation.mutateAsync(values)}
        submitting={mutation.isPending}
        onCancel={() => navigate('/contacts')}
        submitLabel={t('actions.create')}
      />
    </Flex>
  );
}

function ContactView({ id }: { id: string }) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const [editing, setEditing] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const query = useQuery({
    queryKey: contactKeys.detail(id),
    queryFn: ({ signal }) => fetchContact(id, signal),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: contactKeys.all });

  const update = useMutation({
    mutationFn: (body: ContactCreate) => updateContact(id, body),
    onSuccess: async () => {
      await refresh();
      setEditing(false);
      void message.success(t('common.saved'));
    },
  });

  const archive = useMutation({
    mutationFn: (archived: boolean) => (archived ? archiveContact(id) : unarchiveContact(id)),
    onSuccess: async (_data, archived) => {
      setConfirmArchive(false);
      await refresh();
      void message.success(archived ? t('contacts.archivedOk') : t('contacts.restoredOk'));
    },
    onError: (error) => void message.error(errorMessage(error)),
  });

  if (query.isPending) {
    return (
      <Card variant="borderless">
        <Skeleton active paragraph={{ rows: 8 }} />
      </Card>
    );
  }
  if (query.isError) {
    return (
      <LoadError
        error={query.error}
        title={t('contacts.loadError')}
        notFoundTitle={t('contacts.notFound')}
        onRetry={() => void query.refetch()}
        extra={<BackLink />}
      />
    );
  }

  const contact = query.data;
  const name = contactName(contact) || '—';

  return (
    <Flex vertical gap={16}>
      <BackLink />
      <PageHeader
        title={<AutoDir>{name}</AutoDir>}
        subtitle={<ContactTags tags={contact.tags} />}
        extra={
          !editing && (
            <>
              <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>
                {t('actions.edit')}
              </Button>
              {contact.archivedAt ? (
                <Button
                  icon={<UndoOutlined />}
                  loading={archive.isPending}
                  onClick={() => archive.mutate(false)}
                >
                  {t('actions.restore')}
                </Button>
              ) : (
                <Button icon={<InboxOutlined />} onClick={() => setConfirmArchive(true)}>
                  {t('actions.archive')}
                </Button>
              )}
            </>
          )
        }
      />
      {contact.archivedAt && <Alert type="warning" showIcon title={t('contacts.archivedNotice')} />}
      {!contact.driver && contact.tags.includes('DRIVER') && (
        <Alert
          type="info"
          showIcon
          icon={<IdcardOutlined />}
          title={t('contacts.noDriverProfile')}
          action={
            <Link
              to={`/drivers/new?contactId=${encodeURIComponent(contact.id)}`}
              data-testid="contact-create-driver"
            >
              {t('contacts.createDriverProfile')}
            </Link>
          }
        />
      )}
      {contact.driver && (
        <Alert
          type="info"
          showIcon
          icon={<IdcardOutlined />}
          title={t('contacts.driverProfileHint')}
          action={
            <Link
              to={`/drivers/${encodeURIComponent(contact.driver.id)}`}
              data-testid="contact-driver-link"
            >
              {t('contacts.driverProfile')}
            </Link>
          }
        />
      )}

      {editing ? (
        <ContactForm
          contact={contact}
          onSubmit={(values) => update.mutateAsync(values)}
          submitting={update.isPending}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <ContactSummary contact={contact} />
      )}

      <EntityDocuments owner={{ contactId: id }} onChange={() => void refresh()} />

      <ConfirmDialog
        open={confirmArchive}
        title={t('actions.archive')}
        content={t('contacts.archiveConfirm')}
        confirmText={t('actions.archive')}
        loading={archive.isPending}
        onConfirm={() => archive.mutate(true)}
        onCancel={() => setConfirmArchive(false)}
      />
    </Flex>
  );
}

function ContactSummary({ contact }: { contact: ContactDetail }) {
  const { t } = useTranslation();
  const today = todayInBusinessTz();
  const company = isCompany(contact);
  const text = (value: string | null | undefined) =>
    value ? <AutoDir>{value}</AutoDir> : <span className="rm-empty-value">—</span>;
  const overdue = Boolean(contact.followUpAt && contact.followUpAt < today);

  return (
    <Card variant="borderless" title={t('common.details')}>
      <Descriptions
        column={{ xs: 1, sm: 2, lg: 3 }}
        size="small"
        items={[
          {
            key: 'type',
            label: t('contacts.contactType'),
            children: company ? t('contacts.company') : t('contacts.person'),
          },
          ...(company
            ? [
                {
                  key: 'company',
                  label: t('contacts.fields.companyName'),
                  children: text(contact.companyName),
                },
              ]
            : [
                {
                  key: 'first',
                  label: t('contacts.fields.firstName'),
                  children: text(contact.firstName),
                },
                {
                  key: 'last',
                  label: t('contacts.fields.lastName'),
                  children: text(contact.lastName),
                },
                ...(contact.companyName
                  ? [
                      {
                        key: 'company',
                        label: t('contacts.fields.companyName'),
                        children: text(contact.companyName),
                      },
                    ]
                  : []),
              ]),
          {
            key: 'idNumber',
            label: t('contacts.fields.idNumber'),
            children: contact.idNumber ? <Ltr>{contact.idNumber}</Ltr> : text(null),
          },
          {
            key: 'phones',
            label: t('contacts.fields.phones'),
            children:
              contact.phones.length > 0 ? (
                <Flex vertical gap={2}>
                  {contact.phones.map((p) => (
                    <PhoneText key={p} value={p} />
                  ))}
                </Flex>
              ) : (
                text(null)
              ),
          },
          {
            key: 'email',
            label: t('contacts.fields.email'),
            children: contact.email ? (
              <Ltr tabular={false}>
                <a href={`mailto:${contact.email}`}>{contact.email}</a>
              </Ltr>
            ) : (
              text(null)
            ),
          },
          { key: 'address', label: t('contacts.fields.address'), children: text(contact.address) },
          { key: 'city', label: t('contacts.fields.city'), children: text(contact.city) },
          {
            key: 'lang',
            label: t('contacts.fields.preferredLang'),
            children: t(`language.${contact.preferredLang}`),
          },
          { key: 'source', label: t('contacts.fields.source'), children: text(contact.source) },
          {
            key: 'followUp',
            label: t('contacts.fields.followUpAt'),
            children: (
              <Flex gap={6} align="center" className={overdue ? 'rm-overdue' : undefined}>
                <DateText value={contact.followUpAt} />
                {overdue && <Tag color="error">{t('expiry.overdue')}</Tag>}
              </Flex>
            ),
          },
          {
            key: 'deals',
            label: t('contacts.counts.deals'),
            children: <Ltr>{String(contact.counts?.deals ?? 0)}</Ltr>,
          },
          {
            key: 'documents',
            label: t('contacts.counts.documents'),
            children: <Ltr>{String(contact.counts?.documents ?? 0)}</Ltr>,
          },
          {
            key: 'notes',
            label: t('contacts.fields.notes'),
            span: 'filled',
            children: contact.notes ? (
              <Typography.Paragraph className="rm-pre-wrap" dir="auto">
                {contact.notes}
              </Typography.Paragraph>
            ) : (
              text(null)
            ),
          },
        ]}
      />
    </Card>
  );
}
