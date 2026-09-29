import React from 'react';
import { SupportedLanguage } from '../i18n/types';
import { useColorModeValue } from './ui/color-mode';
import { useSettings } from '../stores/settingsStore';
import { setLanguage } from '../utils/setLanguage';

const languages: Array<{
  code: SupportedLanguage;
  name: string;
  flag: string;
}> = [
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
];

interface LanguageSelectorProps {
  textColor?: string;
  borderColor?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  textColor,
  borderColor,
}) => {
  const { interface: uiSettings } = useSettings();

  const currentLanguage =
    languages.find(lang => lang.code === uiSettings.language) || languages[0];

  const handleLanguageChange = async (languageCode: SupportedLanguage) => {
    await setLanguage(languageCode);
  };

  const defaultTextColor = useColorModeValue('#333', 'gray.300');
  const defaultBorderColor = useColorModeValue('#ddd', 'gray.600');
  const selectBgColor = useColorModeValue('white', '#2D3748');

  return (
    <select
      value={currentLanguage.code}
      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
        handleLanguageChange(e.target.value as SupportedLanguage);
      }}
      style={{
        padding: '0.5rem',
        borderRadius: '6px',
        border: `1px solid ${borderColor || defaultBorderColor}`,
        backgroundColor: selectBgColor,
        color: textColor || defaultTextColor,
        minWidth: '150px',
        fontSize: '0.9rem',
      }}
    >
      {languages.map(language => (
        <option key={language.code} value={language.code}>
          {language.flag} {language.name}
        </option>
      ))}
    </select>
  );
};
