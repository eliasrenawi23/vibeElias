import { PlusOutlined } from '@ant-design/icons';
import { ContactTag, todayInBusinessTz } from '@renawi/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Button, Flex, Typography } from 'antd';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { AutoDir } from '../../../shared/lib/bidi';
import { useEnumOptions } from '../../../shared/lib/enums';
import { useListParams } from '../../../shared/lib/listParams';
import { DataTable, type DataTableColumn } from '../../../shared/ui/DataTable';
import { DateText } from '../../../shared/ui/DateText';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { FilterBar } from '../../../shared/ui/FilterBar';
import { LoadError } from '../../../shared/ui/LoadError';
import { PhoneText } from '../../../shared/ui/PhoneText';
import { ToneTag } from '../../../shared/ui/ToneTag';
import { fetchContacts } from '../api';
import { ContactTags } from '../components/ContactTags';
import { contactName, personName } from '../lib';
import { contactKeys } from '../queryKeys';
import type { Contact, ContactListQuery } from '../types';

/** `/contacts`: searchable list of contacts and leads with tag and follow-up filters. */
export function ContactsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const tagOptions = useEnumOptions('ContactTag', ContactTag.options);
  const { page, pageSize, sort, order, searchParams, setTableParams } = useListParams();
  const today = todayInBusinessTz();

  const query = useMemo<ContactListQuery>(() => {
    const due = searchParams.get('due') === '1';
    return {
      q: searchParams.get('q') || undefined,
      tag: searchParams.get('tag') || undefined,
      followUpBefore: due ? today : undefined,
      includeArchived: searchParams.get('archived') === '1' || undefined,
      page,
      pageSize,
      sort,
      order,
    };
  }, [searchParams, today, page, pageSize, sort, order]);
  const filtered = Boolean(query.q || query.tag || query.followUpBefore || query.includeArchived);

  const list = useQuery({
    queryKey: contactKeys.list(query),
    queryFn: ({ signal }) => fetchContacts(query, signal),
    placeholderData: keepPreviousData,
  });

  const columns: DataTableColumn<Contact>[] = [
    {
      key: 'name',
      title: t('contacts.fields.name'),
      sortKey: 'lastName',
      mobile: 'title',
      render: (c) => {
        const person = personName(c);
        return (
          <Flex vertical>
            <Flex gap={6} align="center" wrap>
              <Link to={`/contacts/${encodeURIComponent(c.id)}`} className="rm-strong-link">
                <AutoDir>{contactName(c) || '—'}</AutoDir>
              </Link>
              {c.archivedAt && <ToneTag tone="neutral">{t('contacts.archived')}</ToneTag>}
            </Flex>
            {person && c.companyName && (
              <Typography.Text type="secondary">
                <AutoDir>{c.companyName}</AutoDir>
              </Typography.Text>
            )}
          </Flex>
        );
      },
    },
    { key: 'tags', title: t('contacts.fields.tags'), render: (c) => <ContactTags tags={c.tags} /> },
    {
      key: 'phones',
      title: t('contacts.fields.phones'),
      render: (c) =>
        c.phones.length === 0 ? (
          <span className="rm-empty-value">—</span>
        ) : (
          <Flex gap={6} align="center">
            <PhoneText value={c.phones[0]} />
            {c.phones.length > 1 && (
              <Typography.Text type="secondary" className="rm-tabular">
                +{c.phones.length - 1}
              </Typography.Text>
            )}
          </Flex>
        ),
    },
    {
      key: 'city',
      title: t('contacts.fields.city'),
      sortKey: 'city',
      render: (c) =>
        c.city ? <AutoDir>{c.city}</AutoDir> : <span className="rm-empty-value">—</span>,
    },
    {
      key: 'followUpAt',
      title: t('contacts.fields.followUpAt'),
      sortKey: 'followUpAt',
      render: (c) => {
        const overdue = Boolean(c.followUpAt && c.followUpAt < today);
        return (
          <Flex gap={6} align="center" className={overdue ? 'rm-overdue' : undefined}>
            <DateText value={c.followUpAt} />
            {overdue && <ToneTag tone="error">{t('expiry.overdue')}</ToneTag>}
          </Flex>
        );
      },
    },
  ];

  const newButton = (
    <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/contacts/new')}>
      {t('contacts.new')}
    </Button>
  );

  return (
    <Flex vertical gap={16}>
      <FilterBar
        searchPlaceholder={t('contacts.searchPlaceholder')}
        filters={[
          { type: 'chips', key: 'tag', label: t('contacts.fields.tags'), options: tagOptions },
          { type: 'toggle', key: 'due', label: t('contacts.followUpsDue') },
          { type: 'toggle', key: 'archived', label: t('contacts.showArchived') },
        ]}
        extra={newButton}
      />
      {list.isError ? (
        <LoadError error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <DataTable<Contact>
          label={t('nav.contacts')}
          data-testid="contacts-table"
          rowKey={(c) => c.id}
          columns={columns}
          data={list.data?.items}
          total={list.data?.total ?? 0}
          page={page}
          pageSize={pageSize}
          sort={sort}
          order={order}
          loading={list.isFetching}
          onChange={setTableParams}
          onRowClick={(c) => navigate(`/contacts/${encodeURIComponent(c.id)}`)}
          rowClassName={(c) => (c.archivedAt ? 'rm-row-archived' : undefined)}
          empty={
            filtered ? (
              <EmptyState compact description={t('table.emptyFiltered')} />
            ) : (
              <EmptyState
                title={t('contacts.listEmpty')}
                description={t('contacts.listEmptyHint')}
                action={newButton}
              />
            )
          }
        />
      )}
    </Flex>
  );
}
