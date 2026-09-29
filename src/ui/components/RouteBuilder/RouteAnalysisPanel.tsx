import React from 'react';
import {
  Box,
  Flex,
  Text,
  Collapsible,
  useCollapsibleContext,
} from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { LuChevronDown, LuInfo } from 'react-icons/lu';
import { RouteStats } from './utils/routeAnalysis';
import { useAppStore } from '../../stores/appStore';

interface RouteAnalysisPanelProps {
  routeStats: RouteStats;
  lengthLabel: string;
  // When true, the panel does not render its own trigger and relies on external control
  useExternalTrigger?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: 'top' | 'bottom';
  align?: 'center' | 'left';
  onSurfaceHoverChange?: (surfaceKey: string | null) => void;
}

const CollapsibleArrow: React.FC = () => {
  const collapsible = useCollapsibleContext();
  return (
    <Box
      as={LuChevronDown}
      fontSize={'16px'}
      style={{
        transition: 'transform 0.2s ease',
        transform: collapsible?.open ? 'rotate(180deg)' : 'rotate(0deg)',
      }}
    />
  );
};

const RouteAnalysisPanel: React.FC<RouteAnalysisPanelProps> = ({
  routeStats,
  lengthLabel,
  useExternalTrigger = false,
  open,
  onOpenChange,
  placement,
  align,
  onSurfaceHoverChange,
}) => {
  const { t } = useTranslation();
  const isLandscape = useAppStore(state => state.isLandscape);
  const containerPositionStyles = (() => {
    if (useExternalTrigger && placement === 'bottom') {
      if (align === 'center') {
        return {
          bottom: '70px',
          left: '50%',
          transform: 'translateX(-50%)' as const,
        };
      }
      return { bottom: '70px', left: '10px', transform: 'none' as const };
    }
    return isLandscape
      ? { top: '10px', left: '50%', transform: 'translateX(-50%)' as const }
      : { top: '10px', left: '10px', transform: 'none' as const };
  })();
  const isControlled = useExternalTrigger && typeof open === 'boolean';
  const shouldUseWidePanel =
    isLandscape || (useExternalTrigger && placement === 'bottom');
  return (
    <Box
      position="absolute"
      top={containerPositionStyles.top as any}
      bottom={containerPositionStyles.bottom as any}
      left={containerPositionStyles.left as any}
      transform={containerPositionStyles.transform}
      bg="rgba(0, 0, 0, 0.65)"
      color="white"
      px={0}
      py={0}
      borderRadius="md"
      zIndex={1000}
      boxShadow="lg"
      pointerEvents="auto"
      minWidth={shouldUseWidePanel ? { base: '240px', sm: '260px' } : 'auto'}
      maxWidth="50vw"
      maxHeight="50vh"
    >
      <Collapsible.Root
        unmountOnExit
        {...(isControlled
          ? {
              open,
              onOpenChange: (details: any) => onOpenChange?.(details.open),
            }
          : { defaultOpen: false })}
      >
        {!useExternalTrigger && (
          <Collapsible.Trigger style={{ width: '100%' }}>
            {isLandscape ? (
              <Flex
                align="center"
                justify="space-between"
                px={4}
                py={2}
                gap={3}
              >
                <Text fontSize="sm" fontWeight="medium">
                  {lengthLabel}: {routeStats.lengthText} km ·{' '}
                  {t('routeBuilder:routeInfo.offRoad', {
                    defaultValue: 'OffRoad',
                  })}
                  : {routeStats.offRoadPct}%
                </Text>
                <Flex align="center" gap={2} opacity={0.9}>
                  <Text fontSize="xs">Details</Text>
                  <CollapsibleArrow />
                </Flex>
              </Flex>
            ) : (
              <Flex align="center" justify="center" px={2} py={2}>
                <Box
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  width="32px"
                  height="32px"
                  borderRadius="6px"
                  bg="rgba(255,255,255,0.1)"
                >
                  <LuInfo size={18} />
                </Box>
              </Flex>
            )}
          </Collapsible.Trigger>
        )}
        <Collapsible.Content>
          <Box px={4} pb={3} pt={1} maxH="calc(50vh - 12px)" overflowY="auto">
            {!isLandscape && !useExternalTrigger && (
              <Box mb={2}>
                <Text fontSize="sm" fontWeight="medium">
                  {lengthLabel}: {routeStats.lengthText} km ·{' '}
                  {t('routeBuilder:routeInfo.offRoad', {
                    defaultValue: 'OffRoad',
                  })}
                  : {routeStats.offRoadPct}%
                </Text>
              </Box>
            )}
            {useExternalTrigger && (
              <Box mb={2}>
                <Text fontSize="sm" fontWeight="medium">
                  {lengthLabel}: {routeStats.lengthText} km ·{' '}
                  {t('routeBuilder:routeInfo.offRoad', {
                    defaultValue: 'OffRoad',
                  })}
                  : {routeStats.offRoadPct}%
                </Text>
              </Box>
            )}
            {routeStats.surfaces && routeStats.surfaces.length > 0 ? (
              <Box
                maxH={
                  shouldUseWidePanel ? { base: '120px', md: '160px' } : '72px'
                }
                overflowY="auto"
                pr={1}
              >
                {routeStats.surfaces.map(s => (
                  <Flex
                    key={s.key}
                    align="center"
                    gap={2}
                    fontSize="xs"
                    mt={1}
                    px={2}
                    py={1}
                    borderRadius="4px"
                    cursor={onSurfaceHoverChange ? 'pointer' : 'default'}
                    _hover={
                      onSurfaceHoverChange
                        ? { bg: 'rgba(255, 255, 0, 0.12)' }
                        : undefined
                    }
                    onMouseEnter={() => onSurfaceHoverChange?.(s.key)}
                    onMouseLeave={() => onSurfaceHoverChange?.(null)}
                  >
                    <Box
                      width="10px"
                      height="10px"
                      borderRadius="2px"
                      bg={s.color}
                    />
                    <Text>
                      {t(`routeBuilder:surfaces.${s.key}`, {
                        defaultValue: s.display,
                      })}{' '}
                      {routeStats.formatMeters(s.length_m)}
                    </Text>
                  </Flex>
                ))}
              </Box>
            ) : (
              <Text fontSize="xs" opacity={0.8}>
                Keine Oberflächendaten verfügbar.
              </Text>
            )}
          </Box>
        </Collapsible.Content>
      </Collapsible.Root>
    </Box>
  );
};

export default RouteAnalysisPanel;
