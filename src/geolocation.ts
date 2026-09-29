import { invoke, isTauri } from '@tauri-apps/api/core';
import * as gps from '@tauri-apps/plugin-geolocation';
// Existing UI components use navigator.geolocation. Native webviews cannot use
// that API on the tauri:// origin, so the app installs a platform adapter at startup.
// Android uses the Tauri geolocation plugin and the native GPS API.
//   macOS   -> CoreLocation through the Rust bridge (location_*)
//   others  -> the webview implementation (Windows WebView2 / Linux WebKitGTK)
type Fix = {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number;
  altitudeAccuracy: number;
  heading: number;
  speed: number;
  timestamp: number;
};
let nextId = 0;
const fixError = (code: number, message: string): GeolocationPositionError => ({
  code,
  message,
  PERMISSION_DENIED: 1,
  POSITION_UNAVAILABLE: 2,
  TIMEOUT: 3,
});
const fixToPosition = (fix: Fix): GeolocationPosition =>
  ({
    coords: {
      latitude: fix.latitude,
      longitude: fix.longitude,
      accuracy: fix.accuracy,
      altitude: fix.altitude > 0 ? fix.altitude : null,
      altitudeAccuracy: fix.altitudeAccuracy > 0 ? fix.altitudeAccuracy : null,
      heading: fix.heading >= 0 ? fix.heading : null,
      speed: fix.speed >= 0 ? fix.speed : null,
    },
    timestamp: fix.timestamp,
    toJSON: () => fix,
  }) as unknown as GeolocationPosition;

export async function installNativeGeolocation() {
  if (!isTauri()) return;
  const platform = await invoke<string>('platform');
  if (platform === 'android') installAndroid();
  else if (platform === 'macos') installMacos();
}

// Android uses the Tauri geolocation plugin.
function installAndroid() {
  const watchers = new Map<number, number | null>();
  const permissions = async () => {
    const p = await gps.checkPermissions();
    if (p.location !== 'granted' && p.coarseLocation !== 'granted') {
      const result = await gps.requestPermissions(['location']);
      if (result.location !== 'granted' && result.coarseLocation !== 'granted')
        throw new Error('Standortzugriff nicht erlaubt');
    }
  };
  const options = (o?: PositionOptions): gps.PositionOptions => ({
    enableHighAccuracy: o?.enableHighAccuracy ?? true,
    timeout: o?.timeout ?? 20000,
    maximumAge: o?.maximumAge ?? 0,
  });
  const position = (p: gps.Position) =>
    ({
      ...p,
      toJSON: () => p,
      coords: { ...p.coords, toJSON: () => p.coords },
    }) as GeolocationPosition;
  const geolocation: Geolocation = {
    getCurrentPosition(success, error, o) {
      void permissions()
        .then(() => gps.getCurrentPosition(options(o)))
        .then(p => success(position(p)))
        .catch(e => error?.(fixError(2, String(e))));
    },
    watchPosition(success, error, o) {
      const id = ++nextId;
      watchers.set(id, null);
      void permissions()
        .then(() =>
          gps.watchPosition(options(o), (p, e) => {
            if (!watchers.has(id)) return;
            if (p) success(position(p));
            else if (e) error?.(fixError(2, String(e)));
          })
        )
        .then(nativeId => {
          if (watchers.has(id)) watchers.set(id, nativeId);
          else void gps.clearWatch(nativeId);
        })
        .catch(e => {
          watchers.delete(id);
          error?.(fixError(2, String(e)));
        });
      return id;
    },
    clearWatch(id) {
      const nativeId = watchers.get(id);
      watchers.delete(id);
      if (nativeId != null) void gps.clearWatch(nativeId);
    },
  };
  Object.defineProperty(navigator, 'geolocation', {
    value: geolocation,
    configurable: true,
  });
}

// macOS polls the latest position from the CoreLocation bridge.
function installMacos() {
  const watchers = new Map<number, ReturnType<typeof setInterval>>();
  const stopWatcher = (id: number) => {
    const timer = watchers.get(id);
    if (timer != null) {
      clearInterval(timer);
      watchers.delete(id);
    }
    if (!watchers.size) void invoke('location_stop').catch(() => {});
  };
  // The localized "permission not granted" message represents CoreLocation's temporary NotDetermined state while
  // the macOS permission dialog is open. Keep polling until the user decides.
  const denied = (message: string) =>
    message.includes('verweigert') || message.includes('eingeschränkt');
  const geolocation: Geolocation = {
    getCurrentPosition(success, error, o) {
      const started = Date.now(),
        timeout = o?.timeout ?? 20000;
      let timer: ReturnType<typeof setInterval>;
      let done = false;
      const finish = (fn: () => void) => {
        if (done) return;
        done = true;
        clearInterval(timer);
        void invoke('location_stop').catch(() => {});
        fn();
      };
      void invoke('location_start').catch(e =>
        finish(() => error?.(fixError(2, String(e))))
      );
      timer = setInterval(
        () =>
          void (async () => {
            try {
              const fix = await invoke<Fix>('location_current');
              finish(() => success(fixToPosition(fix)));
            } catch (raw) {
              const message = String(raw);
              if (denied(message)) finish(() => error?.(fixError(1, message)));
              else if (Date.now() - started > timeout)
                finish(() => error?.(fixError(3, 'Kein GPS-Signal empfangen')));
            }
          })(),
        500
      );
    },
    watchPosition(success, error, o) {
      const id = ++nextId;
      const started = Date.now(),
        timeout = o?.timeout ?? 30000;
      void invoke('location_start').catch(e => {
        stopWatcher(id);
        error?.(fixError(2, String(e)));
      });
      const timer = setInterval(
        () =>
          void (async () => {
            if (!watchers.has(id)) return;
            try {
              success(fixToPosition(await invoke<Fix>('location_current')));
            } catch (raw) {
              const message = String(raw);
              if (denied(message)) {
                stopWatcher(id);
                error?.(fixError(1, message));
              } else if (Date.now() - started > timeout) {
                stopWatcher(id);
                error?.(fixError(3, 'Kein GPS-Signal empfangen'));
              }
            }
          })(),
        1000
      );
      watchers.set(id, timer);
      return id;
    },
    clearWatch(id) {
      stopWatcher(id);
    },
  };
  Object.defineProperty(navigator, 'geolocation', {
    value: geolocation,
    configurable: true,
  });
}
