import { Box } from '@chakra-ui/react';
import { useState } from 'react';
import { SettingsNavigation } from './ui/components/Settings/SettingsNavigation';
import { InterfaceSettings } from './ui/components/Settings/InterfaceSettings';
import { AppSettings } from './ui/components/Settings/AppSettings';
import { useColorModeSync } from './ui/components/Settings/hooks/useColorModeSync';
import About from './ui/components/Settings/About';
import { Regions } from './Regions';
import { GeocodingSettings } from './GeocodingSettings';
export const Settings = () => {
  const [tab, setTab] = useState<'regions' | 'interface' | 'app' | 'about'>(
    'regions'
  );
  useColorModeSync();
  return (
    <>
      <SettingsNavigation activeTab={tab} onTabChange={setTab} />
      <Box maxW="920px" mx="auto" p={{ base: 3, md: 4 }}>
        {tab === 'regions' && <Regions />}
        {tab === 'interface' && <InterfaceSettings />}
        {tab === 'app' && (
          <Box display="flex" flexDirection="column" gap="4">
            <AppSettings />
            <GeocodingSettings />
          </Box>
        )}
        {tab === 'about' && <About />}
      </Box>
    </>
  );
};
