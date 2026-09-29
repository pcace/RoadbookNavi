import i18n from '../i18n';
import { useSettings } from '../stores/settingsStore';

// Normalize arbitrary language tags to supported app languages
const normalize = (lng: string): 'de' | 'en' => {
  const l = (lng || '').toLowerCase();
  if (l.startsWith('en')) return 'en';
  if (l.startsWith('de')) return 'de';
  // default fallback
  return 'de';
};

export const setLanguage = async (lng: string) => {
  const target = normalize(lng);

  // Update i18n immediately (and let detector cache to localStorage/cookie)
  await i18n.changeLanguage(target);

  try {
    // Store the explicit preference independently from detector metadata.
    localStorage.setItem('preferredLanguage', target);
  } catch {}

  const { updateInterfaceSettings } = useSettings.getState();
  await updateInterfaceSettings({ language: target });
};

export const getPreferredLanguage = (): 'de' | 'en' | null => {
  try {
    const explicit = localStorage.getItem('preferredLanguage');
    if (explicit) return normalize(explicit);
    const detected = localStorage.getItem('i18nextLng');
    return detected ? normalize(detected) : null;
  } catch {
    return null;
  }
};
