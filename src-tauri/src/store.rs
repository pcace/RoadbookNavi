use crate::obf::Bridge;
use rusqlite::{params, Connection};
use serde_json::{json, Value};
use std::{
    fs,
    path::{Path, PathBuf},
};

pub type Result<T> = std::result::Result<T, String>;
pub fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}
pub fn key(value: &str) -> Result<&str> {
    if value.is_empty()
        || value.len() > 100
        || !value
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
    {
        return Err("Ungültiger Dateiname".into());
    }
    Ok(value)
}
pub fn open(root: &Path) -> Result<Connection> {
    fs::create_dir_all(root).map_err(err)?;
    let db = Connection::open(root.join("library.sqlite")).map_err(err)?;
    db.busy_timeout(std::time::Duration::from_secs(10))
        .map_err(err)?;
    db.execute_batch(
        "PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS regions(id TEXT PRIMARY KEY, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS preferences(id TEXT PRIMARY KEY, body TEXT NOT NULL);",
    )
    .map_err(err)?;
    Ok(db)
}
pub fn list_projects(root: &Path) -> Result<Vec<Value>> {
    list(root, "projects")
}
pub fn save_project(root: &Path, value: &Value) -> Result<()> {
    put(root, "projects", value)
}
pub fn delete_project(root: &Path, id: &str) -> Result<()> {
    open(root)?
        .execute("DELETE FROM projects WHERE id=?1", [key(id)?])
        .map_err(err)?;
    Ok(())
}
pub fn list(root: &Path, table: &str) -> Result<Vec<Value>> {
    if !["projects", "regions", "preferences"].contains(&table) {
        return Err("Unbekannte Sammlung".into());
    }
    let db = open(root)?;
    let mut stmt = db
        .prepare(&format!("SELECT body FROM {table} ORDER BY id"))
        .map_err(err)?;
    let rows = stmt.query_map([], |r| r.get::<_, String>(0)).map_err(err)?;
    rows.map(|r| serde_json::from_str(&r.map_err(err)?).map_err(err))
        .collect()
}
pub fn put(root: &Path, table: &str, value: &Value) -> Result<()> {
    if !["projects", "regions", "preferences"].contains(&table) {
        return Err("Unbekannte Sammlung".into());
    }
    let id = key(value["id"].as_str().ok_or("ID fehlt")?)?;
    open(root)?.execute(&format!("INSERT INTO {table}(id,body) VALUES(?1,?2) ON CONFLICT(id) DO UPDATE SET body=excluded.body"), params![id,value.to_string()]).map_err(err)?;
    Ok(())
}
pub fn region_path(root: &Path, region: &Value) -> Result<PathBuf> {
    let file = key(region["version"].as_str().ok_or("Gebietsversion fehlt")?)?;
    Ok(root.join("regions").join(format!("{file}.obf")))
}
/// Map features for the offline style, served by the resident OBF bridge.
/// `purpose` filters like before: `map-overview` keeps major roads, places and
/// water only; `map` and `detail` return everything the bridge whitelist has.
pub fn features(root: &Path, bridge: &Bridge, bbox: [f64; 4], purpose: &str) -> Result<Value> {
    let [w, s, e, n] = bbox;
    if !bbox.iter().all(|v| v.is_finite())
        || w > e
        || s > n
        || w < -180.
        || e > 180.
        || s < -90.
        || n > 90.
    {
        return Err("Ungültiger Kartenausschnitt".into());
    }
    match purpose {
        "map" | "map-overview" | "detail" => {}
        _ => return Err("Unbekannte Abfrage".into()),
    }
    let mut files: Vec<PathBuf> = vec![];
    for region in list(root, "regions")? {
        if let Some(bounds) = region["bbox"].as_array() {
            if bounds.len() == 4 {
                let rw = bounds[0].as_f64().unwrap_or(-180.);
                let rs = bounds[1].as_f64().unwrap_or(-90.);
                let re = bounds[2].as_f64().unwrap_or(180.);
                let rn = bounds[3].as_f64().unwrap_or(90.);
                if re < w || rw > e || rn < s || rs > n {
                    continue;
                }
            }
        }
        let path = region_path(root, &region)?;
        if path.exists() {
            files.push(path);
        }
    }
    if files.is_empty() {
        return Ok(json!({"type":"FeatureCollection","features":[],"truncated":false}));
    }
    bridge.query(&files, bbox, purpose, 20001).map_err(err)
}
/// Structured place/street search (city → street) from the OBF Address section.
pub fn search(root: &Path, bridge: &Bridge, query: &str) -> Result<Vec<Value>> {
    if query.chars().count() < 2 {
        return Ok(vec![]);
    }
    let files: Vec<PathBuf> = list(root, "regions")?
        .into_iter()
        .map(|region| region_path(root, &region))
        .filter(|path| matches!(path, Ok(p) if p.exists()))
        .collect::<Result<Vec<PathBuf>>>()?;
    if files.is_empty() {
        return Ok(vec![]);
    }
    bridge.search(&files, query, 40).map_err(err)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn ids_cannot_escape_storage() {
        for bad in ["../a", "/tmp/a", "a.b", "a/b", ""] {
            assert!(key(bad).is_err());
        }
        assert!(key("route-123_4").is_ok());
    }
    #[test]
    fn saved_project_survives_reopen() {
        let tmp = tempfile::tempdir().unwrap();
        let p = json!({"id":"route-1","name":"Gravel","revision":1});
        put(tmp.path(), "projects", &p).unwrap();
        assert_eq!(list(tmp.path(), "projects").unwrap(), vec![p]);
        put(
            tmp.path(),
            "projects",
            &json!({"id":"route-1","revision":2}),
        )
        .unwrap();
        assert_eq!(list(tmp.path(), "projects").unwrap().len(), 1);
    }
}
