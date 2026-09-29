import {
  Box,
  Text,
  Flex,
  Portal,
  Select,
  createListCollection,
} from '@chakra-ui/react';
import { useSettings } from '../../stores/settingsStore';
import {
  useColorModeValue,
  useColorMode,
  ColorModeIcon,
} from '../ui/color-mode';
import { LanguageSelector } from '../LanguageSelector';
import { useTranslation } from 'react-i18next';

export const InterfaceSettings = () => {
  const { interface: uiSettings, updateInterfaceSettings } = useSettings();
  const { colorMode, setColorMode } = useColorMode();
  const { t } = useTranslation();

  // Collections for select components
  const colorModeOptions = createListCollection({
    items: [
      { label: t('settings:interface.system'), value: 'system' },
      { label: t('settings:interface.light'), value: 'light' },
      { label: t('settings:interface.dark'), value: 'dark' },
    ],
  });

  const headerPositionOptions = createListCollection({
    items: [
      { label: t('settings:interface.automatic'), value: 'automatic' },
      { label: t('settings:interface.left'), value: 'left' },
      { label: t('settings:interface.top'), value: 'top' },
    ],
  });

  const bgSection = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('#ddd', 'gray.600');
  const headingColor = useColorModeValue('#333', 'gray.200');
  const textColor = useColorModeValue('#333', 'gray.300');

  return (
    <Box
      bg={bgSection}
      borderRadius="6px"
      p="1rem"
      boxShadow="0 1px 3px rgba(0, 0, 0, 0.1)"
      className="settings-section"
    >
      <Box display="flex" flexDirection="column" gap="1rem">
        {/* Color Mode Setting */}
        <Box>
          <Text
            color={headingColor}
            fontSize="1.1rem"
            fontWeight="600"
            mb="0.5rem"
          >
            {t('settings:interface.colorMode')}
          </Text>
          <Text color={textColor} fontSize="0.9rem" mb="0.75rem">
            {t('settings:interface.colorModeDescription')}
          </Text>
          <Flex alignItems="center" gap="1rem">
            <Box>
              <Select.Root
                collection={colorModeOptions}
                value={[uiSettings.colorMode]}
                onValueChange={details => {
                  const newMode = details.value[0] as
                    'light' | 'dark' | 'system';
                  updateInterfaceSettings({ colorMode: newMode });

                  // Apply the color mode immediately
                  if (newMode === 'system') {
                    // For system mode, we detect the user's preference
                    const prefersDark = window.matchMedia(
                      '(prefers-color-scheme: dark)'
                    ).matches;
                    setColorMode(prefersDark ? 'dark' : 'light');
                  } else {
                    setColorMode(newMode);
                  }
                }}
                size="sm"
                width="150px"
              >
                <Select.HiddenSelect />
                <Select.Control>
                  <Select.Trigger>
                    <Select.ValueText placeholder="Select color mode" />
                  </Select.Trigger>
                  <Select.IndicatorGroup>
                    <Select.Indicator />
                  </Select.IndicatorGroup>
                </Select.Control>
                <Portal>
                  <Select.Positioner>
                    <Select.Content>
                      {colorModeOptions.items.map(option => (
                        <Select.Item item={option} key={option.value}>
                          {option.label}
                          <Select.ItemIndicator />
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Positioner>
                </Portal>
              </Select.Root>
            </Box>
            <Flex alignItems="center" gap="0.5rem" color={textColor}>
              <ColorModeIcon />
              <Text fontSize="0.9rem">
                {t('settings:interface.current')}:{' '}
                {colorMode === 'dark'
                  ? t('settings:interface.dark')
                  : t('settings:interface.light')}
              </Text>
            </Flex>
          </Flex>
        </Box>

        {/* Language Setting */}
        <Box pt="1rem" borderTop="1px solid" borderColor={borderColor}>
          <Text
            color={headingColor}
            fontSize="1.1rem"
            fontWeight="600"
            mb="0.5rem"
          >
            {t('settings:interface.language')}
          </Text>
          <Text color={textColor} fontSize="0.9rem" mb="0.75rem">
            {t('settings:interface.languageDescription')}
          </Text>
          <Flex alignItems="center" gap="1rem">
            <Box>
              <LanguageSelector
                textColor={textColor}
                borderColor={borderColor}
              />
            </Box>
          </Flex>
        </Box>

        {/* Header Position Setting */}
        <Box pt="1rem" borderTop="1px solid" borderColor={borderColor}>
          <Text
            color={headingColor}
            fontSize="1.1rem"
            fontWeight="600"
            mb="0.5rem"
          >
            {t('settings:interface.headerPosition')}
          </Text>
          <Text color={textColor} fontSize="0.9rem" mb="0.75rem">
            {t('settings:interface.headerPositionDescription')}
          </Text>
          <Flex alignItems="center" gap="1rem">
            <Box>
              <Select.Root
                collection={headerPositionOptions}
                value={[uiSettings.headerPosition]}
                onValueChange={details => {
                  const newPosition = details.value[0] as
                    'automatic' | 'left' | 'top';
                  updateInterfaceSettings({ headerPosition: newPosition });
                }}
                size="sm"
                width="150px"
              >
                <Select.HiddenSelect />
                <Select.Control>
                  <Select.Trigger>
                    <Select.ValueText placeholder="Select header position" />
                  </Select.Trigger>
                  <Select.IndicatorGroup>
                    <Select.Indicator />
                  </Select.IndicatorGroup>
                </Select.Control>
                <Portal>
                  <Select.Positioner>
                    <Select.Content>
                      {headerPositionOptions.items.map(option => (
                        <Select.Item item={option} key={option.value}>
                          {option.label}
                          <Select.ItemIndicator />
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Positioner>
                </Portal>
              </Select.Root>
            </Box>
            <Text fontSize="0.9rem" color={textColor}>
              {t('settings:interface.current')}:{' '}
              {uiSettings.headerPosition === 'automatic'
                ? t('settings:interface.automatic')
                : uiSettings.headerPosition === 'left'
                  ? t('settings:interface.left')
                  : t('settings:interface.top')}
            </Text>
          </Flex>
        </Box>
      </Box>
    </Box>
  );
};
