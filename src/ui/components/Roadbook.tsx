import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, HStack, Text, VStack } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { IoIosList, IoIosMap } from 'react-icons/io';

import { RoadbookHeader } from './RoadbookHeader';
import { RoadbookPdfViewer } from './RoadbookPdfViewer';
import { useAppStore } from '../stores/appStore';
import { useSettings } from '../stores/settingsStore';
import { buildRoutePlanningPath } from '../utils/roadbookRoute';

interface RoadbookNaviProps {
  coordinates: [number, number, number][];
  currentDistance?: number;
  className?: string;
  nextTurnIndex?: number;
  routeName?: string;
  routeId?: string;
}

export const RoadbookNavi: React.FC<RoadbookNaviProps> = ({ routeId }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { interface: uiSettings } = useSettings();
  const isLandscape = useAppStore(state => state.isLandscape);
  const isHeaderExpanded = useAppStore(state => state.isHeaderExpanded);
  const currentRouteId = useAppStore(state => state.currentRouteId);
  const effectiveRouteId = routeId || currentRouteId;

  const shouldUseHorizontalLayout = useMemo(() => {
    switch (uiSettings.headerPosition) {
      case 'left':
        return true;
      case 'top':
        return false;
      case 'automatic':
      default:
        return isLandscape;
    }
  }, [uiSettings.headerPosition, isLandscape]);

  const mainContent = (
    <>
      {!effectiveRouteId && (
        <VStack justify="center" align="center" height="100%" width="100%">
          <Box
            as="button"
            onClick={() => {
              navigate(buildRoutePlanningPath());
            }}
            p={8}
            borderRadius="lg"
            border="2px "
            borderColor="blue.300"
            bg="transparent"
            _hover={{ transform: 'scale(1.02)' }}
            cursor="pointer"
            width="80%"
            maxWidth="400px"
          >
            <VStack gap={4}>
              <Box
                display="flex"
                alignItems="center"
                justifyContent="center"
                width="48px"
                height="48px"
                borderRadius="md"
                color="blue.500"
                _hover={{ color: 'blue.600' }}
                pointerEvents="none"
              >
                <IoIosMap size={32} />
              </Box>
              <Box fontSize="lg" color="blue.600" textAlign="center">
                <Text fontWeight="semibold">
                  {t('roadbook:states.clickToCreate')}
                </Text>
                <Text fontSize="sm" color="gray.500" mt={1}>
                  {t('roadbook:states.clickToCreateSubtext')}
                </Text>
              </Box>
            </VStack>
          </Box>

          <Box
            as="button"
            onClick={() => {
              navigate('/app/routes-list');
            }}
            p={8}
            borderRadius="lg"
            border="2px "
            borderColor="green.300"
            bg="transparent"
            _hover={{
              transform: 'scale(1.02)',
            }}
            cursor="pointer"
            width="80%"
            maxWidth="400px"
          >
            <VStack gap={4}>
              <Box
                display="flex"
                alignItems="center"
                justifyContent="center"
                w={12}
                h={12}
                borderRadius="md"
                bg="green.50"
                color="green.500"
              >
                <IoIosList size={32} />
              </Box>
              <Box fontSize="lg" color="green.600" textAlign="center">
                <Text fontWeight="semibold">
                  {t('routeBuilder:actions.loadRoute')}
                </Text>
                <Text fontSize="sm" color="gray.500" mt={1}>
                  {t('navigation.routesList')}
                </Text>
              </Box>
            </VStack>
          </Box>
        </VStack>
      )}

      {effectiveRouteId && (
        <RoadbookPdfViewer routeId={effectiveRouteId} exportType="pdf-screen" />
      )}
    </>
  );

  if (shouldUseHorizontalLayout) {
    return (
      <VStack align="stretch" height="100%" className="roadbook-container">
        <HStack flex="1" align="stretch" overflow="hidden">
          <RoadbookHeader
            isLandscape={true}
            isHeaderExpanded={isHeaderExpanded}
          />
          <Box flex="1" overflow="hidden">
            {mainContent}
          </Box>
        </HStack>
      </VStack>
    );
  }

  return (
    <Box
      display="flex"
      flexDirection="column"
      height="100%"
      className="roadbook-container"
    >
      <RoadbookHeader isHeaderExpanded={isHeaderExpanded} isLandscape={false} />
      <Box flex="1" overflow="hidden">
        {mainContent}
      </Box>
    </Box>
  );
};
