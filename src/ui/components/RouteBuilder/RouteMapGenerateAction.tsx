import React from 'react';
import { Button, Box, Flex, IconButton, Spinner, Text } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { LuInfo } from 'react-icons/lu';
import type { RouteStats } from './utils/routeAnalysis';

interface RouteMapGenerateActionProps {
  hasPendingChanges: boolean;
  isAnalysisOpen: boolean;
  isEditMode: boolean;
  isGenerating: boolean;
  isLoading: boolean;
  isRouteTooLong: boolean;
  onAnalysisToggle: () => void;
  onGenerateRoute: () => Promise<void>;
  onUndoChanges: () => void;
  routePointsCount: number;
  routeStats: RouteStats | null;
  submitLabel: string;
  submitLoadingLabel: string;
  hasRouteData: boolean;
}

export const RouteMapGenerateAction: React.FC<RouteMapGenerateActionProps> = ({
  hasRouteData,
  hasPendingChanges,
  isAnalysisOpen,
  isEditMode,
  isGenerating,
  isLoading,
  isRouteTooLong,
  onAnalysisToggle,
  onGenerateRoute,
  onUndoChanges,
  routePointsCount,
  routeStats,
  submitLabel,
  submitLoadingLabel,
}) => {
  const { t } = useTranslation();

  return (
    <Box
      position="absolute"
      bottom="25px"
      left="50%"
      transform="translateX(-50%)"
      zIndex={1000}
    >
      <Flex align="center" gap={3}>
        {isEditMode && hasPendingChanges ? (
          <Button
            size="md"
            aria-label={t('routeBuilder:actions.revertChanges')}
            onClick={onUndoChanges}
            disabled={isLoading || isGenerating}
            boxShadow="md"
            minWidth="48px"
            borderWidth="0"
            borderColor="transparent"
            borderRadius="md"
            bg="red.500"
            color="white"
            _hover={{ bg: 'red.600' }}
          >
            X
          </Button>
        ) : null}
        <Button
          size="md"
          aria-busy={isGenerating || isLoading}
          onClick={onGenerateRoute}
          disabled={
            routePointsCount === 0 ||
            !hasRouteData ||
            routePointsCount < 2 ||
            isRouteTooLong ||
            isLoading ||
            isGenerating
          }
          boxShadow="md"
          minWidth="200px"
          borderWidth="0"
          borderColor="transparent"
          borderRadius="md"
          bg="green.500"
          color="white"
          _hover={{ bg: 'green.600' }}
        >
          {isGenerating || isLoading ? (
            <Flex align="center" gap={2}>
              <Spinner size="sm" />
              <Text>{submitLoadingLabel}</Text>
            </Flex>
          ) : routePointsCount === 0 ? (
            t('routeBuilder:labels.noPointsAdded')
          ) : routePointsCount === 1 ? (
            t('routeBuilder:labels.needOneMorePoint')
          ) : (
            submitLabel
          )}
        </Button>
        <IconButton
          size="md"
          aria-label="Details"
          aria-pressed={isAnalysisOpen}
          onClick={onAnalysisToggle}
          disabled={!routeStats || isLoading || isGenerating}
          bg={
            isAnalysisOpen
              ? 'rgba(59, 130, 246, 0.95)'
              : 'rgba(255, 255, 255, 0.95)'
          }
          color={isAnalysisOpen ? 'white' : 'gray.800'}
          _hover={{
            bg: isAnalysisOpen
              ? 'rgba(59, 130, 246, 1)'
              : 'rgba(255, 255, 255, 1)',
          }}
          boxShadow="md"
        >
          <LuInfo size={16} />
        </IconButton>
      </Flex>
    </Box>
  );
};
