import 'react-i18next';
import type commonDE from './locales/de/common.json';
import type roadbookDE from './locales/de/roadbook.json';
import type settingsDE from './locales/de/settings.json';
import type routeBuilderDE from './locales/de/routeBuilder.json';

declare module 'react-i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof commonDE;
      roadbook: typeof roadbookDE;
      settings: typeof settingsDE;
      routeBuilder: typeof routeBuilderDE;
    };
  }
}

export type SupportedLanguage = 'de' | 'en';

export interface LanguageOption {
  code: SupportedLanguage;
  name: string;
  flag: string;
}
