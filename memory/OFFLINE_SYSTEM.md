# Offline System Detailed Memory

## Storage Breakdown
```
OPFS:  pmtiles files (*.pmtiles) - full country/bbox files
IndexedDB (spotfinder-offline-v2):
  - tiles:     raster PNG/JPG  key: z/x/y|hash
  - pois:      JSON array      key: countryCode
  - meta:      {downloadedAt,sizeMB} key: countryCode
  - bbox_meta: {id,filename,bbox:[w,s,e,n],name,downloadedAt,sizeMB} key: bboxId
```

## Download Flow (New Bbox)
1. OfflineMapsMenu: bbox draw → bboxId = sanitize(bbox+'-'+name.toLower())
2. offlineManager.downloadBboxPMTiles(bboxId, bbox, name):
   - PMTiles('https://build.protomaps.com/20260403.pmtiles')
   - header.entries → bboxToTileRanges(bbox, minz=0,maxz=16)
   - concurrent fetch(ranges) → stream to OPFS `${bboxId}.pmtiles`
   - setBboxMeta(bboxId, {filename,bbox,name,sizeMB})
3. List: getAllBboxMeta() + hasFile(filename)

## Render Switch (MapLibreMap)
```
moveend → center → loop bbox_meta:
  if pointInBbox(center, bbox) && hasFile(filename):
    sources.v.tiles = [`pmtiles://${filename}.pmtiles`]
    map.setStyle(...)
    setOfflineCountry(name)
```

## Filename Convention
`praha-center.pmtiles`, `user-trip-2024-10-15.pmtiles` (sanitize: lowercase,no spaces,-)

## Direct vs Proxy
- Countries: keep api/download proxy (GitHub CDN chunks)
- Bbox: direct protomaps.com (PMTiles lib Range requests, CORS allowed)
