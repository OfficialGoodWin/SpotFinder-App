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
    const coord = centroid(feature.geometry);
    if (!coord) continue;
    const [lon, lat] = coord;
    const id = tags.id || feature.id || `${lat},${lon}`;

    let entity = null;
    if (tags.wikidata) {
      try { entity = await wikidataEntity(tags.wikidata); } catch {}
      await sleep(75);
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
      wikidata: tags.wikidata || null,
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
