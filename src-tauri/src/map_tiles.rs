//! Persistent cache for OpenFreeMap vector tiles used by roadbook drawings.
//!
//! The public TileJSON document points at immutable, versioned planet tiles.
//! Keeping the source version in the cache path lets existing roadbooks remain
//! reproducible while a refreshed planet build is downloaded for new routes.

use crate::store::{err, Result};
use base64::{engine::general_purpose::STANDARD, Engine};
use serde_json::{json, Value};
use std::{
    fs,
    io::Read,
    path::{Path, PathBuf},
    sync::OnceLock,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

const TILEJSON_URL: &str = "https://tiles.openfreemap.org/planet";
const MAX_TILE_BYTES: u64 = 10 * 1024 * 1024;

fn client() -> Result<&'static reqwest::blocking::Client> {
    static CLIENT: OnceLock<reqwest::blocking::Client> = OnceLock::new();
    if let Some(client) = CLIENT.get() {
        return Ok(client);
    }
    let client = reqwest::blocking::Client::builder()
        .user_agent("RoadbookNavi/1.0 (+https://github.com/pcace/RoadbookNavi)")
        .connect_timeout(Duration::from_secs(20))
        .timeout(Duration::from_secs(60))
        .redirect(reqwest::redirect::Policy::custom(|attempt| {
            let allowed = attempt.url().scheme() == "https"
                && attempt.url().host_str() == Some("tiles.openfreemap.org")
                && attempt.previous().len() < 4;
            if allowed {
                attempt.follow()
            } else {
                attempt.stop()
            }
        }))
        .build()
        .map_err(err)?;
    let _ = CLIENT.set(client);
    CLIENT
        .get()
        .ok_or("Kartenclient konnte nicht gestartet werden".into())
}

fn unix_time() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn valid_template(template: &str) -> bool {
    reqwest::Url::parse(template).ok().is_some_and(|url| {
        url.scheme() == "https"
            && url.host_str() == Some("tiles.openfreemap.org")
            && template.contains("{z}")
            && template.contains("{x}")
            && template.contains("{y}")
    })
}

fn source_version(template: &str) -> String {
    let candidate = template
        .split('/')
        .find(|part| part.chars().any(|c| c.is_ascii_digit()) && !part.contains('{'))
        .unwrap_or("current");
    let value: String = candidate
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
        .take(80)
        .collect();
    if value.is_empty() {
        "current".into()
    } else {
        value
    }
}

fn source(root: &Path) -> Result<(String, String)> {
    let directory = root.join("map-tiles");
    fs::create_dir_all(&directory).map_err(err)?;
    let metadata = directory.join("source.json");
    let stale: Option<Value> = fs::read(&metadata)
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok());
    let fresh = stale.as_ref().is_some_and(|value| {
        value["fetchedAt"]
            .as_u64()
            .is_some_and(|time| unix_time().saturating_sub(time) < 24 * 60 * 60)
            && value["template"].as_str().is_some_and(valid_template)
    });
    let value = if fresh {
        stale.unwrap()
    } else {
        let fetched = (|| -> Result<Value> {
            let value: Value = client()?
                .get(TILEJSON_URL)
                .send()
                .map_err(err)?
                .error_for_status()
                .map_err(err)?
                .json()
                .map_err(err)?;
            let template = value["tiles"]
                .as_array()
                .and_then(|tiles| tiles.first())
                .and_then(Value::as_str)
                .filter(|template| valid_template(template))
                .ok_or("OpenFreeMap liefert keine unterstützte Kachelquelle")?;
            let cached = json!({
                "template": template,
                "version": source_version(template),
                "fetchedAt": unix_time()
            });
            let temporary = metadata.with_extension("json.tmp");
            fs::write(&temporary, serde_json::to_vec(&cached).map_err(err)?).map_err(err)?;
            fs::rename(temporary, &metadata).map_err(err)?;
            Ok(cached)
        })();
        match fetched {
            Ok(value) => value,
            Err(error) => stale.ok_or(error)?,
        }
    };
    let template = value["template"]
        .as_str()
        .filter(|template| valid_template(template))
        .ok_or("Ungültige OpenFreeMap-Kachelquelle")?
        .to_owned();
    let version = value["version"].as_str().unwrap_or("current").to_owned();
    Ok((template, version))
}

fn tile_path(root: &Path, version: &str, z: u8, x: u32, y: u32) -> PathBuf {
    root.join("map-tiles")
        .join(version)
        .join(z.to_string())
        .join(x.to_string())
        .join(format!("{y}.pbf"))
}

pub fn tile(root: &Path, z: u8, x: u32, y: u32) -> Result<Value> {
    if z > 14 || x >= 1u32 << z || y >= 1u32 << z {
        return Err("Ungültige Kartenkachel".into());
    }
    let (template, version) = source(root)?;
    let path = tile_path(root, &version, z, x, y);
    let cached = path.exists();
    if !cached {
        fs::create_dir_all(path.parent().ok_or("Ungültiger Kachelpfad")?).map_err(err)?;
        let url = template
            .replace("{z}", &z.to_string())
            .replace("{x}", &x.to_string())
            .replace("{y}", &y.to_string());
        let mut response = client()?
            .get(url)
            .header(reqwest::header::ACCEPT_ENCODING, "identity")
            .send()
            .map_err(err)?
            .error_for_status()
            .map_err(err)?
            .take(MAX_TILE_BYTES + 1);
        let mut bytes = Vec::new();
        response.read_to_end(&mut bytes).map_err(err)?;
        if bytes.is_empty() || bytes.len() as u64 > MAX_TILE_BYTES {
            return Err("OpenFreeMap-Kachel ist leer oder zu groß".into());
        }
        let temporary = path.with_extension("pbf.part");
        fs::write(&temporary, &bytes).map_err(err)?;
        fs::rename(temporary, &path).map_err(err)?;
    }
    Ok(json!({
        "data": STANDARD.encode(fs::read(path).map_err(err)?),
        "version": version,
        "cached": cached
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn validates_openfreemap_templates_and_versions() {
        let template = "https://tiles.openfreemap.org/planet/20260927_080001_pt/{z}/{x}/{y}.pbf";
        assert!(valid_template(template));
        assert_eq!(source_version(template), "20260927_080001_pt");
        assert!(!valid_template("https://example.org/{z}/{x}/{y}.pbf"));
    }

    #[test]
    #[ignore = "Explicit live check against OpenFreeMap"]
    fn downloads_and_reuses_a_vector_tile() {
        let root = tempfile::tempdir().unwrap();
        let first = tile(root.path(), 14, 8592, 5331).unwrap();
        let bytes = STANDARD.decode(first["data"].as_str().unwrap()).unwrap();
        assert!(bytes.len() > 1000);
        assert_ne!(bytes.get(..2), Some(&[0x1f, 0x8b][..]));
        assert_eq!(tile(root.path(), 14, 8592, 5331).unwrap()["cached"], true);
    }
}
