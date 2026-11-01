import i18n from '../i18n';
import { useSettings } from '../stores/settingsStore';
import { normalizeLanguage, type SupportedLanguage } from '../i18n/languages';

// Normalize arbitrary language tags to supported app languages
export const setLanguage = async (lng: string) => {
  const target = normalizeLanguage(lng);

  // Update i18n immediately (and let detector cache to localStorage/cookie)
  await i18n.changeLanguage(target);

  try {
    // Store the explicit preference independently from detector metadata.
    localStorage.setItem('preferredLanguage', target);
    const url = new URL(window.location.href);
    if (url.searchParams.has('lng')) {
      url.searchParams.set('lng', target);
      window.history.replaceState(window.history.state, '', url);
    }
  } catch {}

  const { updateInterfaceSettings } = useSettings.getState();
  await updateInterfaceSettings({ language: target });
};

export const getPreferredLanguage = (): SupportedLanguage | null => {
  try {
    const explicit = localStorage.getItem('preferredLanguage');
    if (explicit) return normalizeLanguage(explicit);
    const detected = localStorage.getItem('i18nextLng');
    return detected ? normalizeLanguage(detected) : null;
  } catch {
    return null;
  }
};
