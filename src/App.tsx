import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppPage from './ui/pages/AppPage';
import {
  NativeProfilesContext,
  NativeImportContext,
} from './ui/config/runtime';
import { importRoadbook } from './import';
import { loadLibrary } from './services';
export default function App() {
  const [profiles, setProfiles] = useState<string[]>([]);
  useEffect(() => {
    const refresh = () => {
      void loadLibrary()
        .then(x => setProfiles(x.profiles))
        .catch(console.error);
    };
    refresh();
    window.addEventListener('profiles-changed', refresh);
    return () => window.removeEventListener('profiles-changed', refresh);
  }, []);
  return (
    <NativeProfilesContext.Provider value={profiles}>
      <NativeImportContext.Provider value={importRoadbook}>
        <Routes>
          <Route path="/app/*" element={<AppPage />} />
          <Route
            path="*"
            element={<Navigate to="/app/routes-list" replace />}
          />
        </Routes>
      </NativeImportContext.Provider>
    </NativeProfilesContext.Provider>
  );
}
