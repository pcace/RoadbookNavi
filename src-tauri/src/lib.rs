mod download;
mod geocoding;
mod location;
mod obf;
mod osm;
mod store;
#[cfg(target_os = "android")]
include!(concat!(env!("OUT_DIR"), "/profiles.rs"));
use serde_json::{json, Value};
use std::{
    fs,
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
};
use store::{err, Result};
use tauri::{AppHandle, Manager, State};

#[tauri::command]
fn platform() -> &'static str {
    std::env::consts::OS
}

struct LocalState {
    root: PathBuf,
    cancel: Arc<AtomicBool>,
    busy: Arc<AtomicBool>,
    aborted: Arc<AtomicBool>,
}

fn dir_size(path: &PathBuf) -> u64 {
    let mut total = 0u64;
    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_dir() {
                total += dir_size(&p)
            } else if let Ok(m) = entry.metadata() {
                if m.is_file() {
                    total += m.len()
                }
            }
        }
    }
    total
}
#[tauri::command]
fn library(state: State<LocalState>) -> Result<Value> {
    let mut profiles = vec![];
    for item in fs::read_dir(state.root.join("engine/profiles2")).map_err(err)? {
        let path = item.map_err(err)?.path();
        if path.extension().is_some_and(|x| x == "brf") {
            profiles.push(path.file_stem().unwrap().to_string_lossy().to_string());
        }
    }
    profiles.sort();
    let mut regions = store::list(&state.root, "regions")?;
    for region in regions.iter_mut() {
        let size = store::region_path(&state.root, region)
            .map(|p| fs::metadata(p).map(|m| m.len()).unwrap_or(0))
            .unwrap_or(0);
        region["size"] = json!(size);
    }
    Ok(json!({"regions":regions,"profiles":profiles}))
}
#[tauri::command]
fn list_projects(state: State<LocalState>) -> Result<Vec<Value>> {
    store::list_projects(&state.root)
}
#[tauri::command]
fn save_project(state: State<LocalState>, project: Value) -> Result<()> {
    if project["schemaVersion"] != 1
        || !project["waypoints"].is_array()
        || !project["name"].is_string()
    {
        return Err("Ungültiges Projektformat".into());
    }
    store::save_project(&state.root, &project)
}
#[tauri::command]
fn delete_project(state: State<LocalState>, id: String) -> Result<()> {
    store::delete_project(&state.root, &id)
}
#[tauri::command]
fn import_profile(state: State<LocalState>, name: String, content: String) -> Result<()> {
    store::key(&name)?;
    if content.len() > 1024 * 1024 || !content.contains("---context:global") {
        return Err("Keine gültige BRouter-Profildatei".into());
    }
    fs::write(
        state
            .root
            .join("engine/profiles2")
            .join(format!("{name}.brf")),
        content,
    )
    .map_err(err)
}
#[tauri::command]
async fn get_catalogue(state: State<'_, LocalState>, refresh: bool) -> Result<Value> {
    let root = state.root.clone();
    tauri::async_runtime::spawn_blocking(move || download::catalogue(&root, refresh))
        .await
        .map_err(err)?
}
#[tauri::command]
fn storage_usage(state: State<LocalState>) -> Result<Value> {
    #[cfg(unix)]
    fn available(path: &std::path::Path) -> u64 {
        let c = path.to_str().and_then(|s| std::ffi::CString::new(s).ok());
        if let Some(c) = c {
            unsafe {
                let mut st: libc::statvfs = std::mem::zeroed();
                if libc::statvfs(c.as_ptr(), &mut st) == 0 {
                    return st.f_bavail as u64 * st.f_frsize as u64;
                }
            }
        }
        0
    }
    #[cfg(not(unix))]
    fn available(_: &std::path::Path) -> u64 {
        0
    }
    Ok(json!({"available":available(&state.root),"total":dir_size(&state.root)}))
}
// Cache PBF Content-Length values because the Geofabrik catalogue omits sizes.
// Query up to eight allowed hosts concurrently.
#[tauri::command]
async fn catalogue_sizes(state: State<'_, LocalState>, urls: Vec<String>) -> Result<Value> {
    let root = state.root.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let cache_path = root.join("catalogue-sizes.json");
        let mut cache: Value = fs::read(&cache_path)
            .ok()
            .and_then(|b| serde_json::from_slice(&b).ok())
            .unwrap_or(json!({}));
        // Cached zeros are stale poison from the old HEAD-based sizing — treat them as missing.
        let missing: Vec<String> = urls
            .into_iter()
            .filter(|u| cache[u.as_str()].as_u64().unwrap_or(0) == 0)
            .collect();
        for batch in missing.chunks(8) {
            let results: Vec<(String, Option<u64>)> = std::thread::scope(|s| {
                batch
                    .iter()
                    .map(|u| {
                        s.spawn(move || {
                            if let Ok(parsed) = reqwest::Url::parse(u) {
                                if parsed.scheme() == "https"
                                    && download::is_allowed_host(parsed.host_str().unwrap_or(""))
                                {
                                    return (
                                        u.clone(),
                                        download::content_length(parsed.as_str()).ok().flatten(),
                                    );
                                }
                            }
                            (u.clone(), None)
                        })
                    })
                    .collect::<Vec<_>>()
                    .into_iter()
                    .map(|h| h.join())
                    .filter_map(|r| r.ok())
                    .collect()
            });
            for (u, len) in results {
                if let Some(len) = len.filter(|l| *l > 0) {
                    cache[u.as_str()] = json!(len);
                }
            }
        }
        let tmp = cache_path.with_extension("json.tmp");
        if fs::write(&tmp, serde_json::to_vec(&cache).map_err(err)?).is_ok() {
            let _ = fs::rename(&tmp, &cache_path);
        }
        Ok(json!({"sizes":cache}))
    })
    .await
    .map_err(err)?
}
#[tauri::command]
fn download_status(state: State<LocalState>) -> Option<Value> {
    let mut value = match download::status(&state.root) {
        Some(v) => v,
        None => json!({}),
    };
    value["active"] = json!(state.busy.load(Ordering::SeqCst));
    value["queue"] = json!(download::read_queue(&state.root));
    if value.get("phase").is_none() {
        if value["queue"].as_array().is_some_and(|q| !q.is_empty()) {
            value["phase"] = json!("Warteschlange")
        } else {
            return None;
        }
    }
    Some(value)
}
#[tauri::command]
fn cancel_download(state: State<LocalState>) {
    state.cancel.store(true, Ordering::Relaxed);
}
#[tauri::command]
fn abort_install(app: AppHandle, state: State<LocalState>) {
    state.aborted.store(true, Ordering::Relaxed);
    state.cancel.store(true, Ordering::Relaxed);
    // Cancellation affects both the active operation and the queue.
    let _ = download::write_queue(&state.root, vec![]);
    // If no operation is active after an error or an app restart while paused,
    // discard stale state so the cancel button always has a visible effect.
    // Remove cache directories and partial targets from the previous operation.
    if !state.busy.load(Ordering::SeqCst) {
        if let Ok(root) = app.path().app_data_dir() {
            let status = download::status(&root).unwrap_or(json!({}));
            if let Some(id) = status["region"]["id"].as_str() {
                if let Ok(key) = store::key(id) {
                    let _ = fs::remove_dir_all(root.join("downloads").join(key));
                }
            }
            if let Ok(entries) = fs::read_dir(root.join("regions")) {
                for entry in entries.flatten() {
                    let p = entry.path();
                    if p.extension().is_some_and(|x| x == "part") {
                        let _ = fs::remove_file(p);
                    }
                }
            }
            let _ = fs::write(
                root.join("download-status.json"),
                serde_json::to_vec(&json!({"phase":"Abgebrochen","current":0,"total":null}))
                    .unwrap_or_default(),
            );
        }
    }
}
#[tauri::command]
async fn install_region(
    app: AppHandle,
    state: State<'_, LocalState>,
    region: Value,
) -> Result<Value> {
    // Queue and deduplicate a region when another download is already active.
    if state.busy.swap(true, Ordering::SeqCst) {
        let position = download::enqueue(&state.root, &region).map_err(err)?;
        return Ok(json!({"queued":true,"position":position}));
    }
    state.cancel.store(false, Ordering::SeqCst);
    state.aborted.store(false, Ordering::SeqCst);
    let root = state.root.clone();
    let cancel = state.cancel.clone();
    let busy = state.busy.clone();
    let aborted = state.aborted.clone();
    // Install the requested region, then process the queue in FIFO order.
    // A failed region does not block later items. Pausing preserves the queue;
    // cancellation clears it.
    tauri::async_runtime::spawn(async move {
        let mut current = Some(region);
        loop {
            let Some(region_to_install) = current.take() else {
                break;
            };
            let app2 = app.clone();
            let root2 = root.clone();
            let c2 = cancel.clone();
            let a2 = aborted.clone();
            let outcome = tauri::async_runtime::spawn_blocking(move || {
                download::install(&app2, &root2, region_to_install, c2, a2)
            })
            .await
            .map_err(err);
            if cancel.load(Ordering::SeqCst) || aborted.load(Ordering::SeqCst) {
                break;
            }
            if let Err(failure) = outcome {
                download::progress_detail(&app, "Fehler", 0, None, Some(format!("{failure}")));
            }
            current = download::dequeue(&root);
        }
        busy.store(false, Ordering::SeqCst);
    });
    Ok(json!({"queued":false}))
}
#[tauri::command]
fn remove_queued_region(state: State<LocalState>, id: String) -> Result<()> {
    download::remove_queued(&state.root, &id).map_err(err)
}
#[tauri::command]
fn remove_region(state: State<LocalState>, id: String) -> Result<()> {
    if state.busy.load(Ordering::SeqCst) {
        return Err("Download zuerst beenden".into());
    }
    if let Some(region) = store::list(&state.root, "regions")?
        .into_iter()
        .find(|r| r["id"] == id)
    {
        store::open(&state.root)?
            .execute("DELETE FROM regions WHERE id=?1", [store::key(&id)?])
            .map_err(err)?;
        fs::remove_file(store::region_path(&state.root, &region)?).map_err(err)?;
        // Shared routing segments are intentionally retained for other regions.
    }
    Ok(())
}
#[tauri::command]
async fn query_features(
    state: State<'_, LocalState>,
    bbox: [f64; 4],
    purpose: String,
) -> Result<Value> {
    let root = state.root.clone();
    tauri::async_runtime::spawn_blocking(move || store::features(&root, bbox, &purpose))
        .await
        .map_err(err)?
}
#[tauri::command]
async fn search_places(state: State<'_, LocalState>, query: String) -> Result<Vec<Value>> {
    let root = state.root.clone();
    tauri::async_runtime::spawn_blocking(move || store::search(&root, &query))
        .await
        .map_err(err)?
}
#[tauri::command]
async fn geocode(
    state: State<'_, LocalState>,
    base: String,
    key: String,
    operation: String,
    query: String,
    lat: f64,
    lon: f64,
    language: String,
) -> Result<Value> {
    let root = state.root.clone();
    tauri::async_runtime::spawn_blocking(move || {
        geocoding::lookup(&root, &base, &key, &operation, &query, lat, lon, &language)
    })
    .await
    .map_err(err)?
}
#[tauri::command]
async fn calculate_route(
    app: AppHandle,
    state: State<'_, LocalState>,
    profile: String,
    lonlats: String,
    polygons: String,
) -> Result<Value> {
    store::key(&profile)?;
    if lonlats.len() > 200000
        || polygons.len() > 10000000
        || lonlats.contains('\n')
        || polygons.contains('\n')
    {
        return Err("Routinganfrage ungültig oder zu groß".into());
    }
    let root = state.root.join("engine");
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(target_os = "android")]
        let output = tauri_plugin_brouter::route(
            &app,
            root.to_str().ok_or("Ungültiger Pfad")?,
            &profile,
            &lonlats,
            &polygons,
        )?;
        #[cfg(not(target_os = "android"))]
        let output = {
            use std::{
                io::Write,
                process::{Command, Stdio},
            };
            let resources = app.path().resource_dir().map_err(err)?.join("engine");
            let java = resources.join(if cfg!(target_os = "windows") {
                "runtime/bin/java.exe"
            } else {
                "runtime/bin/java"
            });
            let mut command = Command::new(java);
            #[cfg(target_os = "windows")]
            {
                use std::os::windows::process::CommandExt;
                command.creation_flags(0x08000000);
            }
            let mut child = command
                .args(["-Xmx512m", "-jar"])
                .arg(resources.join("brouter.jar"))
                .arg(&root)
                .arg(&profile)
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
                .map_err(err)?;
            if let Some(mut input) = child.stdin.take() {
                input
                    .write_all(format!("{lonlats}\n{polygons}\n").as_bytes())
                    .map_err(err)?;
            }
            let result = child.wait_with_output().map_err(err)?;
            if !result.status.success() {
                return Err(String::from_utf8_lossy(&result.stderr).into_owned());
            }
            String::from_utf8(result.stdout).map_err(err)?
        };
        serde_json::from_str(&output).map_err(err)
    })
    .await
    .map_err(err)?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_geolocation::init())
        .plugin(tauri_plugin_brouter::init())
        .setup(|app| {
            let root = app.path().app_data_dir()?;
            fs::create_dir_all(root.join("engine/profiles2"))?;
            store::open(&root)?;
            #[cfg(not(target_os = "android"))]
            {
                let resources = app.path().resource_dir()?.join("engine/profiles2");
                for item in fs::read_dir(resources)? {
                    let path = item?.path();
                    if path.is_file() {
                        let dest = root
                            .join("engine/profiles2")
                            .join(path.file_name().unwrap());
                        if !dest.exists() {
                            fs::copy(path, dest)?;
                        }
                    }
                }
            }
            #[cfg(target_os = "android")]
            for (name, content) in BUNDLED_PROFILES {
                let dest = root.join("engine/profiles2").join(name);
                if !dest.exists() {
                    fs::write(dest, content)?;
                }
            }
            app.manage(LocalState {
                root,
                cancel: Arc::new(AtomicBool::new(false)),
                busy: Arc::new(AtomicBool::new(false)),
                aborted: Arc::new(AtomicBool::new(false)),
            });
            app.manage(location::LocationState::default());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_projects,
            platform,
            library,
            save_project,
            delete_project,
            import_profile,
            get_catalogue,
            storage_usage,
            catalogue_sizes,
            download_status,
            cancel_download,
            abort_install,
            install_region,
            remove_region,
            query_features,
            search_places,
            geocode,
            calculate_route,
            remove_queued_region,
            location::location_start,
            location::location_current,
            location::location_stop
        ])
        .run(tauri::generate_context!())
        .expect("RoadbookNavi konnte nicht gestartet werden");
}
