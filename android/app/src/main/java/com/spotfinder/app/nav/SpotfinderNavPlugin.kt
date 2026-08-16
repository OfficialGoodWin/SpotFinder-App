package com.spotfinder.app.nav

import android.content.Intent
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.PluginMethod
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.UUID
import java.util.concurrent.Executors

/**
 * Capacitor bridge kept for compatibility while native core handles all heavy logic.
 * Exposed methods:
 * - downloadRegion(bbox)
 * - calculateRoute(points)
 * - startNavigation(routeGeoJson)
 */
@CapacitorPlugin(name = "SpotfinderNav")
class SpotfinderNavPlugin : Plugin() {

    private val ioExecutor = Executors.newSingleThreadExecutor()

    override fun load() {
        super.load()
        File(context.filesDir, "mbtiles").mkdirs()
        File(context.filesDir, "osrm").mkdirs()
    }

    @PluginMethod
    fun downloadRegion(call: PluginCall) {
        val bbox = call.getArray("bbox")
        if (bbox == null || bbox.length() != 4) {
            call.reject("bbox must be [west,south,east,north]")
            return
        }

        val west = bbox.optDouble(0)
        val south = bbox.optDouble(1)
        val east = bbox.optDouble(2)
        val north = bbox.optDouble(3)

        val regionId = call.getString("regionId") ?: UUID.randomUUID().toString()

        ioExecutor.execute {
            try {
                val manager = OfflineRegionManager.getInstance(context)
                val mbtilesPath = manager.downloadMbtilesForBbox(
                    regionId = regionId,
                    west = west,
                    south = south,
                    east = east,
                    north = north
                ) { pct ->
                    val ev = JSObject()
                    ev.put("regionId", regionId)
                    ev.put("pct", pct)
                    notifyListeners("downloadProgress", ev)
                }

                val ret = JSObject()
                ret.put("regionId", regionId)
                ret.put("mbtilesPath", mbtilesPath)
                call.resolve(ret)
            } catch (e: Exception) {
                call.reject("downloadRegion failed: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun calculateRoute(call: PluginCall) {
        val points = call.getArray("points")
        if (points == null || points.length() < 2) {
            call.reject("points must contain >= 2 coordinates")
            return
        }

        val osrmRegionPath = call.getString("osrmRegionPath")
        if (osrmRegionPath.isNullOrBlank()) {
            call.reject("Missing osrmRegionPath")
            return
        }

        ioExecutor.execute {
            try {
                val engine = OsrmEngine.getInstance(context)
                if (!engine.isInitialized()) {
                    val ok = engine.init(osrmRegionPath)
                    if (!ok) {
                        call.reject("Failed to initialize OSRM with path: $osrmRegionPath")
                        return@execute
                    }
                }

                val payload = JSONObject()
                payload.put("points", jsonArrayToLonLat(points))
                val raw = engine.calculateRoute(payload.toString())

                val ret = JSObject(raw)
                call.resolve(ret)
            } catch (e: Exception) {
                call.reject("calculateRoute failed: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun startNavigation(call: PluginCall) {
        val routeGeoJson = call.getString("routeGeoJson")
        if (routeGeoJson.isNullOrBlank()) {
            call.reject("Missing routeGeoJson")
            return
        }

        val intent = Intent(context, NavigationService::class.java).apply {
            putExtra(NavigationService.EXTRA_ROUTE_GEOJSON, routeGeoJson)
        }

        context.startForegroundService(intent)
        call.resolve(JSObject().put("started", true))
    }

    @PluginMethod
    fun showNativeMap(call: PluginCall) {
        val mbtilesPath = call.getString("mbtilesPath")
        if (mbtilesPath.isNullOrBlank()) {
            call.reject("Missing mbtilesPath")
            return
        }

        bridge.activity?.runOnUiThread {
            NativeMapOverlay.getInstance(bridge.activity).show(mbtilesPath)
            call.resolve(JSObject().put("shown", true))
        } ?: call.reject("No activity")
    }

    private fun jsonArrayToLonLat(points: JSArray): JSONArray {
        val out = JSONArray()
        for (i in 0 until points.length()) {
            val p = points.getJSONObject(i)
            val lon = p.optDouble("lon", Double.NaN)
            val lat = p.optDouble("lat", Double.NaN)
            if (!lon.isNaN() && !lat.isNaN()) {
                val obj = JSONObject()
                obj.put("lon", lon)
                obj.put("lat", lat)
                out.put(obj)
            }
        }
        return out
    }
}
