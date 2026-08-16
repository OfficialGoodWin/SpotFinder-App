package com.spotfinder.app.nav

import androidx.annotation.WorkerThread
import java.io.Closeable
import java.util.concurrent.atomic.AtomicLong

/**
 * Kotlin front-end for the native libosrm (MLD) routing engine.
 *
 * Maps 1:1 to the JNI functions in `osrm_bridge.cpp`:
 *   - [nativeInit]    opens the offline MLD dataset, returns an opaque handle.
 *   - [nativeRoute]   computes one route, returns a packed double[] (see below).
 *   - [nativeDestroy] frees the native handle.
 *
 * The native side owns one heap object per handle; [close] frees it exactly once.
 * Instances are safe to query concurrently once [open] has succeeded (libosrm
 * route queries are thread-safe), but you must not [close] while queries run.
 */
class OsrmEngine : Closeable {

    /** 0 = not open. Any non-zero value is a live native handle pointer. */
    private val handle = AtomicLong(0L)

    val isOpen: Boolean get() = handle.get() != 0L

    /**
     * Opens the MLD dataset.
     *
     * @param osrmBasePath absolute base path WITHOUT extension suffix, e.g.
     *        `.../files/regions/monaco/osrm/region.osrm`. libosrm appends the
     *        `.mldgr`, `.partition`, `.cells`, ... suffixes itself.
     * @throws IllegalStateException if the dataset cannot be loaded.
     */
    @WorkerThread
    fun open(osrmBasePath: String) {
        check(!isOpen) { "OsrmEngine already open" }
        val h = nativeInit(osrmBasePath)
        check(h != 0L) { "Failed to load OSRM MLD data at $osrmBasePath" }
        handle.set(h)
    }

    /**
     * Computes the shortest route between two WGS84 coordinates.
     *
     * @return a [RouteResult] on success, or `null` if no route was found.
     * @throws IllegalStateException if the engine is not open.
     */
    @WorkerThread
    fun route(startLat: Double, startLon: Double, endLat: Double, endLon: Double): RouteResult? {
        val h = handle.get()
        check(h != 0L) { "OsrmEngine is not open" }

        val packed = nativeRoute(h, startLat, startLon, endLat, endLon)
        return RouteResult.fromPacked(packed)
    }

    /** Frees the native handle. Idempotent. */
    override fun close() {
        val h = handle.getAndSet(0L)
        if (h != 0L) nativeDestroy(h)
    }

    // --- JNI ---
    private external fun nativeInit(osrmBasePath: String): Long
    private external fun nativeRoute(
        handle: Long,
        startLat: Double, startLon: Double,
        endLat: Double, endLon: Double,
    ): DoubleArray
    private external fun nativeDestroy(handle: Long)

    companion object {
        init {
            // One shared library holds both the OSRM and SpatiaLite bridges.
            System.loadLibrary("spotfinder_native")
        }
    }
}

/** A computed route: total [distanceMeters], [durationSeconds] and the [geometry]. */
data class RouteResult(
    val distanceMeters: Double,
    val durationSeconds: Double,
    /** Polyline as ordered (lat, lon) pairs, ready for a Mapsforge Polyline. */
    val geometry: List<LatLon>,
) {
    companion object {
        private const val HEADER = 4

        /**
         * Decodes the packed native array:
         *   [0]=status(1/0) [1]=distance [2]=duration [3]=N  then N*(lat,lon).
         */
        fun fromPacked(a: DoubleArray): RouteResult? {
            if (a.size < HEADER || a[0] != 1.0) return null
            val n = a[3].toInt()
            if (n < 0 || a.size < HEADER + 2 * n) return null

            val pts = ArrayList<LatLon>(n)
            var i = HEADER
            repeat(n) {
                pts.add(LatLon(a[i], a[i + 1]))
                i += 2
            }
            return RouteResult(a[1], a[2], pts)
        }
    }
}

data class LatLon(val lat: Double, val lon: Double)
