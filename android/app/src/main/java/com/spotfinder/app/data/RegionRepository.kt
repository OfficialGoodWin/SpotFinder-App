package com.spotfinder.app.data

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream
import org.apache.commons.compress.compressors.zstandard.ZstdCompressorInputStream
import java.io.File

/**
 * Manages download-on-demand offline region packs.
 *
 * Each region pack (produced by the Phase 1 desktop pipeline, archived as
 * `<regionId>.tar.zst`) contains:
 *
 *   region.map            - Mapsforge vector map               (MainActivity / MapFragment)
 *   pois_spots.db         - SpatiaLite DB: pois + custom_spots  (SpatiaLiteDatabase)
 *   osrm/region.osrm.*    - OSRM MLD routing graph               (OsrmEngine)
 *
 * Packs are extracted into app-private internal storage under:
 *   filesDir/regions/<regionId>/
 *
 * Downloads extract into a temp directory first and are atomically swapped
 * into place, so a killed/failed download never leaves a half-installed,
 * "looks valid" region on disk.
 */
class RegionRepository(private val context: Context) {

    private val http = OkHttpClient()
    private val regionsDir: File = File(context.filesDir, "regions").apply { mkdirs() }

    // ==========================================================================
    //  Paths consumed by the native engines / map layer.
    // ==========================================================================

    fun regionDir(regionId: String): File = File(regionsDir, regionId)

    /** True once a region has been fully extracted (manifest present). */
    fun isInstalled(regionId: String): Boolean =
        File(regionDir(regionId), "manifest.json").exists()

    /** Mapsforge vector map for [regionId]. */
    fun mapFile(regionId: String): File =
        File(regionDir(regionId), "region.map")

    /** SpatiaLite database (read-only pois + read/write custom_spots) for [regionId]. */
    fun sqliteFile(regionId: String): File =
        File(regionDir(regionId), "pois_spots.db")

    /**
     * Base path for the OSRM MLD dataset, e.g. ".../osrm/region.osrm" with NO
     * extension suffix. libosrm appends .mldgr/.partition/.cells/... itself.
     */
    fun osrmBasePath(regionId: String): String =
        File(regionDir(regionId), "osrm/region.osrm").absolutePath

    // ==========================================================================
    //  Download + extract
    // ==========================================================================

    /**
     * Streams and extracts a `<regionId>.tar.zst` archive from [url] into
     * `filesDir/regions/<regionId>`, replacing any previous copy of the region
     * only after the full archive has been extracted successfully.
     *
     * @param onProgress bytes downloaded / total content length (total may be
     *        -1 if the server didn't send Content-Length).
     * @throws IllegalStateException on HTTP failure, an unsafe archive entry
     *         path (zip-slip guard), or a failed atomic swap.
     */
    suspend fun download(
        regionId: String,
        url: String,
        onProgress: (bytesRead: Long, totalBytes: Long) -> Unit = { _, _ -> },
    ) = withContext(Dispatchers.IO) {
        val tmp = File(regionsDir, "$regionId.tmp").apply {
            deleteRecursively()
            mkdirs()
        }

        try {
            val request = Request.Builder().url(url).build()
            http.newCall(request).execute().use { response ->
                check(response.isSuccessful) { "Download failed: HTTP ${response.code}" }
                val body = checkNotNull(response.body) { "Empty response body for $url" }
                val total = body.contentLength()
                var read = 0L

                TarArchiveInputStream(ZstdCompressorInputStream(body.byteStream())).use { tar ->
                    val buffer = ByteArray(64 * 1024)
                    var entry = tar.nextTarEntry
                    while (entry != null) {
                        val outFile = File(tmp, entry.name)

                        // Zip-slip guard: every extracted path must stay inside tmp.
                        check(outFile.canonicalPath.startsWith(tmp.canonicalPath + File.separator) ||
                            outFile.canonicalPath == tmp.canonicalPath) {
                            "Refusing to extract entry outside target dir: ${entry.name}"
                        }

                        if (entry.isDirectory) {
                            outFile.mkdirs()
                        } else {
                            outFile.parentFile?.mkdirs()
                            outFile.outputStream().use { out ->
                                var n = tar.read(buffer)
                                while (n >= 0) {
                                    if (n > 0) {
                                        out.write(buffer, 0, n)
                                        read += n
                                        onProgress(read, total)
                                    }
                                    n = tar.read(buffer)
                                }
                            }
                        }
                        entry = tar.nextTarEntry
                    }
                }
            }

            // Sanity check: the pack must contain the three assets we depend on.
            val expected = listOf(
                File(tmp, "region.map"),
                File(tmp, "pois_spots.db"),
                File(tmp, "osrm/region.osrm"),
            )
            val missing = expected.filterNot { it.exists() }
            check(missing.isEmpty()) {
                "Region pack for $regionId is missing: ${missing.joinToString { it.name }}"
            }

            // Atomic swap: only a fully extracted, validated pack becomes live.
            val dest = regionDir(regionId)
            dest.deleteRecursively()
            check(tmp.renameTo(dest)) { "Could not finalize region install for $regionId" }
        } catch (t: Throwable) {
            tmp.deleteRecursively()
            throw t
        }
    }

    /** Removes a downloaded region entirely, freeing its storage. */
    fun delete(regionId: String) {
        regionDir(regionId).deleteRecursively()
    }

    /** Total on-disk size of an installed region, in bytes. */
    fun sizeOnDisk(regionId: String): Long =
        regionDir(regionId).walkTopDown().filter { it.isFile }.sumOf { it.length() }

    /** All region ids currently installed (have a manifest.json). */
    fun installedRegions(): List<String> =
        regionsDir.listFiles { f -> f.isDirectory }
            ?.filter { File(it, "manifest.json").exists() }
            ?.map { it.name }
            ?: emptyList()
}
