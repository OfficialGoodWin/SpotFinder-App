package com.spotfinder.app;

import android.util.Log;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.zip.GZIPInputStream;
import java.util.zip.ZipEntry;

import org.apache.commons.compress.archivers.tar.TarArchiveEntry;
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream;

/**
 * OsrmDownloader.java
 *
 * Downloads and extracts a .tar.gz OSRM routing data package.
 *
 * Expected server layout:  https://your-server.com/osrm/{CC}-osrm.tar.gz
 * Each archive contains:   {CC}-osrm/czech-republic-latest.osrm
 *                          {CC}-osrm/czech-republic-latest.osrm.nbg_nodes
 *                          {CC}-osrm/czech-republic-latest.osrm.partition
 *                          ... (all .osrm.* files for MLD algorithm)
 *
 * After extraction the data files live at:
 *   getFilesDir()/osrm/{CC}/
 *
 * The main .osrm file path is then:
 *   getFilesDir()/osrm/{CC}/{CC}.osrm
 *   (the extractor renames the main file to {CC}.osrm for convenience)
 */
public class OsrmDownloader {

    private static final String TAG         = "OsrmDownloader";
    private static final int    BUFFER_SIZE = 256 * 1024; // 256 KB

    public interface ProgressCallback {
        void onProgress(int percentComplete);
    }

    /**
     * Download the OSRM routing package for a country and extract it.
     *
     * @param url          Full URL to the .tar.gz file
     * @param osrmDir      Base directory for OSRM data (getFilesDir()/osrm)
     * @param countryCode  e.g. "CZ"
     * @param onProgress   Called with 0-100 as download progresses
     */
    public static void download(String url, File osrmDir, String countryCode, ProgressCallback onProgress)
            throws IOException {

        File destDir = new File(osrmDir, countryCode);
        if (!destDir.exists()) destDir.mkdirs();

        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(60000);
        conn.connect();

        if (conn.getResponseCode() != 200) {
            throw new IOException("Server returned " + conn.getResponseCode() + " for " + url);
        }

        long contentLength = conn.getContentLengthLong();
        Log.i(TAG, String.format("Downloading OSRM data for %s: %.1f MB", countryCode, contentLength / 1048576.0));

        // Stream: HTTP → GZip → TAR → files
        try (InputStream raw = new BufferedInputStream(conn.getInputStream(), BUFFER_SIZE);
             GZIPInputStream gzip = new GZIPInputStream(raw, BUFFER_SIZE);
             TarArchiveInputStream tar = new TarArchiveInputStream(gzip)) {

            long received = 0;
            TarArchiveEntry entry;
            byte[] buffer = new byte[BUFFER_SIZE];

            while ((entry = tar.getNextTarEntry()) != null) {
                if (!tar.canReadEntryData(entry)) continue;

                String entryName = new File(entry.getName()).getName(); // strip leading dirs
                File outFile = new File(destDir, entryName);

                if (entry.isDirectory()) {
                    outFile.mkdirs();
                    continue;
                }

                outFile.getParentFile().mkdirs();
                try (FileOutputStream fos = new FileOutputStream(outFile)) {
                    int read;
                    while ((read = tar.read(buffer)) != -1) {
                        fos.write(buffer, 0, read);
                        received += read;
                        if (contentLength > 0 && onProgress != null) {
                            onProgress.onProgress((int) (received * 100 / contentLength));
                        }
                    }
                }

                // If this is the main .osrm file, also create a symlink/copy named {CC}.osrm
                if (entryName.endsWith(".osrm") && !entryName.startsWith(countryCode)) {
                    File canonical = new File(destDir, countryCode + ".osrm");
                    if (!canonical.exists()) {
                        // Copy (Android doesn't support symlinks from userspace easily)
                        copyFile(outFile, canonical);
                    }
                }
            }

            Log.i(TAG, "OSRM data for " + countryCode + " extracted to " + destDir.getAbsolutePath());
            if (onProgress != null) onProgress.onProgress(100);
        } finally {
            conn.disconnect();
        }
    }

    private static void copyFile(File src, File dst) throws IOException {
        try (java.io.FileInputStream fis  = new java.io.FileInputStream(src);
             java.io.FileOutputStream fos = new java.io.FileOutputStream(dst)) {
            byte[] buf = new byte[BUFFER_SIZE];
            int n;
            while ((n = fis.read(buf)) != -1) fos.write(buf, 0, n);
        }
    }

    /**
     * Returns the path to the .osrm data file for a country, or null if not downloaded.
     */
    public static String getDataPath(File osrmDir, String countryCode) {
        File f = new File(new File(osrmDir, countryCode), countryCode + ".osrm");
        return f.exists() ? f.getAbsolutePath() : null;
    }

    /**
     * Delete OSRM data for a country.
     */
    public static void deleteData(File osrmDir, String countryCode) {
        File dir = new File(osrmDir, countryCode);
        if (dir.exists()) deleteRecursive(dir);
    }

    private static void deleteRecursive(File f) {
        if (f.isDirectory()) for (File c : f.listFiles()) deleteRecursive(c);
        f.delete();
    }
}
