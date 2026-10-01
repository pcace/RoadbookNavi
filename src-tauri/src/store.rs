use rusqlite::{params, Connection};
use serde_json::Value;
#[cfg(test)]
use serde_json::json;
use std::{fs, path::Path};

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
    if !["projects", "preferences"].contains(&table) {
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
    if !["projects", "preferences"].contains(&table) {
        return Err("Unbekannte Sammlung".into());
    }
    let id = key(value["id"].as_str().ok_or("ID fehlt")?)?;
    open(root)?.execute(&format!("INSERT INTO {table}(id,body) VALUES(?1,?2) ON CONFLICT(id) DO UPDATE SET body=excluded.body"), params![id,value.to_string()]).map_err(err)?;
    Ok(())
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
