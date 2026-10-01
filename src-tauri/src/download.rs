use crate::{
    obf::Bridge,
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
    host == "brouter.de" || host == "download.osmand.net"
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
fn download(app: &AppHandle, url: &str, path: &Path, cancel: &AtomicBool, phase: &str) -> Result<String> {
    let parsed = reqwest::Url::parse(url).map_err(err)?;
    if parsed.scheme() != "https"
        || !["download.osmand.net", "brouter.de"].contains(&parsed.host_str().unwrap_or(""))
    {
        return Err("Nicht unterstützte Datenquelle".into());
    }
    download_file(
        url,
        path,
        cancel,
        |current, total| progress(app, phase, current, total),
    )
}
// Range requests use a server validator so a refreshed extract can never be appended to an older one.
fn download_file(
    url: &str,
    path: &Path,
    cancel: &AtomicBool,
    report: impl Fn(u64, Option<u64>),
) -> Result<String> {
    let metadata = path.with_extension("resume.json");
    let complete = path.with_extension("complete.json");
    if path.exists() && complete.exists() {
        let value: Value =
            serde_json::from_slice(&fs::read(&complete).map_err(err)?).map_err(err)?;
        if value["url"] == url && value["length"].as_u64() == Some(fs::metadata(path).map_err(err)?.len()) {
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
    // Cache the index for a day — polite towards OsmAnd's donation-funded
    // server; a manual refresh (UI) always refetches.
    if !refresh {
        let fresh = fs::metadata(&file)
            .ok()
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.elapsed().ok())
            .map(|age| age < Duration::from_secs(24 * 3600))
            .unwrap_or(false);
        if fresh {
            return serde_json::from_slice(&fs::read(file).map_err(err)?).map_err(err);
        }
    }
    let raw = client()?
        .get("https://download.osmand.net/get_indexes?gzip")
        .timeout(Duration::from_secs(120))
        .send()
        .map_err(err)?
        .error_for_status()
        .map_err(err)?
        .bytes()
        .map_err(err)?;
    let xml = read_gzip(&raw)?;
    let xml = String::from_utf8(xml).map_err(err)?;
    let regions = parse_indexes(&xml)?;
    fs::write(&file, serde_json::to_vec(&regions).map_err(err)?).map_err(err)?;
    Ok(json!({"type":"osmand","regions":regions}))
}

/// The index body is gzip data regardless of the URL suffix.
fn read_gzip(raw: &[u8]) -> Result<Vec<u8>> {
    if raw.starts_with(&[0x1f, 0x8b]) {
        let mut out = vec![];
        flate2::read::GzDecoder::new(raw).read_to_end(&mut out).map_err(err)?;
        Ok(out)
    } else {
        Ok(raw.to_vec())
    }
}

/// Parse the `osmand_regions` XML into flat region offers. Only `type=map`
/// files are offered (DEM/hillshade/wiki carry separate attributions; the
/// `free` attribute is OsmAnd's app-business marker and is ignored).
fn parse_indexes(xml: &str) -> Result<Vec<Value>> {
    let mut regions = vec![];
    let mut reader = quick_xml::Reader::from_str(xml);
    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(quick_xml::events::Event::Start(e)) | Ok(quick_xml::events::Event::Empty(e)) => {
                if e.name().as_ref() != b"region" {
                    buf.clear();
                    continue;
                }
                let mut attrs: std::collections::HashMap<String, String> = Default::default();
                for attr in e.attributes().with_checks(false) {
                    let attr = attr.map_err(err)?;
                    attrs.insert(
                        String::from_utf8_lossy(attr.key.local_name().as_ref()).into_owned(),
                        attr.unescape_value().map_err(err)?.into_owned(),
                    );
                }
                buf.clear();
                if attrs.get("type").map(String::as_str) != Some("map") {
                    continue;
                }
                let Some(name) = attrs.get("name").cloned() else {
                    continue;
                };
                let Some(id) = name.strip_suffix(".obf.zip") else {
                    continue;
                };
                let date = attrs.get("date").cloned().unwrap_or_default();
                let stamp: String = date.split('.').rev().collect::<Vec<_>>().join("");
                let size = attrs
                    .get("containerSize")
                    .and_then(|s| s.parse::<u64>().ok())
                    .unwrap_or(0);
                regions.push(json!({
                    "id": id,
                    "name": id.replace("_", " "),
                    "version": format!("{id}-{stamp}"),
                    "date": date,
                    "size": size,
                    "url": format!("https://download.osmand.net/download?event=2&file={name}"),
                }));
            }
            Ok(quick_xml::events::Event::Eof) => break,
            Ok(_) => buf.clear(),
            Err(e) => return Err(format!("Ungültiger Gebietskatalog: {e}")),
        }
    }
    if regions.is_empty() {
        return Err("Ungültiger Gebietskatalog".into());
    }
    Ok(regions)
}

/// Old-format artifacts (Geofabrik catalogue cache, per-region SQLite files)
/// are removed once at startup — the OBF flow keeps no compatibility mode.
pub fn sweep_legacy(root: &Path) {
    let _ = fs::remove_file(root.join("catalogue.json"));
    let _ = fs::remove_file(root.join("catalogue-sizes.json"));
    if let Ok(entries) = fs::read_dir(root.join("regions")) {
        for entry in entries.flatten() {
            if entry.path().extension().and_then(|e| e.to_str()) == Some("sqlite") {
                let _ = fs::remove_file(entry.path());
            }
        }
    }
}

pub fn install(
    app: &AppHandle,
    root: &Path,
    bridge: &Bridge,
    region: Value,
    cancel: Arc<AtomicBool>,
    aborted: Arc<AtomicBool>,
) -> Result<Value> {
    let id = store::key(region["id"].as_str().ok_or("Gebiets-ID fehlt")?)?;
    let version = store::key(region["version"].as_str().ok_or("Gebietsversion fehlt")?)?.to_owned();
    let url = region["url"].as_str().ok_or("Downloadquelle fehlt")?;
    let cache = root.join("downloads").join(&id);
    fs::create_dir_all(&cache).map_err(err)?;
    let manifest = cache.join("job.json");
    let mut job: Value = fs::read(&manifest)
        .ok()
        .and_then(|v| serde_json::from_slice(&v).ok())
        .unwrap_or(json!({"version":version,"region":region}));
    if job["version"] != version || job["region"] != region {
        // A different version replaces the whole job — the old file is
        // removed after a successful install (see below), never resumed.
        job = json!({"version":version,"region":region});
    }
    store::key(&version)?;
    let dir = root.join("regions");
    fs::create_dir_all(&dir).map_err(err)?;
    let zip_path = cache.join(format!("{version}.obf.zip.part"));
    let target = dir.join(format!("{version}.obf"));
    write_json(&manifest, &job)?;
    write_json(
        &root.join("download-status.json"),
        &json!({"region":region,"phase":"Kartenpaket herunterladen (1/2)","current":0,"total":region["size"]}),
    )?;
    let result = (|| {
        let checksum = download(app, url, &zip_path, &cancel, "Kartenpaket herunterladen (1/2)")?;
        progress(app, "Kartenpaket entpacken (2/2)", 0, None);
        unzip_obf(&zip_path, &target)?;
        let bbox = bounds_for(bridge, &target)?;
        let segment_dir = root.join("engine/segments4");
        fs::create_dir_all(&segment_dir).map_err(err)?;
        let segments = segment_names(bbox)?;
        for (i, name) in segments.iter().enumerate() {
            if cancel.load(Ordering::Relaxed) {
                return Err("Pausiert".into());
            }
            let dest = segment_dir.join(name);
            if dest.exists() {
                continue;
            }
            let part = cache.join(format!("{name}.part"));
            let phase = format!("Routingdaten (2/2) · {}/{}", i + 1, segments.len());
            download_file(
                &format!("https://brouter.de/brouter/segments4/{name}"),
                &part,
                &cancel,
                |current, total| progress(app, &phase, current, total),
            )?;
            fs::rename(part, dest).map_err(err)?;
        }
        if cancel.load(Ordering::Relaxed) {
            return Err("Pausiert".into());
        }
        let installed = json!({"id":id,"name":region["name"],"bbox":bbox,"version":version,"sha256":checksum,"size":fs::metadata(&target).map(|m| m.len()).unwrap_or(0),"segments":segments,"downloadedAt":std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_err(err)?.as_secs(),"source":url});
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
                let _ = fs::remove_file(target.with_extension("obf.part"));
                let _ = write_json(
                    &root.join("download-status.json"),
                    &json!({"phase":"Abgebrochen","current":0,"total":null}),
                );
            } else {
                // Pausing preserves the resumable download; the extracted
                // region is only complete or absent.
                let _ = fs::remove_file(target.with_extension("obf.part"));
                let mut state = status(root).unwrap_or(json!({}));
                state["error"] = json!(error);
                let _ = write_json(&root.join("download-status.json"), &state);
            }
        }
    }
    result
}

/// The .obf.zip contains exactly one .obf file; a mismatched or broken archive
/// fails loudly instead of leaving a truncated region behind.
fn unzip_obf(zip_path: &Path, target: &Path) -> Result<()> {
    let mut archive = zip::ZipArchive::new(File::open(zip_path).map_err(err)?).map_err(err)?;
    if archive.len() != 1 {
        return Err(format!("Unerwartetes Kartenpaket ({} Einträge)", archive.len()));
    }
    let name = archive.by_index(0).map_err(err)?.name().to_string();
    let mut entry = archive.by_index(0).map_err(err)?;
    if !name.ends_with(".obf") || entry.is_dir() {
        return Err(format!("Unerwarteter Kartenpaket-Inhalt: {name}"));
    }
    let mut out = File::create(target.with_extension("obf.part")).map_err(err)?;
    std::io::copy(&mut entry, &mut out).map_err(err)?;
    out.sync_all().map_err(err)?;
    drop(entry);
    drop(archive);
    fs::rename(target.with_extension("obf.part"), target).map_err(err)?;
    Ok(())
}

/// Read the region bounds from the downloaded OBF via the bridge. Failing to
/// determine bounds is fatal for the install: coverage checks (roadbook turns)
/// depend on them.
fn bounds_for(bridge: &Bridge, target: &Path) -> Result<[f64; 4]> {
    let list = bridge
        .bounds(&[target.to_path_buf()])
        .map_err(err)?
        .into_iter()
        .flatten()
        .next()
        .ok_or("OBF enthält keine Kartendaten")?;
    Ok(list)
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
        let hash = download_file(&url, &file, &AtomicBool::new(false), |_, _| {}).unwrap();
        server.join().unwrap();
        let expected: Vec<u8> = b"\x00\x00\x00\x0fOSMHeader-12345678".to_vec();
        assert_eq!(fs::read(&file).unwrap(), expected);
        assert_eq!(hash, format!("{:x}", Sha256::digest(&expected)));
        // A completed stage is reusable with the server already stopped.
        assert_eq!(
            download_file(&url, &file, &AtomicBool::new(false), |_, _| {}).unwrap(),
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

#[cfg(test)]
mod catalogue_tests {
    use super::*;

    #[test]
    fn osmand_index_parse_keeps_map_files_only() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<osmand_regions mapversion="1" gentime="0.2" timestamp="01.10.2026 09:13">
  <region name="Germany_bremen-city_europe_2.obf.zip" type="map" date="01.09.2026" size="27.8" containerSize="29127526" free="false"/>
  <region name="Germany_bremen-city_europe_2.wiki.obf.zip" type="wiki" date="06.09.2026" containerSize="15057130" free="false"/>
  <region name="Netherlands_europe_2.obf.zip" type="map" date="01.09.2026" containerSize="999"/>
</osmand_regions>"#;
        let regions = parse_indexes(xml).unwrap();
        assert_eq!(regions.len(), 2, "wiki files must be skipped");
        let bremen = &regions[0];
        assert_eq!(bremen["id"], json!("Germany_bremen-city_europe_2"));
        assert_eq!(bremen["version"], json!("Germany_bremen-city_europe_2-20260901"));
        assert_eq!(bremen["size"], json!(29127526));
        assert_eq!(bremen["name"], json!("Germany bremen-city europe 2"));
        assert_eq!(
            bremen["url"],
            json!("https://download.osmand.net/download?event=2&file=Germany_bremen-city_europe_2.obf.zip")
        );
        // version keys must pass the filename validator
        assert!(store::key(bremen["version"].as_str().unwrap()).is_ok());
    }
}
