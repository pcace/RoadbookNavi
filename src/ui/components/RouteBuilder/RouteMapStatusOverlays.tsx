import React from 'react';
import { Box, Flex, Text } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { useNotificationColors } from '../../theme/colors';
import RouteAnalysisPanel from './RouteAnalysisPanel';
import type { RouteStats } from './utils/routeAnalysis';

interface HoverInfo {
  x: number;
  y: number;
  surface: string;
  lengthText: string;
}

interface RouteMapStatusOverlaysProps {
  distanceWarning: string | null;
  error: string | null;
  hoverInfo: HoverInfo | null;
  isAnalysisOpen: boolean;
  isLoading: boolean;
  onAnalysisOpenChange: (open: boolean) => void;
  onSurfaceHoverChange: (surfaceKey: string | null) => void;
  routeStats: RouteStats | null;
}

export const RouteMapStatusOverlays: React.FC<RouteMapStatusOverlaysProps> = ({
  distanceWarning,
  error,
  hoverInfo,
  isAnalysisOpen,
  isLoading,
  onAnalysisOpenChange,
  onSurfaceHoverChange,
  routeStats,
}) => {
  const { t } = useTranslation();
  const notificationColors = useNotificationColors();

  return (
    <>
      {hoverInfo && !isLoading && (
        <Box
          position="absolute"
          left={`${hoverInfo.x + 12}px`}
          top={`${hoverInfo.y + 12}px`}
          bg="rgba(0,0,0,0.8)"
          color="white"
          borderRadius="6px"
          px={3}
          py={2}
          zIndex={1100}
          pointerEvents="none"
          maxWidth="280px"
        >
          <Text fontSize="xs">
            {hoverInfo.surface} • {hoverInfo.lengthText}
          </Text>
        </Box>
      )}

      {routeStats && !isLoading && (
        <RouteAnalysisPanel
          routeStats={routeStats}
          lengthLabel={t('routeBuilder:routeInfo.length')}
          useExternalTrigger
          open={isAnalysisOpen}
          onOpenChange={onAnalysisOpenChange}
          placement="bottom"
          align="center"
          onSurfaceHoverChange={onSurfaceHoverChange}
        />
      )}

      {error && (
        <Flex
          position="absolute"
          top="20px"
          left="20px"
          right="20px"
          bg={notificationColors.error.bg}
          alignItems="center"
          justifyContent="center"
          zIndex={1001}
          p={4}
          borderRadius="md"
          boxShadow="lg"
        >
          <Text
            fontSize="md"
            fontWeight="medium"
            color={notificationColors.error.color}
            textAlign="center"
          >
            ❌ {error}
          </Text>
        </Flex>
      )}

      {distanceWarning && (
        <Flex
          position="absolute"
          top={error ? '80px' : '20px'}
          left="20px"
          right="20px"
          bg={notificationColors.warning.bg}
          alignItems="center"
          justifyContent="center"
          zIndex={1001}
          p={4}
          borderRadius="md"
          boxShadow="lg"
        >
          <Text
            fontSize="md"
            fontWeight="medium"
            color={notificationColors.warning.color}
            textAlign="center"
          >
            ⚠️ {distanceWarning}
          </Text>
        </Flex>
      )}
    </>
  );
};
