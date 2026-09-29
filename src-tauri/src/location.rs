//! macOS location support through CoreLocation.
//!
//! The desktop Tauri geolocation plugin is a stub, while WKWebView rejects
//! navigator.geolocation on the tauri:// origin. This bridge starts the system
//! location service and exposes its latest position to geolocation.ts.
use serde::Serialize;
#[cfg(target_os = "macos")]
use std::sync::Mutex;

#[derive(Default)]
pub struct LocationState {
    #[cfg(target_os = "macos")]
    manager: Mutex<Option<ManagerHandle>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Fix {
    latitude: f64,
    longitude: f64,
    accuracy: f64,
    altitude: f64,
    altitude_accuracy: f64,
    heading: f64,
    speed: f64,
    timestamp: f64,
}

#[cfg(target_os = "macos")]
struct ManagerHandle(
    #[allow(dead_code)] objc2::rc::Retained<objc2_core_location::CLLocationManager>,
);
// Apple documents CLLocationManager as thread-safe. The delegate is only shared
// after construction, so these explicit markers are safe.
#[cfg(target_os = "macos")]
unsafe impl Send for ManagerHandle {}
#[cfg(target_os = "macos")]
unsafe impl Sync for ManagerHandle {}

#[tauri::command]
pub fn location_start(
    app: tauri::AppHandle,
    state: tauri::State<LocationState>,
) -> Result<(), String> {
    start(app, state)
}

#[tauri::command]
pub fn location_current(state: tauri::State<LocationState>) -> Result<Fix, String> {
    current(state)
}

#[tauri::command]
pub fn location_stop(state: tauri::State<LocationState>) -> Result<(), String> {
    stop(state)
}

#[cfg(target_os = "macos")]
fn start(app: tauri::AppHandle, state: tauri::State<LocationState>) -> Result<(), String> {
    use objc2::rc::Retained;
    use objc2_core_location::{CLAuthorizationStatus, CLLocationManager};
    let mut manager_slot = state.manager.lock().unwrap();
    if manager_slot.is_some() {
        return Ok(());
    }
    // CoreLocation requires construction on a thread with an active run loop.
    // Create the delegate on the main thread, then share it safely.
    let (sender, receiver) = std::sync::mpsc::channel::<Result<ManagerHandle, String>>();
    app.run_on_main_thread(move || unsafe {
        let manager: Retained<CLLocationManager> = CLLocationManager::new();
        // kCLDistanceFilterNone and kCLLocationAccuracyBest are both -1.0.
        manager.setDistanceFilter(-1.0);
        manager.setDesiredAccuracy(-1.0);
        if manager.authorizationStatus() == CLAuthorizationStatus::NotDetermined {
            manager.requestWhenInUseAuthorization();
        }
        manager.startUpdatingLocation();
        let _ = sender.send(Ok(ManagerHandle(manager)));
    })
    .map_err(|e| e.to_string())?;
    let handle = receiver
        .recv()
        .map_err(|_| "CoreLocation-Aufruf fehlgeschlagen")??;
    *manager_slot = Some(handle);
    Ok(())
}

#[cfg(target_os = "macos")]
fn current(state: tauri::State<LocationState>) -> Result<Fix, String> {
    use objc2_core_location::CLAuthorizationStatus;
    let manager_slot = state.manager.lock().unwrap();
    let handle = manager_slot
        .as_ref()
        .ok_or("Standortdienst nicht gestartet")?;
    let manager = &handle.0;
    unsafe {
        let status = manager.authorizationStatus();
        if status == CLAuthorizationStatus::Denied || status == CLAuthorizationStatus::Restricted {
            return Err("Standortzugriff verweigert".into());
        }
        if status == CLAuthorizationStatus::NotDetermined {
            return Err("Standortfreigabe noch nicht erteilt".into());
        }
        let location = manager.location().ok_or("Noch keine Position")?;
        if location.horizontalAccuracy() < 0.0 {
            return Err("Noch keine Position".into());
        }
        let timestamp = location.timestamp();
        let coordinate = location.coordinate();
        Ok(Fix {
            latitude: coordinate.latitude,
            longitude: coordinate.longitude,
            accuracy: location.horizontalAccuracy(),
            altitude: location.altitude(),
            altitude_accuracy: location.verticalAccuracy(),
            heading: location.course(),
            speed: location.speed(),
            timestamp: timestamp.timeIntervalSince1970() * 1000.0,
        })
    }
}

#[cfg(target_os = "macos")]
fn stop(state: tauri::State<LocationState>) -> Result<(), String> {
    if let Some(handle) = state.manager.lock().unwrap().take() {
        unsafe { handle.0.stopUpdatingLocation() };
    }
    Ok(())
}

#[cfg(not(target_os = "macos"))]
fn start(_app: tauri::AppHandle, _state: tauri::State<LocationState>) -> Result<(), String> {
    Err("Standortbestimmung läuft auf dieser Plattform über die Webview".into())
}

#[cfg(not(target_os = "macos"))]
fn current(_state: tauri::State<LocationState>) -> Result<Fix, String> {
    Err("Standortbestimmung läuft auf dieser Plattform über die Webview".into())
}

#[cfg(not(target_os = "macos"))]
fn stop(_state: tauri::State<LocationState>) -> Result<(), String> {
    Ok(())
}
