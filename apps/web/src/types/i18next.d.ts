import 'i18next';
import type common from '@renawi/shared/locales/en/common.json';

// Type-safe translation keys: English is the reference file (a shared test keeps he/ar identical).
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: { common: typeof common };
    returnNull: false;
  }
}
