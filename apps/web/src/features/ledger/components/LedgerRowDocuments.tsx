import { DownloadOutlined, EyeOutlined, FileOutlined, PaperClipOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Button, Flex, Popover, Skeleton, Tooltip, Typography } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AutoDir, isolateLtr, Ltr } from '../../../shared/lib/bidi';
import { useEnumLabel } from '../../../shared/lib/enums';
import { useErrorMessage } from '../../../shared/lib/i18n';
import { DateTimeText } from '../../../shared/ui/DateTimeText';
import { documentFileUrl, fetchDocuments } from '../../documents/api';
import { documentKeys } from '../../documents/queryKeys';
import type { DocumentItem } from '../../documents/types';

export interface LedgerRowDocumentsProps {
  entryId: string;
  /** `documentCount` of the entry (from the ledger API); the button shows only when > 0. */
  count: number;
}

/**
 * Paperclip on a ledger row that has documents (generated deposit / payment confirmations):
 * opens a small list, loaded on the first click (`GET /documents?ledgerEntryId=`), with open and
 * download links. Ledger entries have no Documents tab of their own.
 */
export function LedgerRowDocuments({ entryId, count }: LedgerRowDocumentsProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const label = t('ledger.documents.button', { n: isolateLtr(String(count)) });
  if (count <= 0) return null;
  return (
    <Popover
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      title={t('ledger.documents.title')}
      content={open ? <DocumentList entryId={entryId} /> : null}
      destroyOnHidden
    >
      <Tooltip title={open ? null : label}>
        <Button
          type="text"
          size="small"
          aria-label={label}
          icon={<PaperClipOutlined />}
          data-testid="ledger-documents"
          data-count={count}
        >
          {count > 1 && <Ltr>{count}</Ltr>}
        </Button>
      </Tooltip>
    </Popover>
  );
}

function DocumentList({ entryId }: { entryId: string }) {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const owner = { ledgerEntryId: entryId };
  const query = useQuery({
    queryKey: documentKeys.list(owner),
    queryFn: ({ signal }) => fetchDocuments(owner, signal),
  });
  if (query.isPending) return <Skeleton active title={false} paragraph={{ rows: 2 }} />;
  if (query.isError) {
    return <Typography.Text type="danger">{errorMessage(query.error)}</Typography.Text>;
  }
  if (query.data.length === 0) {
    return <Typography.Text type="secondary">{t('ledger.documents.empty')}</Typography.Text>;
  }
  return (
    <Flex vertical gap={8} className="rm-ledger-docs" data-testid="ledger-documents-list">
      {query.data.map((doc) => (
        <DocumentRow key={doc.id} doc={doc} />
      ))}
    </Flex>
  );
}

function DocumentRow({ doc }: { doc: DocumentItem }) {
  const { t } = useTranslation();
  const enumLabel = useEnumLabel();
  return (
    <Flex gap={8} align="center" justify="space-between" data-doc={doc.id}>
      <Flex gap={8} align="center" className="rm-grow">
        <FileOutlined aria-hidden />
        <Flex vertical gap={0}>
          <AutoDir>{doc.title || doc.fileName}</AutoDir>
          <Typography.Text type="secondary" className="rm-ledger-meta">
            {enumLabel('DocKind', doc.kind)} · <DateTimeText value={doc.createdAt} />
          </Typography.Text>
        </Flex>
      </Flex>
      <Flex gap={2}>
        <Tooltip title={t('actions.open')}>
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            href={documentFileUrl(doc)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('actions.open')}
            data-testid="ledger-document-open"
          />
        </Tooltip>
        <Tooltip title={t('actions.download')}>
          <Button
            type="text"
            size="small"
            icon={<DownloadOutlined />}
            href={documentFileUrl(doc, true)}
            aria-label={t('actions.download')}
            data-testid="ledger-document-download"
          />
        </Tooltip>
      </Flex>
    </Flex>
  );
}
