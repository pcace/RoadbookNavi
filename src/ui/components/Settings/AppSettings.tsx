import { useNativeProfiles } from '../../config/runtime';
import {
  Box,
  Text,
  HStack,
  Switch,
  VStack,
  Button,
  Slider,
  RadioGroup,
  NativeSelect,
} from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../stores/settingsStore';
import { useColorModeValue } from '../ui/color-mode';
import { KeySelector } from './KeySelector';
import { useState, useEffect } from 'react';
import { offlineCache } from '../../utils/offlineCache';
import { completeAppReset } from '../../utils/resetApp';
import { MAP_STYLES } from '../RouteBuilder/mapStyles';

export const AppSettings = () => {
  const nativeProfiles = useNativeProfiles();
  const { t } = useTranslation();
  const settingsStore = useSettings();
  const [cacheInfo, setCacheInfo] = useState<{ routes: string[] }>({
    routes: [],
  });
  const [isClearing, setIsClearing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [tempScrollSpeed, setTempScrollSpeed] = useState<number | null>(null);
  const [tempCloseDistance, setTempCloseDistance] = useState<number | null>(
    null
  );

  const bgSection = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('#ddd', 'gray.600');
  const headingColor = useColorModeValue('#333', 'gray.200');
  const textColor = useColorModeValue('#333', 'gray.300');

  // Load locally rendered roadbook information when the settings open.
  useEffect(() => {
    const loadCacheInfo = async () => {
      try {
        const routes = await offlineCache.getAllCachedRouteIds();
        setCacheInfo({ routes });
      } catch (error) {
        console.error('Error loading cache info:', error);
      }
    };
    loadCacheInfo();
  }, []);

  const clearCache = async () => {
    if (isClearing) return;

    setIsClearing(true);
    try {
      await offlineCache.clearAllCache();
      setCacheInfo({ routes: [] });
    } catch (error) {
      console.error('Error clearing cache:', error);
    } finally {
      setIsClearing(false);
    }
  };

  const resetApp = async () => {
    if (isResetting) return;

    const confirmed = window.confirm(t('settings:app.resetAppConfirm'));

    if (!confirmed) return;

    setIsResetting(true);
    try {
      await completeAppReset();
      // Reload page with force refresh
      window.location.href = window.location.origin;
    } catch (error) {
      console.error('Error resetting app:', error);
      alert(t('settings:app.resetAppError'));
      setIsResetting(false);
    }
  };

  return (
    <Box
      bg={bgSection}
      borderRadius="6px"
      p="1rem"
      boxShadow="0 1px 3px rgba(0, 0, 0, 0.1)"
      className="settings-section"
    >
      {/* Keep Screen On Setting */}
      <Box>
        <HStack
          alignItems="flex-start"
          justifyContent="space-between"
          gap="1rem"
        >
          <Box flex="1">
            <Text
              color={headingColor}
              fontSize="1.1rem"
              fontWeight="600"
              mb="0.25rem"
            >
              {t('settings:app.keepScreenOn')}
            </Text>
            <Text color={textColor} fontSize="0.9rem">
              {t('settings:app.keepScreenOnDescription')}
            </Text>
          </Box>
          <Switch.Root
            checked={settingsStore.app.keepScreenOn}
            onCheckedChange={e => {
              settingsStore.updateAppSettings({ keepScreenOn: e.checked });
            }}
            size="md"
          >
            <Switch.HiddenInput />
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch.Root>
        </HStack>
      </Box>

      {/* Default Map Style */}
      <Box pt="1rem" borderTop="1px solid" borderColor={borderColor}>
        <Text
          color={headingColor}
          fontSize="1.1rem"
          fontWeight="600"
          mb="0.25rem"
        >
          {t('settings:app.defaultMapStyle')}
        </Text>
        <Text color={textColor} fontSize="0.9rem" mb="0.75rem">
          {t('settings:app.defaultMapStyleDescription')}
        </Text>
        <NativeSelect.Root size="sm" maxW="240px">
          <NativeSelect.Field
            value={settingsStore.app.defaultMapStyle ?? 'open_topo'}
            onChange={e =>
              settingsStore.updateAppSettings({
                defaultMapStyle: e.target.value,
              })
            }
          >
            {MAP_STYLES.map(style => (
              <option key={style.id} value={style.id}>
                {t(style.labelKey, { defaultValue: style.labelDefault })}
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      </Box>

      {/* Default Routing Profile */}
      <Box pt="1rem" borderTop="1px solid" borderColor={borderColor}>
        <Text
          color={headingColor}
          fontSize="1.1rem"
          fontWeight="600"
          mb="0.25rem"
        >
          {t('settings:app.defaultRoutingProfile')}
        </Text>
        <Text color={textColor} fontSize="0.9rem" mb="0.75rem">
          {t('settings:app.defaultRoutingProfileDescription')}
        </Text>
        <NativeSelect.Root size="sm" maxW="240px">
          <NativeSelect.Field
            value={settingsStore.app.defaultRoutingProfile ?? 'Car-FastEco'}
            onChange={e =>
              settingsStore.updateAppSettings({
                defaultRoutingProfile: e.target.value,
              })
            }
          >
            {nativeProfiles.map(value => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      </Box>

      {/* Odometer Keyboard Controls */}
      <Box pt="1rem" borderTop="1px solid" borderColor={borderColor}>
        <Text
          color={headingColor}
          fontSize="1.1rem"
          fontWeight="600"
          mb="0.5rem"
        >
          {t('settings:app.odometerKeys')}
        </Text>
        <Text color={textColor} fontSize="0.9rem" mb="1rem">
          {t('settings:app.odometerKeysDescription')}
        </Text>

        <Box display="flex" flexDirection="column" gap="1rem">
          <KeySelector
            value={settingsStore.app.odometerDecreaseKey}
            onChange={key =>
              settingsStore.updateAppSettings({ odometerDecreaseKey: key })
            }
            label={t('settings:app.odometerDecrease')}
            description={t('settings:app.odometerDecreaseDescription')}
          />
          <KeySelector
            value={settingsStore.app.odometerIncreaseKey}
            onChange={key =>
              settingsStore.updateAppSettings({ odometerIncreaseKey: key })
            }
            label={t('settings:app.odometerIncrease')}
            description={t('settings:app.odometerIncreaseDescription')}
          />
        </Box>
      </Box>

      {/* Roadbook Scroll Keyboard Controls */}
      <Box pt="1rem" borderTop="1px solid" borderColor={borderColor}>
        <Text
          color={headingColor}
          fontSize="1.1rem"
          fontWeight="600"
          mb="0.5rem"
        >
          {t('settings:app.roadbookScrollKeys')}
        </Text>
        <Text color={textColor} fontSize="0.9rem" mb="1rem">
          {t('settings:app.roadbookScrollKeysDescription')}
        </Text>

        <Box display="flex" flexDirection="column" gap="1rem">
          <KeySelector
            value={settingsStore.app.roadbookScrollUpKey}
            onChange={key =>
              settingsStore.updateAppSettings({ roadbookScrollUpKey: key })
            }
            label={t('settings:app.roadbookScrollUp')}
            description={t('settings:app.roadbookScrollUpDescription')}
          />
          <KeySelector
            value={settingsStore.app.roadbookScrollDownKey}
            onChange={key =>
              settingsStore.updateAppSettings({ roadbookScrollDownKey: key })
            }
            label={t('settings:app.roadbookScrollDown')}
            description={t('settings:app.roadbookScrollDownDescription')}
          />
        </Box>
      </Box>

      {/* Auto-Follow Toggle Key */}
      <Box pt="1rem" borderTop="1px solid" borderColor={borderColor}>
        <Text
          color={headingColor}
          fontSize="1.1rem"
          fontWeight="600"
          mb="0.5rem"
        >
          {t('settings:app.autoFollowToggleKey')}
        </Text>
        <Text color={textColor} fontSize="0.9rem" mb="1rem">
          {t('settings:app.autoFollowToggleKeyDescription')}
        </Text>

        <KeySelector
          value={settingsStore.app.autoFollowToggleKey}
          onChange={key =>
            settingsStore.updateAppSettings({ autoFollowToggleKey: key })
          }
          label={t('settings:app.autoFollowToggle')}
          description={t('settings:app.autoFollowToggleDescription')}
        />
      </Box>

      {/* Roadbook Scroll Mode */}
      <Box pt="1rem" borderTop="1px solid" borderColor={borderColor}>
        <Text
          color={headingColor}
          fontSize="1.1rem"
          fontWeight="600"
          mb="0.5rem"
        >
          {t('settings:app.roadbookScrollMode')}
        </Text>
        <Text color={textColor} fontSize="0.9rem" mb="1rem">
          {t('settings:app.roadbookScrollModeDescription')}
        </Text>

        <RadioGroup.Root
          value={settingsStore.app.roadbookScrollMode}
          onValueChange={details =>
            settingsStore.updateAppSettings({
              roadbookScrollMode: details.value as 'entry' | 'continuous',
            })
          }
        >
          <VStack align="stretch" gap="0.5rem">
            <RadioGroup.Item value="entry">
              <RadioGroup.ItemHiddenInput />
              <RadioGroup.ItemControl />
              <RadioGroup.ItemText>
                {t('settings:app.scrollModeEntry')}
              </RadioGroup.ItemText>
            </RadioGroup.Item>
            <RadioGroup.Item value="continuous">
              <RadioGroup.ItemHiddenInput />
              <RadioGroup.ItemControl />
              <RadioGroup.ItemText>
                {t('settings:app.scrollModeContinuous')}
              </RadioGroup.ItemText>
            </RadioGroup.Item>
          </VStack>
        </RadioGroup.Root>

        {/* Scroll speed is relevant only in continuous mode. */}
        {settingsStore.app.roadbookScrollMode === 'continuous' && (
          <VStack align="stretch" gap="0.5rem" mt="1.5rem">
            <Text color={textColor} fontSize="0.9rem" mb="0.5rem">
              {t('settings:app.roadbookScrollSpeedDescription')}
            </Text>
            <HStack justifyContent="space-between">
              <Text fontSize="0.9rem" color={textColor}>
                {t('settings:app.slow')}
              </Text>
              <Text fontSize="0.9rem" fontWeight="600" color={headingColor}>
                {tempScrollSpeed ?? settingsStore.app.roadbookScrollSpeed}
              </Text>
              <Text fontSize="0.9rem" color={textColor}>
                {t('settings:app.fast')}
              </Text>
            </HStack>
            <Slider.Root
              value={[tempScrollSpeed ?? settingsStore.app.roadbookScrollSpeed]}
              onValueChange={details => setTempScrollSpeed(details.value[0])}
              onValueChangeEnd={details => {
                settingsStore.updateAppSettings({
                  roadbookScrollSpeed: details.value[0],
                });
                setTempScrollSpeed(null);
              }}
              min={1}
              max={100}
              step={1}
              width="100%"
            >
              <Slider.Control>
                <Slider.Track>
                  <Slider.Range />
                </Slider.Track>
                <Slider.Thumb index={0}>
                  <Slider.HiddenInput />
                </Slider.Thumb>
              </Slider.Control>
            </Slider.Root>
          </VStack>
        )}
      </Box>

      {/* Close Distance Threshold */}
      <Box pt="1rem" borderTop="1px solid" borderColor={borderColor}>
        <Text
          color={headingColor}
          fontSize="1.1rem"
          fontWeight="600"
          mb="0.5rem"
        >
          {t('settings:app.closeDistanceThreshold')}
        </Text>
        <Text color={textColor} fontSize="0.9rem" mb="1rem">
          {t('settings:app.closeDistanceThresholdDescription')}
        </Text>

        <VStack align="stretch" gap="0.5rem">
          <HStack justifyContent="space-between">
            <Text fontSize="0.9rem" color={textColor}>
              100m
            </Text>
            <Text fontSize="0.9rem" fontWeight="600" color={headingColor}>
              {tempCloseDistance ??
                settingsStore.app.closeDistanceThreshold ??
                200}
              m
            </Text>
            <Text fontSize="0.9rem" color={textColor}>
              1000m
            </Text>
          </HStack>
          <Slider.Root
            value={[
              tempCloseDistance ??
                settingsStore.app.closeDistanceThreshold ??
                200,
            ]}
            onValueChange={details => setTempCloseDistance(details.value[0])}
            onValueChangeEnd={details => {
              settingsStore.updateAppSettings({
                closeDistanceThreshold: details.value[0],
              });
              setTempCloseDistance(null);
            }}
            min={100}
            max={1000}
            step={10}
            width="100%"
          >
            <Slider.Control>
              <Slider.Track>
                <Slider.Range />
              </Slider.Track>
              <Slider.Thumb index={0}>
                <Slider.HiddenInput />
              </Slider.Thumb>
            </Slider.Control>
          </Slider.Root>
        </VStack>
      </Box>

      {/* Offline Cache Management */}
      <Box borderTop={`1px solid ${borderColor}`} pt="1rem" mt="1rem">
        <Text
          color={headingColor}
          fontSize="1.1rem"
          fontWeight="600"
          mb="0.5rem"
        >
          {t('settings:app.offlineCache')}
        </Text>
        <Text color={textColor} fontSize="0.9rem" mb="1rem">
          {t('settings:app.offlineCacheDescription')}
        </Text>

        <VStack align="stretch" gap="0.5rem">
          <Text color={textColor} fontSize="0.9rem">
            {t('settings:app.cachedRoutes', { count: cacheInfo.routes.length })}
          </Text>

          <Button
            onClick={clearCache}
            colorScheme="red"
            size="sm"
            variant="outline"
            loading={isClearing}
            loadingText={t('settings:app.clearing')}
            disabled={cacheInfo.routes.length === 0}
            maxW="200px"
          >
            {t('settings:app.clearCache')}
          </Button>

          {cacheInfo.routes.length === 0 && (
            <Text color={textColor} fontSize="0.8rem" fontStyle="italic">
              {t('settings:app.noCachedRoutes')}
            </Text>
          )}
        </VStack>
      </Box>

      {/* Complete App Reset */}
      <Box borderTop={`1px solid ${borderColor}`} pt="1rem" mt="1rem">
        <Text
          color={headingColor}
          fontSize="1.1rem"
          fontWeight="600"
          mb="0.5rem"
        >
          {t('settings:app.resetApp')}
        </Text>
        <Text color={textColor} fontSize="0.9rem" mb="1rem">
          {t('settings:app.resetAppDescription')}
        </Text>

        <Button
          onClick={resetApp}
          colorScheme="red"
          size="sm"
          variant="solid"
          loading={isResetting}
          loadingText={t('settings:app.resetting')}
          maxW="300px"
        >
          {t('settings:app.resetAppButton')}
        </Button>
      </Box>
    </Box>
  );
};
