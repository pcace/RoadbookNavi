import React from 'react';
import { Box } from '@chakra-ui/react';
import { OdometerDisplay } from './OdometerDisplay';
import { OdometerButtons } from './OdometerButtons';

// Wrapper component that combines odometer display and buttons
export const Odometer: React.FC = () => {
  return (
    <Box position="relative" flex={1} display="flex" minH={0}>
      <OdometerDisplay />
      <OdometerButtons />
    </Box>
  );
};
