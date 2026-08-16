package com.spotfinder.app.nav

import android.app.Activity
import android.view.ViewGroup
import android.widget.FrameLayout
import org.maplibre.android.MapLibre
import org.maplibre.android.maps.MapView
import org.maplibre.android.maps.Style
import java.io.File

/**
 * Native MapLibre full-screen overlay for smoother navigation rendering.
 * MBTiles integration point is prepared via local file path.
 */
class NativeMapOverlay private constructor(private val activity: Activity) {

    companion object {
        @Volatile
        private var INSTANCE: NativeMapOverlay? = null

        fun getInstance(activity: Activity): NativeMapOverlay {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: NativeMapOverlay(activity).also { INSTANCE = it }
            }
        }
    }

    private var container: FrameLayout? = null
    private var mapView: MapView? = null

    fun show(mbtilesPath: String) {
        if (container != null) return

        val mbtiles = File(mbtilesPath)
        if (!mbtiles.exists()) throw IllegalStateException("MBTiles not found: $mbtilesPath")

        MapLibre.getInstance(activity)

        val root = activity.findViewById<ViewGroup>(android.R.id.content)

        container = FrameLayout(activity).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }

        mapView = MapView(activity).also { mv ->
            container?.addView(
                mv,
                FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT
                )
            )

            mv.onCreate(null)
            mv.getMapAsync { map ->
                // NOTE:
                // For MBTiles, provide either:
                // 1) custom TileProvider backed by SQLite MBTiles reader, or
                // 2) local tile server endpoint (127.0.0.1) backed by MBTiles
                // Here we set a minimal style placeholder.
                map.setStyle(
                    Style.Builder().fromUri(Style.MAPBOX_STREETS)
                ) {
                    // TODO add raster/vector source from mbtilesPath
                }
            }
        }

        root.addView(container)
    }

    fun hide() {
        val root = activity.findViewById<ViewGroup>(android.R.id.content)
        container?.let { root.removeView(it) }
        mapView?.onDestroy()
        mapView = null
        container = null
    }
}
