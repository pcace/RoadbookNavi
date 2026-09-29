import React from 'react';
import { Group, IconButton, Menu, Portal, Spinner } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import {
  LuCompass,
  LuMap,
  LuMinus,
  LuMountain,
  LuNavigation,
  LuPlus,
} from 'react-icons/lu';
import { MAP_STYLES, type MapStyleId } from './mapStyles';

interface RouteMapControlsProps {
  isLoading: boolean;
  isLoadingLocation: boolean;
  mapRef: React.RefObject<any>;
  mapStyle: MapStyleId;
  onZoomToCurrentLocation: () => void;
  setMapStyle: (style: MapStyleId) => void;
}

export const RouteMapControls: React.FC<RouteMapControlsProps> = ({
  isLoading,
  isLoadingLocation,
  mapRef,
  mapStyle,
  onZoomToCurrentLocation,
  setMapStyle,
}) => {
  const { t } = useTranslation();

  return (
    <>
      <Group
        attached
        orientation="vertical"
        position="absolute"
        top="10px"
        right="10px"
        zIndex={1000}
      >
        <IconButton
          size="md"
          aria-label="Zoom in"
          onClick={() => {
            if (mapRef.current) {
              mapRef.current.zoomIn();
            }
          }}
          bg="rgba(255, 255, 255, 0.95)"
          color="gray.800"
          _hover={{ bg: 'rgba(255, 255, 255, 1)' }}
          boxShadow="md"
        >
          <LuPlus size={16} />
        </IconButton>

        <IconButton
          size="md"
          aria-label="Zoom out"
          onClick={() => {
            if (mapRef.current) {
              mapRef.current.zoomOut();
            }
          }}
          bg="rgba(255, 255, 255, 0.95)"
          color="gray.800"
          _hover={{ bg: 'rgba(255, 255, 255, 1)' }}
          boxShadow="md"
        >
          <LuMinus size={16} />
        </IconButton>

        <IconButton
          size="md"
          aria-label="Reset bearing to north"
          onClick={() => {
            if (mapRef.current) {
              mapRef.current.resetNorth();
            }
          }}
          bg="rgba(255, 255, 255, 0.95)"
          color="gray.800"
          _hover={{ bg: 'rgba(255, 255, 255, 1)' }}
          boxShadow="md"
        >
          <LuCompass size={16} />
        </IconButton>
      </Group>

      <Group
        orientation="vertical"
        position="absolute"
        top="135px"
        right="10px"
        zIndex={1000}
        gap={2}
      >
        <Menu.Root>
          <Menu.Trigger asChild>
            <IconButton
              size="md"
              aria-label={t('routeBuilder:labels.mapStyle', {
                defaultValue: 'Kartenstil auswählen',
              })}
              bg="rgba(255, 255, 255, 0.95)"
              color="gray.800"
              _hover={{ bg: 'rgba(255, 255, 255, 1)' }}
              boxShadow="md"
              disabled={isLoading}
            >
              {mapStyle === 'natural_earth' ? (
                <LuMountain size={16} />
              ) : (
                <LuMap size={16} />
              )}
            </IconButton>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content>
                {MAP_STYLES.map(style => (
                  <Menu.Item
                    key={style.id}
                    value={style.id}
                    onClick={() => setMapStyle(style.id)}
                  >
                    {mapStyle === style.id ? '✓ ' : ''}
                    {t(style.labelKey, {
                      defaultValue: style.labelDefault,
                    })}
                  </Menu.Item>
                ))}
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>

        <IconButton
          size="md"
          aria-label="Zu meiner Position"
          onClick={onZoomToCurrentLocation}
          bg="rgba(255, 255, 255)"
          color="gray.800"
          _hover={{ bg: 'rgba(255, 255, 255, 1)' }}
          boxShadow="md"
          disabled={isLoadingLocation}
        >
          {isLoadingLocation ? (
            <Spinner size="md" />
          ) : (
            <LuNavigation size={16} />
          )}
        </IconButton>
      </Group>
    </>
  );
};
