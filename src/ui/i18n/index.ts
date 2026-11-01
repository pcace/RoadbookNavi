import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { normalizeLanguage, supportedLanguages } from './languages';

// Import translation files
import commonDE from './locales/de/common.json';
import roadbookDE from './locales/de/roadbook.json';
import settingsDE from './locales/de/settings.json';
import routeBuilderDE from './locales/de/routeBuilder.json';

import commonEN from './locales/en/common.json';
import roadbookEN from './locales/en/roadbook.json';
import settingsEN from './locales/en/settings.json';
import routeBuilderEN from './locales/en/routeBuilder.json';
import commonES from './locales/es/common.json';
import roadbookES from './locales/es/roadbook.json';
import settingsES from './locales/es/settings.json';
import routeBuilderES from './locales/es/routeBuilder.json';
import commonFR from './locales/fr/common.json';
import roadbookFR from './locales/fr/roadbook.json';
import settingsFR from './locales/fr/settings.json';
import routeBuilderFR from './locales/fr/routeBuilder.json';

// Define resources
const resources = {
  es: {
    common: commonES,
    roadbook: roadbookES,
    settings: settingsES,
    routeBuilder: routeBuilderES,
  },
  fr: {
    common: commonFR,
    roadbook: roadbookFR,
    settings: settingsFR,
    routeBuilder: routeBuilderFR,
  },
  de: {
    common: commonDE,
    roadbook: roadbookDE,
    settings: settingsDE,
    routeBuilder: routeBuilderDE,
  },
  en: {
    common: commonEN,
    roadbook: roadbookEN,
    settings: settingsEN,
    routeBuilder: routeBuilderEN,
  },
};

i18n
  .use(LanguageDetector) // Automatically detect user language
  .use(initReactI18next) // Pass i18n instance to react-i18next
  .init({
    // Bundled resources and detection are synchronous; settings must see the
    // resolved language before their persisted store is initialized.
    initAsync: false,
    resources,

    // Language settings - let LanguageDetector determine the language
    // lng: undefined, // Let LanguageDetector determine the language
    fallbackLng: 'en', // Fallback to English if detection fails
    supportedLngs: [...supportedLanguages],

    // Namespace settings
    defaultNS: 'common',
    ns: ['common', 'roadbook', 'settings', 'routeBuilder'],

    // Interpolation settings
    interpolation: {
      escapeValue: false, // React already escapes values
    },

    // Development settings
    debug: import.meta.env.DEV && import.meta.env.MODE !== 'test',

    // Language detection settings
    detection: {
      // Order of detection methods (URL > hash > storage > cookie > browser > DOM)
      order: [
        'querystring',
        'localStorage',
        'sessionStorage',
        'cookie',
        'navigator',
        'htmlTag',
      ],
      // Cache detected language
      caches: ['localStorage', 'cookie'],
      cookieOptions: { path: '/', sameSite: 'lax' },
      lookupQuerystring: 'lng',
      // Look for these language codes in navigator.language
      lookupFromPathIndex: 0,
      lookupFromSubdomainIndex: 0,
      // Convert browser language codes to our supported languages
      convertDetectedLanguage: normalizeLanguage,
    },
  });

// Keep <html lang="..."> in sync for accessibility/SEO
i18n.on('languageChanged', lng => {
  try {
    document.documentElement.lang = normalizeLanguage(lng);
  } catch {}
});

if (typeof document !== 'undefined') {
  document.documentElement.lang = normalizeLanguage(i18n.resolvedLanguage);
}

export default i18n;
