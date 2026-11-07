import '@fontsource-variable/rubik';
import '@fontsource/noto-sans-arabic';
import '@fontsource/noto-sans-hebrew';
import '@renawi/brand/tokens.css';
import './styles/global.css';

import { installValidationErrorMap } from '@renawi/shared';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { AuthProvider } from './app/providers/AuthProvider';
import { I18nProvider } from './app/providers/I18nProvider';
import { QueryProvider } from './app/providers/QueryProvider';
import { UiProvider } from './app/providers/UiProvider';
import { createRouter } from './app/router';

// Generic zod messages become i18n keys (`validation.*`), translated by the form fields.
installValidationErrorMap();

const router = createRouter();

const container = document.getElementById('root');
if (!container) throw new Error('#root element missing from index.html');

createRoot(container).render(
  <StrictMode>
    <QueryProvider>
      <I18nProvider>
        <UiProvider>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </UiProvider>
      </I18nProvider>
    </QueryProvider>
  </StrictMode>,
);
