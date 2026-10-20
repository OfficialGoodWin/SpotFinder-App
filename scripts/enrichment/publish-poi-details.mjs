// Bounded, offline publisher for the existing numeric-ID z10 detail reader.
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { poiDetailTile } from '../../src/lib/poiDetailShard.js';
import { supportedLanguages } from './wikidata-batch.mjs';

const require = createRequire(import.meta.url);
const { resolveLegacyIdentity } = require('../../functions/officialPoiIdentity.js');
const { sourceRevision } = require('../../functions/officialPoiFoundation.js');
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ID = /^osm:(node|way|relation):([1-9]\d*)$/;
const QID = /^Q[1-9]\d*$/;
const SHA = /^sha256:[a-f0-9]{64}$/;
const allowedInput = new Set(['canonicalId', 'lookupId', 'category', 'position', 'tileFeature', 'source', 'verifiedWikidata', 'review']);
const allowedSource = new Set(['originalName', 'originalDescription', 'osmNames', 'osmDescriptions', 'wikidataId', 'website', 'phone', 'openingHours', 'attributes']);
const allowedRow = new Set(['id', 'canonical_id', 'osm_type', 'osm_id', 'originalName', 'originalDescription', 'osmNames', 'osmDescriptions', 'nameProvenance', 'descriptionProvenance', 'localizedNames', 'localizedDescriptions', 'shortSummaries', 'description', 'descriptionRevision', 'wikidata', 'website', 'phone', 'openingHours', 'attributes', 'accessibility', 'photoRefs', 'source', 'sourceIdentity', 'publicationRevision']);
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const check = (ok, message) => { if (!ok) throw new Error(message); };
const exactKeys = (value, allowed, label) => { check(object(value), `${label} must be an object`); for (const key of Object.keys(value)) check(allowed.has(key), `${label}.${key} is not allowed`); };
const cleanText = (value, max, label) => { check(typeof value === 'string' && value.trim() && value.length <= max, `${label} must be nonempty text <= ${max}`); return value.trim(); };
const sha = value => createHash('sha256').update(value).digest('hex');
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const sorted = value => Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b, 'en')));
const validUrl = value => { const url = new URL(value); check(['https:', 'http:'].includes(url.protocol) && url.hostname.includes('.') && !url.username && !url.password, 'Invalid public URL'); return url.href; };
function localized(values, max, label) {
  exactKeys(values || {}, new Set(Object.keys(values || {}).filter(key => supportedLanguages.has(key))), label);
  return sorted(Object.fromEntries(Object.entries(values || {}).map(([lang, value]) => [lang, cleanText(value, max, `${label}.${lang}`)])));
}
function approvedEntries(values, max, label, revision = null) {
  check(Array.isArray(values) && values.length <= 100, `${label} must be a bounded array`);
  const seen = new Set();
  return values.filter(entry => entry.approval === 'approved').map(entry => {
    exactKeys(entry, new Set(['language', 'text', 'source', 'approval', 'sourceRevision', 'sourceReference', 'retrievedAt']), label);
    check(supportedLanguages.has(entry.language) && ['human', 'machine'].includes(entry.source), `Invalid ${label} language or source`);
    if (label === 'localizedNames') check(entry.source === 'human', 'Business and place names require human approval');
    if (entry.source === 'machine') check(revision && entry.sourceRevision === revision, 'Stale machine description');
    const key = `${entry.language}:${entry.source}`;
    check(!seen.has(key), `Duplicate ${label} ${key}`); seen.add(key);
    return { language: entry.language, text: cleanText(entry.text, max, label), source: entry.source, approval: 'approved',
      ...(entry.sourceRevision ? { sourceRevision: entry.sourceRevision } : {}),
      ...(entry.sourceReference ? { sourceReference: entry.sourceReference } : {}) };
  }).sort((a, b) => `${a.language}:${a.source}`.localeCompare(`${b.language}:${b.source}`, 'en'));
}
function validateSource(source) {
  exactKeys(source, allowedSource, 'source');
  const originalName = cleanText(source.originalName, 250, 'originalName');
  const originalDescription = source.originalDescription == null ? null : cleanText(source.originalDescription, 4000, 'originalDescription');
  check(source.wikidataId == null || QID.test(source.wikidataId), 'Invalid explicit Wikidata Q-ID');
  const attributes = source.attributes || {};
  exactKeys(attributes, new Set(['address', 'email', 'wheelchair', 'internet_access', 'toilets:wheelchair', 'operator', 'brand', 'access']), 'attributes');
  for (const [key, value] of Object.entries(attributes)) cleanText(value, 300, `attributes.${key}`);
  return { originalName, originalDescription, osmNames: localized(source.osmNames || {}, 250, 'osmNames'),
    osmDescriptions: localized(source.osmDescriptions || {}, 4000, 'osmDescriptions'), wikidataId: source.wikidataId || null,
    website: source.website == null ? null : validUrl(source.website),
    phone: source.phone == null ? null : cleanText(source.phone, 80, 'phone'),
    openingHours: source.openingHours == null ? null : cleanText(source.openingHours, 500, 'openingHours'), attributes: sorted(attributes) };
}
function verifiedWikidata(value, source) {
  if (value == null) return null;
  exactKeys(value, new Set(['id', 'linkMethod', 'approval', 'sourceRevision', 'labels', 'summaries']), 'verifiedWikidata');
  check(source.wikidataId && value.id === source.wikidataId && value.linkMethod === 'osm_tag' && value.approval === 'approved', 'Wikidata needs an approved explicit OSM Q-ID');
  const labels = localized(value.labels || {}, 250, 'wikidata.labels');
  const summaries = localized(value.summaries || {}, 500, 'wikidata.summaries');
  check(SHA.test(value.sourceRevision) && value.sourceRevision === sourceRevision(JSON.stringify({ labels, summaries })), 'Wikidata text revision mismatch');
  return { id: value.id, linkMethod: 'osm_tag', labels, summaries, sourceRevision: value.sourceRevision };
}
function validateInputRow(input, index) {
  exactKeys(input, allowedInput, `records[${index}]`);
  const match = ID.exec(input.canonicalId || '');
  check(match, `records[${index}] needs a typed OSM identity`);
  const lookupId = String(input.lookupId || '');
  check(/^[1-9]\d{0,15}$/.test(lookupId) && Number.isSafeInteger(Number(lookupId)) && lookupId === match[2], `records[${index}] lookup ID mismatch`);
  const identity = resolveLegacyIdentity(lookupId, input.category);
  check(identity.canonicalId === input.canonicalId, `records[${index}] index identity mismatch`);
  exactKeys(input.position, new Set(['lat', 'lon']), 'position');
  const { lat, lon } = input.position;
  check(Number.isFinite(lat) && Number.isFinite(lon) && lat >= -85.05112878 && lat <= 85.05112878 && lon >= -180 && lon <= 180, `records[${index}] invalid position`);
  exactKeys(input.tileFeature, new Set(['id', 'category', 'lat', 'lon', 'name', 'wikidataId', 'archiveSha256']), 'tileFeature');
  const tile = input.tileFeature;
  check(String(tile.id) === lookupId && tile.category === input.category && Number.isFinite(tile.lat) && Number.isFinite(tile.lon) && Math.abs(tile.lat - lat) < 0.00001 && Math.abs(tile.lon - lon) < 0.00001, `records[${index}] live feature mismatch`);
  check(/^[a-f0-9]{64}$/.test(tile.archiveSha256) && tile.archiveSha256 === identity.legacyArchiveSha256, `records[${index}] archive checksum mismatch`);
  check(typeof input.review === 'string' && input.review.length >= 10 && input.review.length <= 500, `records[${index}] review evidence required`);
  const source = validateSource(input.source);
  check(tile.name === source.originalName, `records[${index}] original name differs from the tile`);
  check((tile.wikidataId || null) === source.wikidataId, `records[${index}] explicit Wikidata tag mismatch`);
  return { canonicalId: input.canonicalId, lookupId, category: input.category, position: { lat, lon }, source,
    wikidata: verifiedWikidata(input.verifiedWikidata, source), identity, review: input.review };
}
function validateShard(shard, path) {
  check(object(shard) && shard.schemaVersion === 1 && Array.isArray(shard.items) && shard.items.length <= 10000, `Invalid shard ${path}`);
  const ids = new Set();
  for (const row of shard.items) {
    check(object(row) && /^[1-9]\d*$/.test(String(row.id)), `Invalid row in ${path}`);
    check(!ids.has(String(row.id)), `Duplicate numeric ID in ${path}`); ids.add(String(row.id));
    if (row.canonical_id) check(ID.test(row.canonical_id), `Invalid canonical ID in ${path}`);
  }
}
function recordFor(row, existing = null) {
  const source = row.source;
  const names = sorted({ ...(existing?.osmNames || {}), ...source.osmNames });
  const descriptions = sorted({ ...(existing?.osmDescriptions || {}), ...source.osmDescriptions });
  const admin = row.admin || null;
  const revision = sourceRevision(source.originalDescription);
  const output = { ...(existing || {}), id: row.lookupId, canonical_id: row.canonicalId,
    osm_type: row.canonicalId.split(':')[1], osm_id: row.lookupId, originalName: source.originalName,
    ...(source.originalDescription ? { originalDescription: source.originalDescription, description: source.originalDescription, descriptionRevision: revision } : {}),
    osmNames: names, ...(Object.keys(descriptions).length ? { osmDescriptions: descriptions } : {}),
    nameProvenance: sorted(Object.fromEntries(Object.keys(names).map(lang => [lang, `osm:name:${lang}`]))),
    ...(Object.keys(descriptions).length ? { descriptionProvenance: sorted(Object.fromEntries(Object.keys(descriptions).map(lang => [lang, `osm:description:${lang}`]))) } : {}),
    source: 'OpenStreetMap', sourceIdentity: { canonicalId: row.canonicalId, legacyTileId: Number(row.lookupId), evidence: 'Reviewed live feature and verified original-PBF identity index' },
  };
  if (row.wikidata) output.wikidata = row.wikidata;
  if (admin) {
    output.localizedNames = admin.localizedNames;
    output.localizedDescriptions = admin.localizedDescriptions;
    output.shortSummaries = admin.shortSummaries;
    for (const key of ['website', 'phone', 'openingHours', 'attributes', 'accessibility']) if (admin[key] !== undefined) output[key] = admin[key];
    output.publicationRevision = admin.revision;
  }
  for (const key of ['website', 'phone', 'openingHours', 'attributes']) if (output[key] === undefined && source[key] != null && (key !== 'attributes' || Object.keys(source[key]).length)) output[key] = source[key];
  return output;
}
function projectAdmin(doc, revisionDoc, row) {
  check(doc?.id === row.canonicalId && doc.sourceKind === 'osm' && doc.workflow === 'ready' && doc.publicationStatus === 'unpublished', 'Admin change is not an unpublished ready imported POI');
  check(Number.isSafeInteger(doc.revision) && doc.revision > 0 && revisionDoc?.id === doc.id && revisionDoc.revision === doc.revision && revisionDoc.workflow === 'ready' && JSON.stringify(revisionDoc.patch) === JSON.stringify(doc.patch), 'Admin revision mismatch');
  const base = doc.base;
  check(base?.id === row.canonicalId && String(base.sourceFields?.tile?.id) === row.lookupId && base.category === row.category && base.originalName === row.source.originalName, 'Admin base identity mismatch');
  check(Math.abs(base.position.lat - row.position.lat) < 0.00001 && Math.abs(base.position.lon - row.position.lon) < 0.00001, 'Admin base location mismatch');
  const patch = doc.patch || {};
  const blocked = [];
  for (const key of ['position', 'category', 'visibility', 'photoRefs']) if (key in patch) blocked.push(`${key}: requires geometry, suppression, or photo review stage`);
  if (patch.visibility === 'hidden') return { skip: true, blocked };
  const localizedNames = approvedEntries(patch.nameOverrides || [], 250, 'localizedNames');
  const localizedDescriptions = approvedEntries(patch.descriptions || [], 4000, 'localizedDescriptions', sourceRevision(row.source.originalDescription));
  const shortSummaries = approvedEntries(patch.shortSummaries || [], 500, 'shortSummaries');
  const admin = { revision: doc.revision, localizedNames, localizedDescriptions, shortSummaries };
  for (const key of ['website', 'phone', 'openingHours']) if (key in patch) admin[key] = patch[key] == null ? null : key === 'website' ? validUrl(patch[key]) : cleanText(patch[key], key === 'openingHours' ? 500 : 80, key);
  for (const key of ['attributes', 'accessibility']) if (key in patch) {
    exactKeys(patch[key], key === 'attributes' ? new Set(['address', 'email', 'wheelchair', 'internet_access', 'toilets:wheelchair', 'operator', 'brand', 'access']) : new Set(['wheelchair', 'stepFree', 'accessibleToilet']), key);
    admin[key] = sorted(Object.fromEntries(Object.entries(patch[key]).map(([name, value]) => [name, cleanText(value, 300, `${key}.${name}`)])));
  }
  return { admin, blocked };
}
async function readJson(path, fallback = null) { try { return JSON.parse(await readFile(path, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return fallback; throw error; } }
async function atomicWrite(path, body) { await mkdir(dirname(path), { recursive: true }); const temp = `${path}.${process.pid}.${randomUUID()}.tmp`; try { await writeFile(temp, body, { flag: 'wx' }); await rename(temp, path); } catch (error) { await import('node:fs/promises').then(fs => fs.unlink(temp).catch(() => {})); throw error; } }

export async function publishPoiDetails({ input, outputRoot = join(ROOT, 'public/poi-details'), dryRun = true, maxRecords = 20, batchLimit = 20, adminDocuments = {}, now = () => new Date().toISOString() }) {
  check(Number.isSafeInteger(maxRecords) && maxRecords >= 1 && maxRecords <= 100 && Number.isSafeInteger(batchLimit) && batchLimit >= 1 && batchLimit <= maxRecords, 'Invalid bounded limits');
  check(object(input) && input.schemaVersion === 1 && Array.isArray(input.records) && input.records.length >= 1 && input.records.length <= maxRecords && input.records.length <= batchLimit, 'Input batch exceeds limit or is empty');
  check(Object.keys(input).every(key => ['schemaVersion', 'records', 'publicationVersion'].includes(key)), 'Unsupported input field');
  check(typeof input.publicationVersion === 'string' && /^[a-z0-9][a-z0-9-]{5,80}$/.test(input.publicationVersion), 'Invalid publicationVersion');
  const prepared = input.records.map(validateInputRow);
  const deduped = new Map();
  for (const row of prepared) { const old = deduped.get(row.lookupId); check(!old || old.canonicalId === row.canonicalId && JSON.stringify(old) === JSON.stringify(row), `Ambiguous or conflicting numeric lookup ID ${row.lookupId}`); deduped.set(row.lookupId, row); }
  const affected = new Map(); const blocked = []; const previews = [];
  for (const row of deduped.values()) {
    const adminDocs = adminDocuments[row.canonicalId];
    if (adminDocs) {
      const projected = projectAdmin(adminDocs.change, adminDocs.revision, row);
      blocked.push(...projected.blocked.map(reason => ({ id: row.canonicalId, reason })));
      if (projected.skip) { previews.push({ id: row.canonicalId, readiness: 'blocked', blocked: projected.blocked }); continue; }
      row.admin = projected.admin;
    }
    const tile = poiDetailTile(row.position.lon, row.position.lat);
    const relative = `10/${tile.x}/${tile.y}.json`;
    if (!affected.has(relative)) affected.set(relative, []);
    affected.get(relative).push(row);
  }
  const writes = [];
  for (const [relative, rows] of [...affected].sort(([a], [b]) => a.localeCompare(b, 'en'))) {
    const path = join(outputRoot, relative);
    const old = await readJson(path, { schemaVersion: 1, publicationVersion: input.publicationVersion, generatedAt: now(), items: [] });
    validateShard(old, path);
    const byId = new Map(old.items.map(item => [String(item.id), item]));
    for (const row of rows) {
      const previous = byId.get(row.lookupId);
      check(!previous?.canonical_id || previous.canonical_id === row.canonicalId, `Ambiguous existing numeric ID ${row.lookupId} in ${relative}`);
      const next = recordFor(row, previous);
      check(Object.keys(next).every(key => allowedRow.has(key) || Object.hasOwn(previous || {}, key)), `Unexpected public field in ${relative}`);
      byId.set(row.lookupId, next);
      const fields = Object.keys(next).filter(key => JSON.stringify(next[key]) !== JSON.stringify(previous?.[key]));
      previews.push({ id: row.canonicalId, lookupId: row.lookupId, file: `poi-details/${relative}`, source: { originalName: row.source.originalName, osmNames: row.source.osmNames }, published: { originalName: next.originalName, osmNames: next.osmNames, localizedNames: next.localizedNames || [] }, provenance: next.nameProvenance, changedFields: fields, readiness: 'metadata-ready', blocked: blocked.filter(item => item.id === row.canonicalId).map(item => item.reason) });
    }
    const items = [...byId.values()].sort((a, b) => BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0);
    const contentChanged = JSON.stringify(items) !== JSON.stringify(old.items);
    const next = contentChanged ? { ...old, schemaVersion: 1, publicationVersion: input.publicationVersion, generatedAt: now(), items } : old;
    validateShard(next, path);
    const body = json(next);
    check(Buffer.byteLength(body) <= 2 * 1024 * 1024, `Shard ${relative} exceeds 2 MiB review threshold`);
    if (contentChanged) writes.push({ relative, path, body, sha256: sha(body), records: rows.length });
  }
  const report = { dryRun, inputRecords: input.records.length, uniqueRecords: deduped.size, affectedFiles: affected.size, changedFiles: writes.map(write => `poi-details/${write.relative}`), blocked, previews,
    surfaces: { detailPanelAfterDeploy: ['localized names', 'descriptions', 'short summaries', 'website', 'phone', 'opening hours', 'email'], storedOnly: ['other supported attributes', 'accessibility'], markerPosition: 'unchanged', markerCategory: 'unchanged', markerVisibility: 'unchanged', searchIndex: 'unchanged', newOfficialMarkers: 'unchanged' }, networkCalls: 0 };
  if (!dryRun) {
    const manifestPath = join(outputRoot, 'publisher-manifest.json');
    const previous = writes.length ? await readJson(manifestPath, { schemaVersion: 1, assets: {} }) : null;
    if (previous) check(previous.schemaVersion === 1 && object(previous.assets), 'Invalid existing manifest');
    // Complete validation above precedes every replacement. Each file remains valid if a later write fails.
    for (const write of writes) await atomicWrite(write.path, write.body);
    if (writes.length) {
      const assets = { ...previous.assets };
      for (const write of writes) assets[write.relative] = { sha256: write.sha256, bytes: Buffer.byteLength(write.body), publicationVersion: input.publicationVersion };
      await atomicWrite(manifestPath, json({ schemaVersion: 1, assets: sorted(assets) }));
    }
  }
  return report;
}

async function cli() {
  const args = Object.fromEntries(process.argv.slice(2).map(arg => { const match = /^--([a-z-]+)(?:=(.*))?$/.exec(arg); check(match, `Invalid argument ${arg}`); return [match[1], match[2] ?? true]; }));
  check(args.input, 'Use --input=reviewed-records.json');
  check(Object.keys(args).every(key => ['input', 'write', 'max-records', 'batch-limit', 'output-root', 'admin-ids', 'service-account'].includes(key)), 'Unsupported CLI option');
  check(args.write == null || args.write === true, 'Use --write without a value');
  const input = await readJson(resolve(String(args.input)));
  const adminDocuments = {};
  if (args['admin-ids']) {
    check(args['service-account'], 'Admin IDs require --service-account=PATH');
    const ids = await readJson(resolve(String(args['admin-ids'])));
    check(Array.isArray(ids) && ids.length <= 20 && new Set(ids).size === ids.length && ids.every(id => input.records.some(row => row.canonicalId === id)), 'Admin IDs must be a bounded subset of reviewed input');
    const serviceAccount = await readJson(resolve(String(args['service-account'])));
    check(serviceAccount?.type === 'service_account' && serviceAccount.project_id === 'spotfinderapp-cdc7b', 'Wrong service account project');
    const { initializeApp, cert, deleteApp } = require('firebase-admin/app');
    const { getFirestore } = require('firebase-admin/firestore');
    const app = initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id }, `poi-publisher-${process.pid}`);
    try {
      const db = getFirestore(app);
      for (const id of ids) {
        const change = await db.collection('official_poi_changes').doc(id).get();
        check(change.exists, `No official admin record for ${id}`);
        const value = change.data();
        check(Number.isSafeInteger(value.revision) && value.revision > 0, `Invalid admin revision ${id}`);
        const revision = await db.collection('official_poi_revisions').doc(`${id}__${value.revision}`).get();
        check(revision.exists, `No matching server revision for ${id}`);
        adminDocuments[id] = { change: value, revision: revision.data() };
      }
    } finally { await deleteApp(app); }
  }
  const report = await publishPoiDetails({ input, outputRoot: args['output-root'] ? resolve(String(args['output-root'])) : undefined,
    dryRun: args.write !== true, maxRecords: args['max-records'] ? Number(args['max-records']) : 20,
    batchLimit: args['batch-limit'] ? Number(args['batch-limit']) : 20, adminDocuments });
  console.log(json(report));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) cli().catch(error => { console.error(error.message); process.exitCode = 1; });
