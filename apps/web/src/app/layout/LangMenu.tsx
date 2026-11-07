import { GlobalOutlined } from '@ant-design/icons';
import { LOCALES, localeDirection, toLocale, type Locale } from '@renawi/shared';
import { Button, Dropdown } from 'antd';
import { useTranslation } from 'react-i18next';
import { usePreferences } from '../providers/AuthProvider';

export interface LangMenuProps {
  /** Icon-only trigger (narrow screens). */
  compact?: boolean;
}

/**
 * Language switcher. Each language is listed by its own name (עברית / العربية / English);
 * choosing one flips `<html lang dir>`, the AntD direction/locale and dayjs, and is saved to the
 * account when logged in.
 */
export function LangMenu({ compact = false }: LangMenuProps) {
  const { t, i18n } = useTranslation();
  const setPreferences = usePreferences();
  const current = toLocale(i18n.resolvedLanguage);
  const nativeName = (lng: Locale) => t(`language.${lng}`, { lng });

  return (
    <Dropdown
      trigger={['click']}
      menu={{
        selectable: true,
        selectedKeys: [current],
        items: LOCALES.map((lng) => ({
          key: lng,
          label: (
            <span lang={lng} dir={localeDirection(lng)}>
              {nativeName(lng)}
            </span>
          ),
        })),
        onClick: ({ key }) => setPreferences({ locale: key as Locale }),
      }}
    >
      <Button
        type="text"
        icon={<GlobalOutlined />}
        aria-label={t('language.label')}
        title={t('language.label')}
        data-testid="lang-menu"
      >
        {compact ? null : <span lang={current}>{nativeName(current)}</span>}
      </Button>
    </Dropdown>
  );
}
