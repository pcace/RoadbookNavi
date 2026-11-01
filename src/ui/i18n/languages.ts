export const supportedLanguages = ['de', 'en', 'es', 'fr'] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

export const languageOptions = [
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
] satisfies { code: SupportedLanguage; name: string; flag: string }[];

export function normalizeLanguage(language?: string | null): SupportedLanguage {
  const base = language?.toLowerCase().split(/[-_]/)[0];
  return supportedLanguages.find(code => code === base) ?? 'en';
}

export function languageLocale(language?: string | null): string {
  return { de: 'de-DE', en: 'en-GB', es: 'es-ES', fr: 'fr-FR' }[
    normalizeLanguage(language)
  ];
}
