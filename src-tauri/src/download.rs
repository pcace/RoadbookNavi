//! On-demand BRouter segment downloads.
//!
//! Routing data is shared by every roadbook and downloaded only when a route
//! reaches a previously unseen 5° × 5° segment.

use crate::store::{err, Result};
use std::{
    collections::BTreeSet,
    fs,
    io::{Read, Write},
    path::Path,
    time::Duration,
};
use tauri::{AppHandle, Emitter};

const SEGMENT_BASE: &str = "https://brouter.de/brouter/segments4";

fn segment_component(value: f64, positive: char, negative: char) -> String {
    let base = (value / 5.).floor() as i32 * 5;
    format!(
        "{}{}",
        if base < 0 { negative } else { positive },
        base.abs()
    )
}

pub fn segment_name(lon: f64, lat: f64) -> Result<String> {
    if !lon.is_finite()
        || !lat.is_finite()
        || !(-180.0..=180.0).contains(&lon)
        || !(-90.0..=90.0).contains(&lat)
    {
        return Err("Ungültige Routingkoordinate".into());
    }
    Ok(format!(
        "{}_{}.rd5",
        segment_component(lon, 'E', 'W'),
        segment_component(lat, 'N', 'S')
    ))
}

pub fn segment_names(points: &[(f64, f64)]) -> Result<Vec<String>> {
    if points.is_empty() {
        return Err("Keine Routingkoordinaten".into());
    }
    let (mut west, mut east, mut south, mut north) = (180.0f64, -180.0f64, 90.0f64, -90.0f64);
    for &(lon, lat) in points {
        segment_name(lon, lat)?;
        west = west.min(lon);
        east = east.max(lon);
        south = south.min(lat);
        north = north.max(lat);
    }
    let mut names = BTreeSet::new();
    let mut lon = (west / 5.).floor() as i32 * 5;
    let max_lon = (east / 5.).floor() as i32 * 5;
    while lon <= max_lon {
        let mut lat = (south / 5.).floor() as i32 * 5;
        let max_lat = (north / 5.).floor() as i32 * 5;
        while lat <= max_lat {
            names.insert(format!(
                "{}{}_{}{}.rd5",
                if lon < 0 { 'W' } else { 'E' },
                lon.abs(),
                if lat < 0 { 'S' } else { 'N' },
                lat.abs()
            ));
            lat += 5;
        }
        lon += 5;
    }
    if names.len() > 64 {
        return Err("Die Route umfasst zu viele Routingsegmente".into());
    }
    Ok(names.into_iter().collect())
}

pub fn valid_segment_name(name: &str) -> bool {
    let Some((lon, lat)) = name.strip_suffix(".rd5").and_then(|v| v.split_once('_')) else {
        return false;
    };
    let valid = |value: &str, positive: char, negative: char| {
        value.len() >= 2
            && matches!(value.chars().next(), Some(c) if c == positive || c == negative)
            && value[1..].chars().all(|c| c.is_ascii_digit())
    };
    valid(lon, 'E', 'W') && valid(lat, 'N', 'S')
}

fn emit(app: &AppHandle, name: &str, current: u64, total: Option<u64>) {
    let _ = app.emit(
        "routing-data-progress",
        serde_json::json!({ "name": name, "current": current, "total": total }),
    );
}

fn download_segment(app: &AppHandle, directory: &Path, name: &str) -> Result<()> {
    if !valid_segment_name(name) {
        return Err("Ungültiger Routingsegmentname".into());
    }
    fs::create_dir_all(directory).map_err(err)?;
    let target = directory.join(name);
    if target
        .metadata()
        .is_ok_and(|metadata| metadata.len() > 1024)
    {
        return Ok(());
    }
    let partial = target.with_extension("rd5.part");
    let resume_file = target.with_extension("rd5.resume.json");
    let resume: serde_json::Value = fs::read(&resume_file)
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or(serde_json::Value::Null);
    let url = format!("{SEGMENT_BASE}/{name}");
    let validator = resume["validator"]
        .as_str()
        .filter(|_| resume["url"] == url);
    let offset = if validator.is_some() {
        partial
            .metadata()
            .map(|metadata| metadata.len())
            .unwrap_or(0)
    } else {
        0
    };
    let client = reqwest::blocking::Client::builder()
        .user_agent("RoadbookNavi/1.0 (+https://github.com/pcace/RoadbookNavi)")
        .connect_timeout(Duration::from_secs(30))
        .timeout(Duration::from_secs(3600))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(err)?;
    let mut request = client.get(&url);
    if offset > 0 {
        request = request
            .header(reqwest::header::RANGE, format!("bytes={offset}-"))
            .header(reqwest::header::IF_RANGE, validator.unwrap());
    }
    let mut response = request.send().map_err(err)?;
    if response.status() == reqwest::StatusCode::RANGE_NOT_SATISFIABLE {
        fs::remove_file(&partial).map_err(err)?;
        return download_segment(app, directory, name);
    }
    response = response.error_for_status().map_err(err)?;
    let append = response.status() == reqwest::StatusCode::PARTIAL_CONTENT;
    let start = if append { offset } else { 0 };
    let total = response.content_length().map(|length| length + start);
    let new_validator = response
        .headers()
        .get(reqwest::header::ETAG)
        .and_then(|value| value.to_str().ok())
        .filter(|value| !value.starts_with("W/"))
        .or_else(|| {
            response
                .headers()
                .get(reqwest::header::LAST_MODIFIED)
                .and_then(|value| value.to_str().ok())
        })
        .map(str::to_owned);
    fs::write(
        &resume_file,
        serde_json::to_vec(&serde_json::json!({
            "url": url,
            "validator": new_validator
        }))
        .map_err(err)?,
    )
    .map_err(err)?;
    let mut file = fs::OpenOptions::new()
        .create(true)
        .write(true)
        .append(append)
        .truncate(!append)
        .open(&partial)
        .map_err(err)?;
    let mut buffer = [0u8; 128 * 1024];
    let mut current = start;
    emit(app, name, current, total);
    loop {
        let size = response.read(&mut buffer).map_err(err)?;
        if size == 0 {
            break;
        }
        file.write_all(&buffer[..size]).map_err(err)?;
        current += size as u64;
        emit(app, name, current, total);
    }
    file.sync_all().map_err(err)?;
    if current <= 1024 || total.is_some_and(|expected| expected != current) {
        return Err(format!(
            "Routingsegment {name} wurde nicht vollständig geladen"
        ));
    }
    fs::rename(partial, target).map_err(err)?;
    let _ = fs::remove_file(resume_file);
    Ok(())
}

pub fn ensure(app: &AppHandle, root: &Path, points: &[(f64, f64)]) -> Result<()> {
    let directory = root.join("segments4");
    for name in segment_names(points)? {
        download_segment(app, &directory, &name)?;
    }
    Ok(())
}

pub fn ensure_named(app: &AppHandle, root: &Path, name: &str) -> Result<()> {
    download_segment(app, &root.join("segments4"), name)
}

pub fn missing_segment(error: &str) -> Option<String> {
    error
        .split(|c: char| c.is_whitespace() || matches!(c, '\'' | '"' | ':' | ',' | '(' | ')'))
        .find(|word| valid_segment_name(word))
        .map(str::to_owned)
}

pub fn sweep_legacy(root: &Path) {
    for name in [
        "regions",
        "downloads",
        "catalogue.json",
        "download-status.json",
        "download-queue.json",
    ] {
        let path = root.join(name);
        if path.is_dir() {
            let _ = fs::remove_dir_all(path);
        } else {
            let _ = fs::remove_file(path);
        }
    }
    if let Ok(db) = crate::store::open(root) {
        let _ = db.execute("DROP TABLE IF EXISTS regions", []);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn derives_and_validates_segments() {
        assert_eq!(segment_name(7.1, 47.2).unwrap(), "E5_N45.rd5");
        assert_eq!(segment_name(-47.1, 37.2).unwrap(), "W50_N35.rd5");
        assert!(valid_segment_name("E5_N45.rd5"));
        assert!(!valid_segment_name("../E5_N45.rd5"));
        assert_eq!(
            missing_segment("datafile E10_N50.rd5 not found").as_deref(),
            Some("E10_N50.rd5")
        );
    }
    #[test]
    fn includes_segments_between_distant_waypoints() {
        assert_eq!(
            segment_names(&[(7.0, 47.0), (11.0, 51.0)]).unwrap().len(),
            4
        );
    }
}
