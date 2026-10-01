//! Desktop bridge to a resident JVM service that queries OsmAnd .obf files
//! (see Documentation/obf-spike.md). The service speaks line-delimited JSON on
//! stdio; this module supervises the process and translates the previous
//! store.rs contract onto it. Android uses an in-process plugin instead.

use serde_json::{json, Value};
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::mpsc;
use std::sync::{Mutex, MutexGuard};
use std::time::Duration;

pub struct Bridge {
    java: PathBuf,
    classpath: PathBuf,
    session: Mutex<Option<Session>>,
}

struct Session {
    child: Child,
    stdin: Option<std::process::ChildStdin>,
    rx: mpsc::Receiver<String>,
    files: Vec<String>,
}

const OPEN_TIMEOUT: Duration = Duration::from_secs(60);
const QUERY_TIMEOUT: Duration = Duration::from_secs(90);
const SEARCH_TIMEOUT: Duration = Duration::from_secs(30);

impl Bridge {
    /// `java` is the bundled jlink runtime (`runtime/bin/java`) on desktop,
    /// `classpath` points at `obf-bridge/resources/lib`.
    pub fn new(java: PathBuf, classpath: PathBuf) -> Bridge {
        Bridge { java, classpath, session: Mutex::new(None) }
    }

    fn spawn(&self) -> Result<Session, String> {
        let mut child = Command::new(&self.java)
            .args(["-Xmx1024m", "-cp", &format!("{}/*", self.classpath.display())])
            .arg("net.osmand.probe.ObfService")
            .stdin(std::process::Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("OBF-Service start fehlgeschlagen: {e}"))?;
        let stdin = child.stdin.take().ok_or("OBF-Service stdin fehlt")?;
        let stdout = child.stdout.take().ok_or("OBF-Service stdout fehlt")?;
        let (tx, rx) = mpsc::channel();
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                if tx.send(line.unwrap_or_default()).is_err() {
                    break;
                }
            }
        });
        Ok(Session { child, stdin: Some(stdin), rx, files: vec![] })
    }

    fn session(&self) -> Result<MutexGuard<'_, Option<Session>>, String> {
        Ok(self.session.lock().unwrap_or_else(|poisoned| poisoned.into_inner()))
    }

    fn send(&self, session: &mut Session, line: &str) -> Result<(), String> {
        let stdin = session.stdin.as_mut().ok_or("OBF-Service stdin geschlossen")?;
        stdin.write_all(line.as_bytes()).map_err(|e| e.to_string())?;
        stdin.write_all(b"\n").map_err(|e| e.to_string())?;
        stdin.flush().map_err(|e| e.to_string())
    }

    fn recv(session: &mut Session, timeout: Duration) -> Result<Value, String> {
        let line = match session.rx.recv_timeout(timeout) {
            Ok(l) => l,
            Err(mpsc::RecvTimeoutError::Timeout) => {
                let _ = session.child.kill();
                return Err("OBF-Service antwortet nicht (Timeout)".into());
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => {
                return Err("OBF-Service wurde beendet".into());
            }
        };
        let value: Value = serde_json::from_str(&line).map_err(|e| format!("OBF-Service: ungültige Antwort: {e}"))?;
        if let Some(message) = value.get("error").and_then(Value::as_str) {
            return Err(message.to_string());
        }
        Ok(value)
    }

    fn ensure_open(&self, files: &[PathBuf]) -> Result<MutexGuard<'_, Option<Session>>, String> {
        let mut guard = self.session()?;
        let alive = match guard.as_mut() {
            Some(s) => s.child.try_wait().map_err(|e| e.to_string())?.is_none(),
            None => false,
        };
        if !alive {
            *guard = Some(self.spawn()?);
        }
        let wanted: Vec<String> = files.iter().map(|p| p.to_string_lossy().into_owned()).collect();
        let session = guard.as_mut().expect("just spawned");
        if session.files != wanted {
            let request = json!({"op":"open","files":wanted}).to_string();
            self.send(session, &request)?;
            let answer = Self::recv(session, OPEN_TIMEOUT)?;
            if answer.get("ok").and_then(Value::as_bool) != Some(true) {
                return Err("OBF-Service: Öffnen fehlgeschlagen".into());
            }
            session.files = wanted;
        }
        Ok(guard)
    }

    /// Previous contract: `{"type":"FeatureCollection","features":[…],"truncated":bool}`.
    pub fn query(
        &self,
        files: &[PathBuf],
        bbox: [f64; 4],
        purpose: &str,
        limit: usize,
    ) -> Result<Value, String> {
        if let Err(message) = validate_bbox(bbox) {
            return Err(message);
        }
        let mut guard = self.ensure_open(files)?;
        for _ in 0..2 {
            let session = guard.as_mut().expect("session opened");
            let request = json!({"op":"query","w":bbox[0],"s":bbox[1],"e":bbox[2],"n":bbox[3],
                                 "purpose":purpose,"limit":limit});
            match self.send(session, &request.to_string()) {
                Ok(()) => {}
                Err(_) => {
                    *guard = Some(self.spawn()?);
                    continue;
                }
            }
            let session = guard.as_mut().expect("session opened");
            return match Self::recv(session, QUERY_TIMEOUT) {
                Ok(value) => Ok(value),
                Err(_) => Err("OBF-Abfrage fehlgeschlagen".into()),
            };
        }
        Err("OBF-Abfrage fehlgeschlagen".into())
    }

    /// Per-file overall bounds (w, s, e, n) in degrees; `None` for files
    /// without map data. Used by the installer to record region coverage.
    pub fn bounds(&self, files: &[PathBuf]) -> Result<Vec<Option<[f64; 4]>>, String> {
        if files.is_empty() {
            return Ok(vec![]);
        }
        let mut guard = self.ensure_open(files)?;
        let session = guard.as_mut().expect("session opened");
        self.send(session, "{\"op\":\"bounds\"}")?;
        let answer = Self::recv(session, OPEN_TIMEOUT)?;
        serde_json::from_value(
            answer
                .get("bounds")
                .cloned()
                .ok_or("OBF-Service: Antwort ohne Grenzen")?,
        )
        .map_err(|e| format!("OBF-Service: ungültige Grenzen: {e}"))
    }

    /// Default desktop wiring: the bundled jlink runtime (same one BRouter
    /// uses) plus the obf-bridge classpath. Env vars allow overrides for tests.
    pub fn bundled(resources: &std::path::Path) -> Bridge {
        let java = std::env::var("OBF_JAVA").map(PathBuf::from).unwrap_or_else(|_| {
            let path = resources.join("runtime/bin/java");
            if cfg!(target_os = "windows") {
                path.with_extension("exe")
            } else {
                path
            }
        });
        let classpath = std::env::var("OBF_BRIDGE_LIB")
            .map(PathBuf::from)
            .unwrap_or_else(|_| resources.join("obf-bridge/lib"));
        Bridge::new(java, classpath)
    }

    /// Address search (cities and streets) from the OBF Address section.
    pub fn search(&self, files: &[PathBuf], query: &str, limit: usize) -> Result<Vec<Value>, String> {
        if query.chars().count() < 2 {
            return Ok(vec![]);
        }
        let mut guard = self.ensure_open(files)?;
        let session = guard.as_mut().expect("session opened");
        let request = json!({"op":"search","q":query,"limit":limit});
        self.send(session, &request.to_string()).map_err(|e| e.to_string())?;
        let answer = Self::recv(session, SEARCH_TIMEOUT)?;
        Ok(answer
            .get("results")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default())
    }
}

fn validate_bbox(bbox: [f64; 4]) -> Result<(), String> {
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
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture() -> Option<(PathBuf, PathBuf)> {
        let obf = std::env::var("OBF_TEST_OBF").ok()?;
        if obf.is_empty() {
            return None;
        }
        let java = std::env::var("OBF_JAVA").unwrap_or_else(|_| "java".into());
        Some((PathBuf::from(java), PathBuf::from(obf)))
    }

    #[test]
    fn bridge_query_and_search_end_to_end() {
        let Some((java, obf)) = fixture() else {
            eprintln!("skipping: set OBF_TEST_OBF (and build via scripts/build-obf-bridge.mjs)");
            return;
        };
        let classpath = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../native/obf-bridge/resources/lib");
        let bridge = Bridge::new(java, classpath);
        let files = [obf.clone()];

        let fc = bridge
            .query(&files, [8.795, 53.072, 8.83, 53.10], "detail", 20001)
            .unwrap();
        let features = fc["features"].as_array().cloned().unwrap_or_default();
        assert!(features.len() > 10_000, "features: {}", features.len());
        assert!(
            features.iter().any(|f| f["geometry"]["type"] == "Polygon"),
            "buildings/water must come back as polygons"
        );
        assert!(features.iter().any(|f| f["properties"].get("name").is_some()));

        let overview = bridge
            .query(&files, [8.795, 53.072, 8.83, 53.10], "map-overview", 20001)
            .unwrap();
        let overview_kinds: Vec<String> = overview["features"]
            .as_array()
            .cloned()
            .unwrap_or_default()
            .iter()
            .map(|f| f["properties"]["kind"].as_str().unwrap_or_default().to_string())
            .collect();
        assert!(!overview_kinds.is_empty());
        assert!(
            overview_kinds.iter().all(|k| ["major-road", "place", "water"].contains(&k.as_str())),
            "map-overview must filter to major-road/place/water, got {overview_kinds:?}"
        );

        let results = bridge.search(&files, "Bahnhof", 40).unwrap();
        assert!(results.len() >= 3, "results: {}", results.len());
        assert!(
            results
                .iter()
                .any(|r| r["properties"]["name"].as_str().unwrap_or_default().contains("Bahnhof")),
            "street search must return matching names"
        );
    }
}