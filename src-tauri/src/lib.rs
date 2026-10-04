mod download;
mod geocoding;
mod location;
mod map_tiles;
mod store;
mod updates;
#[cfg(target_os = "android")]
include!(concat!(env!("OUT_DIR"), "/profiles.rs"));
use serde_json::{json, Value};
use std::{fs, path::PathBuf};
use store::{err, Result};
use tauri::{AppHandle, Manager, State};

#[tauri::command]
fn platform() -> &'static str {
    std::env::consts::OS
}

#[tauri::command]
async fn check_for_update(app: AppHandle) -> Result<updates::UpdateStatus> {
    let current_version = app.package_info().version.to_string();
    tauri::async_runtime::spawn_blocking(move || updates::check(&current_version))
        .await
        .map_err(err)?
}

struct LocalState {
    root: PathBuf,
}

fn java_compatible_path(path: &std::path::Path) -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        // Java's launcher cannot open JAR files through Windows verbatim paths
        // such as `\\?\C:\...`, which Tauri may return for resource files.
        return dunce::simplified(path).to_path_buf();
    }
    #[cfg(not(target_os = "windows"))]
    path.to_path_buf()
}

fn routing_failure(root: &std::path::Path, detail: impl AsRef<str>) -> String {
    let detail = detail.as_ref().trim();
    let log_path = root.join("last-routing-error.log");
    let report = format!(
        "RoadbookNavi routing diagnostic\nPlatform: {} {}\nData directory: {}\n\n{}\n",
        std::env::consts::OS,
        std::env::consts::ARCH,
        root.display(),
        detail
    );
    let log_note = if fs::write(&log_path, report).is_ok() {
        format!(" Diagnostic file: {}", log_path.display())
    } else {
        String::new()
    };
    let visible = if detail.chars().count() > 1200 {
        format!("{}…", detail.chars().take(1200).collect::<String>())
    } else {
        detail.to_owned()
    };
    format!("{visible}{log_note}")
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
    Ok(json!({"profiles":profiles}))
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
#[tauri::command]
fn geographic_cache_usage(state: State<LocalState>) -> Value {
    json!({
        "mapTiles": dir_size(&state.root.join("map-tiles")),
        "routing": dir_size(&state.root.join("engine/segments4"))
    })
}
#[tauri::command]
fn clear_geographic_cache(state: State<LocalState>, kind: String) -> Result<()> {
    let path = match kind.as_str() {
        "mapTiles" => state.root.join("map-tiles"),
        "routing" => state.root.join("engine/segments4"),
        _ => return Err("Unbekannter Cache".into()),
    };
    if path.exists() {
        fs::remove_dir_all(path).map_err(err)?;
    }
    Ok(())
}
#[tauri::command]
async fn get_map_tile(state: State<'_, LocalState>, z: u8, x: u32, y: u32) -> Result<Value> {
    let root = state.root.clone();
    tauri::async_runtime::spawn_blocking(move || map_tiles::tile(&root, z, x, y))
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
    let points: Vec<(f64, f64)> = lonlats
        .split('|')
        .map(|point| {
            let (lon, lat) = point.split_once(',').ok_or("Ungültiger Wegpunkt")?;
            Ok((
                lon.parse::<f64>().map_err(err)?,
                lat.parse::<f64>().map_err(err)?,
            ))
        })
        .collect::<Result<_>>()?;
    if points.len() < 2 {
        return Err("Mindestens zwei Wegpunkte setzen".into());
    }
    let root = state.root.join("engine");
    tauri::async_runtime::spawn_blocking(move || {
        download::ensure(&app, &root, &points)?;
        for _ in 0..8 {
            let result: Result<String> = (|| {
                #[cfg(target_os = "android")]
                {
                    tauri_plugin_brouter::route(
                        &app,
                        root.to_str().ok_or("Ungültiger Pfad")?,
                        &profile,
                        &lonlats,
                        &polygons,
                    )
                }
                #[cfg(not(target_os = "android"))]
                {
                    use std::{
                        io::Write,
                        process::{Command, Stdio},
                    };
                    let resources = app.path().resource_dir().map_err(err)?.join("engine");
                    let java =
                        java_compatible_path(&resources.join(if cfg!(target_os = "windows") {
                            "runtime/bin/java.exe"
                        } else {
                            "runtime/bin/java"
                        }));
                    let jar = java_compatible_path(&resources.join("brouter.jar"));
                    let routing_root = java_compatible_path(&root);
                    if !java.is_file() {
                        return Err(format!(
                            "Bundled Java runtime is missing: {}",
                            java.display()
                        ));
                    }
                    if !jar.is_file() {
                        return Err(format!(
                            "Bundled BRouter engine is missing: {}",
                            jar.display()
                        ));
                    }
                    let mut command = Command::new(java);
                    #[cfg(target_os = "windows")]
                    {
                        use std::os::windows::process::CommandExt;
                        command.creation_flags(0x08000000);
                    }
                    let mut child = command
                        .args(["-Xmx512m", "-Dfile.encoding=UTF-8", "-jar"])
                        .arg(&jar)
                        .arg(&routing_root)
                        .arg(&profile)
                        .stdin(Stdio::piped())
                        .stdout(Stdio::piped())
                        .stderr(Stdio::piped())
                        .spawn()
                        .map_err(|error| {
                            format!(
                                "Could not start the bundled routing engine ({}): {error}",
                                jar.display()
                            )
                        })?;
                    if let Some(mut input) = child.stdin.take() {
                        input
                            .write_all(format!("{lonlats}\n{polygons}\n").as_bytes())
                            .map_err(err)?;
                    }
                    let output = child.wait_with_output().map_err(err)?;
                    if !output.status.success() {
                        let stderr = String::from_utf8_lossy(&output.stderr);
                        let stdout = String::from_utf8_lossy(&output.stdout);
                        return Err(format!(
                            "BRouter exited with {}.\n{}{}",
                            output.status,
                            stderr.trim(),
                            if stdout.trim().is_empty() {
                                String::new()
                            } else {
                                format!("\nOutput: {}", stdout.trim())
                            }
                        ));
                    }
                    String::from_utf8(output.stdout).map_err(err)
                }
            })();
            match result {
                Ok(output) => {
                    return serde_json::from_str(&output).map_err(|error| {
                        routing_failure(
                            &root,
                            format!(
                                "BRouter returned invalid JSON: {error}\nOutput: {}",
                                output.chars().take(4000).collect::<String>()
                            ),
                        )
                    })
                }
                Err(error) => {
                    let Some(name) = download::missing_segment(&error) else {
                        return Err(routing_failure(&root, error));
                    };
                    download::ensure_named(&app, &root, &name)?;
                }
            }
        }
        Err(routing_failure(
            &root,
            "BRouter requested an unexpected number of additional routing segments",
        ))
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
            app.manage(LocalState { root });
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
            storage_usage,
            geographic_cache_usage,
            clear_geographic_cache,
            check_for_update,
            get_map_tile,
            geocode,
            calculate_route,
            location::location_start,
            location::location_current,
            location::location_stop
        ])
        .run(tauri::generate_context!())
        .expect("RoadbookNavi konnte nicht gestartet werden");
}
