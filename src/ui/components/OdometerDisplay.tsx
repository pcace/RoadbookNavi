import React from 'react';
import { Box, Flex, Text, VStack } from '@chakra-ui/react';
import { useOdometerColors } from '../theme/colors';
import { useAppStore } from '../stores/appStore';

// Separate component for odometer display to prevent unnecessary re-renders
export const OdometerDisplay: React.FC = React.memo(() => {
  const currentOdometer = useAppStore(state => state.odometer);
  const { textColor, odometerBg } = useOdometerColors();

  return (
    <Box
      flex={1}
      textAlign="center"
      border="2px solid black"
      background={odometerBg}
      position="relative"
      display="flex"
      alignItems="center"
      justifyContent="center"
      minH={0}
    >
      <Box
        position="absolute"
        top={1}
        left={2}
        pointerEvents="none"
        opacity={0.85}
      >
        <Text
          fontWeight="bold"
          color={textColor}
          css={{ fontSize: 'clamp(0.85rem, 2vw, 1rem)' }}
        >
          ←
        </Text>
      </Box>

      <Box
        position="absolute"
        top={1}
        right={2}
        pointerEvents="none"
        opacity={0.85}
      >
        <Text
          fontWeight="bold"
          color={textColor}
          css={{ fontSize: 'clamp(0.85rem, 2vw, 1rem)' }}
        >
          →
        </Text>
      </Box>

      <VStack>
        <Flex alignItems="baseline">
          <Text
            fontWeight="bold"
            color={textColor}
            fontSize={['4xl', '5xl', '6xl']}
            css={{
              fontSize: 'clamp(2rem, 8vw, 4rem)',
              '@media (orientation: landscape)': {
                fontSize: 'clamp(3rem, 5vw, 5rem)',
              },
              '@media (orientation: portrait)': {
                fontSize: 'clamp(2rem, 10vw, 4rem)',
              },
            }}
          >
            {currentOdometer < 1000
              ? `${currentOdometer.toFixed(1)}`
              : `${(currentOdometer / 1000).toFixed(2)}`}
          </Text>
          <Text
            fontSize={['sm', 'md']}
            ml={1}
            color={textColor}
            css={{
              fontSize: 'clamp(0.8rem, 2vw, 1rem)',
            }}
          >
            {currentOdometer < 1000 ? 'm' : 'km'}
          </Text>
        </Flex>
      </VStack>
    </Box>
  );
});

OdometerDisplay.displayName = 'OdometerDisplay';
