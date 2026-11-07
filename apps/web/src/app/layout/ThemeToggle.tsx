import { MoonOutlined, SunOutlined } from '@ant-design/icons';
import { Button, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { usePreferences } from '../providers/AuthProvider';
import { useUi } from '../providers/UiProvider';

/** Light / dark switch. The choice is remembered (and saved to the account when logged in). */
export function ThemeToggle() {
  const { t } = useTranslation();
  const { themeMode } = useUi();
  const setPreferences = usePreferences();
  const next = themeMode === 'dark' ? 'light' : 'dark';
  const label = next === 'dark' ? t('theme.switchToDark') : t('theme.switchToLight');
  return (
    <Tooltip title={label}>
      <Button
        type="text"
        aria-label={label}
        icon={themeMode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
        onClick={() => setPreferences({ theme: next })}
        data-testid="theme-toggle"
      />
    </Tooltip>
  );
}
