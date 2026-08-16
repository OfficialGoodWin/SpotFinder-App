package com.spotfinder.app

import android.app.Application
import org.mapsforge.map.android.graphics.AndroidGraphicFactory

/**
 * Initialises the Mapsforge Android graphic factory exactly once for the whole
 * process. Mapsforge requires this before any MapView / bitmap is created.
 *
 * Register in AndroidManifest.xml:
 *   <application android:name=".SpotFinderApp" ...>
 */
class SpotFinderApp : Application() {
    override fun onCreate() {
        super.onCreate()
        AndroidGraphicFactory.createInstance(this)
    }
}
