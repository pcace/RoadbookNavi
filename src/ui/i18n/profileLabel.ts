import i18n from './index';
import { normalizeLanguage } from './languages';
import routeBuilder from './locales/en/routeBuilder.json';

export function profileLabel(profile: string, language?: string): string {
  if (!Object.hasOwn(routeBuilder.routeProfiles, profile)) return profile;
  return i18n.getFixedT(
    normalizeLanguage(language ?? i18n.resolvedLanguage),
    'routeBuilder'
  )(`routeProfiles.${profile}`);
}
