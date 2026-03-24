package com.spotfinder.app;

import android.content.Intent;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

/**
 * OsrmPlugin.java — Capacitor bridge for the on-device OSRM routing server.
 *
 * Exposes three JS-callable methods:
 *   startOsrm(dataPath: string)  — starts osrm-routed pointing at the given data file
 *   stopOsrm()                   — stops the server
 *   getStatus()                  — returns { running: bool, port: number }
 *
 * Register in MainActivity.java:
 *   add(OsrmPlugin.class);
 *
 * Also add to AndroidManifest.xml (inside <application>):
 *   <service android:name=".OsrmService"
 *            android:exported="false"
 *            android:foregroundServiceType="dataSync" />
 *   <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
 *   <uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" />
 */
@CapacitorPlugin(name = "OsrmPlugin")
public class OsrmPlugin extends Plugin {

    private static final String TAG  = "OsrmPlugin";
    public  static final int    PORT = 5000;

    @PluginMethod
    public void startOsrm(PluginCall call) {
        String dataPath = call.getString("dataPath", "");

        if (dataPath.isEmpty()) {
            call.reject("dataPath is required");
            return;
        }

        File dataFile = new File(dataPath);
        if (!dataFile.exists()) {
            call.reject("OSRM data file not found: " + dataPath);
            return;
        }

        try {
            Intent intent = new Intent(getContext(), OsrmService.class);
            intent.putExtra(OsrmService.EXTRA_DATA_PATH, dataPath);
            intent.putExtra(OsrmService.EXTRA_PORT, PORT);
            getContext().startForegroundService(intent);

            JSObject result = new JSObject();
            result.put("started", true);
            result.put("port", PORT);
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Failed to start OSRM service", e);
            call.reject("Failed to start OSRM service: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopOsrm(PluginCall call) {
        try {
            Intent intent = new Intent(getContext(), OsrmService.class);
            getContext().stopService(intent);

            JSObject result = new JSObject();
            result.put("stopped", true);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to stop OSRM service: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        boolean running = OsrmService.isRunning();
        JSObject result = new JSObject();
        result.put("running", running);
        result.put("port", PORT);
        result.put("url", running ? "http://localhost:" + PORT : null);
        call.resolve(result);
    }

    /**
     * Download OSRM routing data for a country from the tile server.
     * The file is stored in the app's files directory so OSRM can access it.
     *
     * Call this from JS when the user taps "Download Czech Republic" in the
     * offline menu — run it alongside the PMTiles map download.
     *
     * JS usage:
     *   OsrmPlugin.downloadData({
     *     url: 'https://your-server.com/osrm/CZ.osrm.tar',
     *     countryCode: 'CZ'
     *   })
     */
    @PluginMethod
    public void downloadData(PluginCall call) {
        String url         = call.getString("url", "");
        String countryCode = call.getString("countryCode", "");

        if (url.isEmpty() || countryCode.isEmpty()) {
            call.reject("url and countryCode are required");
            return;
        }

        File osrmDir = new File(getContext().getFilesDir(), "osrm");
        if (!osrmDir.exists()) osrmDir.mkdirs();

        // Run download in background thread
        new Thread(() -> {
            try {
                OsrmDownloader.download(url, osrmDir, countryCode, (progress) -> {
                    // Emit progress event to JS
                    JSObject data = new JSObject();
                    data.put("countryCode", countryCode);
                    data.put("pct", progress);
                    notifyListeners("osrmDownloadProgress", data);
                });

                String dataPath = new File(osrmDir, countryCode + ".osrm").getAbsolutePath();
                JSObject result = new JSObject();
                result.put("dataPath", dataPath);
                result.put("countryCode", countryCode);
                call.resolve(result);
            } catch (Exception e) {
                call.reject("Download failed: " + e.getMessage());
            }
        }).start();
    }
}
