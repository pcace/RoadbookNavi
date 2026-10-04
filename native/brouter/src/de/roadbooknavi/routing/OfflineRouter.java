package de.roadbooknavi.routing;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import btools.router.*;

/** One engine adapter for Android ART and bundled desktop Java. No HTTP server. */
public final class OfflineRouter {
  public static synchronized String route(String root, String profile, String lonlats, String polygons) throws Exception {
    if (!profile.matches("[A-Za-z0-9_-]{1,100}")) throw new IllegalArgumentException("Invalid profile name");
    File profileFile = new File(root, "profiles2/" + profile + ".brf");
    if (!profileFile.isFile()) throw new FileNotFoundException("Profil fehlt: " + profile);
    RoutingContext context = new RoutingContext();
    context.localFunction = profileFile.getAbsolutePath();
    context.memoryclass = 256;
    RoutingParamCollector collector = new RoutingParamCollector();
    List<OsmNodeNamed> points = collector.getWayPointList(lonlats);
    if (points.size() < 2) throw new IllegalArgumentException("Mindestens zwei Wegpunkte benötigt");
    Map<String,String> params = new HashMap<>();
    params.put("timode", "3");
    if (polygons != null && !polygons.isEmpty()) params.put("polygons", polygons);
    collector.setParams(context, points, params);
    RoutingEngine engine = new RoutingEngine(null, null, new File(root,"segments4"), points, context);
    engine.quite = true;
    engine.doRun(120000);
    if (engine.getErrorMessage() != null) throw new IOException(engine.getErrorMessage());
    if (engine.getFoundTrack() == null) throw new IOException("Keine Route gefunden");
    return new FormatJson(context).format(engine.getFoundTrack());
  }
  public static void main(String[] args) throws Exception {
    if (args.length == 2 && "--self-test".equals(args[0])) {
      File root = new File(args[1]);
      File profile = new File(root, "profiles2/trekking.brf");
      File lookups = new File(root, "profiles2/lookups.dat");
      if (!profile.isFile()) throw new FileNotFoundException("Self-test profile missing: " + profile);
      if (!lookups.isFile()) throw new FileNotFoundException("Self-test lookups missing: " + lookups);
      new RoutingContext();
      System.out.print("RoadbookNavi routing engine OK");
      return;
    }
    if (args.length != 2) throw new IllegalArgumentException("root and profile required");
    BufferedReader in = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8));
    String points = in.readLine();
    String polygons = in.readLine();
    // Keep stdout a strict JSON channel even when BRouter logs diagnostics.
    PrintStream output = System.out;
    System.setOut(System.err);
    output.print(route(args[0], args[1], points, polygons));
  }
}
