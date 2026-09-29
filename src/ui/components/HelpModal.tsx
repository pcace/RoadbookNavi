import React, { useState } from 'react';
import { Dialog, CloseButton, Portal } from '@chakra-ui/react';
import { useColorModeValue } from './ui/color-mode';
import { useTranslation } from 'react-i18next';
import { HelpContent } from './HelpContent';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();

  const borderColor = useColorModeValue('gray.200', 'gray.700');

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(e: { open: boolean }) => {
        if (!e.open) onClose();
      }}
      size="cover"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header borderBottom="1px" borderColor={borderColor} p={4}>
              <Dialog.Title>{t('help.title')}</Dialog.Title>
            </Dialog.Header>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" position="absolute" right={4} top={4} />
            </Dialog.CloseTrigger>

            <Dialog.Body
              p={0}
              overflow="hidden"
              display="flex"
              flexDirection="column"
            >
              <HelpContent enabled={isOpen} height="95%" padding={8} />
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};

// Export hook for easy usage
export const useHelpModal = () => {
  const [open, setOpen] = useState(false);

  return {
    isOpen: open,
    onOpen: () => setOpen(true),
    onClose: () => setOpen(false),
  };
};
