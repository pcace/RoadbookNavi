import { useEffect } from 'react';
import { useSettings } from '../../../stores/settingsStore';
import { useColorMode } from '../../ui/color-mode';

export const useColorModeSync = () => {
  const { interface: uiSettings } = useSettings();
  const { setColorMode } = useColorMode();

  useEffect(() => {
    const applySavedColorMode = () => {
      const savedMode = uiSettings.colorMode;

      if (savedMode === 'system') {
        // For system mode, detect user's preference
        const prefersDark = window.matchMedia(
          '(prefers-color-scheme: dark)'
        ).matches;
        setColorMode(prefersDark ? 'dark' : 'light');
      } else {
        setColorMode(savedMode);
      }
    };

    applySavedColorMode();

    // Listen for system theme changes if in system mode
    if (uiSettings.colorMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleSystemThemeChange = (e: MediaQueryListEvent) => {
        setColorMode(e.matches ? 'dark' : 'light');
      };

      mediaQuery.addEventListener('change', handleSystemThemeChange);
      return () =>
        mediaQuery.removeEventListener('change', handleSystemThemeChange);
    }
  }, [uiSettings.colorMode, setColorMode]);
};
