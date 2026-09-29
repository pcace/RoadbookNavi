//! Streaming PBF import into an on-disk, indexed region. No Overpass or tile server.
use crate::store::{err, Result};
use osmpbfreader::{OsmId, OsmObj, OsmPbfReader};
use rusqlite::{params, Connection};
use serde_json::{json, Value};
use std::{
    collections::BTreeMap,
    fs::{self, File},
    io::Read,
    path::Path,
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc,
    },
};

/// Counts bytes read from the block-oriented PBF reader for import progress.
struct Counting {
    inner: File,
    position: Arc<AtomicU64>,
}
impl Read for Counting {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        let n = self.inner.read(buf)?;
        self.position.fetch_add(n as u64, Ordering::Relaxed);
        Ok(n)
    }
}

type Tags = BTreeMap<String, String>;
type Coord = [f64; 2];
fn tags(t: &osmpbfreader::Tags) -> Tags {
    t.iter()
        .map(|(k, v)| (k.to_string(), v.to_string()))
        .collect()
}
fn relevant(t: &Tags) -> bool {
    [
        "highway",
        "building",
        "waterway",
        "natural",
        "railway",
        "power",
        "place",
        "amenity",
        "tourism",
        "landuse",
        "boundary",
        "leisure",
        "addr:housenumber",
    ]
    .iter()
    .any(|k| t.contains_key(*k))
}
fn kind(t: &Tags) -> &'static str {
    if t.contains_key("place") {
        "place"
    } else if t
        .get("highway")
        .is_some_and(|v| ["motorway", "trunk", "primary", "secondary"].contains(&v.as_str()))
    {
        "major-road"
    } else if t.contains_key("highway") {
        "road"
    } else if t.contains_key("building") {
        "building"
    } else if t.contains_key("waterway") || t.get("natural").is_some_and(|v| v == "water") {
        "water"
    } else {
        "other"
    }
}
fn insert(db: &Connection, id: &str, geometry: Value, points: &[Coord], mut t: Tags) -> Result<()> {
    if points.is_empty() {
        return Ok(());
    }
    let mut b = [180f64, 90f64, -180f64, -90f64];
    for p in points {
        b[0] = b[0].min(p[0]);
        b[1] = b[1].min(p[1]);
        b[2] = b[2].max(p[0]);
        b[3] = b[3].max(p[1]);
    }
    let k = kind(&t).to_owned();
    if !t.contains_key("name") {
        if let (Some(street), Some(house)) = (t.get("addr:street"), t.get("addr:housenumber")) {
            t.insert("name".into(), format!("{street} {house}"));
        }
    }
    let name = t.get("name").cloned().unwrap_or_default().to_lowercase();
    let feature = json!({"type":"Feature","id":id,"geometry":geometry,"properties":t});
    db.execute(
        "INSERT INTO features(osm_id,kind,name,body) VALUES(?1,?2,?3,?4)",
        params![id, k, name, feature.to_string()],
    )
    .map_err(err)?;
    let row = db.last_insert_rowid();
    db.execute(
        "INSERT INTO bounds VALUES(?1,?2,?3,?4,?5)",
        params![row, b[0], b[2], b[1], b[3]],
    )
    .map_err(err)?;
    Ok(())
}

/// Join unordered relation member ways. Incomplete rings are rejected, never closed artificially.
fn rings(mut pieces: Vec<Vec<Coord>>) -> Option<Vec<Vec<Coord>>> {
    let mut rings = vec![];
    while let Some(mut ring) = pieces.pop() {
        if ring.len() < 2 {
            return None;
        }
        while ring.first() != ring.last() {
            let end = *ring.last()?;
            let i = pieces
                .iter()
                .position(|p| p.first() == Some(&end) || p.last() == Some(&end))?;
            let mut next = pieces.swap_remove(i);
            if next.first() != Some(&end) {
                next.reverse();
            }
            ring.extend(next.into_iter().skip(1));
        }
        if ring.len() < 4 {
            return None;
        }
        rings.push(ring);
    }
    Some(rings)
}
fn inside(p: Coord, ring: &[Coord]) -> bool {
    let mut inside = false;
    for pair in ring.windows(2) {
        let [a, b] = [pair[0], pair[1]];
        if (a[1] > p[1]) != (b[1] > p[1])
            && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]
        {
            inside = !inside;
        }
    }
    inside
}

pub fn import(
    pbf: &Path,
    output: &Path,
    final_db: &Path,
    cancel: Arc<AtomicBool>,
    progress: impl Fn(&str, u64, u64, u64),
) -> Result<Value> {
    let db = Connection::open(output).map_err(err)?;
    db.execute_batch("PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF; PRAGMA temp_store=FILE; PRAGMA cache_size=-131072; PRAGMA mmap_size=536870912;
      CREATE TABLE nodes(id INTEGER PRIMARY KEY, lon REAL, lat REAL);
      CREATE TABLE ways(id INTEGER PRIMARY KEY, body TEXT);
      CREATE TABLE features(id INTEGER PRIMARY KEY,osm_id TEXT,kind TEXT,name TEXT,body TEXT);
      CREATE VIRTUAL TABLE bounds USING rtree(id,minx,maxx,miny,maxy);
      BEGIN;").map_err(err)?;
    let mut count = 0u64;
    let mut incomplete = 0u64;
    let position = Arc::new(AtomicU64::new(0));
    let file = File::open(pbf).map_err(err)?;
    let total = file.metadata().map_err(err)?.len();
    let mut reader = OsmPbfReader::new(Counting {
        inner: file,
        position: position.clone(),
    });
    let mut last_reported = 0u64;
    for object in reader.iter() {
        if cancel.load(Ordering::Relaxed) {
            return Err("Abgebrochen".into());
        }
        count += 1;
        if count % 20000 == 0 {
            let current = position.load(Ordering::Relaxed);
            if current > last_reported {
                last_reported = current;
                progress("OSM-Daten aufbereiten (2/3)", count, current, total);
            }
        }
        match object.map_err(|e|format!("{e} (Importabbruch: Objekt {count}, gelesene Bytes {} — Datei beschädigt oder nicht vollständig)",position.load(Ordering::Relaxed)))? {
            OsmObj::Node(node) => {
                let p=[node.lon(),node.lat()];
                db.execute("INSERT INTO nodes VALUES(?1,?2,?3)",params![node.id.0,p[0],p[1]]).map_err(err)?;
                let t=tags(&node.tags);
                if relevant(&t) {insert(&db,&format!("node/{}",node.id.0),json!({"type":"Point","coordinates":p}),&[p],t)?;}
            },
            OsmObj::Way(way) => {
                let mut points=vec![];
                let mut stmt=db.prepare_cached("SELECT lon,lat FROM nodes WHERE id=?1").map_err(err)?;
                let mut complete=true;
                for id in &way.nodes {
                    match stmt.query_row([id.0],|r|Ok([r.get::<_,f64>(0)?,r.get::<_,f64>(1)?])) {
                        Ok(p)=>points.push(p), Err(rusqlite::Error::QueryReturnedNoRows)=>{complete=false;break;},Err(e)=>return Err(err(e))
                    }
                }
                let t=tags(&way.tags);
                if !complete {incomplete+=1; continue;}
                if points.len()<2 {continue}
                db.execute("INSERT INTO ways VALUES(?1,?2)",params![way.id.0,serde_json::to_string(&points).map_err(err)?]).map_err(err)?;
                if relevant(&t) {
                    let area=points.len()>3 && points.first()==points.last() && !t.get("area").is_some_and(|v|v=="no") && (t.contains_key("building")||t.contains_key("landuse")||t.get("natural").is_some_and(|v|v=="water"||v=="wood")||t.get("area").is_some_and(|v|v=="yes"));
                    let geometry=if area {json!({"type":"Polygon","coordinates":[points]})} else {json!({"type":"LineString","coordinates":points})};
                    insert(&db,&format!("way/{}",way.id.0),geometry,&points,t)?;
                }
            },
            OsmObj::Relation(relation) => {
                let t=tags(&relation.tags);
                if !relevant(&t) || !t.get("type").is_some_and(|v|v=="multipolygon"||v=="boundary") {continue}
                let mut outer=vec![];let mut inner=vec![];let mut complete=true;
                for member in relation.refs {
                    let role=member.role.as_str();
                    if let OsmId::Way(id)=member.member {
                        if !["outer","inner",""].contains(&role) {continue}
                        match db.query_row("SELECT body FROM ways WHERE id=?1",[id.0],|r|r.get::<_,String>(0)) {
                            Ok(body)=>{let points:Vec<Coord>=serde_json::from_str(&body).map_err(err)?;if role=="inner"{inner.push(points)}else{outer.push(points)}},
                            Err(rusqlite::Error::QueryReturnedNoRows)=>{complete=false;},Err(e)=>return Err(err(e))
                        }
                    } else if ["outer","inner"].contains(&role) {complete=false;}
                }
                let joined=if complete {rings(outer).zip(rings(inner))} else {None};
                if let Some((outer,inner))=joined {
                    if outer.is_empty() {incomplete+=1;continue}
                    let mut polygons:Vec<Vec<Vec<Coord>>>=outer.into_iter().map(|r|vec![r]).collect();
                    let mut valid=true;
                    for hole in inner {
                        if let Some(poly)=polygons.iter_mut().find(|p|inside(hole[0],&p[0])) {poly.push(hole)} else {valid=false;}
                    }
                    if !valid {incomplete+=1;continue}
                    let points:Vec<Coord>=polygons.iter().flat_map(|p|p.iter().flatten().copied()).collect();
                    insert(&db,&format!("relation/{}",relation.id.0),json!({"type":"MultiPolygon","coordinates":polygons}),&points,t)?;
                } else {incomplete+=1;}
            }
        }
    }
    // Finalization used to appear stuck at 100% on slow devices while indexes
    // and VACUUM processed several gigabytes. Report each phase and use the
    // SQLite progress handler for cancellation. VACUUM INTO writes the compact
    // target directly and avoids an additional full database copy.
    progress(
        "OSM-Daten aufbereiten (2/3) · Indizes erstellen",
        count,
        total,
        total,
    );
    db.progress_handler(4096, Some(move || cancel.load(Ordering::Relaxed)));
    db.execute_batch(
        "COMMIT; DROP TABLE nodes; DROP TABLE ways; CREATE INDEX feature_names ON features(name);",
    )
    .map_err(err)?;
    progress(
        "OSM-Daten aufbereiten (2/3) · Datenbank verdichten",
        count,
        total,
        total,
    );
    let finalize = final_db.with_extension("sqlite.part");
    let _ = fs::remove_file(&finalize);
    db.execute(
        "VACUUM INTO ?1",
        params![finalize.to_string_lossy().to_string()],
    )
    .map_err(err)?;
    fs::rename(&finalize, final_db).map_err(err)?;
    let _ = fs::remove_file(output);
    let features: u64 = db
        .query_row("SELECT count(*) FROM features", [], |r| r.get(0))
        .map_err(err)?;
    if features == 0 {
        return Err("Der Extrakt enthält keine verwendbaren OSM-Daten".into());
    }
    Ok(json!({"objects":count,"features":features,"incomplete":incomplete}))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn relation_joins_reversed_members() {
        let r = rings(vec![
            vec![[0., 0.], [1., 0.]],
            vec![[1., 1.], [1., 0.]],
            vec![[0., 0.], [1., 1.]],
        ])
        .unwrap();
        assert_eq!(r.len(), 1);
        assert_eq!(r[0].len(), 4);
        assert_eq!(r[0].first(), r[0].last());
    }
    #[test]
    fn incomplete_relation_is_not_silently_closed() {
        assert!(rings(vec![vec![[0., 0.], [1., 0.]]]).is_none());
    }
    #[test]
    fn holes_are_assigned_by_containment() {
        assert!(inside(
            [0.5, 0.5],
            &[[0., 0.], [1., 0.], [1., 1.], [0., 1.], [0., 0.]]
        ));
    }
    #[test]
    #[ignore = "Requires OFFLINE_PBF_FIXTURE pointing at a downloaded OSM PBF"]
    fn imports_real_osm_extract() {
        let fixture = std::env::var("OFFLINE_PBF_FIXTURE").expect("OFFLINE_PBF_FIXTURE");
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("region.sqlite");
        let stats = import(
            Path::new(&fixture),
            &path,
            &path,
            Arc::new(AtomicBool::new(false)),
            |phase, objects, current, total| {
                println!("Import [{phase}]: {objects} Objekte, {current}/{total} Bytes")
            },
        )
        .unwrap();
        assert!(stats["features"].as_u64().unwrap() > 100);
        let db = Connection::open(&path).unwrap();
        let roads: i64 = db
            .query_row("SELECT count(*) FROM features WHERE kind='road'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert!(roads > 20);
        let bounds: i64 = db
            .query_row("SELECT count(*) FROM bounds", [], |r| r.get(0))
            .unwrap();
        assert_eq!(bounds as u64, stats["features"].as_u64().unwrap());
        assert!(
            db.prepare("SELECT * FROM nodes").is_err(),
            "Temporary import data must not remain"
        );
        println!("OSM import: {stats}");
        if let Ok(output) = std::env::var("OFFLINE_TEST_REGION_OUTPUT") {
            std::fs::copy(path, output).unwrap();
        }
    }
}
