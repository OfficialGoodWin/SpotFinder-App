package com.spotfinder.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.IBinder;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import java.io.File;

/**
 * OsrmService.java — Android Foreground Service that runs osrm-routed.
 *
 * osrm-routed is the OSRM HTTP server binary. This service:
 *   1. Extracts the pre-compiled osrm-routed ARM64 binary from app assets
 *      (on first run only — cached in filesDir after that)
 *   2. Starts the process: osrm-routed --port 5000 <dataPath>
 *   3. Keeps it alive as a foreground service with a persistent notification
 *   4. Stops the process when stopService() is called
 *
 * ── Binary setup ─────────────────────────────────────────────────────────────
 *
 * You need a pre-compiled osrm-routed binary for Android ARM64.
 * Compilation options:
 *
 * Option A (recommended): Download pre-built binary from:
 *   https://github.com/Project-OSRM/osrm-backend/releases
 *   Look for Android ARM64 builds, or use a Docker cross-compilation setup.
 *
 * Option B: Cross-compile from source using the Android NDK:
 *   git clone https://github.com/Project-OSRM/osrm-backend
 *   cd osrm-backend
 *   cmake -DANDROID_ABI=arm64-v8a \
 *         -DCMAKE_TOOLCHAIN_FILE=$NDK/build/cmake/android.toolchain.cmake \
 *         -DANDROID_PLATFORM=android-24 \
 *         -DOSRM_BUILD_SHARED_LIBS=ON \
 *         -DENABLE_MASON=ON ..
 *   make -j$(nproc) osrm-routed
 *
 * Place the compiled binary at:
 *   android/app/src/main/assets/osrm-routed-arm64
 *
 * ── Routing data setup ───────────────────────────────────────────────────────
 *
 * Generate OSRM routing data per country using the OSRM command-line tools:
 *
 *   # Download OSM data
 *   wget https://download.geofabrik.de/europe/czech-republic-latest.osm.pbf
 *
 *   # Process with OSRM (MLD algorithm, best for mobile)
 *   osrm-extract -p /opt/osrm-backend/profiles/car.lua czech-republic-latest.osm.pbf
 *   osrm-partition czech-republic-latest.osrm
 *   osrm-customize czech-republic-latest.osrm
 *
 *   # Package all .osrm.* files into a single archive
 *   tar -czf CZ-osrm.tar.gz czech-republic-latest.osrm*
 *
 * Host CZ-osrm.tar.gz on the same server as your PMTiles files.
 * The OsrmPlugin.downloadData() method downloads and extracts it.
 *
 * Typical sizes (MLD algorithm, driving profile):
 *   Czech Republic: ~15 MB    Slovakia: ~10 MB    Austria: ~12 MB
 *   Germany: ~55 MB           France: ~70 MB      Poland: ~30 MB
 */
public class OsrmService extends Service {

    private static final String TAG         = "OsrmService";
    public  static final String EXTRA_DATA_PATH = "dataPath";
    public  static final String EXTRA_PORT      = "port";
    private static final String CHANNEL_ID  = "osrm_service";
    private static final int    NOTIF_ID    = 1001;

    private static volatile boolean sRunning = false;
    private Process osrmProcess;

    public static boolean isRunning() { return sRunning; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;

        String dataPath = intent.getStringExtra(EXTRA_DATA_PATH);
        int    port     = intent.getIntExtra(EXTRA_PORT, 5000);

        createNotificationChannel();
        startForeground(NOTIF_ID, buildNotification());

        // Kill any existing process first
        stopOsrmProcess();

        new Thread(() -> startOsrmProcess(dataPath, port)).start();

        return START_STICKY; // Restart automatically if killed by OS
    }

    private void startOsrmProcess(String dataPath, int port) {
        try {
            // Extract binary from assets on first run
            File binaryFile = extractBinary();
            if (binaryFile == null) {
                Log.e(TAG, "Failed to extract osrm-routed binary");
                return;
            }

            // Start osrm-routed
            ProcessBuilder pb = new ProcessBuilder(
                binaryFile.getAbsolutePath(),
                "--port", String.valueOf(port),
                "--max-table-size", "1000",
                "--algorithm", "MLD",
                dataPath
            );
            pb.redirectErrorStream(true);
            pb.directory(new File(dataPath).getParentFile());

            osrmProcess = pb.start();
            sRunning    = true;
            Log.i(TAG, "osrm-routed started on port " + port);

            // Wait for process (blocks until killed)
            int exitCode = osrmProcess.waitFor();
            Log.i(TAG, "osrm-routed exited with code " + exitCode);
            sRunning = false;

        } catch (Exception e) {
            Log.e(TAG, "osrm-routed error", e);
            sRunning = false;
        }
    }

    private void stopOsrmProcess() {
        if (osrmProcess != null) {
            osrmProcess.destroyForcibly();
            osrmProcess = null;
        }
        sRunning = false;
    }

    /**
     * Extracts the osrm-routed binary from assets to filesDir if not already there.
     * Returns the executable File, or null on failure.
     */
    private File extractBinary() {
        File dest = new File(getFilesDir(), "osrm-routed");
        if (dest.exists() && dest.canExecute()) return dest;

        try {
            byte[] bytes = getAssets().open("osrm-routed-arm64").readAllBytes();
            try (java.io.FileOutputStream fos = new java.io.FileOutputStream(dest)) {
                fos.write(bytes);
            }
            dest.setExecutable(true, true);
            Log.i(TAG, "Extracted osrm-routed to " + dest.getAbsolutePath());
            return dest;
        } catch (Exception e) {
            Log.e(TAG, "Failed to extract osrm-routed binary: " + e.getMessage());
            Log.e(TAG, "Make sure android/app/src/main/assets/osrm-routed-arm64 exists.");
            return null;
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        stopOsrmProcess();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    // ── Notification ──────────────────────────────────────────────────────────

    private void createNotificationChannel() {
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Navigation Service",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Offline navigation routing");
        getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }

    private Notification buildNotification() {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Offline navigation active")
            .setContentText("Routing engine running")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build();
    }
}
