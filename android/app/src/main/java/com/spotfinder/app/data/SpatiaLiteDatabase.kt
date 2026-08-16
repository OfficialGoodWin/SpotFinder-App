package com.spotfinder.app.data

import androidx.annotation.WorkerThread
import org.json.JSONArray
import java.io.Closeable
import java.util.Locale
import java.util.concurrent.atomic.AtomicLong

/**
 * Offline spatial store backed by statically-linked SQLite (FTS5 + R*Tree) and
 * SpatiaLite. Handles two datasets from the Phase 1 database:
 *
 *   - `pois`         : read-only static OSM POIs (+ `pois_fts`)
 *   - `custom_spots` : read/write user markers/events (+ `spots_fts`, kept in
 *                      sync by triggers)
 *
 * Coordinates and radii are formatted into SQL as literals ([Locale.US] so the
 * decimal separator is always '.'); free text is bound as a parameter to avoid
 * SQL injection.
 */
class SpatiaLiteDatabase : Closeable {

    private val handle = AtomicLong(0L)
    val isOpen: Boolean get() = handle.get() != 0L

    @WorkerThread
    fun open(dbPath: String) {
        check(!isOpen) { "SpatiaLiteDatabase already open" }
        val h = nativeOpen(dbPath)
        check(h != 0L) { "Failed to open SpatiaLite db at $dbPath" }
        handle.set(h)
    }

    override fun close() {
        val h = handle.getAndSet(0L)
        if (h != 0L) nativeClose(h)
    }

    // ========================================================================
    //  (a) Static POI search: radius + optional FTS5 text match.
    // ========================================================================

    /**
     * Finds static POIs within [radiusMeters] of ([lat],[lon]).
     * If [term] is non-blank, results are additionally filtered by an FTS5
     * prefix match on name/category.
     */
    @WorkerThread
    fun searchPois(
        lat: Double,
        lon: Double,
        radiusMeters: Double,
        term: String? = null,
        limit: Int = 200,
    ): List<Poi> {
        val h = requireHandle()
        val degR = degreesForMeters(radiusMeters, lat)

        val (sql, args) = if (term.isNullOrBlank()) {
            // Radius only. R*Tree pre-filter via SpatialIndex, exact via PtDistWithin.
            val s = """
                SELECT p.id AS id, p.name AS name, p.category AS category,
                       p.kind AS kind, p.lat AS lat, p.lon AS lon,
                       ST_Distance(p.geom, MakePoint(${d(lon)}, ${d(lat)}, 4326), 1) AS dist_m
                FROM pois p
                WHERE p.ROWID IN (
                    SELECT ROWID FROM SpatialIndex
                    WHERE f_table_name = 'pois'
                      AND search_frame = BuildCircleMbr(${d(lon)}, ${d(lat)}, ${d(degR)}, 4326)
                )
                AND PtDistWithin(p.geom, MakePoint(${d(lon)}, ${d(lat)}, 4326), ${d(radiusMeters)}, 0)
                ORDER BY dist_m
                LIMIT $limit;
            """.trimIndent()
            s to emptyArray<String>()
        } else {
            // FTS5 MATCH joined to the base table, then the same spatial filter.
            val s = """
                SELECT p.id AS id, p.name AS name, p.category AS category,
                       p.kind AS kind, p.lat AS lat, p.lon AS lon,
                       ST_Distance(p.geom, MakePoint(${d(lon)}, ${d(lat)}, 4326), 1) AS dist_m
                FROM pois_fts f
                JOIN pois p ON p.id = f.rowid
                WHERE pois_fts MATCH ?
                  AND p.ROWID IN (
                      SELECT ROWID FROM SpatialIndex
                      WHERE f_table_name = 'pois'
                        AND search_frame = BuildCircleMbr(${d(lon)}, ${d(lat)}, ${d(degR)}, 4326)
                  )
                  AND PtDistWithin(p.geom, MakePoint(${d(lon)}, ${d(lat)}, 4326), ${d(radiusMeters)}, 0)
                ORDER BY dist_m
                LIMIT $limit;
            """.trimIndent()
            s to arrayOf(toFtsQuery(term))
        }

        return parsePois(nativeQueryJson(h, sql, args))
    }

    // ========================================================================
    //  (b) Custom spots: insert / query-by-radius / update / delete.
    // ========================================================================

    /** Inserts a custom spot; returns the new row id (or -1 on failure). */
    @WorkerThread
    fun insertSpot(
        title: String,
        description: String?,
        spotType: String?,
        lat: Double,
        lon: Double,
    ): Long {
        val h = requireHandle()
        val sql = """
            INSERT INTO custom_spots (title, description, spot_type, lat, lon, geom)
            VALUES (?, ?, ?, ${d(lat)}, ${d(lon)}, MakePoint(${d(lon)}, ${d(lat)}, 4326));
        """.trimIndent()
        // The spots_ai trigger mirrors this into spots_fts automatically.
        return nativeInsert(h, sql, arrayOf(title, description ?: "", spotType ?: ""))
    }

    /** Finds custom spots within [radiusMeters], with optional FTS5 text match. */
    @WorkerThread
    fun searchSpots(
        lat: Double,
        lon: Double,
        radiusMeters: Double,
        term: String? = null,
        limit: Int = 200,
    ): List<Spot> {
        val h = requireHandle()
        val degR = degreesForMeters(radiusMeters, lat)

        val (sql, args) = if (term.isNullOrBlank()) {
            val s = """
                SELECT s.id AS id, s.title AS title, s.description AS description,
                       s.spot_type AS spot_type, s.lat AS lat, s.lon AS lon,
                       s.created_at AS created_at,
                       ST_Distance(s.geom, MakePoint(${d(lon)}, ${d(lat)}, 4326), 1) AS dist_m
                FROM custom_spots s
                WHERE s.ROWID IN (
                    SELECT ROWID FROM SpatialIndex
                    WHERE f_table_name = 'custom_spots'
                      AND search_frame = BuildCircleMbr(${d(lon)}, ${d(lat)}, ${d(degR)}, 4326)
                )
                AND PtDistWithin(s.geom, MakePoint(${d(lon)}, ${d(lat)}, 4326), ${d(radiusMeters)}, 0)
                ORDER BY dist_m
                LIMIT $limit;
            """.trimIndent()
            s to emptyArray<String>()
        } else {
            val s = """
                SELECT s.id AS id, s.title AS title, s.description AS description,
                       s.spot_type AS spot_type, s.lat AS lat, s.lon AS lon,
                       s.created_at AS created_at,
                       ST_Distance(s.geom, MakePoint(${d(lon)}, ${d(lat)}, 4326), 1) AS dist_m
                FROM spots_fts f
                JOIN custom_spots s ON s.id = f.rowid
                WHERE spots_fts MATCH ?
                  AND s.ROWID IN (
                      SELECT ROWID FROM SpatialIndex
                      WHERE f_table_name = 'custom_spots'
                        AND search_frame = BuildCircleMbr(${d(lon)}, ${d(lat)}, ${d(degR)}, 4326)
                  )
                  AND PtDistWithin(s.geom, MakePoint(${d(lon)}, ${d(lat)}, 4326), ${d(radiusMeters)}, 0)
                ORDER BY dist_m
                LIMIT $limit;
            """.trimIndent()
            s to arrayOf(toFtsQuery(term))
        }

        return parseSpots(nativeQueryJson(h, sql, args))
    }

    /** Updates an existing spot's text fields. Returns rows affected. */
    @WorkerThread
    fun updateSpot(id: Long, title: String, description: String?, spotType: String?): Int {
        val h = requireHandle()
        val sql = """
            UPDATE custom_spots
               SET title = ?, description = ?, spot_type = ?,
                   updated_at = strftime('%s','now')
             WHERE id = $id;
        """.trimIndent()
        return nativeExecute(h, sql, arrayOf(title, description ?: "", spotType ?: ""))
    }

    /** Deletes a spot (the spots_ad trigger removes its FTS row). */
    @WorkerThread
    fun deleteSpot(id: Long): Int {
        val h = requireHandle()
        return nativeExecute(h, "DELETE FROM custom_spots WHERE id = $id;", emptyArray())
    }

    // ========================================================================
    //  Helpers
    // ========================================================================

    private fun requireHandle(): Long {
        val h = handle.get()
        check(h != 0L) { "SpatiaLiteDatabase is not open" }
        return h
    }

    /** Format a double as a SQL literal with '.' decimal separator. */
    private fun d(v: Double): String = String.format(Locale.US, "%.9f", v)

    /** Meters -> approximate degrees for the R*Tree MBR pre-filter (padded). */
    private fun degreesForMeters(meters: Double, atLat: Double): Double {
        val metersPerDegLat = 111_320.0
        // Longitude degrees shrink with latitude; use the tighter of the two so
        // the MBR safely encloses the circle, then PtDistWithin trims it exact.
        val cos = Math.cos(Math.toRadians(atLat)).coerceAtLeast(1e-6)
        val degLat = meters / metersPerDegLat
        val degLon = meters / (metersPerDegLat * cos)
        return maxOf(degLat, degLon) * 1.05
    }

    /** Turn free user text into a safe FTS5 prefix query: `"foo"* "bar"*`. */
    private fun toFtsQuery(term: String): String =
        term.trim()
            .split(Regex("\\s+"))
            .filter { it.isNotBlank() }
            .joinToString(" ") { token ->
                val escaped = token.replace("\"", "\"\"")
                "\"$escaped\"*"
            }

    private fun parsePois(json: String): List<Poi> {
        val arr = JSONArray(json)
        return (0 until arr.length()).map { i ->
            val o = arr.getJSONObject(i)
            Poi(
                id = o.getLong("id"),
                name = o.optString("name", ""),
                category = o.optString("category", ""),
                kind = o.optString("kind", ""),
                lat = o.getDouble("lat"),
                lon = o.getDouble("lon"),
                distanceMeters = o.optDouble("dist_m", Double.NaN),
            )
        }
    }

    private fun parseSpots(json: String): List<Spot> {
        val arr = JSONArray(json)
        return (0 until arr.length()).map { i ->
            val o = arr.getJSONObject(i)
            Spot(
                id = o.getLong("id"),
                title = o.optString("title", ""),
                description = o.optString("description", ""),
                spotType = o.optString("spot_type", ""),
                lat = o.getDouble("lat"),
                lon = o.getDouble("lon"),
                createdAt = o.optLong("created_at", 0L),
                distanceMeters = o.optDouble("dist_m", Double.NaN),
            )
        }
    }

    // --- JNI ---
    private external fun nativeOpen(dbPath: String): Long
    private external fun nativeQueryJson(handle: Long, sql: String, args: Array<String>): String
    private external fun nativeInsert(handle: Long, sql: String, args: Array<String>): Long
    private external fun nativeExecute(handle: Long, sql: String, args: Array<String>): Int
    private external fun nativeClose(handle: Long)

    companion object {
        init {
            System.loadLibrary("spotfinder_native")
        }
    }
}

data class Poi(
    val id: Long,
    val name: String,
    val category: String,
    val kind: String,
    val lat: Double,
    val lon: Double,
    val distanceMeters: Double,
)

data class Spot(
    val id: Long,
    val title: String,
    val description: String,
    val spotType: String,
    val lat: Double,
    val lon: Double,
    val createdAt: Long,
    val distanceMeters: Double,
)
