import React from 'react';
import { Box, Flex, IconButton, Text } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { useUIColors } from '../../theme/colors';
import { useRouteBuilderController } from './RouteBuilderControllerContext';
import RoutePointsList from './RoutePointsList';

export const RouteBuilderSidebar: React.FC = () => {
  const { t } = useTranslation();
  const { isSidebarCollapsed, toggleSidebar } = useRouteBuilderController();
  const uiColors = useUIColors();

  return (
    <>
      <Box
        width={{
          base: '100%',
          md: isSidebarCollapsed ? '0px' : '350px',
        }}
        height={{
          base: isSidebarCollapsed ? 'auto' : 'auto',
          md: '100%',
        }}
        borderRight={{ base: 'none', md: '1px solid' }}
        borderBottom={{ base: '1px solid', md: 'none' }}
        borderColor={uiColors.borderColor}
        overflowY="auto"
        boxShadow="md"
        position="relative"
        zIndex={1}
        maxHeight={{ base: isSidebarCollapsed ? 'auto' : '50vh', md: 'none' }}
        transition="all 0.3s ease"
        overflow={isSidebarCollapsed ? 'hidden' : 'auto'}
      >
        <Box display={{ base: 'block', md: 'none' }}>
          {!isSidebarCollapsed ? (
            <>
              <Flex justify="space-between" align="center" mb={4} p={4}>
                <Text fontSize="lg" fontWeight="bold">
                  {t('routeBuilder:title')}
                </Text>
              </Flex>

              <Box px={4} pb={4}>
                <RoutePointsList />
              </Box>
            </>
          ) : null}
        </Box>

        <Box
          display={{ base: 'none', md: 'block' }}
          p={isSidebarCollapsed ? 0 : 4}
        >
          {!isSidebarCollapsed && <RoutePointsList />}
        </Box>
      </Box>

      <Box position="relative" display={{ base: 'none', md: 'block' }}>
        <IconButton
          aria-label={
            isSidebarCollapsed
              ? t('routeBuilder:actions.showSidebar')
              : t('routeBuilder:actions.hideSidebar')
          }
          onClick={toggleSidebar}
          position="absolute"
          top="50%"
          left={isSidebarCollapsed ? '10px' : '-20px'}
          transform="translateY(-50%)"
          zIndex={10}
          size="sm"
          bg={uiColors.toggleButtonBg}
          color={uiColors.toggleButtonColor}
          _hover={{ bg: uiColors.toggleButtonHoverBg }}
          borderRadius="md"
          boxShadow="md"
          transition="all 0.3s ease"
        >
          <span style={{ fontSize: '16px', lineHeight: 1 }}>
            {isSidebarCollapsed ? '▶' : '◀'}
          </span>
        </IconButton>
      </Box>
    </>
  );
};
