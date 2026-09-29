import React, { useRef, useCallback, useEffect } from 'react';
import { Box } from '@chakra-ui/react';
import { useAppStore } from '../stores/appStore';
import { useSettings } from '../stores/settingsStore';

export const OdometerButtons: React.FC = () => {
  // Get odometer functions from app store using stable selectors
  const setOdometer = useAppStore(state => state.setOdometer);
  const currentOdometer = useAppStore(state => state.odometer);

  // Get keyboard settings
  const { app: appSettings } = useSettings();

  // Refs for interval handling
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(false);

  // Start continuous adjustment
  const startContinuousDecrease = useCallback(() => {
    if (isActiveRef.current) return; // Prevent multiple intervals
    isActiveRef.current = true;

    // Immediate first action
    setOdometer(Math.max(0, currentOdometer - 10));

    // Start interval for continuous action
    intervalRef.current = setInterval(() => {
      // Access current state from store
      const { odometer: currentValue } = useAppStore.getState();
      setOdometer(Math.max(0, currentValue - 10));
    }, 100);
  }, [currentOdometer, setOdometer]);

  const startContinuousIncrease = useCallback(() => {
    if (isActiveRef.current) return; // Prevent multiple intervals
    isActiveRef.current = true;

    // Immediate first action
    setOdometer(currentOdometer + 10);

    // Start interval for continuous action
    intervalRef.current = setInterval(() => {
      // Access current state from store
      const { odometer: currentValue } = useAppStore.getState();
      setOdometer(currentValue + 10);
    }, 100);
  }, [currentOdometer, setOdometer]);

  // Stop continuous adjustment
  const stopContinuous = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    isActiveRef.current = false;
  }, []);

  // Enhanced event handlers that are more reliable
  const handleDecreaseStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      startContinuousDecrease();
    },
    [startContinuousDecrease]
  );

  const handleIncreaseStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      startContinuousIncrease();
    },
    [startContinuousIncrease]
  );

  const handleStop = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      stopContinuous();
    },
    [stopContinuous]
  );

  // Cleanup interval on unmount and component updates
  useEffect(() => {
    return () => {
      stopContinuous();
    };
  }, [stopContinuous]);

  // Keyboard event handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Normalize key name for space
      const keyName = e.key === ' ' ? 'Space' : e.key;

      if (keyName === appSettings.odometerDecreaseKey) {
        e.preventDefault();
        e.stopPropagation();
        startContinuousDecrease();
      } else if (keyName === appSettings.odometerIncreaseKey) {
        e.preventDefault();
        e.stopPropagation();
        startContinuousIncrease();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Normalize key name for space
      const keyName = e.key === ' ' ? 'Space' : e.key;

      if (
        keyName === appSettings.odometerDecreaseKey ||
        keyName === appSettings.odometerIncreaseKey
      ) {
        e.preventDefault();
        e.stopPropagation();
        stopContinuous();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    appSettings.odometerDecreaseKey,
    appSettings.odometerIncreaseKey,
    startContinuousDecrease,
    startContinuousIncrease,
    stopContinuous,
  ]);

  // // Additional safety: Clear interval on any window events that might interrupt
  // useEffect(() => {
  //   const handleGlobalStop = () => {
  //     stopContinuous();
  //   };

  //   // Add global event listeners for safety
  //   window.addEventListener('blur', handleGlobalStop);
  //   window.addEventListener('visibilitychange', handleGlobalStop);
  //   document.addEventListener('touchcancel', handleGlobalStop);

  //   return () => {
  //     window.removeEventListener('blur', handleGlobalStop);
  //     window.removeEventListener('visibilitychange', handleGlobalStop);
  //     document.removeEventListener('touchcancel', handleGlobalStop);
  //     handleGlobalStop();
  //   };
  // }, [stopContinuous]);

  return (
    <Box
      position="absolute"
      top={0}
      left={0}
      width="100%"
      height="100%"
      zIndex={10}
    >
      {/* Invisible button for decreasing odometer (left half) */}
      <Box
        position="absolute"
        top={0}
        left={0}
        width="50%"
        height="100%"
        cursor="pointer"
        onMouseDown={handleDecreaseStart}
        onMouseUp={handleStop}
        onMouseLeave={handleStop}
        onTouchStart={handleDecreaseStart}
        onTouchEnd={handleStop}
        onTouchCancel={handleStop}
        background="transparent"
        _hover={{ background: 'rgba(255, 255, 255, 0.1)' }}
        style={{
          // Prevent text selection
          userSelect: 'none',
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none',
          // Prevent context menu
          WebkitTouchCallout: 'none',
        }}
      />

      {/* Invisible button for increasing odometer (right half) */}
      <Box
        position="absolute"
        top={0}
        right={0}
        width="50%"
        height="100%"
        cursor="pointer"
        onMouseDown={handleIncreaseStart}
        onMouseUp={handleStop}
        onMouseLeave={handleStop}
        onTouchStart={handleIncreaseStart}
        onTouchEnd={handleStop}
        onTouchCancel={handleStop}
        background="transparent"
        _hover={{ background: 'rgba(255, 255, 255, 0.1)' }}
        style={{
          // Prevent text selection
          userSelect: 'none',
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none',
          // Prevent context menu
          WebkitTouchCallout: 'none',
        }}
      />
    </Box>
  );
};
