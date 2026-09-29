import { useNativeProfiles } from '../../config/runtime';
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Button,
  CloseButton,
  Dialog,
  Flex,
  IconButton,
  Input,
  Menu,
  Text,
  Portal,
  Select,
  createListCollection,
  Spinner,
} from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useRouteBuilderColors } from '../../theme/colors';
import { useAppStore } from '../../stores/appStore';
import { useSettings } from '../../stores/settingsStore';
import { useRoutesStore, type UserRoute } from '../../stores/routesStore';
import {
  buildRoutePlanningPath,
  getAppSectionFromPathname,
  getRoutePlanningView,
} from '../../utils/roadbookRoute';
import {
  searchAddress,
  AddressSearchResult,
} from '../../services/localProjects';
import { IoMdSettings } from 'react-icons/io';
import { useRouteBuilderController } from './RouteBuilderControllerContext';
import { useRouteBuilderStoreActions } from './hooks/useRouteBuilderStore';
import type { RoutePoint } from './types';

interface SortablePointItemProps {
  point: RoutePoint;
  index: number;
  onRemove: (id: string) => void;
  textColor: string;
  pointItemBg: string;
  borderColor: string;
}

const SortablePointItem: React.FC<SortablePointItemProps> = ({
  point,
  index,
  onRemove,
  textColor,
  pointItemBg,
  borderColor,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: point.id });
  const { draggingBg, draggingBorderColor, hoverBg, dotBorderColor } =
    useRouteBuilderColors();

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Flex
      ref={setNodeRef}
      style={style}
      justifyContent="space-between"
      alignItems="center"
      p={2}
      mb={1}
      bg={isDragging ? draggingBg : pointItemBg}
      borderRadius="md"
      borderWidth="1px"
      borderColor={isDragging ? draggingBorderColor : borderColor}
      boxShadow={isDragging ? 'md' : 'none'}
    >
      <Box
        {...attributes}
        {...listeners}
        cursor="grab"
        _active={{ cursor: 'grabbing' }}
        display="flex"
        alignItems="center"
        justifyContent="center"
        width="32px"
        height="100%"
        mr={2}
        borderRadius="md"
        _hover={{ bg: hoverBg }}
        flexShrink={0}
        style={{ touchAction: 'none' }}
      >
        <Box>
          <Box
            width="12px"
            height="2px"
            bg={textColor}
            mb="2px"
            borderRadius="1px"
          />
          <Box
            width="12px"
            height="2px"
            bg={textColor}
            mb="2px"
            borderRadius="1px"
          />
          <Box width="12px" height="2px" bg={textColor} borderRadius="1px" />
        </Box>
      </Box>

      <Box flex={1} display="flex" alignItems="center" minWidth={0}>
        <Box
          fontSize="sm"
          fontWeight="500"
          color={textColor}
          mr={2}
          overflow="hidden"
          textOverflow="ellipsis"
          whiteSpace="nowrap"
          userSelect="none"
          display="flex"
          alignItems="center"
        >
          <Box
            width="12px"
            height="12px"
            borderRadius="50%"
            backgroundColor={point.color || '#3498DB'}
            style={{ backgroundColor: point.color || '#3498DB' }}
            mr={2}
            flexShrink={0}
            border="1px solid"
            borderColor={dotBorderColor}
          />
          {index + 1}.{' '}
          {point.displayName ||
            `lat: ${point.lat.toFixed(6)} / lng: ${point.lon.toFixed(6)}`}
        </Box>
      </Box>
      <Button
        onClick={event => {
          event.stopPropagation();
          event.preventDefault();
          onRemove(point.id);
        }}
        onMouseDown={event => {
          event.stopPropagation();
        }}
        onTouchStart={event => {
          event.stopPropagation();
        }}
        onTouchEnd={event => {
          event.stopPropagation();
        }}
        colorScheme="red"
        size="xs"
        borderRadius="sm"
        flexShrink={0}
        zIndex={1}
        style={{ touchAction: 'manipulation' }}
      >
        ×
      </Button>
    </Flex>
  );
};

const RoutePointsList: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { editRouteId: routeEditId } = useParams<{ editRouteId?: string }>();
  const retainedEditRouteIdRef = useRef<string | undefined>(routeEditId);
  if (getAppSectionFromPathname(location.pathname) === 'route-planning') {
    retainedEditRouteIdRef.current = routeEditId;
  }
  const editRouteId = retainedEditRouteIdRef.current;
  const {
    autoGeneratedRouteName,
    addCurrentPosition,
    addPointByAddress,
    handleGPXImport,
    isGettingLocation,
    isRouteNameManuallySet,
    mapRef,
    removePoint,
    routeNameInput,
    routePoints,
    reorderPoints,
    routingProfile,
    setIsRouteNameManuallySet,
    setRouteNameInput,
    setRoutingProfile,
  } = useRouteBuilderController();
  const { setSelectedRouteName } = useRouteBuilderStoreActions();
  const routes = useRoutesStore(state => state.routes);
  const routesStore = useRoutesStore();
  const settingsStore = useSettings();
  const resetRouteBuilder = useAppStore(state => state.resetRouteBuilder);
  const currentRouteId = useAppStore(state => state.currentRouteId);
  const setCurrentRouteId = useAppStore(state => state.setCurrentRouteId);
  const setCurrentRouteName = useAppStore(state => state.setCurrentRouteName);
  const setRouteBuilderMapView = useAppStore(
    state => state.setRouteBuilderMapView
  );

  const [addressSearchQuery, setAddressSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AddressSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [pendingRename, setPendingRename] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const searchResultsRef = useRef<HTMLDivElement>(null);
  const gpxFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoGeneratedRouteName && !isRouteNameManuallySet) {
      setRouteNameInput(autoGeneratedRouteName);
    }
  }, [autoGeneratedRouteName, isRouteNameManuallySet, setRouteNameInput]);

  useEffect(() => {
    const checkAspectRatio = () => {
      const aspectRatio = window.innerHeight / window.innerWidth;
      setIsLandscape(aspectRatio <= 0.5);
    };

    checkAspectRatio();
    window.addEventListener('resize', checkAspectRatio);

    return () => {
      window.removeEventListener('resize', checkAspectRatio);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        searchBoxRef.current &&
        !searchBoxRef.current.contains(target) &&
        searchResultsRef.current &&
        !searchResultsRef.current.contains(target)
      ) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleAddressSearch = useCallback(async (query: string) => {
    if (query.trim().length < 3) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await searchAddress(query, 8);
      setSearchResults(response.results);
      setShowResults(response.results.length > 0);
    } catch (error) {
      console.error('Error searching address:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleAddressInputChange = (value: string) => {
    setAddressSearchQuery(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    setSearchResults([]);
    setShowResults(false);
  };

  const handleSelectAddress = (result: AddressSearchResult) => {
    addPointByAddress(result.lat, result.lon, result.displayName);
    setAddressSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
  };

  const triggerGPXImport = () => {
    gpxFileInputRef.current?.click();
  };

  const handleGPXFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    void handleGPXImport(file);
    if (gpxFileInputRef.current) {
      gpxFileInputRef.current.value = '';
    }
  };

  const nativeProfiles = useNativeProfiles();
  const routingProfiles = createListCollection({
    items: nativeProfiles.map(value => ({ label: value, value })),
  });

  const editableRoutes = [...routes].sort(
    (left, right) =>
      new Date(right.updated_at || right.created_at).getTime() -
      new Date(left.updated_at || left.created_at).getTime()
  );

  const routeSelectionOptions = createListCollection({
    items: [
      {
        label: t('routeBuilder:labels.newRoadbook'),
        value: 'new',
      },
      ...editableRoutes.map(route => ({
        label: route.name || t('routeBuilder:labels.unnamedRoute'),
        value: route.id,
      })),
    ],
  });
  const currentEditableRoute =
    editableRoutes.find(route => route.id === editRouteId) || null;
  const canDuplicate = Boolean(currentEditableRoute);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const {
    bgSection,
    borderColor,
    pointItemBg,
    textColor,
    labelColor,
    selectHoverBorderColor,
    selectContentBg,
    selectItemHoverBg,
  } = useRouteBuilderColors();

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = routePoints.findIndex(point => point.id === active.id);
      const newIndex = routePoints.findIndex(point => point.id === over?.id);

      reorderPoints(arrayMove(routePoints, oldIndex, newIndex));
    }
  };

  const handleRouteSelectionChange = (value: string | undefined) => {
    if (!value) {
      return;
    }

    if (value === 'new') {
      resetRouteBuilder();
      setRouteNameInput('');
      setIsRouteNameManuallySet(false);
      setRoutingProfile(
        settingsStore.app.defaultRoutingProfile ?? 'Car-FastEco'
      );
      setRouteBuilderMapView(null);
      navigate(buildRoutePlanningPath());
      return;
    }

    const route = editableRoutes.find(entry => entry.id === value);
    if (!route) {
      return;
    }

    const routePlanningView = getRoutePlanningView(route.waypoints);
    if (routePlanningView) {
      setRouteBuilderMapView(routePlanningView);
    }

    const map = mapRef.current?.getMap?.();
    if (map) {
      if (route.waypoints.length === 1) {
        map.flyTo({
          center: [route.waypoints[0].lon, route.waypoints[0].lat],
          zoom: 13,
          duration: 1000,
        });
      } else if (route.waypoints.length > 1) {
        const longitudes = route.waypoints.map(point => point.lon);
        const latitudes = route.waypoints.map(point => point.lat);

        map.fitBounds(
          [
            [Math.min(...longitudes), Math.min(...latitudes)],
            [Math.max(...longitudes), Math.max(...latitudes)],
          ],
          { padding: 80, duration: 1000 }
        );
      }
    }

    resetRouteBuilder();
    setRouteNameInput('');
    navigate(buildRoutePlanningPath(route.id));
  };

  const handleOpenRenameDialog = (route: UserRoute) => {
    setPendingRename(route.name || routeNameInput || '');
    setIsRenameDialogOpen(true);
  };

  const handleRenameRoute = async () => {
    if (!currentEditableRoute) {
      return;
    }

    const trimmedName = pendingRename.trim();
    if (!trimmedName || isSubmittingAction) {
      return;
    }

    try {
      setIsSubmittingAction(true);
      await routesStore.updateRoute(currentEditableRoute.id, {
        name: trimmedName,
      });
      setRouteNameInput(trimmedName);
      setIsRouteNameManuallySet(true);
      setSelectedRouteName(trimmedName);

      if (currentRouteId === currentEditableRoute.id) {
        setCurrentRouteName(trimmedName);
      }

      setIsRenameDialogOpen(false);
    } catch (error) {
      console.error('Error renaming route:', error);
      alert(
        `Roadbook konnte nicht umbenannt werden: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      );
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleDeleteRoute = async () => {
    if (!currentEditableRoute || isSubmittingAction) {
      return;
    }

    try {
      setIsSubmittingAction(true);
      await routesStore.deleteRoute(currentEditableRoute.id);

      if (currentRouteId === currentEditableRoute.id) {
        setCurrentRouteId(null);
        setCurrentRouteName(null);
      }

      resetRouteBuilder();
      setRouteBuilderMapView(null);
      setRouteNameInput('');
      setSelectedRouteName('');
      setIsDeleteDialogOpen(false);
      navigate(buildRoutePlanningPath());
    } catch (error) {
      console.error('Error deleting route:', error);
      alert(
        `Roadbook konnte nicht gelöscht werden: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      );
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleDuplicateRoute = async () => {
    if (!currentEditableRoute) {
      alert(t('routeBuilder:warnings.duplicateUnavailable'));
      return;
    }

    try {
      setIsSubmittingAction(true);
      const baseName =
        currentEditableRoute.name || t('routeBuilder:labels.unnamedRoute');
      const duplicatedRoute = await routesStore.saveRoute({
        name: `${baseName}-duplikat`,
        waypoints: currentEditableRoute.waypoints,
        profile: currentEditableRoute.profile,
        cached_brouterTrack_data: currentEditableRoute.cached_brouterTrack_data,
        total_turns: currentEditableRoute.total_turns || 0,
      });

      const routePlanningView = getRoutePlanningView(duplicatedRoute.waypoints);
      if (routePlanningView) {
        setRouteBuilderMapView(routePlanningView);
      }

      resetRouteBuilder();
      setRouteNameInput('');
      navigate(buildRoutePlanningPath(duplicatedRoute.id));
    } catch (error) {
      console.error('Error duplicating route:', error);
      alert(
        `Roadbook konnte nicht dupliziert werden: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      );
    } finally {
      setIsSubmittingAction(false);
    }
  };

  return (
    <>
      <Box>
        <Box
          mb={4}
          p={2}
          bg={bgSection}
          borderWidth="1px"
          borderColor={borderColor}
          borderRadius="md"
        >
          <Text mb={2} fontWeight="500" color={labelColor}>
            {t('routeBuilder:labels.selectRoadbook')}:
          </Text>
          <Flex gap={2} align="center">
            <Box flex={1}>
              <Select.Root
                collection={routeSelectionOptions}
                value={[currentEditableRoute?.id || 'new']}
                onValueChange={details =>
                  handleRouteSelectionChange(details.value[0])
                }
                width="100%"
              >
                <Select.HiddenSelect />
                <Select.Control>
                  <Select.Trigger
                    bg={bgSection}
                    borderColor={borderColor}
                    _hover={{ borderColor: selectHoverBorderColor }}
                  >
                    <Select.ValueText
                      placeholder={t('routeBuilder:labels.selectRoadbook')}
                    />
                  </Select.Trigger>
                  <Select.IndicatorGroup>
                    <Select.Indicator />
                  </Select.IndicatorGroup>
                </Select.Control>
                <Portal>
                  <Select.Positioner>
                    <Select.Content
                      bg={selectContentBg}
                      borderColor={borderColor}
                      boxShadow="lg"
                    >
                      {routeSelectionOptions.items.map(option => (
                        <Select.Item
                          item={option}
                          key={option.value}
                          _hover={{ bg: selectItemHoverBg }}
                          color={textColor}
                        >
                          {option.label}
                          <Select.ItemIndicator />
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Positioner>
                </Portal>
              </Select.Root>
            </Box>

            {currentEditableRoute ? (
              <Menu.Root>
                <Menu.Trigger asChild>
                  <IconButton
                    variant="outline"
                    size="sm"
                    aria-label={t('routeBuilder:labels.routeActions')}
                  >
                    <IoMdSettings />
                  </IconButton>
                </Menu.Trigger>
                <Portal>
                  <Menu.Positioner>
                    <Menu.Content>
                      <Menu.Item
                        value="duplicate"
                        onClick={() => void handleDuplicateRoute()}
                        disabled={!canDuplicate || isSubmittingAction}
                      >
                        {t('routeBuilder:actions.duplicateRoute')}
                      </Menu.Item>
                      <Menu.Item
                        value="rename"
                        onClick={() =>
                          handleOpenRenameDialog(currentEditableRoute)
                        }
                        disabled={isSubmittingAction}
                      >
                        {t('routeBuilder:actions.renameRoute')}
                      </Menu.Item>
                      <Menu.Item
                        value="delete"
                        color="fg.error"
                        _hover={{ bg: 'bg.error', color: 'fg.error' }}
                        onClick={() => setIsDeleteDialogOpen(true)}
                      >
                        {t('routeBuilder:labels.delete')}
                      </Menu.Item>
                    </Menu.Content>
                  </Menu.Positioner>
                </Portal>
              </Menu.Root>
            ) : null}
          </Flex>
        </Box>

        <Box
          mb={4}
          p={2}
          bg={bgSection}
          borderWidth="1px"
          borderColor={borderColor}
          borderRadius="md"
        >
          <Text mb={2} fontWeight="500" color={labelColor}>
            {t('routeBuilder:labels.routingProfile')}:
          </Text>
          <Select.Root
            collection={routingProfiles}
            value={[routingProfile]}
            onValueChange={details => {
              const profile = details.value[0];
              setRoutingProfile(profile);
              settingsStore.updateAppSettings({
                defaultRoutingProfile: profile,
              });
            }}
            width="100%"
          >
            <Select.HiddenSelect />
            <Select.Control>
              <Select.Trigger
                bg={bgSection}
                borderColor={borderColor}
                _hover={{ borderColor: selectHoverBorderColor }}
              >
                <Select.ValueText />
              </Select.Trigger>
              <Select.IndicatorGroup>
                <Select.Indicator />
              </Select.IndicatorGroup>
            </Select.Control>
            <Portal>
              <Select.Positioner>
                <Select.Content
                  bg={selectContentBg}
                  borderColor={borderColor}
                  boxShadow="lg"
                >
                  {routingProfiles.items.map(profile => (
                    <Select.Item
                      item={profile}
                      key={profile.value}
                      _hover={{ bg: selectItemHoverBg }}
                      color={textColor}
                    >
                      {profile.label}
                      <Select.ItemIndicator />
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Positioner>
            </Portal>
          </Select.Root>
        </Box>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={routePoints.map(point => point.id)}
            strategy={verticalListSortingStrategy}
          >
            <Box
              mb={4}
              borderWidth={routePoints.length > 0 ? '1px' : '0'}
              borderColor={borderColor}
              borderRadius="md"
            >
              {routePoints.map((point, index) => (
                <SortablePointItem
                  key={point.id}
                  point={point}
                  index={index}
                  onRemove={removePoint}
                  textColor={textColor}
                  pointItemBg={pointItemBg}
                  borderColor={borderColor}
                />
              ))}
            </Box>
          </SortableContext>
        </DndContext>

        <Flex direction="column" gap={2}>
          <Button
            width="100%"
            onClick={addCurrentPosition}
            disabled={isGettingLocation}
            colorScheme="blue"
            variant="outline"
            style={{ touchAction: 'manipulation' }}
            minHeight="44px"
          >
            {isGettingLocation
              ? t('routeBuilder:labels.gettingGPS')
              : t('buttons.addCurrentPosition')}
          </Button>

          <>
            <Button
              width="100%"
              onClick={triggerGPXImport}
              colorScheme="purple"
              variant="outline"
              style={{ touchAction: 'manipulation' }}
              minHeight="44px"
            >
              {t('routeBuilder:labels.importGPXTemplate')}
            </Button>
            <input
              ref={gpxFileInputRef}
              type="file"
              accept=".gpx"
              style={{ display: 'none' }}
              onChange={handleGPXFileChange}
            />
          </>

          <Box ref={searchBoxRef} position="relative">
            <Box position="relative">
              <Input
                placeholder={
                  t('routeBuilder:labels.searchAddress') || 'Adresse suchen...'
                }
                size="sm"
                bg={bgSection}
                borderColor={borderColor}
                fontSize="sm"
                value={addressSearchQuery}
                onChange={event => handleAddressInputChange(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void handleAddressSearch(addressSearchQuery);
                  }
                }}
                paddingRight="80px"
                onFocus={() => {
                  if (searchResults.length > 0) {
                    setShowResults(true);
                  }
                }}
              />
              {!isSearching && (
                <Button
                  size="xs"
                  position="absolute"
                  right="4px"
                  top="4px"
                  disabled={addressSearchQuery.trim().length < 3}
                  onClick={() => void handleAddressSearch(addressSearchQuery)}
                >
                  Suchen
                </Button>
              )}
              {isSearching && (
                <Box
                  position="absolute"
                  right="8px"
                  top="50%"
                  transform="translateY(-50%)"
                >
                  <Spinner size="sm" />
                </Box>
              )}
            </Box>

            {showResults &&
              searchResults.length > 0 &&
              (() => {
                const rect = searchBoxRef.current?.getBoundingClientRect();
                if (!rect) return null;

                const gap = 8;
                const maxWidth = 400;
                const maxHeight = 300;
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;

                let top = 0;
                let left = 0;
                let width = rect.width;
                let calculatedMaxHeight = maxHeight;

                if (isLandscape) {
                  const spaceRight = viewportWidth - rect.right - gap;
                  const spaceLeft = rect.left - gap;

                  if (spaceRight >= maxWidth) {
                    left = rect.right + gap;
                    width = Math.min(maxWidth, spaceRight);
                  } else if (spaceLeft >= maxWidth) {
                    width = Math.min(maxWidth, spaceLeft);
                    left = rect.left - width - gap;
                  } else if (spaceRight > spaceLeft) {
                    left = rect.right + gap;
                    width = Math.min(spaceRight - gap, maxWidth);
                  } else {
                    width = Math.min(spaceLeft - gap, maxWidth);
                    left = rect.left - width - gap;
                  }

                  top = rect.top;
                  const spaceBelow = viewportHeight - top;
                  calculatedMaxHeight = Math.min(maxHeight, spaceBelow - gap);
                } else {
                  left = rect.left;
                  width = Math.min(rect.width, maxWidth);

                  if (left + width > viewportWidth) {
                    left = viewportWidth - width - gap;
                  }

                  const spaceBelow = viewportHeight - rect.bottom - gap;

                  if (spaceBelow >= maxHeight) {
                    top = rect.bottom + gap;
                    calculatedMaxHeight = Math.min(maxHeight, spaceBelow);
                  } else {
                    const spaceAbove = rect.top - gap;
                    if (spaceAbove > spaceBelow) {
                      calculatedMaxHeight = Math.min(maxHeight, spaceAbove);
                      top = rect.top - calculatedMaxHeight - gap;
                    } else {
                      top = rect.bottom + gap;
                      calculatedMaxHeight = Math.min(maxHeight, spaceBelow);
                    }
                  }
                }

                return (
                  <Portal>
                    <Box
                      ref={searchResultsRef}
                      position="fixed"
                      top={`${top}px`}
                      left={`${left}px`}
                      width={`${width}px`}
                      bg={selectContentBg}
                      borderWidth="1px"
                      borderColor={borderColor}
                      borderRadius="md"
                      boxShadow="lg"
                      maxHeight={`${calculatedMaxHeight}px`}
                      overflowY="auto"
                      zIndex={99999}
                    >
                      {searchResults.map(result => (
                        <Box
                          key={result.id}
                          p={3}
                          cursor="pointer"
                          _hover={{ bg: selectItemHoverBg }}
                          borderBottomWidth="1px"
                          borderBottomColor={borderColor}
                          _last={{ borderBottomWidth: 0 }}
                          onClick={() => handleSelectAddress(result)}
                        >
                          <Text
                            fontSize="sm"
                            fontWeight="500"
                            color={textColor}
                            mb={1}
                          >
                            {result.displayName}
                          </Text>
                          <Text fontSize="xs" color={labelColor}>
                            {result.lat.toFixed(5)}, {result.lon.toFixed(5)}
                          </Text>
                        </Box>
                      ))}
                    </Box>
                  </Portal>
                );
              })()}
          </Box>
        </Flex>
      </Box>

      <Dialog.Root
        open={isRenameDialogOpen}
        onOpenChange={details => {
          if (isSubmittingAction) {
            return;
          }

          setIsRenameDialogOpen(details.open);
        }}
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>
                  {t('routeBuilder:dialogs.renameTitle')}
                </Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Input
                  value={pendingRename}
                  onChange={event => setPendingRename(event.target.value)}
                  placeholder={t('routeBuilder:labels.roadbookName')}
                  autoFocus
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void handleRenameRoute();
                    }
                  }}
                />
              </Dialog.Body>
              <Dialog.Footer>
                <Button
                  variant="outline"
                  onClick={() => setIsRenameDialogOpen(false)}
                  disabled={isSubmittingAction}
                  mr={3}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  colorScheme="blue"
                  onClick={() => void handleRenameRoute()}
                  loading={isSubmittingAction}
                  disabled={!pendingRename.trim()}
                >
                  {t('common.save')}
                </Button>
              </Dialog.Footer>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" disabled={isSubmittingAction} />
              </Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      <Dialog.Root
        open={isDeleteDialogOpen}
        onOpenChange={details => {
          if (isSubmittingAction) {
            return;
          }

          setIsDeleteDialogOpen(details.open);
        }}
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>
                  {t('routeBuilder:dialogs.deleteTitle')}
                </Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Text>{t('routeBuilder:dialogs.deleteDescription')}</Text>
              </Dialog.Body>
              <Dialog.Footer>
                <Button
                  variant="outline"
                  onClick={() => setIsDeleteDialogOpen(false)}
                  disabled={isSubmittingAction}
                  mr={3}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  colorScheme="red"
                  onClick={() => void handleDeleteRoute()}
                  loading={isSubmittingAction}
                >
                  {t('common.delete')}
                </Button>
              </Dialog.Footer>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" disabled={isSubmittingAction} />
              </Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </>
  );
};

export default RoutePointsList;
