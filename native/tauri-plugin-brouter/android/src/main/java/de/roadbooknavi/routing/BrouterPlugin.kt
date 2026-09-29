package de.roadbooknavi.routing

import android.app.Activity
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Plugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import java.util.concurrent.Executors

@InvokeArg
class RouteArgs {
    lateinit var root: String
    lateinit var profile: String
    lateinit var lonlats: String
    var polygons: String = ""
}

@TauriPlugin
class BrouterPlugin(activity: Activity): Plugin(activity) {
    private val executor = Executors.newSingleThreadExecutor()
    @Command
    fun route(invoke: Invoke) {
        val args = invoke.parseArgs(RouteArgs::class.java)
        executor.execute {
            try {
                val json = OfflineRouter.route(args.root, args.profile, args.lonlats, args.polygons)
                invoke.resolve(JSObject().put("geojson", json))
            } catch (error: Exception) {
                invoke.reject(error.message ?: "Routing fehlgeschlagen")
            }
        }
    }
}
