import { useEffect } from 'react';
// import { useColorMode } from '@chakra-ui/react';
import { useSettings } from '../stores/settingsStore';
import { useColorMode } from '../components/ui/color-mode';

export const useThemeManager = () => {
  const { setColorMode } = useColorMode();
  const colorMode = useSettings(state => state.interface.colorMode);

  useEffect(() => {
    if (colorMode && colorMode !== 'system') {
      setColorMode(colorMode);
    }
    // When mode is 'system', we let Chakra UI handle it, which respects OS-level preferences by default
    // if correctly configured with `useSystemColorMode: true` in the theme.
  }, [colorMode, setColorMode]);
};
