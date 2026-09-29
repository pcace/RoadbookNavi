import React from 'react';
import { Box, Text, VStack } from '@chakra-ui/react';
import { IoIosMap } from 'react-icons/io';
import { useTranslation } from 'react-i18next';

const EmptyState: React.FC<{ onCreateRoute: () => void }> = ({
  onCreateRoute,
}) => {
  const { t } = useTranslation();
  return (
    <VStack justify="center" height="100%" width="100%">
      <Box
        as="button"
        onClick={onCreateRoute}
        p={8}
        borderRadius="lg"
        border="2px"
        borderColor="blue.300"
        width="80%"
        maxWidth="400px"
        _hover={{ transform: 'scale(1.02)' }}
      >
        <VStack gap={4}>
          <IoIosMap size={32} />
          <Text fontWeight="semibold">
            {t('roadbook:states.clickToCreate')}
          </Text>
          <Text fontSize="sm" color="gray.500">
            {t('roadbook:states.clickToCreateSubtext')}
          </Text>
        </VStack>
      </Box>
    </VStack>
  );
};

export default EmptyState;
