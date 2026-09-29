import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import i18n from '../i18n';
import type { AppSettings } from '../types';

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
        language: 'en',
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
        defaultRoutingProfile: 'trekking',
      },
      isLoading: false,
      error: null,
      loadSettings: async () => {
        await i18n.changeLanguage(get().interface.language);
      },
      updateInterfaceSettings: async patch => {
        set(s => ({ interface: { ...s.interface, ...patch } }));
        if (patch.language) await i18n.changeLanguage(patch.language);
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
