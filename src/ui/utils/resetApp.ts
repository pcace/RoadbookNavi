/**
 * Complete app reset utility
 * Clears local display caches and interface preferences.
 */

import { offlineCache } from './offlineCache';

export async function completeAppReset(): Promise<void> {
  try {
    // Keep saved projects and native routing/map caches. Only derived roadbook
    // previews and UI preferences are reset.
    await offlineCache.clearAllCache();
    const language = localStorage.getItem('i18nextLng');
    localStorage.clear();
    if (language) {
      localStorage.setItem('i18nextLng', language);
    }
    sessionStorage.clear();
  } catch (error) {
    console.error('Could not reset local app state:', error);
    throw error;
  }
}
