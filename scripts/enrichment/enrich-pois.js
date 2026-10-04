#!/usr/bin/env node
// Build-time POI details enrichment. No client-side scraping.
// Input: scripts/ambient-tiles/ambient-poi.geojson
// Output: public/poi-details/10/{x}/{y}.json
//
// Photo policy: only accept Commons media whose metadata indicates CC0,
// public domain, CC BY, or CC BY-SA. Arbitrary OSM image URLs are not used
// as reusable photo assets unless they resolve to Wikimedia Commons.

import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const INPUT = process.env.POI_GEOJSON || 'scripts/ambient-tiles/ambient-poi.geojson';
const OUTPUT = process.env.POI_DETAILS_DIR || 'public/poi-details/10';
const MAX_PHOTOS = Number(process.env.POI_MAX_PHOTOS || 3);
const USER_AGENT = 'SpotFinder enrichment/1.0 (build-time; contact: site owner)';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

function cleanHtml(value = '') {
  return String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function commonsMetadata(fileTitle) {
  const title = String(fileTitle).replace(/^File:/i, '');
  const url = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({
    action: 'query', titles: `File:${title}`, prop: 'imageinfo',
    iiprop: 'url|extmetadata', format: 'json', origin: '*'
  });
  const data = await getJson(url);
  const page = Object.values(data?.query?.pages || {})[0];
  const info = page?.imageinfo?.[0];
  const meta = info?.extmetadata;
  if (!info || !meta) return null;
  const license = cleanHtml(meta.LicenseShortName?.value || meta.License?.value || '');
  const author = cleanHtml(meta.Artist?.value || meta.Credit?.value || '');
  const normalizedLicense = license.toLowerCase().replace(/[-_]/g, ' ');
  const rejected = /non\s*commercial|no\s*derivatives|\bnc\b|\bnd\b/.test(normalizedLicense);
  const accepted = !rejected && (normalizedLicense.includes('public domain') || normalizedLicense.includes('cc0') ||
    (/creative commons/.test(normalizedLicense) && /attribution/.test(normalizedLicense)));
  if (!accepted) return null;
  return {
    url: info.url,
    source: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(title.replace(/ /g, '_'))}`,
    author: author || 'Unknown author',
    license,
    credit: `Photo: ${author || 'Unknown author'} (${license}) via Wikimedia Commons`,
  };
}

const MATCH_BY_NAME = process.env.POI_MATCH_WIKIDATA !== '0';
const MATCH_RADIUS_M = Number(process.env.POI_MATCH_RADIUS_M || 150);
const searchCache = new Map();

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000, toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2-lat1), dLon = toRad(lon2-lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
function entityCoord(entity) {
  const v = entity?.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
  return v && Number.isFinite(v.latitude) && Number.isFinite(v.longitude) ? [v.longitude, v.latitude] : null;
}
function poiName(tags) { return tags.name || tags['name:cs'] || tags['name:en'] || ''; }
function isNotable(tags) {
  // Free build-time matching is intentionally aimed at named places where a
  // Wikidata/Commons photo is likely to exist, rather than every bench/shop.
  return Boolean(poiName(tags)) && Boolean(
    tags.tourism || tags.historic || tags.heritage || tags.castle_type ||
    tags.man_made === 'tower' || tags.amenity === 'place_of_worship' ||
    tags.amenity === 'theatre' || tags.amenity === 'arts_centre' ||
    tags.amenity === 'library' || tags.leisure === 'stadium' ||
    tags.natural === 'peak' || tags.tourism === 'viewpoint' ||
    tags.tourism === 'hotel' || tags.tourism === 'museum'
  );
}
async function matchWikidataByNameAndCoord(name, lon, lat) {
  const key = `${name.toLowerCase()}|${lat.toFixed(3)}|${lon.toFixed(3)}`;
  if (searchCache.has(key)) return searchCache.get(key);
  const url = 'https://www.wikidata.org/w/api.php?' + new URLSearchParams({
    action:'wbsearchentities', search:name, language:'cs', uselang:'cs', type:'item', limit:'8', format:'json', origin:'*'
  });
  try {
    const found = await getJson(url); await sleep(90);
    for (const hit of found?.search || []) {
      const entity = await wikidataEntity(hit.id); await sleep(75);
      const c = entityCoord(entity); if (!c) continue;
      if (haversineMeters(lat, lon, c[1], c[0]) <= MATCH_RADIUS_M) {
        const out = { id: hit.id, entity }; searchCache.set(key, out); return out;
      }
    }
  } catch {}
  searchCache.set(key, null); return null;
}

async function wikidataEntity(id) {
  const url = 'https://www.wikidata.org/w/api.php?' + new URLSearchParams({
    action: 'wbgetentities', ids: id, props: 'claims|sitelinks', format: 'json', origin: '*'
  });
  const data = await getJson(url);
  return data?.entities?.[id] || null;
}

async function wikipediaSummary(title, lang) {
  if (!title) return null;
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`;
  try {
    const data = await getJson(url);
    if (!data?.extract) return null;
    return {
      text: String(data.extract),
      url: data.content_urls?.desktop?.page || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
      lang,
    };
  } catch { return null; }
}

function tileXY(lon, lat, z=10) {
  const n = 2 ** z;
  const x = Math.floor((lon + 180) / 360 * n);
  const latRad = Math.max(-85.05112878, Math.min(85.05112878, lat)) * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { x, y };
}

function centroid(geometry) {
  if (geometry?.type === 'Point') return geometry.coordinates;
  // label-point conversion in tippecanoe handles actual rendering; for
  // shard selection we need a stable representative coordinate.
  const pts = [];
  const walk = g => {
    if (!Array.isArray(g)) return;
    if (typeof g[0] === 'number') pts.push(g);
    else g.forEach(walk);
  };
  walk(geometry?.coordinates);
  if (!pts.length) return null;
  const lon = pts.reduce((s,p)=>s+p[0],0)/pts.length;
  const lat = pts.reduce((s,p)=>s+p[1],0)/pts.length;
  return [lon,lat];
}

async function pickPhoto(tags, entity) {
  const candidates = [];
  if (tags?.wikimedia_commons) candidates.push(tags.wikimedia_commons);
  if (tags?.image) {
    try {
      const u = new URL(tags.image);
      if (/commons\.wikimedia\.org|upload\.wikimedia\.org$/i.test(u.hostname)) {
        const file = decodeURIComponent(u.pathname.split('/').pop() || '').replace(/^File:/i, '');
        if (file) candidates.push(file);
      }
    } catch {}
  }
  if (!candidates.length) {
    const p18 = entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
    if (p18) candidates.push(p18);
  }
  for (const candidate of candidates.slice(0, 5)) {
    try {
      const m = await commonsMetadata(candidate);
      if (m) return [m];
    } catch {}
    await sleep(100);
  }
  return [];
}

async function main() {
  const input = JSON.parse(await readFile(INPUT, 'utf8'));
  const shards = new Map();
  let i = 0;

  for (const feature of input.features || []) {
    const tags = feature.properties || {};
    // Existing tags are enriched directly. Named notable POIs without tags are
    // also matched to Wikidata by name + coordinates, then accepted only when
    // the Wikidata coordinate is within 150 m (configurable).
    const hasDirectEnrichment = tags.wikidata || tags.wikimedia_commons || tags.image || tags.description || tags.note;
    if (!hasDirectEnrichment && !(MATCH_BY_NAME && isNotable(tags))) continue;
    const coord = centroid(feature.geometry);
    if (!coord) continue;
    const [lon, lat] = coord;
    const id = tags.id || feature.id || `${lat},${lon}`;

    let entity = null;
    let matchedWikidata = tags.wikidata || null;
    if (matchedWikidata) {
      try { entity = await wikidataEntity(matchedWikidata); } catch {}
      await sleep(75);
    } else if (MATCH_BY_NAME && isNotable(tags)) {
      const matched = await matchWikidataByNameAndCoord(poiName(tags), lon, lat);
      if (matched) { matchedWikidata = matched.id; entity = matched.entity; }
    }

    const photos = (await pickPhoto(tags, entity)).slice(0, MAX_PHOTOS);
    const desc = tags.description || tags.note || null;
    let wikipedia = null;
    const csTitle = entity?.sitelinks?.cswiki?.title;
    const enTitle = entity?.sitelinks?.enwiki?.title;
    if (csTitle) wikipedia = await wikipediaSummary(csTitle, 'cs');
    if (!wikipedia && enTitle) wikipedia = await wikipediaSummary(enTitle, 'en');
    if (wikipedia) wikipedia.attribution = 'Wikipedia text is licensed under CC BY-SA; see the linked article for the source.';

    const details = {
      id: String(id),
      description: desc,
      photos,
      wikipedia,
      wikidata: matchedWikidata || null,
      source: 'OpenStreetMap',
    };

    const { x, y } = tileXY(lon, lat, 10);
    const key = `${x}/${y}`;
    if (!shards.has(key)) shards.set(key, []);
    shards.get(key).push(details);
    if (++i % 100 === 0) console.log(`Enriched ${i} POIs...`);
    await sleep(50);
  }

  for (const [key, rows] of shards) {
    const out = join(OUTPUT, `${key}.json`);
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, JSON.stringify({ generatedAt: new Date().toISOString(), items: rows }));
  }
  console.log(`Wrote ${shards.size} z10 detail shards for ${i} POIs.`);
}

main().catch(err => { console.error(err); process.exit(1); });
