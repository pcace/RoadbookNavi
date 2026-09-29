import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { Provider } from './ui/components/ui/provider';
import { initMobileViewportFix } from './ui/utils/mobileViewportFix';
import './ui/utils/mobileViewportFix.css';
import './ui/i18n';
import App from './App';
import { installNativeGeolocation } from './geolocation';
initMobileViewportFix();
void installNativeGeolocation()
  .catch(console.error)
  .then(() =>
    createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <Provider>
          <HashRouter>
            <App />
          </HashRouter>
        </Provider>
      </React.StrictMode>
    )
  );
