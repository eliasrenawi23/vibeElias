import iconOnLight from '@renawi/brand/logo/a-icon.svg';
import horizontalAr from '@renawi/brand/logo/a-horizontal-ar.svg';
import horizontalEn from '@renawi/brand/logo/a-horizontal-en.svg';
import horizontalHe from '@renawi/brand/logo/a-horizontal-he.svg';
import iconOnDark from '@renawi/brand/logo/a-icon-inverse.svg';
import onDarkAr from '@renawi/brand/logo/a-on-dark-ar.svg';
import onDarkEn from '@renawi/brand/logo/a-on-dark-en.svg';
import onDarkHe from '@renawi/brand/logo/a-on-dark-he.svg';
import { toLocale, type Locale } from '@renawi/shared';
import { useTranslation } from 'react-i18next';

const HORIZONTAL: Record<'light' | 'dark', Record<Locale, string>> = {
  light: { he: horizontalHe, ar: horizontalAr, en: horizontalEn },
  dark: { he: onDarkHe, ar: onDarkAr, en: onDarkEn },
};

export interface BrandLogoProps {
  /** `horizontal`: mark + wordmark in the UI language; `icon`: the mark only. */
  variant?: 'horizontal' | 'icon';
  /** Use the version drawn for dark backgrounds. */
  onDark?: boolean;
  /** Rendered height in px. */
  height?: number;
  className?: string;
}

/** Logo concept A (road-chevron "R"). The wordmark follows the UI language. */
export function BrandLogo({
  variant = 'horizontal',
  onDark = false,
  height = 32,
  className,
}: BrandLogoProps) {
  const { t, i18n } = useTranslation();
  const locale = toLocale(i18n.resolvedLanguage);
  const src =
    variant === 'icon'
      ? onDark
        ? iconOnDark
        : iconOnLight
      : HORIZONTAL[onDark ? 'dark' : 'light'][locale];
  return (
    <img
      src={src}
      alt={t('app.name')}
      height={height}
      className={['rm-logo', className].filter(Boolean).join(' ')}
      style={{ height, width: 'auto' }}
      draggable={false}
    />
  );
}
