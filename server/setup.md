# Tile + OSRM Server Setup Guide

SpotFinder uses a self-hosted server to serve two types of files:
- `.pmtiles` map tile files (zoom 0–19) downloaded to OPFS on the device
- `.tar.gz` OSRM routing data packages downloaded to Android file storage

---

## Part 1 — Map Tiles (PMTiles)

### What you need

A server that can serve large files with HTTP range request support and CORS headers.
The cheapest and easiest option is **Cloudflare R2** (object storage, free egress).

### Option A: Cloudflare R2 (Recommended)

1. Create a Cloudflare account at cloudflare.com
2. Go to R2 → Create bucket → name it `spotfinder-tiles`
3. Enable public access on the bucket
4. Set CORS policy (Bucket settings → CORS):

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["Range", "If-None-Match"],
    "ExposeHeaders": ["Content-Length", "Content-Range", "ETag"],
    "MaxAgeSeconds": 86400
  }
]
```

5. Note your public URL: `https://pub-XXXXXXXX.r2.dev`

### Option B: VPS with nginx

Install nginx and add this block to your site config:

```nginx
location /tiles/ {
    alias /var/www/tiles/;
    
    # Required: range request support (nginx has this built-in)
    # Required: CORS for browser access
    add_header Access-Control-Allow-Origin  "*";
    add_header Access-Control-Allow-Headers "Range, If-None-Match";
    add_header Access-Control-Expose-Headers "Content-Length, Content-Range, ETag";
    
    # Cache tiles aggressively — they change only when you re-generate
    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

### Generating PMTiles files

You need the `pmtiles` CLI tool and the Protomaps planet file.

```bash
# Install pmtiles CLI
curl -L https://github.com/protomaps/go-pmtiles/releases/latest/download/go-pmtiles_Linux_x86_64.tar.gz | tar xz
sudo mv pmtiles /usr/local/bin/

# Download the latest planet file (~115 GB — only needed once, stored on server)
# Or use the Protomaps CDN as the source (no download needed, slower extraction)
PLANET_URL="https://api.protomaps.com/tiles/v4.pmtiles?key=YOUR_PROTOMAPS_KEY"

# Extract per-country files (run this for each country you want to support)
# --maxzoom 19 gives full detail but large files — see size estimates below
# --maxzoom 14 is faster and smaller, suitable for navigation

# Central Europe (fit within ~175 MB at maxzoom 14, or ~300-500 MB at maxzoom 19)
pmtiles extract "$PLANET_URL" CZ.pmtiles --bbox=12.09,48.55,18.87,51.06 --maxzoom=19
pmtiles extract "$PLANET_URL" SK.pmtiles --bbox=16.83,47.73,22.57,49.61 --maxzoom=19
pmtiles extract "$PLANET_URL" AT.pmtiles --bbox=9.53,46.37,17.16,49.02  --maxzoom=19
pmtiles extract "$PLANET_URL" HU.pmtiles --bbox=16.11,45.74,22.90,48.59 --maxzoom=19
pmtiles extract "$PLANET_URL" SI.pmtiles --bbox=13.38,45.42,16.61,46.88 --maxzoom=19
pmtiles extract "$PLANET_URL" HR.pmtiles --bbox=13.49,42.38,19.45,46.55 --maxzoom=19
pmtiles extract "$PLANET_URL" CH.pmtiles --bbox=5.96,45.82,10.49,47.81  --maxzoom=19
pmtiles extract "$PLANET_URL" BE.pmtiles --bbox=2.54,49.50,6.40,51.50   --maxzoom=19
pmtiles extract "$PLANET_URL" PT.pmtiles --bbox=-9.50,36.96,-6.19,42.15 --maxzoom=19

# Large countries: use --maxzoom=16 to keep under 1 GB
pmtiles extract "$PLANET_URL" PL.pmtiles --bbox=14.12,49.00,24.15,54.90 --maxzoom=16
pmtiles extract "$PLANET_URL" DE.pmtiles --bbox=5.87,47.27,15.04,55.06  --maxzoom=16
pmtiles extract "$PLANET_URL" FR.pmtiles --bbox=-5.14,41.33,9.56,51.09  --maxzoom=16
pmtiles extract "$PLANET_URL" IT.pmtiles --bbox=6.63,35.49,18.52,47.09  --maxzoom=16

# Upload to R2 (install rclone first: https://rclone.org)
rclone copy . r2:spotfinder-tiles/ --include "*.pmtiles" --progress
```

### Approximate file sizes at maxzoom 19

| Country | Size at z19 |
|---------|-------------|
| Czech Republic | ~280 MB |
| Slovakia | ~180 MB |
| Austria | ~240 MB |
| Hungary | ~220 MB |
| Slovenia | ~90 MB |
| Croatia | ~250 MB |
| Switzerland | ~230 MB |
| Germany | ~1.8 GB |
| France | ~2.1 GB |
| Poland | ~1.1 GB |

> For countries over ~500 MB, consider offering zoom 16 as "standard" and zoom 19 as "detailed" with a size warning in the UI.

### Set environment variable in your app

Add to your `.env` file:

```
VITE_TILE_SERVER=https://pub-XXXXXXXX.r2.dev
```

Or for nginx:
```
VITE_TILE_SERVER=https://tiles.yourdomain.com
```

---

## Part 2 — OSRM Routing Data

### Generating OSRM data files

Install the OSRM backend tools (or use Docker):

```bash
# Using Docker (easiest)
docker pull osrm/osrm-backend

# Download OSM data
wget https://download.geofabrik.de/europe/czech-republic-latest.osm.pbf -O CZ.osm.pbf

# Process (MLD algorithm — best for mobile, smallest memory footprint)
docker run -t -v $(pwd):/data osrm/osrm-backend osrm-extract \
    -p /opt/osrm-backend/profiles/car.lua /data/CZ.osm.pbf

docker run -t -v $(pwd):/data osrm/osrm-backend osrm-partition /data/CZ.osrm
docker run -t -v $(pwd):/data osrm/osrm-backend osrm-customize /data/CZ.osrm

# Package all OSRM files into a single downloadable archive
tar -czf CZ-osrm.tar.gz CZ.osrm CZ.osrm.*

# Upload to your server alongside the PMTiles files
rclone copy CZ-osrm.tar.gz r2:spotfinder-tiles/osrm/
```

### OSM data sources by country (Geofabrik mirrors)

```bash
# Central Europe
wget https://download.geofabrik.de/europe/czech-republic-latest.osm.pbf   -O CZ.osm.pbf
wget https://download.geofabrik.de/europe/slovakia-latest.osm.pbf          -O SK.osm.pbf
wget https://download.geofabrik.de/europe/austria-latest.osm.pbf           -O AT.osm.pbf
wget https://download.geofabrik.de/europe/hungary-latest.osm.pbf           -O HU.osm.pbf
wget https://download.geofabrik.de/europe/slovenia-latest.osm.pbf          -O SI.osm.pbf
wget https://download.geofabrik.de/europe/croatia-latest.osm.pbf           -O HR.osm.pbf
```

### Typical OSRM data sizes (MLD, driving profile)

| Country | OSRM archive size |
|---------|-------------------|
| Czech Republic | ~14 MB |
| Slovakia | ~9 MB |
| Austria | ~12 MB |
| Hungary | ~11 MB |
| Slovenia | ~4 MB |
| Croatia | ~13 MB |
| Germany | ~55 MB |
| France | ~68 MB |
| Poland | ~28 MB |

### osrm-routed binary for Android

You need a pre-compiled ARM64 binary. Options:

1. **Pre-built** (recommended): Check OSRM releases or community builds at
   `https://github.com/Project-OSRM/osrm-backend/releases`
   Look for Android ARM64 / aarch64 builds.

2. **Cross-compile with NDK**:
   ```bash
   git clone https://github.com/Project-OSRM/osrm-backend && cd osrm-backend
   mkdir build-android && cd build-android
   cmake .. \
     -DANDROID_ABI=arm64-v8a \
     -DCMAKE_TOOLCHAIN_FILE=$ANDROID_NDK/build/cmake/android.toolchain.cmake \
     -DANDROID_PLATFORM=android-26 \
     -DCMAKE_BUILD_TYPE=Release \
     -DENABLE_MASON=ON \
     -DOSRM_BUILD_SHARED_LIBS=OFF
   make -j$(nproc) osrm-routed
   ```

Place the binary at: `android/app/src/main/assets/osrm-routed-arm64`

---

## Part 3 — Add required dependencies

### Android build.gradle (app level)

Add the Apache Commons Compress library for .tar.gz extraction:

```gradle
dependencies {
    // ... existing deps ...
    implementation 'org.apache.commons:commons-compress:1.26.0'
}
```

### MainActivity.java — register the plugin

```java
import com.spotfinder.app.OsrmPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerPlugin(OsrmPlugin.class);  // Add this line
    }
}
```

### AndroidManifest.xml — add service and permissions

Inside `<application>`:
```xml
<service
    android:name=".OsrmService"
    android:exported="false"
    android:foregroundServiceType="dataSync" />
```

Inside `<manifest>`:
```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" />
<uses-permission android:name="android.permission.INTERNET" />
```

---

## Part 4 — Wire OSRM start into app startup

In your app's main `App.jsx` or Capacitor `appStateChange` listener, start OSRM
when offline maps are available:

```javascript
import { getAllMeta } from '@/lib/offlineStorage';

async function maybeStartOsrm() {
  // Only start if the Capacitor plugin is available (Android native)
  const { OsrmPlugin } = await import('@capacitor/core').then(m => m.Capacitor.isPluginAvailable('OsrmPlugin')
    ? import('@/plugins/OsrmPlugin')
    : Promise.resolve({ OsrmPlugin: null })
  ).catch(() => ({ OsrmPlugin: null }));
  
  if (!OsrmPlugin) return;

  const status = await OsrmPlugin.getStatus();
  if (status.running) return; // Already running

  // Find a downloaded country and start OSRM with its data
  const meta = await getAllMeta();
  for (const [code, m] of Object.entries(meta)) {
    if (m?.type === 'pmtiles') {
      try {
        await OsrmPlugin.startOsrm({
          dataPath: `/data/data/com.spotfinder.app/files/osrm/${code}/${code}.osrm`
        });
        console.info(`OSRM started for ${code}`);
        break;
      } catch (e) {
        console.warn('OSRM start failed:', e.message);
      }
    }
  }
}

// Call on app startup
maybeStartOsrm();
```

---

## Summary of environment variables needed

```bash
# .env
VITE_TILE_SERVER=https://pub-XXXXXXXX.r2.dev     # Your PMTiles server
VITE_PROTOMAPS_KEY=your_key                       # Only needed if using Protomaps CDN for extraction
VITE_GEOAPIFY_KEY=your_key                        # For online POI search + offline POI download
VITE_TOMTOM_API_KEY=your_key                      # For traffic overlay (optional)
```
