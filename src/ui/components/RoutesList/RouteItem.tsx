import React from 'react';
import {
  Box,
  Button,
  HStack,
  IconButton,
  Menu,
  Portal,
  Text,
  VStack,
} from '@chakra-ui/react';
import { length } from '@turf/turf';
import { IoIosMap, IoMdSave, IoMdSettings } from 'react-icons/io';
import { useTranslation } from 'react-i18next';
import type { UserRoute } from '../../stores/routesStore';
import { useColorModeValue } from '../ui/color-mode';

interface RouteItemProps {
  route: UserRoute;
  isLoading: boolean;
  loadingText?: string;
  onLoadAndNavigate: () => void;
  onEdit: () => void;
  onExport: () => void;
  onDelete: () => void;
}

const RouteItem: React.FC<RouteItemProps> = ({
  route,
  isLoading,
  loadingText,
  onLoadAndNavigate,
  onEdit,
  onExport,
  onDelete,
}) => {
  const { t } = useTranslation();
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const textColor = useColorModeValue('gray.700', 'gray.300');
  const routeNameColor = useColorModeValue('gray.800', 'gray.100');
  const routeItemBg = useColorModeValue('gray.50', 'gray.700');

  return (
    <Box
      p={4}
      borderWidth="1px"
      borderColor={borderColor}
      borderRadius="md"
      bg={routeItemBg}
    >
      <VStack align="stretch" gap={3}>
        <Box>
          <Text
            fontSize="lg"
            fontWeight="semibold"
            color={routeNameColor}
            mb={2}
          >
            {route.name || `Route ${route.id}`}
          </Text>
          {route.created_at && (
            <Text fontSize="sm" color={textColor} mb={1}>
              {t('routeBuilder:labels.created')}:{' '}
              {new Date(route.created_at).toLocaleDateString()}
            </Text>
          )}
          <HStack gap={4} flexWrap="wrap" fontSize="sm" color={textColor}>
            {route.profile && (
              <Text>
                {t('routeBuilder:labels.profile')}:{' '}
                <strong>{route.profile}</strong>
              </Text>
            )}
            {route.waypoints?.length > 0 && (
              <Text>
                {t('routeBuilder:labels.waypoints')}:{' '}
                <strong>{route.waypoints.length}</strong>
              </Text>
            )}
            {route.total_turns !== undefined && (
              <Text>
                {t('routeBuilder:labels.turns')}:{' '}
                <strong>{route.total_turns}</strong>
              </Text>
            )}
            {route.cached_brouterTrack_data && (
              <Text>
                {t('routeBuilder:labels.distance')}:{' '}
                <strong>
                  {Math.round(
                    length(route.cached_brouterTrack_data, {
                      units: 'kilometers',
                    })
                  )}{' '}
                  km
                </strong>
              </Text>
            )}
          </HStack>
        </Box>

        <HStack gap={2} flexWrap="wrap">
          <Button
            onClick={onLoadAndNavigate}
            size="sm"
            loading={isLoading}
            loadingText={loadingText || t('common.loading')}
          >
            <IoIosMap /> {t('routeBuilder:labels.loadAndNavigate')}
          </Button>
          <IconButton
            aria-label={t('routeBuilder:labels.save')}
            onClick={onExport}
            disabled={isLoading}
          >
            <IoMdSave />
          </IconButton>
          <Menu.Root>
            <Menu.Trigger asChild>
              <IconButton
                ml="auto"
                aria-label={t('routeBuilder:labels.routeOptions')}
                disabled={isLoading}
              >
                <IoMdSettings />
              </IconButton>
            </Menu.Trigger>
            <Portal>
              <Menu.Positioner>
                <Menu.Content>
                  <Menu.Item value="edit" onClick={onEdit}>
                    {t('routeBuilder:labels.edit')}
                  </Menu.Item>
                  <Menu.Item value="export" onClick={onExport}>
                    {t('routeBuilder:labels.export')}
                  </Menu.Item>
                  <Menu.Item value="delete" color="fg.error" onClick={onDelete}>
                    🗑️ {t('routeBuilder:labels.delete')}
                  </Menu.Item>
                </Menu.Content>
              </Menu.Positioner>
            </Portal>
          </Menu.Root>
        </HStack>
      </VStack>
    </Box>
  );
};

export default RouteItem;
