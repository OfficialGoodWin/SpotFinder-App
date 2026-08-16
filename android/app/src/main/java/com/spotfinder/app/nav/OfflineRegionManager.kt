package com.spotfinder.app.nav

import android.content.Context
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

/**
 * Downloads MBTiles into app-internal storage:
 * /data/user/0/<appId>/files/mbtiles/<regionId>.mbtiles
 */
class OfflineRegionManager private constructor(private val appContext: Context) {

    companion object {
        @Volatile
        private var INSTANCE: OfflineRegionManager? = null

        fun getInstance(context: Context): OfflineRegionManager {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: OfflineRegionManager(context.applicationContext).also { INSTANCE = it }
            }
        }
    }

    private val mbtilesDir: File = File(appContext.filesDir, "mbtiles").apply { mkdirs() }

    /**
     * IMPORTANT:
     * Replace endpoint builder with your real backend endpoint that returns mbtiles for bbox.
     * For now this method expects:
     * https://spot-finder-app.vercel.app/api/download-mbtiles?regionId=...&west=...&south=...&east=...&north=...
     */
    fun downloadMbtilesForBbox(
        regionId: String,
        west: Double,
        south: Double,
        east: Double,
        north: Double,
        onProgress: (Int) -> Unit
    ): String {
        val urlStr = "https://spot-finder-app.vercel.app/api/download-mbtiles" +
                "?regionId=$regionId&west=$west&south=$south&east=$east&north=$north"

        val outFile = File(mbtilesDir, "$regionId.mbtiles")
        if (outFile.exists()) outFile.delete()

        val conn = URL(urlStr).openConnection() as HttpURLConnection
        conn.connectTimeout = 30000
        conn.readTimeout = 30000
        conn.requestMethod = "GET"
        conn.connect()

        if (conn.responseCode !in 200..299) {
            throw IllegalStateException("HTTP ${conn.responseCode} downloading mbtiles")
        }

        val total = conn.contentLengthLong.coerceAtLeast(1L)
        var downloaded = 0L

        conn.inputStream.use { input ->
            FileOutputStream(outFile).use { output ->
                val buffer = ByteArray(1024 * 64)
                while (true) {
                    val read = input.read(buffer)
                    if (read <= 0) break
                    output.write(buffer, 0, read)
                    downloaded += read
                    val pct = ((downloaded * 100) / total).toInt().coerceIn(0, 100)
                    onProgress(pct)
                }
                output.flush()
            }
        }

        onProgress(100)
        return outFile.absolutePath
    }
}
