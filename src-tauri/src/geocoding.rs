use crate::store::{self, err, Result};
use rusqlite::OptionalExtension;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    io::Read,
    path::Path,
    sync::Mutex,
    time::{Duration, Instant},
};

// Shared by forward/reverse lookups, including simultaneous UI requests.
static NEXT_REQUEST: Mutex<Option<Instant>> = Mutex::new(None);
fn endpoint(base: &str, operation: &str) -> Result<reqwest::Url> {
    if !["search", "reverse"].contains(&operation) {
        return Err("geocoding.unknownOperation".into());
    }
    let url = reqwest::Url::parse(&format!("{}/{}", base.trim_end_matches('/'), operation))
        .map_err(|_| "geocoding.invalidServiceUrl")?;
    if url.scheme() != "https"
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err("geocoding.insecureServiceUrl".into());
    }
    Ok(url)
}
pub fn lookup(
    root: &Path,
    base: &str,
    key: &str,
    operation: &str,
    query: &str,
    lat: f64,
    lon: f64,
    language: &str,
) -> Result<Value> {
    let mut url = endpoint(base, operation)?;
    if key.len() > 2048 || key.contains(['\r', '\n']) {
        return Err("geocoding.invalidApiKey".into());
    }
    url.query_pairs_mut()
        .append_pair("format", "jsonv2")
        .append_pair("addressdetails", "1")
        .append_pair(
            "accept-language",
            if language == "de" { "de" } else { "en" },
        );
    if operation == "search" {
        if query.trim().len() < 3 || query.len() > 300 {
            return Err("geocoding.invalidQuery".into());
        }
        url.query_pairs_mut()
            .append_pair("q", query.trim())
            .append_pair("limit", "8");
    } else {
        if !lat.is_finite() || !lon.is_finite() || lat.abs() > 90. || lon.abs() > 180. {
            return Err("geocoding.invalidCoordinates".into());
        }
        url.query_pairs_mut()
            .append_pair("lat", &format!("{lat:.5}"))
            .append_pair("lon", &format!("{lon:.5}"));
    }
    let cache_key = format!("{:x}", Sha256::digest(url.as_str().as_bytes()));
    let db = store::open(root)?;
    db.execute_batch("CREATE TABLE IF NOT EXISTS geocoding_cache(id TEXT PRIMARY KEY,body TEXT NOT NULL,updated INTEGER NOT NULL)").map_err(err)?;
    let mut next = NEXT_REQUEST.lock().map_err(err)?;
    let cached: Option<String> = db
        .query_row(
            "SELECT body FROM geocoding_cache WHERE id=?1",
            [&cache_key],
            |r| r.get(0),
        )
        .optional()
        .map_err(err)?;
    if let Some(body) = cached {
        return serde_json::from_str(&body).map_err(err);
    }
    if let Some(at) = *next {
        let wait = at.saturating_duration_since(Instant::now());
        if wait > Duration::from_secs(2) {
            return Err("geocoding.busy".into());
        }
        std::thread::sleep(wait);
    }
    *next = Some(Instant::now() + Duration::from_millis(1100));
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(12))
        .redirect(reqwest::redirect::Policy::none())
        .user_agent("RoadbookNavi/1.0 (+https://roadbooknavi.de)")
        .build()
        .map_err(|_| "geocoding.startupFailed")?;
    let mut request = client.get(url);
    if !key.is_empty() {
        request = request.bearer_auth(key);
    }
    let response = request.send().map_err(|_| "geocoding.unreachable")?;
    if response.status().as_u16() == 429 {
        let retry = response
            .headers()
            .get("retry-after")
            .and_then(|s| s.to_str().ok())
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(60)
            .clamp(60, 3600);
        *next = Some(Instant::now() + Duration::from_secs(retry));
        return Err("geocoding.rateLimited".into());
    }
    if !response.status().is_success() {
        return Err(format!(
            "geocoding.httpError:{}",
            response.status().as_u16()
        ));
    }
    let mut bytes = Vec::new();
    response
        .take(2_000_001)
        .read_to_end(&mut bytes)
        .map_err(|_| "geocoding.readFailed")?;
    if bytes.len() > 2_000_000 {
        return Err("geocoding.responseTooLarge".into());
    }
    let value: Value = serde_json::from_slice(&bytes).map_err(|_| "geocoding.invalidResponse")?;
    if (operation == "search" && !value.is_array())
        || (operation == "reverse" && !value["display_name"].is_string())
    {
        return Err("geocoding.notFound".into());
    }
    db.execute("INSERT OR REPLACE INTO geocoding_cache(id,body,updated) VALUES(?1,?2,strftime('%s','now'))",rusqlite::params![cache_key,value.to_string()]).map_err(err)?;
    db.execute("DELETE FROM geocoding_cache WHERE id IN (SELECT id FROM geocoding_cache ORDER BY updated DESC LIMIT -1 OFFSET 5000)",[]).map_err(err)?;
    Ok(value)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn endpoints() {
        assert_eq!(
            endpoint("https://geocode.maps.co/", "search")
                .unwrap()
                .as_str(),
            "https://geocode.maps.co/search"
        );
        assert!(endpoint("https://nominatim.openstreetmap.org", "reverse").is_ok());
        for base in [
            "http://example.org",
            "https://user:secret@example.org",
            "https://example.org?key=secret",
        ] {
            assert!(endpoint(base, "search").is_err());
        }
        assert!(endpoint("https://geocode.maps.co", "details").is_err());
    }
    #[test]
    #[ignore = "Explicit live check only: two public Nominatim requests"]
    fn public_search_reverse_and_cache() {
        let root = tempfile::tempdir().unwrap();
        let base = "https://nominatim.openstreetmap.org";
        let result = lookup(root.path(), base, "", "search", "Berlin", 0., 0., "de").unwrap();
        assert!(!result.as_array().unwrap().is_empty());
        assert_eq!(
            lookup(root.path(), base, "", "search", "Berlin", 0., 0., "de").unwrap(),
            result
        );
        let place = lookup(root.path(), base, "", "reverse", "", 52.5163, 13.3777, "de").unwrap();
        assert!(place["display_name"].as_str().unwrap().contains("Berlin"));
        let db = store::open(root.path()).unwrap();
        assert_eq!(
            db.query_row("SELECT COUNT(*) FROM geocoding_cache", [], |r| r
                .get::<_, i64>(0))
                .unwrap(),
            2
        );
    }
}
