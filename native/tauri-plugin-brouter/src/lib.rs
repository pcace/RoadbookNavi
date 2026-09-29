#[cfg(target_os = "android")]
use tauri::{plugin::PluginHandle, Manager};
use tauri::{
    plugin::{Builder, TauriPlugin},
    Runtime,
};

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("brouter")
        .setup(|_app, _api| {
            #[cfg(target_os = "android")]
            _app.manage(_api.register_android_plugin("de.roadbooknavi.routing", "BrouterPlugin")?);
            Ok(())
        })
        .build()
}

#[cfg(target_os = "android")]
pub fn route<R: Runtime>(
    app: &tauri::AppHandle<R>,
    root: &str,
    profile: &str,
    lonlats: &str,
    polygons: &str,
) -> Result<String, String> {
    let handle = app.state::<PluginHandle<R>>();
    let result: serde_json::Value = handle.run_mobile_plugin("route", serde_json::json!({"root":root,"profile":profile,"lonlats":lonlats,"polygons":polygons})).map_err(|e|e.to_string())?;
    result["geojson"]
        .as_str()
        .map(str::to_owned)
        .ok_or("BRouter lieferte keine Route".into())
}
