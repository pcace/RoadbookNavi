use crate::{
    osm,
    store::{self, err, Result},
};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    fs::{self, File},
    io::{Read, Write},
    path::Path,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::Duration,
};
use tauri::{AppHandle, Emitter, Manager};

pub fn is_allowed_host(host: &str) -> bool {
    host == "brouter.de" || host.ends_with("geofabrik.de") || host.ends_with("gwdg.de")
}

pub fn client() -> Result<reqwest::blocking::Client> {
    // Do not set a global timeout. Large PBF files download in resumable chunks,
    // and each request applies its own timeout.
    reqwest::blocking::Client::builder()
        .user_agent("RoadbookNavi/1.0 (+https://roadbooknavi.de)")
        .connect_timeout(Duration::from_secs(30))
        .redirect(reqwest::redirect::Policy::custom(|attempt| {
            let url = attempt.url();
            if attempt.previous().len() > 5
                || url.scheme() != "https"
                || !is_allowed_host(url.host_str().unwrap_or(""))
            {
                attempt.stop()
            } else {
                attempt.follow()
            }
        }))
        .build()
        .map_err(err)
}
fn write_json(path: &Path, value: &Value) -> Result<()> {
    let temp = path.with_extension("json.tmp");
    let mut file = File::create(&temp).map_err(err)?;
    file.write_all(&serde_json::to_vec(value).map_err(err)?)
        .map_err(err)?;
    file.sync_all().map_err(err)?;
    fs::rename(temp, path).map_err(err)
}
/// File size of a downloadable URL. HEAD alone is not reliable here: Geofabrik
/// (and some CDNs) answer HEAD with Content-Length 0 (reqwest reports the
/// decoded body size, which is empty for HEAD). A 1-byte Range-GET carries the
/// real total in the Content-Range header instead.
pub fn content_length(url: &str) -> Result<Option<u64>> {
    let client = client()?;
    let response = client
        .get(url)
        .timeout(Duration::from_secs(30))
        .header(reqwest::header::RANGE, "bytes=0-0")
        .header(reqwest::header::ACCEPT_ENCODING, "identity")
        .send()
        .map_err(err)?
        .error_for_status()
        .map_err(err)?;
    if let Some(range) = response
        .headers()
        .get(reqwest::header::CONTENT_RANGE)
        .and_then(|v| v.to_str().ok())
    {
        if let Some((_, total)) = range.split_once('/') {
            if let Ok(total) = total.trim().parse::<u64>() {
                return Ok(Some(total));
            }
        }
    }
    Ok(response.content_length().filter(|l| *l > 0))
}

// ---------------------------------------------------------------------------
// Persist the region download queue in the app data directory across restarts.
// ---------------------------------------------------------------------------
pub fn read_queue(root: &Path) -> Vec<Value> {
    fs::read(root.join("download-queue.json"))
        .ok()
        .and_then(|s| serde_json::from_slice::<Value>(&s).ok())
        .and_then(|v| v.as_array().cloned())
        .unwrap_or_default()
}
pub fn write_queue(root: &Path, items: Vec<Value>) -> Result<()> {
    write_json(&root.join("download-queue.json"), &json!(items))
}
pub fn enqueue(root: &Path, region: &Value) -> Result<usize> {
    let mut items = read_queue(root);
    if items.iter().any(|r| r["id"] == region["id"]) {
        return Ok(items.len());
    }
    items.push(region.clone());
    let position = items.len();
    write_queue(root, items)?;
    Ok(position)
}
pub fn dequeue(root: &Path) -> Option<Value> {
    let mut items = read_queue(root);
    if items.is_empty() {
        return None;
    }
    let first = items.remove(0);
    write_queue(root, items).ok()?;
    Some(first)
}
pub fn remove_queued(root: &Path, id: &str) -> Result<()> {
    let items = read_queue(root);
    write_queue(
        root,
        items.into_iter().filter(|r| r["id"] != json!(id)).collect(),
    )
}

pub fn status(root: &Path) -> Option<Value> {
    fs::read(root.join("download-status.json"))
        .ok()
        .and_then(|s| serde_json::from_slice(&s).ok())
}
pub fn progress_detail(
    app: &AppHandle,
    phase: &str,
    current: u64,
    total: Option<u64>,
    detail: Option<String>,
) {
    if let Ok(root) = app.path().app_data_dir() {
        let mut state = status(&root).unwrap_or(json!({}));
        state["phase"] = json!(phase);
        state["current"] = json!(current);
        state["total"] = json!(total);
        state["detail"] = detail.map(|d| json!(d)).unwrap_or(Value::Null);
        let _ = write_json(&root.join("download-status.json"), &state);
        let _ = app.emit("region-progress", &state);
    }
}
pub fn progress(app: &AppHandle, phase: &str, current: u64, total: Option<u64>) {
    progress_detail(app, phase, current, total, None)
}
fn download(app: &AppHandle, url: &str, path: &Path, cancel: &AtomicBool) -> Result<String> {
    let parsed = reqwest::Url::parse(url).map_err(err)?;
    if parsed.scheme() != "https"
        || !["download.geofabrik.de", "brouter.de"].contains(&parsed.host_str().unwrap_or(""))
    {
        return Err("Nicht unterstützte Datenquelle".into());
    }
    download_file(
        url,
        path,
        cancel,
        |current, total| progress(app, "OSM herunterladen (1/3)", current, total),
        true,
    )
}
// Range requests use a server validator so a refreshed extract can never be appended to an older one.
fn download_file(
    url: &str,
    path: &Path,
    cancel: &AtomicBool,
    report: impl Fn(u64, Option<u64>),
    check_pbf: bool,
) -> Result<String> {
    let metadata = path.with_extension("resume.json");
    let complete = path.with_extension("complete.json");
    if path.exists() && complete.exists() {
        let value: Value =
            serde_json::from_slice(&fs::read(&complete).map_err(err)?).map_err(err)?;
        // The PBF signature only applies to OSM extracts — BRouter segment
        // files (.rd5) are a different binary format and must not be rejected.
        if value["url"] == url
            && value["length"].as_u64() == Some(fs::metadata(path).map_err(err)?.len())
            && (!check_pbf || pbf_header_ok(path))
        {
            if let Some(hash) = value["sha256"].as_str() {
                return Ok(hash.into());
            }
        }
    }
    let client = client()?;
    let mut failures = 0;
    loop {
        if cancel.load(Ordering::Relaxed) {
            return Err("Pausiert".into());
        }
        let previous: Value = fs::read(&metadata)
            .ok()
            .and_then(|v| serde_json::from_slice(&v).ok())
            .unwrap_or(Value::Null);
        let validator = previous["validator"]
            .as_str()
            .filter(|_| previous["url"] == url);
        let offset = if validator.is_some() {
            fs::metadata(path).map(|m| m.len()).unwrap_or(0)
        } else {
            0
        };
        let attempt = (|| -> Result<()> {
            let mut request = client
                .get(url)
                .timeout(Duration::from_secs(3600))
                .header(reqwest::header::ACCEPT_ENCODING, "identity");
            if offset > 0 {
                request = request
                    .header(reqwest::header::RANGE, format!("bytes={offset}-"))
                    .header(reqwest::header::IF_RANGE, validator.unwrap());
            }
            let mut response = request.send().map_err(err)?;
            if response.status() == reqwest::StatusCode::RANGE_NOT_SATISFIABLE {
                let _ = fs::remove_file(&metadata);
                return Err("Download wird neu gestartet".into());
            }
            response = response.error_for_status().map_err(err)?;
            if response.status().is_redirection() {
                return Err(format!("Nicht unterstützter Download-Server: Weiterleitung auf fremden Host blockiert ({status}).",status=response.status()));
            }
            let append = response.status() == reqwest::StatusCode::PARTIAL_CONTENT;
            let new_validator = response
                .headers()
                .get(reqwest::header::ETAG)
                .and_then(|h| h.to_str().ok())
                .filter(|s| !s.starts_with("W/"))
                .or_else(|| {
                    response
                        .headers()
                        .get(reqwest::header::LAST_MODIFIED)
                        .and_then(|h| h.to_str().ok())
                })
                .map(str::to_owned);
            if append {
                if !valid_range(
                    response
                        .headers()
                        .get(reqwest::header::CONTENT_RANGE)
                        .and_then(|h| h.to_str().ok()),
                    offset,
                ) {
                    return Err("Ungültige Download-Fortsetzung".into());
                }
                // Restart when the remote resource changed despite a range request.
                // Combining two PBF versions would corrupt the resume boundary.
                if new_validator.as_deref() != validator {
                    let _ = fs::remove_file(&metadata);
                    return Err("Die Quelle liefert eine andere Dateiversion als die Fortsetzungsbasis. Download wird neu gestartet.".into());
                }
            }
            let start = if append { offset } else { 0 };
            let total = if append {
                response
                    .headers()
                    .get(reqwest::header::CONTENT_RANGE)
                    .and_then(|v| v.to_str().ok())
                    .and_then(|v| v.split_once('/'))
                    .and_then(|(_, v)| v.parse::<u64>().ok())
            } else {
                response.content_length()
            };
            let mut file = fs::OpenOptions::new()
                .create(true)
                .write(true)
                .truncate(!append)
                .append(append)
                .open(path)
                .map_err(err)?;
            write_json(&metadata, &json!({"url":url,"validator":new_validator}))?;
            let mut bytes = [0u8; 256 * 1024];
            let mut current = start;
            let mut last = std::time::Instant::now();
            report(current, total);
            loop {
                if cancel.load(Ordering::Relaxed) {
                    file.sync_all().map_err(err)?;
                    return Err("Pausiert".into());
                }
                let n = response.read(&mut bytes).map_err(err)?;
                if n == 0 {
                    break;
                }
                file.write_all(&bytes[..n]).map_err(err)?;
                current += n as u64;
                if last.elapsed() > Duration::from_millis(500) {
                    report(current, total);
                    last = std::time::Instant::now();
                }
            }
            if current == 0 || total.is_some_and(|t| t != current) {
                return Err("Download unvollständig".into());
            }
            file.sync_all().map_err(err)?;
            report(current, Some(current));
            Ok(())
        })();
        match attempt {
            Ok(()) => break,
            Err(error) => {
                if cancel.load(Ordering::Relaxed) {
                    return Err("Pausiert".into());
                }
                let advanced = fs::metadata(path)
                    .map(|m| m.len() > offset)
                    .unwrap_or(false);
                if advanced {
                    failures = 0
                } else {
                    failures += 1
                }
                if failures >= 5 {
                    return Err(format!("{error}. Mit Fortsetzen erneut versuchen."));
                }
                for _ in 0..20 {
                    if cancel.load(Ordering::Relaxed) {
                        return Err("Pausiert".into());
                    }
                    std::thread::sleep(Duration::from_millis(100));
                }
            }
        }
    }
    if check_pbf && !pbf_header_ok(path) {
        let _ = fs::remove_file(&metadata);
        let size = fs::metadata(path).map(|m| m.len()).unwrap_or(0);
        let mut head = [0u8; 16];
        let preview = File::open(path)
            .ok()
            .and_then(|mut f| f.read_exact(&mut head).ok())
            .map(|_| {
                head.iter()
                    .map(|b| format!("{b:02x}"))
                    .collect::<Vec<_>>()
                    .join(" ")
            })
            .unwrap_or_default();
        return Err(format!("Die heruntergeladene Datei enthält keine gültigen OSM-Daten (kein PBF-Format). Größe: {size} B, Dateianfang: {preview}. Die Quelle hat vermutlich eine Fehler- oder Hinweisseite geliefert."));
    }
    let mut hash = Sha256::new();
    let mut file = File::open(path).map_err(err)?;
    let mut buf = [0u8; 256 * 1024];
    loop {
        if cancel.load(Ordering::Relaxed) {
            return Err("Pausiert".into());
        }
        let n = file.read(&mut buf).map_err(err)?;
        if n == 0 {
            break;
        }
        hash.update(&buf[..n]);
    }
    let checksum = format!("{:x}", hash.finalize());
    write_json(
        &complete,
        &json!({"url":url,"length":file.metadata().map_err(err)?.len(),"sha256":checksum}),
    )?;
    Ok(checksum)
}
fn valid_range(value: Option<&str>, offset: u64) -> bool {
    let parsed = (|| {
        let (range, total) = value?.strip_prefix("bytes ")?.split_once('/')?;
        let (start, end) = range.split_once('-')?;
        Some((
            start.parse::<u64>().ok()?,
            end.parse::<u64>().ok()?,
            total.parse::<u64>().ok()?,
        ))
    })();
    parsed.is_some_and(|(start, end, total)| start == offset && end >= start && end < total)
}

/// An OSM PBF starts with a four-byte big-endian blob length followed by
/// "OSMHeader". Validate it early so an HTTP error page produces a clear error.
fn pbf_header_ok(path: &Path) -> bool {
    // PBF layout: 4-byte big-endian BlobHeader length, then protobuf field
    // header 0a 09 (field 1, len 9) followed by the ASCII type "OSMHeader".
    let mut buf = [0u8; 16];
    match File::open(path).and_then(|mut f| f.read_exact(&mut buf)) {
        Ok(()) => {
            let len = u32::from_be_bytes([buf[0], buf[1], buf[2], buf[3]]);
            buf[4] == 0x0A && buf[5] == 0x09 && &buf[6..14] == b"OSMHeade" && len < 0x10000
        }
        Err(_) => false,
    }
}

#[cfg(test)]
mod pbf_header_tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn pbf_header_accepts_valid_header_blob() {
        // Real-world structure (verified against Geofabrik Bremen extract):
        // length=14, protobuf: 0a 09 "OSMHeader", datasize varint follows.
        let mut dir = std::env::temp_dir();
        dir.push(format!("rn-pbf-test-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("valid.osm.pbf");
        let mut f = File::create(&path).unwrap();
        f.write_all(&[
            0x00, 0x00, 0x00, 0x0e, 0x0a, 0x09, b'O', b'S', b'M', b'H', b'e', b'a', b'd', b'e',
            b'r', 0x18, 0xb5, 0x01, 0x78, 0x9c,
        ])
        .unwrap();
        assert!(pbf_header_ok(&path));
        // HTML error page must be rejected
        let bad = dir.join("invalid.osm.pbf");
        let mut f = File::create(&bad).unwrap();
        f.write_all(b"<!DOCTYPE html><html>404</html>").unwrap();
        assert!(!pbf_header_ok(&bad));
        let _ = fs::remove_dir_all(&dir);
    }
}

pub fn segment_names(bbox: [f64; 4]) -> Result<Vec<String>> {
    let [w, s, e, n] = bbox;
    if !bbox.iter().all(|v| v.is_finite())
        || w >= e
        || s >= n
        || w < -180.
        || e > 180.
        || s < -90.
        || n > 90.
    {
        return Err("Ungültiges Gebiet".into());
    }
    let mut names = vec![];
    let x0 = (w / 5.).floor() as i32 * 5;
    let x1 = ((e - 0.0000001) / 5.).floor() as i32 * 5;
    let y0 = (s / 5.).floor() as i32 * 5;
    let y1 = ((n - 0.0000001) / 5.).floor() as i32 * 5;
    for x in (x0..=x1).step_by(5) {
        for y in (y0..=y1).step_by(5) {
            names.push(format!(
                "{}{}_{}{}.rd5",
                if x < 0 { "W" } else { "E" },
                x.abs(),
                if y < 0 { "S" } else { "N" },
                y.abs()
            ));
        }
    }
    if names.len() > 16 {
        return Err("Bitte eine kleinere Region wählen (höchstens 16 Routingkacheln).".into());
    }
    Ok(names)
}

pub fn catalogue(root: &Path, refresh: bool) -> Result<Value> {
    let file = root.join("catalogue.json");
    if !refresh && file.exists() {
        return serde_json::from_slice(&fs::read(file).map_err(err)?).map_err(err);
    }
    let data: Value = client()?
        .get("https://download.geofabrik.de/index-v1.json")
        .timeout(Duration::from_secs(60))
        .send()
        .map_err(err)?
        .error_for_status()
        .map_err(err)?
        .json()
        .map_err(err)?;
    if !data["features"].is_array() {
        return Err("Ungültiger Gebietskatalog".into());
    }
    fs::write(&file, serde_json::to_vec(&data).map_err(err)?).map_err(err)?;
    Ok(data)
}

pub fn install(
    app: &AppHandle,
    root: &Path,
    region: Value,
    cancel: Arc<AtomicBool>,
    aborted: Arc<AtomicBool>,
) -> Result<Value> {
    let id = store::key(region["id"].as_str().ok_or("Gebiets-ID fehlt")?)?;
    let bbox: [f64; 4] = serde_json::from_value(region["bbox"].clone()).map_err(err)?;
    let segments = segment_names(bbox)?;
    let url = region["url"].as_str().ok_or("Downloadquelle fehlt")?;
    let cache = root.join("downloads").join(&id);
    fs::create_dir_all(&cache).map_err(err)?;
    let manifest = cache.join("job.json");
    let mut job: Value = fs::read(&manifest)
        .ok()
        .and_then(|v| serde_json::from_slice(&v).ok())
        .unwrap_or(json!({"version":uuid::Uuid::new_v4().to_string(),"region":region}));
    if job["region"] != region {
        return Err("Gespeicherter Download gehört zu einer anderen Gebietsversion".into());
    }
    let version = job["version"]
        .as_str()
        .ok_or("Ungültiger Downloadstatus")?
        .to_owned();
    store::key(&version)?;
    let dir = root.join("regions");
    fs::create_dir_all(&dir).map_err(err)?;
    let pbf = cache.join("OSM.osm.pbf.part");
    let temp = cache.join("import.sqlite.part");
    let target = dir.join(format!("{version}.sqlite"));
    write_json(&manifest, &job)?;
    write_json(
        &root.join("download-status.json"),
        &json!({"region":region,"phase":"OSM herunterladen (1/3)","current":0,"total":null}),
    )?;
    let result = (|| {
        let checksum = download(app, url, &pbf, &cancel)?;
        if job["stats"].is_null() || !target.exists() {
            let _ = fs::remove_file(&temp);
            progress(app, "OSM-Daten aufbereiten (2/3)", 0, None);
            let stats = osm::import(
                &pbf,
                &temp,
                &target,
                cancel.clone(),
                |phase, objects, current, total| {
                    progress_detail(
                        app,
                        phase,
                        current,
                        Some(total),
                        Some(format!("{objects} Objekte verarbeitet")),
                    )
                },
            )?;
            job["stats"] = stats;
            write_json(&manifest, &job)?;
        }
        let segment_dir = root.join("engine/segments4");
        fs::create_dir_all(&segment_dir).map_err(err)?;
        for (i, name) in segments.iter().enumerate() {
            let dest = segment_dir.join(name);
            if dest.exists() {
                continue;
            }
            let part = cache.join(format!("{name}.part"));
            let phase = format!("Routingdaten (3/3) · {}/{}", i + 1, segments.len());
            download_file(
                &format!("https://brouter.de/brouter/segments4/{name}"),
                &part,
                &cancel,
                |current, total| progress(app, &phase, current, total),
                false,
            )?;
            fs::rename(part, dest).map_err(err)?;
        }
        if cancel.load(Ordering::Relaxed) {
            return Err("Pausiert".into());
        }
        // osm::import writes the compact target with VACUUM INTO.
        let installed = json!({"id":id,"name":region["name"],"bbox":bbox,"geometry":region["geometry"],"version":version,"sha256":checksum,"stats":job["stats"],"segments":segments,"downloadedAt":std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_err(err)?.as_secs(),"source":url});
        let previous = store::list(root, "regions")?
            .into_iter()
            .find(|r| r["id"] == id);
        store::put(root, "regions", &installed)?;
        if let Some(old) = previous {
            if old["version"] != version {
                if let Ok(path) = store::region_path(root, &old) {
                    let _ = fs::remove_file(path);
                }
            }
        }
        Ok(installed)
    })();
    match &result {
        Ok(_) => {
            progress(app, "Fertig", 1, Some(1));
            let _ = fs::remove_dir_all(cache);
        }
        Err(error) => {
            if aborted.load(Ordering::Relaxed) {
                // Cancellation removes every partial file from this operation.
                let _ = fs::remove_dir_all(&cache);
                let _ = fs::remove_file(target.with_extension("sqlite.part"));
                let _ = write_json(
                    &root.join("download-status.json"),
                    &json!({"phase":"Abgebrochen","current":0,"total":null}),
                );
            } else {
                // Pausing preserves the resumable PBF download but removes
                // incomplete importer state, which cannot be resumed safely.
                let _ = fs::remove_file(&temp);
                let _ = fs::remove_file(target.with_extension("sqlite.part"));
                let mut state = status(root).unwrap_or(json!({}));
                state["error"] = json!(error);
                let _ = write_json(&root.join("download-status.json"), &state);
            }
        }
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn resumed_download_rejects_wrong_offset() {
        assert!(valid_range(Some("bytes 5-9/10"), 5));
        assert!(!valid_range(Some("bytes 0-9/10"), 5));
        assert!(!valid_range(None, 5));
    }
    #[test]
    fn interrupted_download_resumes_without_duplicate_bytes() {
        use std::net::TcpListener;
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let url = format!("http://{}/extract", listener.local_addr().unwrap());
        let server = std::thread::spawn(move || {
            for i in 0..2 {
                let (mut stream, _) = listener.accept().unwrap();
                stream
                    .set_read_timeout(Some(Duration::from_secs(10)))
                    .unwrap();
                let mut request = Vec::new();
                let mut byte = [0];
                while !request.ends_with(b"\r\n\r\n") {
                    stream.read_exact(&mut byte).unwrap();
                    request.push(byte[0]);
                }
                let request = String::from_utf8(request).unwrap().to_lowercase();
                if i == 0 {
                    stream.write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 22\r\nETag: \"v1\"\r\nConnection: close\r\n\r\n\x00\x00\x00\x0fOSMHeade").unwrap();
                } else {
                    assert!(request.contains("range: bytes=12-"));
                    assert!(request.contains("if-range: \"v1\""));
                    stream.write_all(b"HTTP/1.1 206 Partial Content\r\nContent-Length: 10\r\nContent-Range: bytes 12-21/22\r\nETag: \"v1\"\r\nConnection: close\r\n\r\nr-12345678").unwrap();
                }
            }
        });
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("extract.part");
        let hash = download_file(&url, &file, &AtomicBool::new(false), |_, _| {}, false).unwrap();
        server.join().unwrap();
        let expected: Vec<u8> = b"\x00\x00\x00\x0fOSMHeader-12345678".to_vec();
        assert_eq!(fs::read(&file).unwrap(), expected);
        assert_eq!(hash, format!("{:x}", Sha256::digest(&expected)));
        // A completed stage is reusable with the server already stopped.
        assert_eq!(
            download_file(&url, &file, &AtomicBool::new(false), |_, _| {}, false).unwrap(),
            hash
        );
    }
    #[test]
    fn tile_grid_uses_southwest_corner_and_handles_negative_values() {
        assert_eq!(
            segment_names([7., 47., 8., 48.]).unwrap(),
            vec!["E5_N45.rd5"]
        );
        assert_eq!(
            segment_names([-48., 37., -47., 38.]).unwrap(),
            vec!["W50_N35.rd5"]
        );
        assert_eq!(segment_names([-1., -1., 1., 1.]).unwrap().len(), 4);
    }
    #[test]
    fn unbounded_downloads_are_rejected() {
        assert!(segment_names([-180., -90., 180., 90.]).is_err());
    }
}

#[cfg(test)]
mod head_probe_tests {
    use super::*;

    /// Regression: Geofabrik HEAD answers Content-Length 0 (reqwest decodes an
    /// empty body), which poisoned the size cache with 0. The Range-GET helper
    /// must return the real total from Content-Range.
    #[test]
    #[ignore = "network test — run explicitly with `cargo test -- --ignored`"]
    fn content_length_returns_total_for_geofabrik() {
        let url = "https://download.geofabrik.de/europe/germany/bremen-latest.osm.pbf";
        let length = content_length(url)
            .expect("content_length call")
            .expect("some length");
        println!("{url} → {length} B");
        assert!(
            length > 1_000_000,
            "expected the real file size, got {length}"
        );
    }
}

#[cfg(test)]
mod queue_tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn queue_roundtrip_dedup_and_remove() {
        let mut dir = std::env::temp_dir();
        dir.push(format!("rn-queue-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let a = json!({"id":"a","name":"A"});
        let b = json!({"id":"b","name":"B"});
        assert_eq!(enqueue(&dir, &a).unwrap(), 1);
        assert_eq!(enqueue(&dir, &a).unwrap(), 1); // Deduplicate identical region IDs.
        assert_eq!(enqueue(&dir, &b).unwrap(), 2);
        let first = dequeue(&dir).unwrap();
        assert_eq!(first["id"], json!("a"));
        assert_eq!(read_queue(&dir).len(), 1);
        remove_queued(&dir, "b").unwrap();
        assert!(read_queue(&dir).is_empty());
        assert!(dequeue(&dir).is_none()); // An empty queue returns None.
        let _ = fs::remove_dir_all(&dir);
    }
}
