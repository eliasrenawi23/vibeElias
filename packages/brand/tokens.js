// Generated from tokens.ts by scripts/build-tokens.mjs (types stripped). Do not edit.

// -----------------------------------------------------------------------------------------------
// Brand constants
// -----------------------------------------------------------------------------------------------

export const brand = {
  name: { en: 'Renawi Motors', he: 'רינאוי מוטורס', ar: 'ريناوي موتورز' },
  colors: {
    /** Taxi yellow: primary fills, the logo, the selected item. Never text on white. */
    yellow: '#F5C518',
    /** Slightly desaturated yellow used as the primary colour on dark surfaces. */
    yellowOnDark: '#E8BD30',
    /** Brand black: text, the logo tile, the app chrome. */
    ink: '#0F0F10',
    graphite: '#2A2A2E',
    white: '#FFFFFF',
    /** "Green number" accent, reserved for taxi-licence entities. */
    licenseGreen: '#0B6E4F',
  },
};

/** Values for the PWA manifest and `<meta name="theme-color">`. */
export const pwa = {
  themeColor: brand.colors.ink,
  backgroundColor: brand.colors.ink,
};

// -----------------------------------------------------------------------------------------------
// Palette (theme-independent scales)
// -----------------------------------------------------------------------------------------------

export const palette = {
  yellow: {
    50: '#FFFBEB',
    100: '#FEF3C8',
    200: '#FCE697',
    300: '#F8D862',
    400: '#F7CE3B',
    500: '#F5C518',
    600: '#DFAE0C',
    700: '#AD8200',
    800: '#8A6500',
    900: '#5C4200',
  },
  grey: {
    0: '#FFFFFF',
    50: '#F7F7F8',
    100: '#F0F0F2',
    200: '#E4E4E7',
    300: '#D4D4D8',
    400: '#A1A1AA',
    500: '#71717A',
    600: '#52525B',
    700: '#3F3F46',
    800: '#2A2A2E',
    900: '#1B1B1F',
    950: '#0F0F10',
  },
};

// -----------------------------------------------------------------------------------------------
// Semantic colour roles per theme
// -----------------------------------------------------------------------------------------------

const { yellow, grey } = palette;

export const colors = {
  light: {
    bgLayout: grey[50],
    bgContainer: grey[0],
    bgElevated: grey[0],
    bgSunken: grey[100],
    text: grey[950],
    textSecondary: grey[600],
    textTertiary: grey[500],
    textDisabled: grey[400],
    border: grey[300],
    borderStrong: grey[400],
    divider: grey[200],
    primary: yellow[500],
    primaryHover: yellow[400],
    primaryActive: yellow[600],
    primarySoft: yellow[100],
    primaryText: yellow[800],
    onPrimary: grey[950],
    focusRing: 'rgba(245, 197, 24, 0.45)',
    link: '#1D5FD1',
    linkHover: '#174CA8',
    success: '#2E7D32',
    successBg: '#EDF7EE',
    successBorder: '#A7D3AA',
    warning: '#B54708',
    warningBg: '#FEF0E6',
    warningBorder: '#F7C29E',
    error: '#C8281C',
    errorBg: '#FDECEA',
    errorBorder: '#F5B5AF',
    info: '#1D5FD1',
    infoBg: '#EAF1FD',
    infoBorder: '#A9C5F5',
    license: brand.colors.licenseGreen,
    licenseBg: '#E6F4EE',
    licenseBorder: '#9ED2BC',
    chromeBg: grey[950],
    chromeText: '#EDEDEF',
    chromeTextSecondary: '#A6A6AE',
    chromeSelectedBg: yellow[500],
    chromeSelectedText: grey[950],
    onStatus: grey[0],
    overlay: 'rgba(15, 15, 16, 0.45)',
  },
  dark: {
    bgLayout: '#0F0F10',
    bgContainer: '#17171A',
    bgElevated: '#1F1F23',
    bgSunken: '#0A0A0B',
    text: '#EDEDEF',
    textSecondary: '#A6A6AE',
    textTertiary: '#8E8E96',
    textDisabled: '#5E5E66',
    border: '#2E2E33',
    borderStrong: '#3F3F46',
    divider: '#26262B',
    primary: brand.colors.yellowOnDark,
    primaryHover: '#F0CB55',
    primaryActive: '#C99F1F',
    primarySoft: 'rgba(232, 189, 48, 0.14)',
    primaryText: brand.colors.yellowOnDark,
    onPrimary: grey[950],
    focusRing: 'rgba(232, 189, 48, 0.32)',
    link: '#6EA8FE',
    linkHover: '#9CC3FF',
    success: '#52C48C',
    successBg: 'rgba(82, 196, 140, 0.14)',
    successBorder: '#2D6B4D',
    warning: '#F2994A',
    warningBg: 'rgba(242, 153, 74, 0.14)',
    warningBorder: '#7A4B22',
    error: '#F47067',
    errorBg: 'rgba(244, 112, 103, 0.14)',
    errorBorder: '#7D3530',
    info: '#6EA8FE',
    infoBg: 'rgba(110, 168, 254, 0.14)',
    infoBorder: '#2F4F80',
    license: '#3CCB94',
    licenseBg: 'rgba(60, 203, 148, 0.14)',
    licenseBorder: '#1F6B50',
    chromeBg: '#0A0A0B',
    chromeText: '#EDEDEF',
    chromeTextSecondary: '#A6A6AE',
    chromeSelectedBg: brand.colors.yellowOnDark,
    chromeSelectedText: grey[950],
    onStatus: grey[950],
    overlay: 'rgba(0, 0, 0, 0.6)',
  },
};

/** Taxi-licence accent per theme (tags, icons, the licence column, licence detail headers). */
export const licenseAccent = {
  light: {
    color: colors.light.license,
    bg: colors.light.licenseBg,
    border: colors.light.licenseBorder,
    onSolid: grey[0],
  },
  dark: {
    color: colors.dark.license,
    bg: colors.dark.licenseBg,
    border: colors.dark.licenseBorder,
    onSolid: grey[950],
  },
};

// -----------------------------------------------------------------------------------------------
// Typography
// -----------------------------------------------------------------------------------------------

/**
 * Rubik covers Latin, Hebrew and Arabic in one design. 'Rubik Variable' is the family name used
 * by @fontsource-variable/rubik; 'Rubik' matches Google Fonts and locally installed copies.
 */
export const fontFamily =
  "'Rubik Variable', 'Rubik', 'Noto Sans Hebrew', 'Noto Sans Arabic', 'Noto Sans', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";

export const fontFamilyMono =
  "ui-monospace, 'SFMono-Regular', 'Cascadia Mono', 'Segoe UI Mono', Consolas, 'Liberation Mono', monospace";

export const typography = {
  fontFamily,
  fontFamilyMono,
  /** Amounts, plates, dates, counters: always tabular figures. */
  numeric: 'tabular-nums',
  weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
  scale: {
    display: { size: 40, lineHeight: 48, weight: 700 },
    h1: { size: 32, lineHeight: 40, weight: 700 },
    h2: { size: 24, lineHeight: 32, weight: 600 },
    h3: { size: 20, lineHeight: 28, weight: 600 },
    h4: { size: 16, lineHeight: 24, weight: 600 },
    bodyLg: { size: 16, lineHeight: 26, weight: 400 },
    body: { size: 14, lineHeight: 22, weight: 400 },
    small: { size: 12, lineHeight: 18, weight: 400 },
    caption: { size: 11, lineHeight: 16, weight: 500 },
  },
};

// -----------------------------------------------------------------------------------------------
// Space, radius, elevation, motion
// -----------------------------------------------------------------------------------------------

/** 4px grid. Keys are multiples of 4px. */
export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
};

export const radius = { xs: 4, sm: 6, md: 8, lg: 12, xl: 16, pill: 999 };

/** Minimal elevation: flat surfaces, hairline borders, soft shadows only for floating layers. */
export const shadows = {
  light: {
    sm: '0 1px 2px rgba(15, 15, 16, 0.06)',
    md: '0 4px 12px rgba(15, 15, 16, 0.08), 0 1px 2px rgba(15, 15, 16, 0.04)',
    lg: '0 12px 32px rgba(15, 15, 16, 0.14), 0 2px 6px rgba(15, 15, 16, 0.06)',
  },
  dark: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.5)',
    md: '0 4px 12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.04)',
    lg: '0 12px 32px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.06)',
  },
};

export const motion = {
  durationFast: '120ms',
  durationBase: '200ms',
  durationSlow: '320ms',
  easing: 'cubic-bezier(0.2, 0, 0, 1)',
};

export const control = { heightSm: 28, height: 36, heightLg: 44 };

// -----------------------------------------------------------------------------------------------
// Ant Design v6
// -----------------------------------------------------------------------------------------------

function antdToken(mode) {
  const c = colors[mode];
  const s = shadows[mode];
  return {
    colorPrimary: c.primary,
    colorSuccess: c.success,
    colorWarning: c.warning,
    colorError: c.error,
    colorInfo: c.info,
    colorLink: c.link,
    colorLinkHover: c.linkHover,
    colorTextBase: c.text,
    colorBgBase: mode === 'light' ? grey[0] : '#0F0F10',
    colorText: c.text,
    colorTextHeading: c.text,
    colorTextSecondary: c.textSecondary,
    colorTextTertiary: c.textTertiary,
    colorTextQuaternary: c.textDisabled,
    colorTextPlaceholder: c.textTertiary,
    colorTextDisabled: c.textDisabled,
    colorBorder: c.border,
    colorBorderSecondary: c.divider,
    colorSplit: c.divider,
    colorBgLayout: c.bgLayout,
    colorBgContainer: c.bgContainer,
    colorBgElevated: c.bgElevated,
    colorBgSpotlight: mode === 'light' ? grey[800] : '#3F3F46',
    colorBgMask: c.overlay,
    colorPrimaryHover: c.primaryHover,
    colorPrimaryActive: c.primaryActive,
    colorPrimaryBg: mode === 'light' ? yellow[50] : 'rgba(232, 189, 48, 0.12)',
    colorPrimaryBgHover: c.primarySoft,
    colorPrimaryBorder: mode === 'light' ? yellow[300] : '#7A6420',
    colorPrimaryBorderHover: mode === 'light' ? yellow[400] : '#A6862A',
    // AntD paints some text in the primary colour; keep it readable (yellow fails on white).
    colorPrimaryText: c.primaryText,
    colorPrimaryTextHover: mode === 'light' ? yellow[700] : c.primaryHover,
    colorPrimaryTextActive: mode === 'light' ? yellow[900] : c.primaryActive,
    controlOutline: c.focusRing,
    controlOutlineWidth: 3,
    fontFamily,
    fontFamilyCode: fontFamilyMono,
    fontSize: typography.scale.body.size,
    fontSizeSM: typography.scale.small.size,
    fontSizeLG: typography.scale.bodyLg.size,
    fontSizeHeading1: typography.scale.h1.size,
    fontSizeHeading2: typography.scale.h2.size,
    fontSizeHeading3: typography.scale.h3.size,
    fontSizeHeading4: typography.scale.h4.size,
    fontSizeHeading5: typography.scale.body.size,
    fontWeightStrong: typography.weight.semibold,
    borderRadius: radius.md,
    borderRadiusXS: radius.xs,
    borderRadiusSM: radius.sm,
    borderRadiusLG: radius.lg,
    controlHeight: control.height,
    controlHeightSM: control.heightSm,
    controlHeightLG: control.heightLg,
    sizeUnit: 4,
    sizeStep: 4,
    wireframe: false,
    boxShadow: s.md,
    boxShadowSecondary: s.lg,
    boxShadowTertiary: s.sm,
  };
}

/** `theme.token` for the light theme (use with `theme.defaultAlgorithm`). */
export const lightTokens = antdToken('light');
/** `theme.token` for the dark theme (use with `theme.darkAlgorithm`). */
export const darkTokens = antdToken('dark');

function antdComponentTokens(mode) {
  const c = colors[mode];
  const light = mode === 'light';
  const hoverBorder = light ? grey[500] : '#5E5E66';
  // Controls: solid ink/yellow border for the focus state (3:1+) plus the brand glow.
  const inputLike = {
    hoverBorderColor: hoverBorder,
    activeBorderColor: light ? grey[950] : c.primary,
    activeShadow: `0 0 0 3px ${c.focusRing}`,
  };
  return {
    Button: {
      primaryColor: c.onPrimary, // black on yellow (11.8:1); white on yellow is 1.6:1
      fontWeight: typography.weight.medium,
      primaryShadow: 'none',
      defaultShadow: 'none',
      dangerShadow: 'none',
      dangerColor: c.onStatus, // dark theme: black on the light red (white would be 2.9:1)
      defaultHoverColor: c.text,
      defaultHoverBorderColor: light ? grey[950] : grey[400],
      defaultHoverBg: light ? grey[50] : '#1F1F23',
      defaultActiveColor: c.text,
      defaultActiveBorderColor: light ? grey[950] : grey[300],
      defaultActiveBg: light ? grey[100] : '#26262B',
    },
    Menu: {
      itemSelectedColor: light ? c.text : c.primary,
      itemSelectedBg: c.primarySoft,
      itemHoverBg: light ? grey[100] : 'rgba(255, 255, 255, 0.06)',
      itemActiveBg: c.primarySoft,
      itemBorderRadius: radius.md,
      subMenuItemSelectedColor: light ? c.text : c.primary,
      horizontalItemSelectedColor: light ? c.text : c.primary,
      // theme="dark" menus are the brand chrome (side navigation)
      darkItemBg: c.chromeBg,
      darkSubMenuItemBg: light ? grey[900] : '#0F0F10',
      darkPopupBg: light ? grey[900] : '#1F1F23',
      darkItemColor: c.chromeTextSecondary,
      darkItemHoverColor: c.chromeText,
      darkItemHoverBg: 'rgba(255, 255, 255, 0.06)',
      darkItemSelectedBg: c.chromeSelectedBg,
      darkItemSelectedColor: c.chromeSelectedText,
    },
    Table: {
      headerBg: light ? grey[50] : '#1F1F23',
      headerColor: c.textSecondary,
      headerSplitColor: 'transparent',
      headerSortActiveBg: light ? grey[100] : '#26262B',
      borderColor: c.divider,
      rowHoverBg: light ? grey[50] : '#1F1F23',
      rowSelectedBg: light ? yellow[50] : 'rgba(232, 189, 48, 0.10)',
      rowSelectedHoverBg: c.primarySoft,
      footerBg: light ? grey[50] : '#1F1F23',
    },
    Tabs: {
      // Light: an ink bar (a yellow bar on white is 1.6:1 and would not mark the state).
      inkBarColor: light ? grey[950] : c.primary,
      itemSelectedColor: c.text,
      itemActiveColor: c.text,
      itemHoverColor: light ? grey[800] : '#FFFFFF',
    },
    Pagination: {
      itemActiveBg: c.primary,
      itemActiveColor: c.onPrimary,
      itemActiveColorHover: c.onPrimary,
    },
    Input: inputLike,
    InputNumber: inputLike,
    DatePicker: {
      ...inputLike,
      colorTextLightSolid: c.onPrimary, // selected date: black on yellow
      cellActiveWithRangeBg: c.primarySoft,
    },
    Select: {
      ...inputLike,
      activeOutlineColor: c.focusRing,
      optionSelectedBg: c.primarySoft,
      optionSelectedColor: c.text,
      optionActiveBg: light ? grey[100] : 'rgba(255, 255, 255, 0.06)',
    },
    Checkbox: { colorWhite: c.onPrimary }, // black tick on yellow
    Radio: { colorWhite: c.onPrimary, buttonSolidCheckedColor: c.onPrimary },
    Steps: { colorTextLightSolid: c.onPrimary },
    Badge: { colorTextLightSolid: c.onStatus }, // count on the error red
    Tag: { defaultBg: light ? grey[100] : '#1F1F23', defaultColor: c.text },
    Layout: {
      siderBg: c.chromeBg,
      headerBg: c.bgContainer,
      bodyBg: c.bgLayout,
      triggerBg: light ? grey[800] : '#1F1F23',
      lightSiderBg: c.bgContainer,
    },
  };
}

/** `theme.components` per theme. */
export const antdComponents = {
  light: antdComponentTokens('light'),
  dark: antdComponentTokens('dark'),
};

/** `{ token, components }` for `<ConfigProvider theme>`; add the matching AntD algorithm. */
export function antdTheme(mode) {
  return {
    token: mode === 'dark' ? darkTokens : lightTokens,
    components: antdComponents[mode],
  };
}
