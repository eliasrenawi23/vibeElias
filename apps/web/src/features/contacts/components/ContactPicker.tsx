import { PlusOutlined } from '@ant-design/icons';
import { formatPhone, type ContactTag } from '@renawi/shared';
import { useQuery } from '@tanstack/react-query';
import { Button, Divider, Flex, Select, Spin, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AutoDir, Ltr } from '../../../shared/lib/bidi';
import { useDebouncedValue } from '../../../shared/lib/useDebouncedValue';
import { fetchContact, fetchContacts } from '../api';
import { contactName } from '../lib';
import { contactKeys } from '../queryKeys';
import type { Contact } from '../types';
import { ContactQuickCreateDialog } from './ContactQuickCreateDialog';

export interface ContactPickerProps {
  id?: string;
  /** Selected contact id. */
  value?: string | null;
  onChange?: (id: string | null, contact: Contact | null) => void;
  onBlur?: () => void;
  /** Only contacts with this tag; also preset on contacts created from the picker. */
  tag?: ContactTag;
  placeholder?: string;
  allowClear?: boolean;
  allowCreate?: boolean;
  disabled?: boolean;
  status?: 'error';
  'aria-label'?: string;
}

interface Option {
  value: string;
  label: string;
  contact: Contact;
}

/**
 * Contact select with server search (`GET /contacts?q&tag`) and an inline "create new contact"
 * dialog that posts the contact and selects it.
 */
export function ContactPicker({
  id,
  value,
  onChange,
  onBlur,
  tag,
  placeholder,
  allowClear = true,
  allowCreate = true,
  disabled,
  status,
  'aria-label': ariaLabel,
}: ContactPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [picked, setPicked] = useState<Contact | null>(null);
  const q = useDebouncedValue(search.trim(), 300);

  const results = useQuery({
    queryKey: contactKeys.picker(q, tag),
    queryFn: ({ signal }) => fetchContacts({ q: q || undefined, tag, pageSize: 20 }, signal),
    enabled: open,
    staleTime: 30_000,
  });

  // The selected contact's label when it is not among the loaded results (e.g. edit forms).
  const known = picked && picked.id === value ? picked : null;
  const inResults = results.data?.items.some((c) => c.id === value);
  const selected = useQuery({
    queryKey: contactKeys.detail(value ?? ''),
    queryFn: ({ signal }) => fetchContact(value ?? '', signal),
    enabled: Boolean(value) && !known && !inResults,
    staleTime: 5 * 60_000,
  });

  const options = useMemo<Option[]>(() => {
    const list = [...(results.data?.items ?? [])];
    const current = known ?? selected.data ?? null;
    if (current && !list.some((c) => c.id === current.id)) list.unshift(current);
    return list.map((c) => ({ value: c.id, label: contactName(c) || '—', contact: c }));
  }, [results.data, known, selected.data]);

  const choose = (contact: Contact | null) => {
    setPicked(contact);
    onChange?.(contact?.id ?? null, contact);
  };

  return (
    <>
      <Select<string, Option>
        id={id}
        value={value ?? undefined}
        options={options}
        placeholder={placeholder ?? t('contacts.picker.placeholder')}
        aria-label={ariaLabel}
        allowClear={allowClear}
        disabled={disabled}
        status={status}
        onBlur={onBlur}
        open={open}
        onOpenChange={setOpen}
        showSearch={{ filterOption: false, onSearch: setSearch, searchValue: search }}
        loading={results.isFetching}
        notFoundContent={
          results.isFetching ? <Spin size="small" /> : t('contacts.picker.noResults')
        }
        onChange={(v, option) => {
          const opt = Array.isArray(option) ? option[0] : option;
          choose(v ? (opt?.contact ?? null) : null);
          setSearch('');
        }}
        optionRender={(option) => {
          const c = option.data.contact;
          return (
            <Flex vertical>
              <AutoDir>{option.data.label}</AutoDir>
              {c.phones[0] && (
                <Typography.Text type="secondary" className="rm-picker-sub">
                  <Ltr>{formatPhone(c.phones[0])}</Ltr>
                  {c.city ? <> · <AutoDir>{c.city}</AutoDir></> : null}
                </Typography.Text>
              )}
            </Flex>
          );
        }}
        labelRender={(props) => <AutoDir>{String(props.label ?? '')}</AutoDir>}
        popupRender={(menu) =>
          allowCreate ? (
            <>
              {menu}
              <Divider className="rm-picker-divider" />
              <Button
                type="link"
                icon={<PlusOutlined />}
                onClick={() => {
                  setOpen(false);
                  setCreating(true);
                }}
                data-testid="contact-picker-create"
              >
                {t('contacts.picker.createNew')}
              </Button>
            </>
          ) : (
            menu
          )
        }
        data-testid="contact-picker"
        className="rm-contact-picker"
      />
      {creating && (
        <ContactQuickCreateDialog
          presetTags={tag ? [tag] : []}
          initialName={search}
          onCreated={(contact) => {
            setCreating(false);
            setSearch('');
            choose(contact);
          }}
          onCancel={() => setCreating(false)}
        />
      )}
    </>
  );
}
