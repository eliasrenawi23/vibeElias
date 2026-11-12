import { FilePdfOutlined } from '@ant-design/icons';
import { LOCALES, PDF_TEMPLATE_TITLE_KEYS, type Locale, type PdfTemplate } from '@renawi/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Flex, Form, Modal, Radio, Segmented, Tooltip, Typography } from 'antd';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDynamicT, useErrorMessage } from '../../../shared/lib/i18n';
import { generatePdf, type PdfChoice } from '../pdf';
import { documentKeys } from '../queryKeys';
import type { DocumentItem } from '../types';

/** `auto` = no `lang`: the API uses the counterparty's preferred language, else the user's. */
type LangChoice = Locale | 'auto';

/** Translated name of a template (`pdf.templates.<key>`). */
export function usePdfTemplateName(): (template: PdfTemplate) => string {
  const dynamicT = useDynamicT();
  return (template) => dynamicT(PDF_TEMPLATE_TITLE_KEYS[template]);
}

/**
 * A new tab opened at the click, while the browser still counts it as the user's action
 * (rendering a PDF can take longer than popup blockers allow); null when it was blocked.
 */
export function reserveDocumentTab(): Window | null {
  const tab = window.open('', '_blank');
  if (tab) tab.opener = null;
  return tab;
}

/**
 * Show a generated document in the reserved tab (or a new one). Returns false when the browser
 * blocked it (the document is still listed under Documents).
 */
export function showDocumentInTab(tab: Window | null, url: string): boolean {
  if (tab && !tab.closed) {
    tab.location.href = url;
    return true;
  }
  const opened = window.open(url, '_blank');
  if (!opened) return false;
  opened.opener = null;
  return true;
}

export interface GeneratePdfDialogProps {
  /** Templates to choose from (at least one); the first is preselected. */
  choices: readonly PdfChoice[];
  /** Language preselected; omitted = the customer's language (decided by the API). */
  defaultLang?: Locale | null;
  onClose: () => void;
  /** After the document was stored (the documents lists are refreshed already). */
  onGenerated?: (document: DocumentItem) => void;
  /**
   * Where the user finds the stored document again, for the success / popup-blocked messages:
   * the record's Documents tab (default), or the paperclip of the table row (ledger entries).
   */
  savedTo?: 'documents' | 'row';
}

/**
 * Pick the document (when there are several) and its language, then generate it: the API
 * renders and stores the PDF, the documents lists refresh, and the file opens in a new tab.
 */
export function GeneratePdfDialog({
  choices,
  defaultLang,
  onClose,
  onGenerated,
  savedTo = 'documents',
}: GeneratePdfDialogProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const errorMessage = useErrorMessage();
  const templateName = usePdfTemplateName();
  const queryClient = useQueryClient();
  const [index, setIndex] = useState(0);
  const [lang, setLang] = useState<LangChoice>(defaultLang ?? 'auto');
  const choice = choices[index] ?? choices[0];
  const tab = useRef<Window | null>(null);

  const mutation = useMutation({
    mutationFn: (c: PdfChoice) => generatePdf(c.template, c.id, lang === 'auto' ? null : lang),
    onSuccess: (document) => {
      void queryClient.invalidateQueries({ queryKey: documentKeys.all });
      void message.success(savedTo === 'row' ? t('pdf.generatedRow') : t('pdf.generated'));
      if (!showDocumentInTab(tab.current, document.url)) {
        void message.info({
          content: (
            <span>
              {savedTo === 'row' ? t('pdf.popupBlockedRow') : t('pdf.popupBlocked')}{' '}
              <a href={document.url} target="_blank" rel="noopener noreferrer">
                {t('pdf.openDocument')}
              </a>
            </span>
          ),
        });
      }
      tab.current = null;
      onGenerated?.(document);
      onClose();
    },
    onError: () => {
      // Nothing to show: close the tab opened for it.
      tab.current?.close();
      tab.current = null;
    },
  });

  const generate = () => {
    if (!choice) return;
    tab.current = reserveDocumentTab();
    mutation.mutate(choice);
  };

  return (
    <Modal
      open
      title={t('pdf.dialogTitle')}
      onCancel={onClose}
      footer={
        <Flex gap={8} justify="flex-end">
          <Button onClick={onClose}>{t('actions.cancel')}</Button>
          <Button
            type="primary"
            icon={<FilePdfOutlined />}
            loading={mutation.isPending}
            disabled={!choice}
            onClick={generate}
            data-testid="pdf-generate"
          >
            {t('pdf.create')}
          </Button>
        </Flex>
      }
      destroyOnHidden
      width={480}
    >
      <Flex vertical gap={12} data-testid="pdf-dialog">
        {mutation.isError && <Alert type="error" showIcon title={errorMessage(mutation.error)} />}
        <Form layout="vertical" component={false}>
          <Form.Item label={t('pdf.template')}>
            {choices.length > 1 ? (
              <Radio.Group
                value={index}
                onChange={(e) => setIndex(Number(e.target.value))}
                data-testid="pdf-template"
              >
                <Flex vertical gap={8}>
                  {choices.map((c, i) => (
                    <Radio key={c.template} value={i} data-template={c.template}>
                      {templateName(c.template)}
                    </Radio>
                  ))}
                </Flex>
              </Radio.Group>
            ) : (
              <Typography.Text strong data-template={choice?.template}>
                {choice && templateName(choice.template)}
              </Typography.Text>
            )}
          </Form.Item>
          <Form.Item label={t('pdf.language')} help={t('pdf.languageHelp')}>
            <Segmented<LangChoice>
              value={lang}
              onChange={setLang}
              options={[
                { value: 'auto', label: t('pdf.languageAuto') },
                ...LOCALES.map((l) => ({ value: l, label: t(`language.${l}`) })),
              ]}
              data-testid="pdf-language"
            />
          </Form.Item>
        </Form>
      </Flex>
    </Modal>
  );
}

export interface PdfRowButtonProps {
  choice: PdfChoice;
  defaultLang?: Locale | null;
  onGenerated?: (document: DocumentItem) => void;
  /** See `GeneratePdfDialogProps.savedTo` (deal payments: the deal's Documents tab). */
  savedTo?: 'documents' | 'row';
}

/** A small "generate PDF" icon button for a table row (deposit, payment), with its dialog. */
export function PdfRowButton({ choice, defaultLang, onGenerated, savedTo }: PdfRowButtonProps) {
  const { t } = useTranslation();
  const templateName = usePdfTemplateName();
  const [open, setOpen] = useState(false);
  const label = t('pdf.generateNamed', { name: templateName(choice.template) });
  return (
    <>
      <Tooltip title={label}>
        <Button
          type="text"
          size="small"
          icon={<FilePdfOutlined />}
          aria-label={label}
          onClick={() => setOpen(true)}
          data-testid={`pdf-row-${choice.template}`}
        />
      </Tooltip>
      {open && (
        <GeneratePdfDialog
          choices={[choice]}
          defaultLang={defaultLang}
          onClose={() => setOpen(false)}
          onGenerated={onGenerated}
          savedTo={savedTo}
        />
      )}
    </>
  );
}
