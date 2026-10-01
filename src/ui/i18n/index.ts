import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import commonDE from './locales/de/common.json';
import roadbookDE from './locales/de/roadbook.json';
import settingsDE from './locales/de/settings.json';
import routeBuilderDE from './locales/de/routeBuilder.json';

import commonEN from './locales/en/common.json';
import roadbookEN from './locales/en/roadbook.json';
import settingsEN from './locales/en/settings.json';
import routeBuilderEN from './locales/en/routeBuilder.json';

// Define resources
const resources = {
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
    resources,

    // Language settings - let LanguageDetector determine the language
    // lng: undefined, // Let LanguageDetector determine the language
    fallbackLng: 'en', // Fallback to English if detection fails
    supportedLngs: ['de', 'en'],

    // Namespace settings
    defaultNS: 'common',
    ns: ['common', 'roadbook', 'settings', 'routeBuilder'],

    // Interpolation settings
    interpolation: {
      escapeValue: false, // React already escapes values
    },

    // Development settings
    debug: import.meta.env.DEV,

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
      convertDetectedLanguage: (lng: string) => {
        // If browser language starts with 'de', use 'de'
        if (lng?.toLowerCase().startsWith('de')) return 'de';
        // If browser language starts with 'en', use 'en'
        if (lng?.toLowerCase().startsWith('en')) return 'en';
        // Default to English for all other languages (main language on fresh install)
        return 'en';
      },
    },
  });

// Keep <html lang="..."> in sync for accessibility/SEO
i18n.on('languageChanged', lng => {
  try {
    document.documentElement.lang = lng || 'de';
  } catch {}
});

export default i18n;
