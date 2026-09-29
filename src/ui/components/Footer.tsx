import React, { Suspense, lazy, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Flex, HStack, IconButton } from '@chakra-ui/react';
import {
  IoIosBook,
  IoIosHelpCircle,
  IoIosList,
  IoIosLocate,
  IoIosMap,
  IoIosSettings,
} from 'react-icons/io';
import { TbRulerMeasure } from 'react-icons/tb';
import { useTranslation } from 'react-i18next';
import { useAppStore, type AppMode } from '../stores/appStore';
import { useFooterColors } from '../theme/colors';
import {
  buildRoadbookPath,
  buildRoutePlanningPath,
  getAppSectionFromPathname,
} from '../utils/roadbookRoute';

const HelpModal = lazy(() =>
  import('./HelpModal').then(module => ({ default: module.HelpModal }))
);

export const NewFooter: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const path = getAppSectionFromPathname(useLocation().pathname);
  const autoFollow = useAppStore(state => state.autoFollow);
  const setAutoFollow = useAppStore(state => state.setAutoFollow);
  const isHeaderExpanded = useAppStore(state => state.isHeaderExpanded);
  const toggleHeaderExpanded = useAppStore(state => state.toggleHeaderExpanded);
  const currentRouteId = useAppStore(state => state.currentRouteId);
  const currentRouteName = useAppStore(state => state.currentRouteName);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const {
    bg,
    borderColor,
    buttonBg,
    buttonColor,
    activeButtonBg,
    activeButtonColor,
  } = useFooterColors();

  const open = (mode: AppMode) => {
    const paths: Record<AppMode, string> = {
      roadbook: buildRoadbookPath(currentRouteId, currentRouteName),
      routePlanning: buildRoutePlanningPath(),
      routesList: '/app/routes-list',
      settings: '/app/settings',
    };
    navigate(paths[mode]);
  };

  const navigationButtons = [
    ['roadbook', 'roadbook', IoIosBook],
    ['routePlanning', 'route-planning', IoIosMap],
    ['routesList', 'routes-list', IoIosList],
    ['settings', 'settings', IoIosSettings],
  ] as const;

  return (
    <Flex
      bg={bg}
      borderTop="1px solid"
      borderColor={borderColor}
      px={4}
      py={2}
      gap={4}
      justify="space-between"
      align="center"
      flexShrink={0}
    >
      <Box flex="1" minWidth={0}>
        <HStack gap={2}>
          {path === 'roadbook' && (
            <>
              <IconButton
                aria-label={t(
                  autoFollow
                    ? 'buttons.autoFollowActive'
                    : 'buttons.autoFollowInactive'
                )}
                bg={autoFollow ? activeButtonBg : buttonBg}
                color={autoFollow ? activeButtonColor : buttonColor}
                onClick={() => setAutoFollow(!autoFollow)}
              >
                <IoIosLocate />
              </IconButton>
              <IconButton
                aria-label={t(
                  isHeaderExpanded
                    ? 'buttons.collapseHeader'
                    : 'buttons.expandHeader'
                )}
                bg={isHeaderExpanded ? activeButtonBg : buttonBg}
                color={isHeaderExpanded ? activeButtonColor : buttonColor}
                onClick={toggleHeaderExpanded}
              >
                <TbRulerMeasure />
              </IconButton>
            </>
          )}
        </HStack>
      </Box>

      <HStack gap={2}>
        {navigationButtons.map(([mode, section, Icon]) => (
          <IconButton
            key={mode}
            aria-label={t(`navigation.${mode}`)}
            title={t(`navigation.${mode}`)}
            bg={path === section ? activeButtonBg : buttonBg}
            color={path === section ? activeButtonColor : buttonColor}
            onClick={() => open(mode)}
          >
            <Icon />
          </IconButton>
        ))}
      </HStack>

      <Box flex="1" minWidth={0} textAlign="right">
        <IconButton
          aria-label={t('buttons.help')}
          title={t('buttons.help')}
          bg={buttonBg}
          color={buttonColor}
          onClick={() => setIsHelpOpen(true)}
        >
          <IoIosHelpCircle />
        </IconButton>
      </Box>

      <Suspense fallback={null}>
        {isHelpOpen && (
          <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
        )}
      </Suspense>
    </Flex>
  );
};
