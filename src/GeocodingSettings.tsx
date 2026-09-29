import { Box, Button, Input, Text, Switch, HStack } from '@chakra-ui/react';
import { useGeocoding, onlineSearch } from './geocoding';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useColorModeValue } from './ui/components/ui/color-mode';

function errorTranslationKey(error: string) {
  const [code, detail] = error.split(':', 2);
  if (!code.startsWith('geocoding.')) return null;
  return {
    key: `settings:geocoding.errors.${code.slice('geocoding.'.length)}`,
    detail,
  };
}

export function GeocodingSettings() {
  const { t } = useTranslation();
  const config = useGeocoding(),
    [testing, setTesting] = useState(false),
    [result, setResult] = useState('');
  const bg = useColorModeValue('white', 'gray.800'),
    muted = useColorModeValue('gray.600', 'gray.400');
  const error = config.error ? errorTranslationKey(config.error) : null;
  const status = error
    ? t(error.key, { status: error.detail })
    : config.error || result;
  return (
    <Box
      bg={bg}
      borderRadius="6px"
      p="1rem"
      boxShadow="0 1px 3px rgba(0,0,0,0.1)"
    >
      <HStack justify="space-between" align="start" gap="4">
        <Box>
          <Text fontSize="1.1rem" fontWeight="600">
            {t('settings:geocoding.title')}
          </Text>
          <Text fontSize="sm" color={muted}>
            {t('settings:geocoding.description')}
          </Text>
        </Box>
        <Switch.Root
          checked={config.enabled}
          onCheckedChange={e => config.update({ enabled: e.checked })}
        >
          <Switch.HiddenInput />
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch.Root>
      </HStack>
      <Input
        mt="3"
        aria-label={t('settings:geocoding.serviceUrl')}
        value={config.base}
        onChange={e => config.update({ base: e.target.value, key: '' })}
        placeholder="https://nominatim.openstreetmap.org"
      />
      <Input
        mt="2"
        aria-label={t('settings:geocoding.apiKey')}
        type="password"
        autoComplete="off"
        value={config.key}
        onChange={e => config.update({ key: e.target.value })}
        placeholder={t('settings:geocoding.apiKeyPlaceholder')}
      />
      <Text fontSize="sm" mt="2">
        {t('settings:geocoding.privacyNotice')}
      </Text>
      <Text fontSize="sm" mt="2">
        {t('settings:geocoding.usageNotice')}{' '}
        <a
          href="https://operations.osmfoundation.org/policies/nominatim/"
          target="_blank"
          rel="noreferrer"
        >
          {t('settings:geocoding.usagePolicy')}
        </a>
      </Text>
      <Button
        mt="2"
        size="sm"
        disabled={!config.enabled || testing}
        onClick={async () => {
          setTesting(true);
          setResult('');
          try {
            const results = await onlineSearch('Berlin');
            setResult(
              results?.length
                ? t('settings:geocoding.testSuccess')
                : t('settings:geocoding.noResults')
            );
          } finally {
            setTesting(false);
          }
        }}
      >
        {testing
          ? t('settings:geocoding.testing')
          : t('settings:geocoding.testConnection')}
      </Button>
      <Text fontSize="sm" mt="2" role="status">
        {status}
      </Text>
      <Text fontSize="xs" mt="2">
        {t('settings:geocoding.attribution')}
      </Text>
    </Box>
  );
}
