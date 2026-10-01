import { createContext, useContext } from 'react';
export const NativeProfilesContext = createContext<string[]>([]);
export const useNativeProfiles = () => useContext(NativeProfilesContext);

export const NativeImportContext = createContext<
  (() => Promise<string | null>) | null
>(null);
export const useNativeImport = () => useContext(NativeImportContext);
