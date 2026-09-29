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
    Ok(root.join("regions").join(format!("{file}.sqlite")))
}
pub fn features(root: &Path, bbox: [f64; 4], purpose: &str) -> Result<Value> {
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
    let filter = match purpose {
        "map-overview" => " AND f.kind IN ('major-road','place','water')",
        "map" | "detail" => "",
        _ => return Err("Unbekannte Abfrage".into()),
    };
    let mut found = std::collections::BTreeMap::new();
    let mut truncated = false;
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
        let db = Connection::open_with_flags(
            region_path(root, &region)?,
            rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
        )
        .map_err(err)?;
        let mut stmt = db.prepare(&format!("SELECT f.osm_id,f.body FROM features f JOIN bounds b ON f.id=b.id WHERE b.maxx>=?1 AND b.minx<=?3 AND b.maxy>=?2 AND b.miny<=?4 {filter} LIMIT 20001")).map_err(err)?;
        let rows = stmt
            .query_map(params![w, s, e, n], |r| {
                Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))
            })
            .map_err(err)?;
        for (i, row) in rows.enumerate() {
            if i == 20000 {
                truncated = true;
                break;
            }
            let (id, body) = row.map_err(err)?;
            found
                .entry(id)
                .or_insert(serde_json::from_str::<Value>(&body).map_err(err)?);
        }
    }
    if truncated && purpose != "map" && purpose != "map-overview" {
        return Err("Zu viele Geometrien. Kleineres Gebiet wählen.".into());
    }
    Ok(
        json!({"type":"FeatureCollection","features":found.into_values().collect::<Vec<_>>(),"truncated":truncated}),
    )
}
pub fn search(root: &Path, query: &str) -> Result<Vec<Value>> {
    if query.chars().count() < 2 {
        return Ok(vec![]);
    }
    let text = query
        .to_lowercase()
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_");
    let mut output = vec![];
    for region in list(root, "regions")? {
        let db = Connection::open_with_flags(
            region_path(root, &region)?,
            rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
        )
        .map_err(err)?;
        let mut stmt = db.prepare("SELECT body FROM features WHERE name LIKE ?1 ESCAPE '\' ORDER BY CASE WHEN kind='place' THEN 0 ELSE 1 END LIMIT 20").map_err(err)?;
        let rows = stmt
            .query_map([format!("%{text}%")], |r| r.get::<_, String>(0))
            .map_err(err)?;
        for row in rows {
            output.push(serde_json::from_str(&row.map_err(err)?).map_err(err)?);
        }
    }
    output.truncate(40);
    Ok(output)
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
