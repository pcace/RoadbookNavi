import React, { useState, useEffect } from 'react';
import { Box, Button, Text, HStack } from '@chakra-ui/react';
import { useColorModeValue } from '../ui/color-mode';

interface KeySelectorProps {
  value: string;
  onChange: (key: string) => void;
  label: string;
  description?: string;
}

// Map of special keys to their display names
const KEY_DISPLAY_MAP: Record<string, string> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Enter: 'Enter',
  Space: 'Space',
  Escape: 'Esc',
  Tab: 'Tab',
  Backspace: 'Backspace',
  Delete: 'Del',
  Home: 'Home',
  End: 'End',
  PageUp: 'PgUp',
  PageDown: 'PgDn',
  Insert: 'Ins',
  F1: 'F1',
  F2: 'F2',
  F3: 'F3',
  F4: 'F4',
  F5: 'F5',
  F6: 'F6',
  F7: 'F7',
  F8: 'F8',
  F9: 'F9',
  F10: 'F10',
  F11: 'F11',
  F12: 'F12',
};

const getKeyDisplayName = (key: string | undefined): string => {
  if (!key) return 'Nicht gesetzt';
  return KEY_DISPLAY_MAP[key] || key.toUpperCase();
};

export const KeySelector: React.FC<KeySelectorProps> = ({
  value,
  onChange,
  label,
  description,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [pressedKey, setPressedKey] = useState<string | null>(null);

  const buttonBg = useColorModeValue('white', 'gray.700');
  const buttonBorder = useColorModeValue('gray.300', 'gray.600');
  const buttonHoverBg = useColorModeValue('gray.50', 'gray.600');
  const listeningBg = useColorModeValue('blue.50', 'blue.900');
  const listeningBorder = useColorModeValue('blue.400', 'blue.500');
  const textColor = useColorModeValue('gray.700', 'gray.200');
  const descriptionColor = useColorModeValue('gray.600', 'gray.400');

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isListening) return;

    e.preventDefault();
    e.stopPropagation();

    let keyName = e.key;

    // Handle special cases
    if (keyName === ' ') {
      keyName = 'Space';
    } else if (keyName === 'Control') {
      keyName = 'Ctrl';
    } else if (keyName === 'Meta') {
      keyName = 'Cmd';
    }

    // Only accept single keys (no modifiers for now)
    if (!e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
      setPressedKey(keyName);
      onChange(keyName);
      setIsListening(false);
    }
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    if (!isListening) return;
    e.preventDefault();
    e.stopPropagation();
  };

  const startListening = () => {
    setIsListening(true);
    setPressedKey(null);
  };

  const stopListening = () => {
    setIsListening(false);
    setPressedKey(null);
  };

  useEffect(() => {
    if (isListening) {
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);

      // Stop listening when clicking outside or losing focus
      const handleClickOutside = (e: MouseEvent) => {
        // Don't stop listening if clicking on the button itself
        if (e.target && (e.target as Element).closest('button')) {
          return;
        }
        stopListening();
      };

      document.addEventListener('click', handleClickOutside);

      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [isListening]);

  // Prevent listening when component unmounts
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);

  return (
    <Box>
      <HStack justifyContent="space-between" alignItems="flex-start" gap="1rem">
        <Box flex="1">
          <Text
            fontSize="0.9rem"
            fontWeight="600"
            color={textColor}
            mb="0.25rem"
          >
            {label}
          </Text>
          {description && (
            <Text fontSize="0.8rem" color={descriptionColor}>
              {description}
            </Text>
          )}
        </Box>
        <Button
          onClick={e => {
            e.stopPropagation();
            startListening();
          }}
          size="sm"
          variant="outline"
          bg={isListening ? listeningBg : buttonBg}
          borderColor={isListening ? listeningBorder : buttonBorder}
          _hover={!isListening ? { bg: buttonHoverBg } : {}}
          cursor={isListening ? 'default' : 'pointer'}
          minWidth="80px"
          fontSize="0.9rem"
        >
          {isListening
            ? pressedKey
              ? getKeyDisplayName(pressedKey)
              : 'Taste drücken...'
            : getKeyDisplayName(value)}
        </Button>
      </HStack>
    </Box>
  );
};
