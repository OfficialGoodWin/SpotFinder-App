package com.spotfinder.app.map

import android.graphics.drawable.Drawable
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import com.spotfinder.app.R
import com.spotfinder.app.data.Poi
import com.spotfinder.app.data.RegionRepository
import com.spotfinder.app.data.Spot
import com.spotfinder.app.nav.RouteResult
import org.mapsforge.core.graphics.Bitmap
import org.mapsforge.core.graphics.Color
import org.mapsforge.core.graphics.Style
import org.mapsforge.core.model.LatLong
import org.mapsforge.map.android.graphics.AndroidGraphicFactory
import org.mapsforge.map.android.util.AndroidUtil
import org.mapsforge.map.android.view.MapView
import org.mapsforge.map.layer.Layer
import org.mapsforge.map.layer.cache.TileCache
import org.mapsforge.map.layer.overlay.Marker
import org.mapsforge.map.layer.overlay.Polyline
import org.mapsforge.map.layer.renderer.TileRendererLayer
import org.mapsforge.map.reader.MapFile
import org.mapsforge.map.rendertheme.InternalRenderTheme

/**
 * Fully offline Mapsforge map view.
 *
 *  - Renders a local `.map` file with a bundled (internal) render theme; no
 *    network access whatsoever.
 *  - Draws an OSRM route polyline ([showRoute]).
 *  - Renders two visually distinct marker sets: static POIs ([showPois], blue
 *    pins) and user Spots ([showSpots], orange stars).
 *
 * Pass the region id via [newInstance].
 */
class MapFragment : Fragment() {

    private lateinit var mapView: MapView
    private lateinit var tileCache: TileCache
    private var tileRendererLayer: TileRendererLayer? = null

    // Overlay layers kept so we can clear/replace them on each update.
    private var routeLayer: Polyline? = null
    private val poiMarkers = mutableListOf<Marker>()
    private val spotMarkers = mutableListOf<Marker>()

    // Pre-converted marker bitmaps (built once, reused for every marker).
    private lateinit var poiBitmap: Bitmap
    private lateinit var spotBitmap: Bitmap

    private val regionId: String
        get() = requireArguments().getString(ARG_REGION) ?: error("regionId missing")

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?,
    ): View {
        // MapView is created programmatically; it is its own ViewGroup.
        mapView = MapView(requireContext()).apply {
            isClickable = true
            mapScaleBar.isVisible = true
            setBuiltInZoomControls(true)
        }
        return mapView
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val repo = RegionRepository(requireContext())
        val mapFile = repo.mapFile(regionId)
        check(mapFile.exists()) { "Map not downloaded for region $regionId" }

        // 1) Tile cache sized to the screen.
        tileCache = AndroidUtil.createTileCache(
            requireContext(),
            "mapcache-$regionId",
            mapView.model.displayModel.tileSize,
            1f,
            mapView.model.frameBufferModel.overdrawFactor,
        )

        // 2) Offline data store from the local .map file.
        val mapStore = MapFile(mapFile)

        // 3) Renderer layer with a bundled render theme (offline).
        val renderer = TileRendererLayer(
            tileCache,
            mapStore,
            mapView.model.mapViewPosition,
            AndroidGraphicFactory.INSTANCE,
        ).apply {
            setXmlRenderTheme(InternalRenderTheme.DEFAULT)
        }
        tileRendererLayer = renderer
        mapView.layerManager.layers.add(renderer)

        // 4) Initial camera: center of the map's bounding box, sensible zoom.
        val bbox = mapStore.boundingBox()
        mapView.setCenter(bbox.centerPoint)
        mapView.setZoomLevel(15.toByte())

        // 5) Build the two marker bitmaps once.
        poiBitmap = drawableToBitmap(R.drawable.ic_marker_poi)
        spotBitmap = drawableToBitmap(R.drawable.ic_marker_spot)
    }

    // ========================================================================
    //  Route polyline
    // ========================================================================

    /** Draws the OSRM route geometry, replacing any previous route. */
    fun showRoute(result: RouteResult) {
        routeLayer?.let { mapView.layerManager.layers.remove(it) }

        val paint = AndroidGraphicFactory.INSTANCE.createPaint().apply {
            color = AndroidGraphicFactory.INSTANCE.createColor(Color.BLUE)
            setStrokeWidth(dp(6f))
            setStyle(Style.STROKE)
        }

        val line = Polyline(paint, AndroidGraphicFactory.INSTANCE)
        result.geometry.forEach { p -> line.latLongs.add(LatLong(p.lat, p.lon)) }

        routeLayer = line
        mapView.layerManager.layers.add(line)
        mapView.layerManager.redrawLayers()
    }

    // ========================================================================
    //  Markers — two distinct styles
    // ========================================================================

    /** Renders static POIs as blue pins (anchored at the tip). */
    fun showPois(pois: List<Poi>) {
        clearMarkers(poiMarkers)
        pois.forEach { poi ->
            // verticalOffset moves the anchor to the pin's bottom tip.
            val marker = Marker(
                LatLong(poi.lat, poi.lon),
                poiBitmap,
                0,
                -poiBitmap.height / 2,
            )
            poiMarkers.add(marker)
            mapView.layerManager.layers.add(marker)
        }
        mapView.layerManager.redrawLayers()
    }

    /** Renders custom Spots as orange stars (center-anchored). */
    fun showSpots(spots: List<Spot>) {
        clearMarkers(spotMarkers)
        spots.forEach { spot ->
            val marker = Marker(LatLong(spot.lat, spot.lon), spotBitmap, 0, 0)
            spotMarkers.add(marker)
            mapView.layerManager.layers.add(marker)
        }
        mapView.layerManager.redrawLayers()
    }

    private fun clearMarkers(markers: MutableList<Marker>) {
        markers.forEach { mapView.layerManager.layers.remove(it) }
        markers.clear()
    }

    // ========================================================================
    //  Helpers + lifecycle
    // ========================================================================

    private fun dp(value: Float): Float = value * resources.displayMetrics.density

    /** Convert a vector drawable resource into a Mapsforge bitmap. */
    private fun drawableToBitmap(resId: Int): Bitmap {
        val drawable: Drawable = ContextCompat.getDrawable(requireContext(), resId)
            ?: error("Drawable $resId not found")
        return AndroidGraphicFactory.convertToBitmap(drawable)
    }

    override fun onDestroyView() {
        // Explicit teardown so native tile caches and bitmaps are released.
        clearMarkers(poiMarkers)
        clearMarkers(spotMarkers)
        routeLayer?.let { mapView.layerManager.layers.remove(it) }
        routeLayer = null

        mapView.layerManager.layers.remove(tileRendererLayer as Layer)
        tileRendererLayer?.onDestroy()   // releases the MapFile handle
        tileRendererLayer = null

        tileCache.destroy()
        mapView.destroyAll()             // frees frame buffer + layers

        if (::poiBitmap.isInitialized) poiBitmap.decrementRefCount()
        if (::spotBitmap.isInitialized) spotBitmap.decrementRefCount()

        super.onDestroyView()
    }

    companion object {
        private const val ARG_REGION = "regionId"

        fun newInstance(regionId: String) = MapFragment().apply {
            arguments = Bundle().apply { putString(ARG_REGION, regionId) }
        }
    }
}
