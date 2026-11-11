import {
  CameraOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  FileOutlined,
  FilePdfOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import { DEFAULT_MAX_UPLOAD_MB, type DocKind } from '@renawi/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Card, Col, Flex, Grid, Image, Row, Skeleton, Tooltip, Typography, Upload } from 'antd';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AutoDir, isolateAuto } from '../../../shared/lib/bidi';
import { useEnumLabel } from '../../../shared/lib/enums';
import { useErrorMessage } from '../../../shared/lib/i18n';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ExpiryBadge } from '../../../shared/ui/ExpiryBadge';
import { LoadError } from '../../../shared/ui/LoadError';
import { ToneTag } from '../../../shared/ui/ToneTag';
import {
  checkUpload,
  deleteDocument,
  documentFileUrl,
  fetchDocuments,
  isImage,
  isPdf,
  updateDocument,
  uploadDocument,
} from '../api';
import { documentKeys } from '../queryKeys';
import type { DocumentItem, DocumentOwner } from '../types';
import { DocumentMetaDialog, type DocumentMeta } from './DocumentMetaDialog';

/** File types offered by the pickers (the API checks the real content). */
const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp';
/** Camera / gallery on phones. */
const CAMERA_ACCEPT = 'image/*,application/pdf';

export interface EntityDocumentsProps {
  /** The record the documents belong to: exactly one id, e.g. `{ vehicleId }`. */
  owner: DocumentOwner;
  /** Pre-selected type in the upload dialog (default: PHOTO for images, OTHER otherwise). */
  defaultKind?: DocKind;
  /** Types offered in the dialogs (default: all). */
  kinds?: readonly DocKind[];
  title?: ReactNode;
  /** Called after an upload, edit or delete (e.g. to refresh a document counter). */
  onChange?: () => void;
}

type Dialog =
  | { type: 'upload'; file: File }
  | { type: 'edit'; doc: DocumentItem }
  | { type: 'delete'; doc: DocumentItem }
  | null;

/**
 * Documents of one record: thumbnail grid with type, title and expiry badge; upload by drag and
 * drop, file picker or (on phones) the camera; preview, download, edit and delete.
 */
export function EntityDocuments({ owner, defaultKind, kinds, title, onChange }: EntityDocumentsProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const enumLabel = useEnumLabel();
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md === false;
  const cameraInput = useRef<HTMLInputElement>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [preview, setPreview] = useState<{ open: boolean; current: number }>({
    open: false,
    current: 0,
  });

  const queryKey = documentKeys.list(owner);
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => fetchDocuments(owner, signal),
  });
  const docs = useMemo(() => query.data ?? [], [query.data]);
  const images = useMemo(() => docs.filter(isImage), [docs]);

  const changed = () => {
    void queryClient.invalidateQueries({ queryKey });
    onChange?.();
  };

  const upload = useMutation({
    mutationFn: ({ file, meta }: { file: File; meta: DocumentMeta }) =>
      uploadDocument({ owner, file, ...meta }),
    onSuccess: () => {
      setDialog(null);
      void message.success(t('documents.uploaded'));
      changed();
    },
  });

  const update = useMutation({
    mutationFn: ({ id, meta }: { id: string; meta: DocumentMeta }) => updateDocument(id, meta),
    onSuccess: () => {
      setDialog(null);
      void message.success(t('common.saved'));
      changed();
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteDocument(id),
    onSuccess: () => {
      setDialog(null);
      void message.success(t('common.deleted'));
      changed();
    },
    onError: (error) => void message.error(errorMessage(error)),
  });

  const pick = (file: File) => {
    const problem = checkUpload(file);
    if (problem) {
      void message.error(t(problem));
      return;
    }
    setDialog({ type: 'upload', file });
  };

  const openPreview = (doc: DocumentItem) => {
    const index = images.findIndex((d) => d.id === doc.id);
    if (index >= 0) setPreview({ open: true, current: index });
  };

  const docName = (doc: DocumentItem) => doc.title || doc.fileName;

  const renderThumb = (doc: DocumentItem) => {
    const name = docName(doc);
    if (isImage(doc)) {
      const src = doc.hasThumb && doc.thumbUrl ? doc.thumbUrl : documentFileUrl(doc);
      return (
        <button
          type="button"
          className="rm-doc-thumb"
          onClick={() => openPreview(doc)}
          aria-label={`${t('actions.preview')}: ${name}`}
        >
          <img src={src} alt={name} loading="lazy" />
        </button>
      );
    }
    return (
      <a
        className="rm-doc-thumb rm-doc-thumb-icon"
        href={documentFileUrl(doc)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${isPdf(doc) ? t('documents.openPdf') : t('actions.open')}: ${name}`}
      >
        {doc.hasThumb && doc.thumbUrl ? (
          <img src={doc.thumbUrl} alt={name} loading="lazy" />
        ) : isPdf(doc) ? (
          <FilePdfOutlined />
        ) : (
          <FileOutlined />
        )}
      </a>
    );
  };

  const renderCard = (doc: DocumentItem) => {
    const name = docName(doc);
    return (
      <Card
        size="small"
        className="rm-doc-card"
        data-testid="document-card"
        cover={renderThumb(doc)}
        actions={[
          isImage(doc) ? (
            <Tooltip key="preview" title={t('actions.preview')}>
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined />}
                aria-label={t('actions.preview')}
                onClick={() => openPreview(doc)}
              />
            </Tooltip>
          ) : (
            <Tooltip key="preview" title={t('documents.openPdf')}>
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined />}
                aria-label={t('actions.open')}
                href={documentFileUrl(doc)}
                target="_blank"
                rel="noopener noreferrer"
              />
            </Tooltip>
          ),
          <Tooltip key="download" title={t('actions.download')}>
            <Button
              type="text"
              size="small"
              icon={<DownloadOutlined />}
              aria-label={t('actions.download')}
              href={documentFileUrl(doc, true)}
              download={doc.fileName}
            />
          </Tooltip>,
          <Tooltip key="edit" title={t('actions.edit')}>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              aria-label={t('actions.edit')}
              onClick={() => setDialog({ type: 'edit', doc })}
            />
          </Tooltip>,
          <Tooltip key="delete" title={t('actions.delete')}>
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              aria-label={t('actions.delete')}
              onClick={() => setDialog({ type: 'delete', doc })}
            />
          </Tooltip>,
        ]}
      >
        <Flex vertical gap={4}>
          <Flex gap={4} wrap align="center">
            <ToneTag tone="neutral" className="rm-doc-kind">{enumLabel('DocKind', doc.kind)}</ToneTag>
            {doc.expiresAt && <ExpiryBadge value={doc.expiresAt} showValid />}
          </Flex>
          <Typography.Text className="rm-doc-name" ellipsis={{ tooltip: name }}>
            <AutoDir>{name}</AutoDir>
          </Typography.Text>
        </Flex>
      </Card>
    );
  };

  const fallbackKind = (file: File): DocKind =>
    defaultKind ?? (file.type.startsWith('image/') ? 'PHOTO' : 'OTHER');

  return (
    <Card
      variant="borderless"
      title={title ?? t('documents.title')}
      className="rm-entity-documents"
      data-testid="entity-documents"
      extra={
        isMobile && (
          <>
            <Button icon={<CameraOutlined />} onClick={() => cameraInput.current?.click()}>
              {t('documents.takePhoto')}
            </Button>
            <input
              ref={cameraInput}
              type="file"
              accept={CAMERA_ACCEPT}
              capture="environment"
              hidden
              data-testid="camera-input"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) pick(file);
              }}
            />
          </>
        )
      }
    >
      <Flex vertical gap={16}>
        <Upload.Dragger
          accept={ACCEPT}
          multiple={false}
          showUploadList={false}
          beforeUpload={(file) => {
            pick(file);
            return Upload.LIST_IGNORE;
          }}
          className="rm-doc-dragger"
          data-testid="document-dragger"
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">{t('documents.dropHint')}</p>
          <p className="ant-upload-hint">
            {t('documents.dropSubHint', { mb: DEFAULT_MAX_UPLOAD_MB })}
          </p>
        </Upload.Dragger>

        {query.isPending ? (
          <Skeleton active paragraph={{ rows: 2 }} />
        ) : query.isError ? (
          <LoadError
            error={query.error}
            title={t('documents.loadError')}
            onRetry={() => void query.refetch()}
          />
        ) : docs.length === 0 ? (
          <EmptyState compact description={t('documents.empty')} />
        ) : (
          <Row gutter={[12, 12]}>
            {docs.map((doc) => (
              <Col key={doc.id} xs={12} sm={8} lg={6} xxl={4}>
                {renderCard(doc)}
              </Col>
            ))}
          </Row>
        )}
      </Flex>

      {images.length > 0 && (
        <Image.PreviewGroup
          items={images.map((doc) => ({ src: documentFileUrl(doc), alt: docName(doc) }))}
          preview={{
            open: preview.open,
            current: preview.current,
            onOpenChange: (open) => setPreview((p) => ({ ...p, open })),
            onChange: (current) => setPreview((p) => ({ ...p, current })),
          }}
        />
      )}

      {dialog?.type === 'upload' && (
        <DocumentMetaDialog
          mode="upload"
          fileName={dialog.file.name}
          initial={{ kind: fallbackKind(dialog.file) }}
          kinds={kinds}
          submitting={upload.isPending}
          onSubmit={(meta) => upload.mutateAsync({ file: dialog.file, meta })}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.type === 'edit' && (
        <DocumentMetaDialog
          mode="edit"
          fileName={dialog.doc.fileName}
          initial={dialog.doc}
          kinds={kinds}
          submitting={update.isPending}
          onSubmit={(meta) => update.mutateAsync({ id: dialog.doc.id, meta })}
          onCancel={() => setDialog(null)}
        />
      )}
      <ConfirmDialog
        open={dialog?.type === 'delete'}
        title={t('documents.deleteTitle')}
        content={
          dialog?.type === 'delete'
            ? t('documents.deleteConfirm', { name: isolateAuto(docName(dialog.doc)) })
            : undefined
        }
        confirmText={t('actions.delete')}
        danger
        loading={remove.isPending}
        onConfirm={() => dialog?.type === 'delete' && remove.mutate(dialog.doc.id)}
        onCancel={() => setDialog(null)}
      />
    </Card>
  );
}
