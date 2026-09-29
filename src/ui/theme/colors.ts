import { useColorModeValue } from '../components/ui/color-mode';

/**
 * Hook for common map-related colors
 */
export const useMapColors = () => {
  return {
    borderColor: useColorModeValue('gray.200', 'gray.600'),
    spinnerColor: useColorModeValue('blue.500', 'blue.300'),
    overlayBg: useColorModeValue(
      'rgba(255, 255, 255, 0.8)',
      'rgba(26, 32, 44, 0.8)'
    ),
    attributionBg: useColorModeValue(
      'rgba(255, 255, 255, 0.1)',
      'rgba(0, 0, 0, 0.4)'
    ),
  };
};

/**
 * Hook for warning and error notification colors
 */
export const useNotificationColors = () => {
  return {
    warning: {
      bg: useColorModeValue('rgba(255, 193, 7, 0.9)', 'rgba(255, 193, 7, 0.9)'),
      color: useColorModeValue('rgba(138, 75, 0, 1)', 'rgba(138, 75, 0, 1)'),
    },
    error: {
      bg: useColorModeValue('rgba(220, 53, 69, 0.9)', 'rgba(220, 53, 69, 0.9)'),
      color: useColorModeValue(
        'rgba(255, 255, 255, 1)',
        'rgba(255, 255, 255, 1)'
      ),
    },
  };
};

/**
 * Hook for common UI element colors
 */
export const useUIColors = () => {
  return {
    bg: useColorModeValue('white', 'gray.800'),
    borderColor: useColorModeValue('gray.200', 'gray.600'),
    toggleButtonBg: useColorModeValue('gray.100', 'gray.700'),
    toggleButtonHoverBg: useColorModeValue('gray.200', 'gray.600'),
    toggleButtonColor: useColorModeValue('gray.700', 'gray.100'),
  };
};

/**
 * Hook for page layout colors
 */
export const usePageColors = () => {
  return {
    pageBg: useColorModeValue('gray.50', 'gray.900'),
    cardBg: useColorModeValue('white', 'gray.800'),
    borderColor: useColorModeValue('gray.200', 'gray.700'),
    textColor: useColorModeValue('gray.700', 'gray.300'),
    headingColor: useColorModeValue('gray.800', 'white'),
  };
};

/**
 * Hook for roadbook entry colors
 */
export const useRoadbookColors = () => {
  return {
    bgEntries: useColorModeValue('white', 'gray.800'),
    activeBg: useColorModeValue('blue.50', 'blue.900'),
    passedBg: useColorModeValue('gray.50', 'gray.700'),
    nextTurnBg: useColorModeValue('red.50', 'red.900'),
    borderColor: useColorModeValue('black', 'gray.600'),
    accentColor: useColorModeValue('blue.600', 'blue.300'),
    headingBg: useColorModeValue('black', 'black'),
    headingColor: useColorModeValue('white', 'white'),
    errorBg: useColorModeValue('red.50', 'red.900'),
    errorColor: useColorModeValue('red.500', 'red.200'),
    nextTurnBorderColor: useColorModeValue('red.500', 'red.500'),
    nextTurnShadow: useColorModeValue(
      '0 0 0 3px #e74c3c, 0 2px 8px rgba(231,76,60,0.15)',
      '0 0 0 3px #e74c3c, 0 2px 8px rgba(231,76,60,0.3)'
    ),
  };
};

/**
 * Hook for roadbook header colors
 */
export const useRoadbookHeaderColors = () => {
  return {
    accentColor: useColorModeValue('blue.500', 'blue.300'),
    headingBg: useColorModeValue('yellow.200', 'yellow.800'),
    textColor: useColorModeValue('gray.800', 'gray.100'),
    arrowTextColor: useColorModeValue('gray.800', 'white'),
    infoBg: useColorModeValue('gray.800', 'gray.800'),
    whiteText: useColorModeValue('gray.100', 'gray.100'),
  };
};

/**
 * Hook for route builder/list colors
 */
export const useRouteBuilderColors = () => {
  return {
    draggingBg: useColorModeValue('blue.50', 'blue.900'),
    draggingBorderColor: useColorModeValue('blue.200', 'blue.600'),
    hoverBg: useColorModeValue('gray.100', 'gray.600'),
    dotBorderColor: useColorModeValue('gray.300', 'gray.600'),
    bgSection: useColorModeValue('white', 'gray.800'),
    borderColor: useColorModeValue('gray.200', 'gray.600'),
    pointItemBg: useColorModeValue('white', 'gray.700'),
    textColor: useColorModeValue('gray.700', 'gray.300'),
    labelColor: useColorModeValue('gray.600', 'gray.400'),
    selectHoverBorderColor: useColorModeValue('gray.300', 'gray.500'),
    selectContentBg: useColorModeValue('white', 'gray.700'),
    selectItemHoverBg: useColorModeValue('gray.50', 'gray.600'),
  };
};

/**
 * Hook for footer colors
 */
export const useFooterColors = () => {
  return {
    bg: useColorModeValue('white', 'gray.800'),
    borderColor: useColorModeValue('gray.200', 'gray.600'),
    buttonBg: useColorModeValue('gray.100', 'gray.700'),
    buttonColor: useColorModeValue('gray.700', 'gray.200'),
    activeButtonBg: useColorModeValue('blue.500', 'blue.400'),
    activeButtonColor: useColorModeValue('white', 'white'),
  };
};

/**
 * Hook for odometer colors
 */
export const useOdometerColors = () => {
  return {
    textColor: useColorModeValue('gray.800', 'gray.100'),
    odometerBg: useColorModeValue('blue.200', 'blue.900'),
  };
};

/**
 * Hook for landing page colors
 */
export const useLandingPageColors = () => {
  return {
    sectionBg: useColorModeValue('white', 'gray.800'),
    altSectionBg: useColorModeValue('gray.50', 'gray.900'),
    textColor: useColorModeValue('gray.700', 'gray.300'),
    headingColor: useColorModeValue('gray.800', 'white'),
    cardBg: useColorModeValue('white', 'gray.700'),
  };
};

/**
 * Hook for Tulip (roadbook turn) rendering colors
 * Centralize all colors used by TulipDisplay and related map renderers
 */
export const useTulipColors = () => {
  return {
    // Core map features
    highwayBase: useColorModeValue('#000000', '#ffffff'),
    buildingFill: useColorModeValue('grey', 'grey'),
    buildingStroke: useColorModeValue('#2c3e50', '#d3d3d3'),
    waterway: useColorModeValue('#3498db', '#c6e0f5'),
    railway: useColorModeValue('#34495e', '#c7d5e0'),
    turnPath: useColorModeValue('#2986f5', '#56a4f5'),
    svgBackground: useColorModeValue('none', 'none'),
    svgFilter: useColorModeValue('none', 'brightness(0.9) contrast(1.2)'),

    // Additional OSM features
    powerLine: useColorModeValue('red', 'red'),
    tree: useColorModeValue('#27ae60', '#2ecc71'),
    naturalWater: useColorModeValue('#3498db', '#74b9ff'),
    power: useColorModeValue('#f39c12', '#fdcb6e'),
    well: useColorModeValue('#34495e', '#74b9ff'),
    trafficSign: useColorModeValue('#e74c3c', '#fd79a8'),

    // Special strokes for multi-line highways and indicators
    majorRoadOuter: useColorModeValue('#000000', '#000000'),
    majorRoadInner: useColorModeValue('#ffffff', '#ffffff'),
    turnIndicator: useColorModeValue('#000000', '#ffffff'),
  };
};
