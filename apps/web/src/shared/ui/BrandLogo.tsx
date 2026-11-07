import iconOnLight from '@renawi/brand/logo/b-icon.svg';
import horizontalAr from '@renawi/brand/logo/b-horizontal-ar.svg';
import horizontalEn from '@renawi/brand/logo/b-horizontal-en.svg';
import horizontalHe from '@renawi/brand/logo/b-horizontal-he.svg';
import iconOnDark from '@renawi/brand/logo/b-icon-inverse.svg';
import onDarkAr from '@renawi/brand/logo/b-on-dark-ar.svg';
import onDarkEn from '@renawi/brand/logo/b-on-dark-en.svg';
import onDarkHe from '@renawi/brand/logo/b-on-dark-he.svg';
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

/**
 * Logo concept B (the taxi roof sign with the R), the chosen brand mark. The wordmark follows the
 * UI language. The mark is wide (64 x 36), so `height` 28 gives an icon about 50 px wide.
 */
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
