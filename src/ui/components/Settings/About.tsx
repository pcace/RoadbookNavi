import React, { useState, useEffect } from 'react';
import { Box, Button, Text, Link } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { useColorModeValue } from '../ui/color-mode';
import { useAppStore } from '../../stores/appStore';
import { checkForUpdate, type UpdateStatus } from '../../../services';

const About: React.FC = () => {
  const { t, i18n } = useTranslation();
  const bgSection = useColorModeValue('white', 'gray.800');
  const textColor = useColorModeValue('#333', 'gray.300');

  // Get version info from store
  const versionInfo = useAppStore(state => state.versionInfo);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isChecking, setIsChecking] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [updateError, setUpdateError] = useState(false);

  const checkVersion = async () => {
    if (isChecking || !isOnline) return;
    setIsChecking(true);
    setUpdateError(false);
    try {
      setUpdateStatus(await checkForUpdate());
    } catch (error) {
      console.error('Unable to check for updates:', error);
      setUpdateStatus(null);
      setUpdateError(true);
    } finally {
      setIsChecking(false);
    }
  };

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Format build times for display
  const localBuildTime = versionInfo.localBuildTime
    ? new Date(parseInt(versionInfo.localBuildTime)).toLocaleString(
        i18n.language,
        {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }
      )
    : null;

  return (
    <Box
      bg={bgSection}
      borderRadius="6px"
      p="1rem"
      boxShadow="0 1px 3px rgba(0, 0, 0, 0.1)"
      className="settings-section"
    >
      <Box display="flex" flexDirection="column" gap="1rem">
        <Text color={textColor} fontSize="1.1rem" fontWeight="600" mb="0.5rem">
          {t('settings:about.title')}
        </Text>

        <Box>
          <Text
            color={textColor}
            fontSize="0.9rem"
            fontWeight="500"
            mb="0.3rem"
          >
            {t('settings:about.versionCheck')}
          </Text>

          <Box mb="0.5rem">
            <Text color={textColor} fontSize="0.85rem">
              {t('settings:about.localVersion', {
                version: versionInfo.local,
              })}
              {localBuildTime && (
                <Text
                  as="span"
                  color={textColor}
                  fontSize="0.75rem"
                  ml="0.5rem"
                >
                  ({localBuildTime})
                </Text>
              )}
            </Text>
          </Box>

          <Box display="flex" gap="0.5rem" alignItems="center">
            {!isOnline && (
              <Text color="orange.500" fontSize="0.8rem">
                {t('settings:about.offline')}
              </Text>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={!isOnline || isChecking}
              loading={isChecking}
              onClick={checkVersion}
            >
              {isChecking
                ? t('settings:about.checking')
                : t('settings:about.checkForUpdates')}
            </Button>
          </Box>

          {updateStatus?.updateAvailable && (
            <Box mt="0.75rem">
              <Text color="green.600" fontSize="0.85rem" mb="0.5rem">
                {t('settings:about.updateAvailable', {
                  version: updateStatus.latestVersion,
                })}
              </Text>
              <Button asChild size="sm" colorPalette="blue">
                <a
                  href={updateStatus.releaseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('settings:about.openRelease')}
                </a>
              </Button>
            </Box>
          )}
          {updateStatus && !updateStatus.updateAvailable && (
            <Text color="green.600" fontSize="0.85rem" mt="0.75rem">
              {t('settings:about.upToDate')}
            </Text>
          )}
          {updateError && (
            <Text color="red.500" fontSize="0.85rem" mt="0.75rem">
              {t('settings:about.checkFailed')}
            </Text>
          )}
        </Box>

        <Text color={textColor} fontSize="0.9rem" mb="0.5rem">
          {t('settings:about.servicesTitle')}
        </Text>
        <Box mb="0.7em" color={textColor}>
          <Box as="ul" ml="1.2em" listStyleType="disc">
            <Box as="li" mb="0.3em">
              <Text fontSize="0.85rem">
                {t('settings:about.osmData')}{' '}
                <Link
                  href="https://www.openstreetmap.org/copyright"
                  target="_blank"
                  rel="noopener noreferrer"
                  color="inherit"
                  textDecoration="underline"
                >
                  OpenStreetMap
                </Link>{' '}
                {t('settings:about.osmLicense')}{' '}
                <Link
                  href="https://opendatacommons.org/licenses/odbl/1-0/"
                  target="_blank"
                  rel="noopener noreferrer"
                  color="inherit"
                  textDecoration="underline"
                >
                  ODbL
                </Link>
                .
              </Text>
            </Box>
            <Box as="li" mb="0.3em">
              <Text fontSize="0.85rem">
                {t('settings:about.routingVia')}{' '}
                <Link
                  href="https://brouter.de/"
                  target="_blank"
                  rel="noopener noreferrer"
                  color="inherit"
                  textDecoration="underline"
                >
                  BRouter
                </Link>{' '}
                {t('settings:about.mitLicense')}
              </Text>
            </Box>
            <Box as="li">
              <Text fontSize="0.85rem">
                {t('settings:about.licensePrefix')}{' '}
                <Link
                  href="https://www.gnu.org/licenses/gpl-3.0.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  color="inherit"
                  textDecoration="underline"
                >
                  GNU GPL v3.0
                </Link>
                .
              </Text>
            </Box>
            <Box as="li">
              <Text fontSize="0.85rem">
                {t('settings:about.sourcePrefix')}{' '}
                <Link
                  href="https://github.com/pcace/RoadbookNavi"
                  target="_blank"
                  rel="noopener noreferrer"
                  color="inherit"
                  textDecoration="underline"
                >
                  github.com/pcace/RoadbookNavi
                </Link>
                .
              </Text>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default About;
