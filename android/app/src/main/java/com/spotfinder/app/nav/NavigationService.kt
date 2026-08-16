package com.spotfinder.app.nav

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.spotfinder.app.R

/**
 * Foreground navigation service placeholder:
 * - Keeps navigation alive in background
 * - Will host GPS tracking + snap-to-route + TTS logic
 */
class NavigationService : Service() {

    companion object {
        const val CHANNEL_ID = "spotfinder_navigation"
        const val NOTIFICATION_ID = 7001
        const val EXTRA_ROUTE_GEOJSON = "extra_route_geojson"

        fun start(context: Context, routeGeoJson: String) {
            val intent = Intent(context, NavigationService::class.java).apply {
                putExtra(EXTRA_ROUTE_GEOJSON, routeGeoJson)
            }
            context.startForegroundService(intent)
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, NavigationService::class.java))
        }
    }

    override fun onCreate() {
        super.onCreate()
        createChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val routeGeoJson = intent?.getStringExtra(EXTRA_ROUTE_GEOJSON).orEmpty()
        startForeground(NOTIFICATION_ID, buildNotification(routeGeoJson))

        // TODO: attach fused location updates, route snapping and TTS here
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Spotfinder Navigation",
                NotificationManager.IMPORTANCE_LOW
            )
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(routeGeoJson: String): Notification {
        val txt = if (routeGeoJson.isNotBlank()) "Navigation active" else "Preparing navigation"
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Spotfinder")
            .setContentText(txt)
            .setOngoing(true)
            .build()
    }
}
