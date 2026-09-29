import { Box, Button, HStack } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { useColorModeValue } from '../ui/color-mode';

type SettingsTab = 'interface' | 'app' | 'about' | 'regions';

interface SettingsNavigationProps {
  activeTab: string;
  onTabChange: (tab: SettingsTab) => void;
}

export const SettingsNavigation = ({
  activeTab,
  onTabChange,
}: SettingsNavigationProps) => {
  const { t } = useTranslation();
  const bg = useColorModeValue('#f8f9fa', 'gray.900');
  const border = useColorModeValue('gray.200', 'gray.700');
  const tabs = [
    { id: 'interface' as const, label: t('settings:tabs.interface') },
    { id: 'app' as const, label: t('settings:tabs.app') },
    {
      id: 'regions' as const,
      label: t('settings:tabs.regions', { defaultValue: 'Gebiete' }),
    },
    { id: 'about' as const, label: t('settings:tabs.about') },
  ];

  return (
    <Box
      position="sticky"
      top="0"
      zIndex="100"
      bg={bg}
      borderBottomWidth="1px"
      borderColor={border}
      px={{ base: 2, md: 4 }}
      py={2}
    >
      <HStack
        maxW="920px"
        mx="auto"
        gap={1}
        overflowX="auto"
        scrollbar="hidden"
      >
        {tabs.map(tab => (
          <Button
            key={tab.id}
            size="sm"
            flexShrink={0}
            variant={activeTab === tab.id ? 'solid' : 'ghost'}
            colorPalette={activeTab === tab.id ? 'blue' : 'gray'}
            aria-current={activeTab === tab.id ? 'page' : undefined}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </HStack>
    </Box>
  );
};
