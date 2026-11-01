import { normalizeLanguage } from '../i18n/languages';
import { create } from 'zustand';
import { isTauri } from '@tauri-apps/api/core';
import { persist } from 'zustand/middleware';
import i18n from '../i18n';
import type { AppSettings } from '../types';

const requestedLanguage =
  typeof window === 'undefined'
    ? null
    : new URLSearchParams(window.location.search).get('lng');

type UI = {
  colorMode: 'light' | 'dark' | 'system';
  headerPosition: 'automatic' | 'left' | 'top';
  language: string;
};
interface Settings {
  interface: UI;
  app: AppSettings;
  isLoading: boolean;
  error: string | null;
  loadSettings: () => Promise<void>;
  updateInterfaceSettings: (p: Partial<UI>) => Promise<void>;
  updateAppSettings: (p: Partial<AppSettings>) => Promise<void>;
}

export const useSettings = create<Settings>()(
  persist(
    (set, get) => ({
      interface: {
        colorMode: 'system',
        headerPosition: 'automatic',
        language: normalizeLanguage(i18n.resolvedLanguage),
      },
      app: {
        keepScreenOn: true,
        odometerDecreaseKey: 'ArrowLeft',
        odometerIncreaseKey: 'ArrowRight',
        roadbookScrollUpKey: 'ArrowUp',
        roadbookScrollDownKey: 'ArrowDown',
        autoFollowToggleKey: 'Space',
        roadbookScrollMode: 'entry',
        roadbookScrollSpeed: 30,
        closeDistanceThreshold: 200,
        defaultMapStyle: 'open_street_map',
        defaultRoutingProfile: isTauri() ? 'trekking' : 'enduro-easy',
      },
      isLoading: false,
      error: null,
      loadSettings: async () => {
        const language = normalizeLanguage(
          requestedLanguage || get().interface.language
        );
        set(s => ({ interface: { ...s.interface, language } }));
        await i18n.changeLanguage(language);
      },
      updateInterfaceSettings: async patch => {
        const normalized = patch.language
          ? { ...patch, language: normalizeLanguage(patch.language) }
          : patch;
        set(s => ({ interface: { ...s.interface, ...normalized } }));
        if (normalized.language) await i18n.changeLanguage(normalized.language);
      },
      updateAppSettings: async patch => {
        set(s => ({ app: { ...s.app, ...patch } }));
      },
    }),
    {
      name: 'roadbooknavi-settings',
      partialize: s => ({ interface: s.interface, app: s.app }),
    }
  )
);
