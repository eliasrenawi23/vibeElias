import { MoreOutlined } from '@ant-design/icons';
import { Button, Dropdown, Grid } from 'antd';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export interface ActionDef<K extends string = string> {
  key: K;
  label: string;
  icon?: ReactNode;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  /** Spinner on the button while the action runs (desktop; the phone menu disables the item). */
  loading?: boolean;
}

export interface ActionBarProps<K extends string> {
  actions: readonly ActionDef<K>[];
  onAction: (key: K) => void;
  /** Accessible name of the phone "more" menu button. */
  menuLabel: string;
  /** Test id prefix: buttons get `<prefix>-<key>`, the phone menu `<prefix>s-menu`. */
  testIdPrefix: string;
}

/**
 * Page-header actions of every detail page (`DetailPageLayout`): buttons from `md` up, one
 * "more" dropdown on phones. The one `primary` action is the thing to do next.
 */
export function ActionBar<K extends string>({
  actions,
  onAction,
  menuLabel,
  testIdPrefix,
}: ActionBarProps<K>) {
  const { t } = useTranslation();
  const screens = Grid.useBreakpoint();
  // `screens` is empty until the first measurement; treat that as desktop.
  const isMobile = screens.md === false;
  if (actions.length === 0) return null;

  if (isMobile) {
    return (
      <Dropdown
        trigger={['click']}
        menu={{
          items: actions.map((a) => ({
            key: a.key,
            label: a.label,
            icon: a.icon,
            danger: a.danger,
            disabled: a.disabled || a.loading,
          })),
          onClick: ({ key }) => onAction(key as K),
        }}
      >
        <Button
          icon={<MoreOutlined />}
          aria-label={menuLabel}
          data-testid={`${testIdPrefix}s-menu`}
        >
          {t('actions.more')}
        </Button>
      </Dropdown>
    );
  }

  return (
    <>
      {actions.map((a) => (
        <Button
          key={a.key}
          icon={a.icon}
          type={a.primary ? 'primary' : 'default'}
          danger={a.danger}
          disabled={a.disabled}
          loading={a.loading}
          onClick={() => onAction(a.key)}
          data-testid={`${testIdPrefix}-${a.key}`}
        >
          {a.label}
        </Button>
      ))}
    </>
  );
}
