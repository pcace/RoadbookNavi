package net.osmand.probe;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import net.osmand.binary.BinaryIndexPart;
import net.osmand.binary.BinaryMapAddressReaderAdapter.AddressRegion;
import net.osmand.binary.BinaryMapAddressReaderAdapter.CityBlocks;
import net.osmand.binary.BinaryMapDataObject;
import net.osmand.binary.BinaryMapIndexReader;
import net.osmand.data.City;
import net.osmand.data.Street;
import net.osmand.util.MapUtils;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.RandomAccessFile;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Resident query service over OsmAnd .obf files for RoadbookNavi.
 *
 * Line-delimited JSON on stdin → line-delimited JSON on stdout:
 *   {"op":"ping"}
 *   {"op":"open","files":["/…/region.obf", …]}
 *   {"op":"query","w":8.795,"s":53.072,"e":8.83,"n":53.10,
 *              "purpose":"map|map-overview|detail","limit":20001}
 *   {"op":"search","q":"Bahnhof","limit":40}
 *
 * query reproduces the previous store.rs contract:
 * {"type":"FeatureCollection","features":[…],"truncated":bool} with the old
 * kind vocabulary (place | major-road | road | building | water | other).
 */
public class ObfService {

    private static final Gson GSON = new Gson();
    private static final Set<String> WL_KEYS = Set.of(
            "highway", "railway", "waterway", "natural", "building", "landuse", "leisure", "place",
            "surface", "tracktype", "bridge", "tunnel", "oneway", "maxspeed", "ref");
    private static final Set<String> GREEN_NATURAL = Set.of("wood", "wetland", "scrub", "grassland", "heath");
    private static final Set<String> GREEN_LANDUSE = Set.of(
            "forest", "grass", "meadow", "village_green", "recreation_ground", "orchard", "allotments");
    private static final Set<String> GREEN_LEISURE = Set.of(
            "park", "garden", "pitch", "playground", "golf_course", "nature_reserve");

    private final LinkedHashMap<String, BinaryMapIndexReader> readers = new LinkedHashMap<>();
    private List<String> opened = List.of();

    public static void main(String[] args) throws IOException {
        ObfService service = new ObfService();
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8));
        String line;
        while ((line = in.readLine()) != null) {
            String out;
            try {
                out = service.handle(line);
            } catch (Exception e) {
                out = error(e.getMessage() == null ? e.toString() : e.getMessage());
            }
            System.out.println(out);
            System.out.flush();
        }
    }

    synchronized String handle(String line) throws IOException {
        JsonObject req = GSON.fromJson(line, JsonObject.class);
        if (req == null || req.get("op") == null) {
            return error("Anfrage ohne op");
        }
        return switch (req.get("op").getAsString()) {
            case "ping" -> "{\"ok\":true}";
            case "open" -> open(req);
            case "bounds" -> bounds();
            case "query" -> query(req);
            case "search" -> search(req);
            default -> error("Unbekannter Vorgang");
        };
    }

    private synchronized String bounds() {
        StringBuilder sb = new StringBuilder("{\"bounds\":[");
        boolean first = true;
        for (String path : opened) {
            BinaryMapIndexReader reader = readers.get(path);
            if (reader == null) {
                continue;
            }
            int w = Integer.MAX_VALUE, s = Integer.MAX_VALUE;
            int e = Integer.MIN_VALUE, n = Integer.MIN_VALUE;
            boolean any = false;
            for (BinaryIndexPart part : reader.getIndexes()) {
                if (!(part instanceof BinaryMapIndexReader.MapIndex)) {
                    continue;
                }
                BinaryMapIndexReader.MapIndex mi = (BinaryMapIndexReader.MapIndex) part;
                for (BinaryMapIndexReader.MapRoot r : mi.getRoots()) {
                    any = true;
                    w = Math.min(w, r.getLeft());
                    e = Math.max(e, r.getRight());
                    n = Math.min(n, r.getTop()); // y grows southward
                    s = Math.max(s, r.getBottom());
                }
            }
            if (!first) {
                sb.append(',');
            }
            first = false;
            if (!any) {
                sb.append("null");
                continue;
            }
            sb.append('[')
                    .append(String.format(Locale.ROOT, "%.6f", MapUtils.get31LongitudeX(w)))
                    .append(',')
                    .append(String.format(Locale.ROOT, "%.6f", MapUtils.get31LatitudeY(s)))
                    .append(',')
                    .append(String.format(Locale.ROOT, "%.6f", MapUtils.get31LongitudeX(e)))
                    .append(',')
                    .append(String.format(Locale.ROOT, "%.6f", MapUtils.get31LatitudeY(n)))
                    .append(']');
        }
        sb.append("]}");
        return sb.toString();
    }

    private String open(JsonObject req) throws IOException {
        List<String> files = new ArrayList<>();
        for (var el : req.getAsJsonArray("files")) {
            files.add(el.getAsString());
        }
        for (String gone : new ArrayList<>(readers.keySet())) {
            if (!files.contains(gone)) {
                readers.remove(gone); // RandomAccessFile is released with the reader
            }
        }
        for (String path : files) {
            if (!readers.containsKey(path)) {
                File f = new File(path);
                readers.put(path, new BinaryMapIndexReader(new RandomAccessFile(f, "r"), f));
            }
        }
        opened = files;
        return "{\"ok\":true,\"open\":" + readers.size() + "}";
    }

    private String query(JsonObject req) throws IOException {
        double w = req.get("w").getAsDouble();
        double s = req.get("s").getAsDouble();
        double e = req.get("e").getAsDouble();
        double n = req.get("n").getAsDouble();
        if (!Double.isFinite(w) || !Double.isFinite(s) || !Double.isFinite(e) || !Double.isFinite(n)
                || w > e || s > n || w < -180 || e > 180 || s < -90 || n > 90) {
            return error("Ungültiger Kartenausschnitt");
        }
        String purpose = req.get("purpose") == null ? "map" : req.get("purpose").getAsString();
        if (!purpose.equals("map") && !purpose.equals("map-overview") && !purpose.equals("detail")) {
            return error("Unbekannte Abfrage");
        }
        boolean overview = purpose.equals("map-overview");
        int limit = req.get("limit") == null ? 20001 : req.get("limit").getAsInt();

        int left = MapUtils.get31TileNumberX(w);
        int right = MapUtils.get31TileNumberX(e);
        int top = MapUtils.get31TileNumberY(n);   // north = smaller y
        int bottom = MapUtils.get31TileNumberY(s);

        StringBuilder sb = new StringBuilder(1 << 20);
        sb.append("{\"type\":\"FeatureCollection\",\"features\":[");
        Set<String> seen = new HashSet<>();
        int features = 0;
        boolean truncated = false;

        for (BinaryMapIndexReader reader : readers.values()) {
            for (BinaryIndexPart part : reader.getIndexes()) {
                if (!(part instanceof BinaryMapIndexReader.MapIndex)) {
                    continue;
                }
                BinaryMapIndexReader.MapIndex mi = (BinaryMapIndexReader.MapIndex) part;
                BinaryMapIndexReader.MapRoot detail = null;
                for (BinaryMapIndexReader.MapRoot r : mi.getRoots()) {
                    if (detail == null || r.getMinZoom() > detail.getMinZoom()) {
                        detail = r;
                    }
                }
                if (detail == null) {
                    continue;
                }
                BinaryMapIndexReader.SearchRequest<BinaryMapDataObject> request =
                        BinaryMapIndexReader.buildSearchRequest(left, right, top, bottom,
                                detail.getMinZoom(), (types, index) -> true);
                for (BinaryMapDataObject o : reader.searchMapIndex(request)) {
                    Map<String, String> tags = decode(o, mi);
                    String kind = kind(tags);
                    if (kind == null || (overview && !Set.of("major-road", "place", "water").contains(kind))) {
                        continue;
                    }
                    String id = kind + "/" + o.getId();
                    if (!seen.add(id)) {
                        continue;
                    }
                    if (features >= limit) {
                        truncated = true;
                        break;
                    }
                    if (features > 0) {
                        sb.append(',');
                    }
                    appendFeature(sb, o, kind, tags);
                    features++;
                }
                if (truncated) {
                    break;
                }
            }
            if (truncated) {
                break;
            }
        }
        sb.append("],\"truncated\":").append(truncated).append('}');
        if (truncated && purpose.equals("detail")) {
            return error("Zu viele Geometrien. Kleineres Gebiet wählen.");
        }
        return sb.toString();
    }

    private String search(JsonObject req) throws IOException {
        String q = req.get("q") == null ? "" : req.get("q").getAsString().toLowerCase(Locale.ROOT);
        int limit = req.get("limit") == null ? 40 : req.get("limit").getAsInt();
        if (q.length() < 2) {
            return "{\"results\":[]}";
        }
        StringBuilder sb = new StringBuilder(1 << 14);
        sb.append("{\"results\":[");
        int count = 0;
        for (BinaryMapIndexReader reader : readers.values()) {
            for (BinaryIndexPart part : reader.getIndexes()) {
                if (!(part instanceof AddressRegion)) {
                    continue;
                }
                for (City city : reader.getCities(null, CityBlocks.CITY_TOWN_TYPE, null, null)) {
                    if (count >= limit) {
                        break;
                    }
                    boolean cityHit = city.getName().toLowerCase(Locale.ROOT).contains(q);
                    List<Street> hits = new ArrayList<>();
                    try {
                        reader.preloadStreets(city, null, null);
                        for (Street street : city.getStreets()) {
                            if (street.getName().toLowerCase(Locale.ROOT).contains(q)) {
                                hits.add(street);
                            }
                        }
                    } catch (IOException io) {
                        // A broken address block must not take down the whole search.
                    }
                    if (cityHit) {
                        appendPlace(sb, count++ > 0, "city", city.getName(), null, city.getLocation().getLongitude(),
                                city.getLocation().getLatitude());
                    }
                    for (Street street : hits) {
                        if (count >= limit) {
                            break;
                        }
                        appendPlace(sb, count++ > 0, "street", street.getName(), city.getName(),
                                street.getLocation().getLongitude(), street.getLocation().getLatitude());
                    }
                }
            }
        }
        sb.append("]}");
        return sb.toString();
    }

    // ------------------------------------------------------------------ //

    static Map<String, String> decode(BinaryMapDataObject o, BinaryMapIndexReader.MapIndex mi) {
        Map<String, String> tags = new LinkedHashMap<>();
        add(tags, mi, o.getTypes());
        add(tags, mi, o.getAdditionalTypes());
        return tags;
    }

    static void add(Map<String, String> tags, BinaryMapIndexReader.MapIndex mi, int[] types) {
        if (types == null) {
            return;
        }
        for (int tid : types) {
            BinaryMapIndexReader.TagValuePair tv = mi.decodeType(tid);
            if (tv != null && tv.tag != null && tv.value != null) {
                tags.putIfAbsent(tv.tag, tv.value);
            }
        }
    }

    /** Same vocabulary as the previous osm.rs kind(). */
    static String kind(Map<String, String> t) {
        if (t.containsKey("place")) {
            return "place";
        }
        String h = t.get("highway");
        if (h != null && (h.equals("motorway") || h.equals("trunk") || h.equals("primary") || h.equals("secondary"))) {
            return "major-road";
        }
        if (h != null) {
            return "road";
        }
        if (t.containsKey("building") && !"no".equals(t.get("building"))) {
            return "building";
        }
        if (t.containsKey("waterway") || "water".equals(t.get("natural"))) {
            return "water";
        }
        if (t.get("natural") != null && GREEN_NATURAL.contains(t.get("natural"))) {
            return "other";
        }
        String landuse = t.get("landuse");
        if (landuse != null && GREEN_LANDUSE.contains(landuse)) {
            return "other";
        }
        String leisure = t.get("leisure");
        if (leisure != null && GREEN_LEISURE.contains(leisure)) {
            return "other";
        }
        return null;
    }

    static void appendFeature(StringBuilder sb, BinaryMapDataObject o, String kind, Map<String, String> tags) {
        sb.append("{\"type\":\"Feature\",\"id\":\"").append(o.getId()).append("\",\"properties\":{\"kind\":\"")
                .append(kind).append('"');
        String name = o.getName();
        if (name != null && !name.isEmpty()) {
            sb.append(",\"name\":\"").append(escape(name)).append('"');
        }
        for (String k : WL_KEYS) {
            String v = tags.get(k);
            if (v != null && !v.isEmpty()) {
                sb.append(",\"").append(k).append("\":\"").append(escape(v)).append('"');
            }
        }
        sb.append("},\"geometry\":");

        int[] pts = o.getCoordinates();
        if (pts == null || pts.length < 2) {
            sb.append("{\"type\":\"Point\",\"coordinates\":[0,0]}");
            return;
        }
        boolean closed = pts.length >= 8 && pts[0] == pts[pts.length - 2] && pts[1] == pts[pts.length - 1];
        boolean kindIsArea = kind.equals("building")
                || (kind.equals("water") && ("water".equals(tags.get("natural"))
                        || "riverbank".equals(tags.get("waterway"))));
        if ((kindIsArea || isGreenKind(kind, tags)) && pts.length >= 8 && closed) {
            sb.append("{\"type\":\"Polygon\",\"coordinates\":[");
            appendRing(sb, pts, closed);
            int[][] inner = o.getPolygonInnerCoordinates();
            if (inner != null) {
                for (int[] ring : inner) {
                    sb.append(',');
                    appendRing(sb, ring, false);
                }
            }
            sb.append("]}");
        } else if (pts.length == 2) {
            sb.append("{\"type\":\"Point\",\"coordinates\":");
            appendPoint(sb, pts[0], pts[1]);
            sb.append('}');
        } else {
            sb.append("{\"type\":\"LineString\",\"coordinates\":");
            appendRing(sb, pts, false);
            sb.append('}');
        }
        sb.append('}');
    }

    static boolean isGreenKind(String kind, Map<String, String> tags) {
        if (!kind.equals("other")) {
            return false;
        }
        String natural = tags.get("natural");
        return (natural != null && GREEN_NATURAL.contains(natural))
                || (tags.get("landuse") != null && GREEN_LANDUSE.contains(tags.get("landuse")))
                || (tags.get("leisure") != null && GREEN_LEISURE.contains(tags.get("leisure")));
    }

    static void appendRing(StringBuilder sb, int[] pts, boolean alreadyClosed) {
        sb.append('[');
        int n = pts.length / 2;
        for (int i = 0; i < n; i++) {
            if (i > 0) {
                sb.append(',');
            }
            appendPoint(sb, pts[2 * i], pts[2 * i + 1]);
        }
        if (!alreadyClosed && n > 0 && (pts[0] != pts[pts.length - 2] || pts[1] != pts[pts.length - 1])) {
            sb.append(',');
            appendPoint(sb, pts[0], pts[1]);
        }
        sb.append(']');
    }

    static void appendPoint(StringBuilder sb, int x, int y) {
        sb.append('[').append(String.format(Locale.ROOT, "%.6f", MapUtils.get31LongitudeX(x)))
                .append(',').append(String.format(Locale.ROOT, "%.6f", MapUtils.get31LatitudeY(y))).append(']');
    }

    static void appendPlace(StringBuilder sb, boolean comma, String kind, String name, String city,
                            double lon, double lat) {
        if (comma) {
            sb.append(',');
        }
        sb.append("{\"type\":\"Feature\",\"id\":\"").append(kind).append('/')
                .append(escape(name)).append("\",\"properties\":{\"kind\":\"").append(kind)
                .append("\",\"name\":\"").append(escape(name)).append('"');
        if (city != null) {
            sb.append(",\"city\":\"").append(escape(city)).append('"');
        }
        sb.append("},\"geometry\":{\"type\":\"Point\",\"coordinates\":[")
                .append(String.format(Locale.ROOT, "%.6f", lon)).append(',')
                .append(String.format(Locale.ROOT, "%.6f", lat)).append("]}}");
    }

    static String escape(String s) {
        StringBuilder b = new StringBuilder(s.length());
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"' -> b.append("\\\"");
                case '\\' -> b.append("\\\\");
                case '\n' -> b.append("\\n");
                case '\r' -> b.append("\\r");
                case '\t' -> b.append("\\t");
                default -> {
                    if (c < 0x20) {
                        b.append(String.format("\\u%04x", (int) c));
                    } else {
                        b.append(c);
                    }
                }
            }
        }
        return b.toString();
    }

    static String error(String message) {
        return "{\"error\":\"" + escape(message) + "\"}";
    }
}