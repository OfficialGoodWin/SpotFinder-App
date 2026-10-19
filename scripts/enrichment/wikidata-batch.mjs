// Admin-side, bounded Wikidata label and short-description cache. Never imported by the client.
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LANGUAGES, LANGUAGE_VARIANTS } from '../../src/locales/translations.js';

export const supportedLanguages = new Set([...LANGUAGES, ...LANGUAGE_VARIANTS].map(item => item.code));
export const validQid = value => typeof value === 'string' && /^Q[1-9]\d*$/.test(value);
const pause = ms => new Promise(done => setTimeout(done, ms));
const readJson = async (path, fallback) => { try { return JSON.parse(await readFile(path, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return fallback; throw error; } };
async function atomicJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify(value, null, 2));
  await rename(temp, path);
}
function retryDelay(response, attempt) {
  const header = response?.headers?.get?.('retry-after');
  const seconds = Number(header);
  if (header && Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = header && Date.parse(header);
  if (date) return Math.max(0, date - Date.now());
  return Math.min(30000, 500 * 2 ** attempt);
}
export function collectVerifiedLinks(rows) {
  if (!Array.isArray(rows)) throw new Error('Input must be a JSON array');
  const links = [];
  for (const row of rows) {
    const id = row?.id || row?.canonicalId;
    const wikidata = row?.wikidata || row?.base?.wikidata;
    const qid = typeof wikidata === 'string' ? wikidata : wikidata?.id;
    const method = typeof wikidata === 'string' ? row?.linkMethod : wikidata?.linkMethod;
    if (!/^osm:(node|way|relation):[1-9]\d*$/.test(id || '') || !validQid(qid) || method !== 'osm_tag') continue;
    const explicit = row?.tags?.wikidata || row?.base?.sourceFields?.tile?.wikidata || row?.base?.sourceFields?.detail?.tags?.wikidata;
    if (explicit !== qid) continue;
    links.push({ id, qid, linkMethod: 'osm_tag' });
  }
  return links;
}
export function entityValues(entity, qid, languages, retrievedAt) {
  const result = { qid, sourceType: 'wikidata', approval: 'unreviewed', retrievedAt,
    revision: Number.isSafeInteger(entity?.lastrevid) ? entity.lastrevid : null,
    missing: Boolean(entity?.missing || !entity || entity.id !== qid), labels: {}, summaries: {} };
  for (const language of languages) {
    const label = entity?.labels?.[language]?.value;
    const summary = entity?.descriptions?.[language]?.value;
    result.labels[language] = typeof label === 'string' && label.length <= 250 ? label : null;
    result.summaries[language] = typeof summary === 'string' && summary.length <= 500 ? summary : null;
  }
  return result;
}
export async function enrichWikidata({ rows, languages, cachePath, checkpointPath, maxRequests = 10, batchSize = 20,
  dryRun = false, fetchImpl = fetch, sleep = pause, now = () => new Date().toISOString(),
  userAgent = 'SpotFinder-POI-Enrichment/1.0 (https://github.com/SpotFinder-App/SpotFinder-App; admin batch)' }) {
  if (!Number.isSafeInteger(maxRequests) || maxRequests < 0 || maxRequests > 1000) throw new Error('Invalid request budget');
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 50) throw new Error('Batch size must be 1–50');
  if (!languages?.length || languages.some(lang => !supportedLanguages.has(lang))) throw new Error('Use existing SpotFinder languages');
  const queryLanguages = [...new Set(languages.flatMap(lang => [lang, lang.split('-')[0]]))];
  const links = collectVerifiedLinks(rows);
  const ids = [...new Set(links.map(link => link.qid))];
  const cache = await readJson(cachePath, { schemaVersion: 1, entities: {} });
  if (cache.schemaVersion !== 1 || typeof cache.entities !== 'object') throw new Error('Invalid cache schema');
  const checkpoint = await readJson(checkpointPath, { schemaVersion: 1, complete: [] });
  if (checkpoint.schemaVersion !== 1) throw new Error('Invalid checkpoint schema');
  const needed = ids.filter(qid => queryLanguages.some(lang => !Object.hasOwn(cache.entities[qid]?.labels || {}, lang) || !Object.hasOwn(cache.entities[qid]?.summaries || {}, lang)));
  const diagnostics = { linkedPois: links.length, uniqueQids: ids.length, cacheHits: ids.length - needed.length, missingQids: needed.length, requests: 0, retries: 0, fetchedQids: 0, dryRun };
  if (dryRun) return { diagnostics, links, cache };
  for (let offset = 0; offset < needed.length && diagnostics.requests < maxRequests; offset += batchSize) {
    const group = needed.slice(offset, offset + batchSize);
    const url = new URL('https://www.wikidata.org/w/api.php');
    url.search = new URLSearchParams({ action: 'wbgetentities', ids: group.join('|'), props: 'labels|descriptions', languages: queryLanguages.join('|'), languagefallback: '0', format: 'json', formatversion: '2', maxlag: '5' }).toString();
    let body;
    for (let attempt = 0; attempt < 4 && diagnostics.requests < maxRequests; attempt++) {
      let response;
      try {
        diagnostics.requests++;
        response = await fetchImpl(url, { headers: { 'User-Agent': userAgent, Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
        if (response.ok) {
          body = await response.json();
          if (!body.error) break;
          if (body.error.code !== 'maxlag') throw new Error(`Wikidata API: ${body.error.code}`);
        } else if (response.status !== 429 && response.status < 500) throw new Error(`Wikidata HTTP ${response.status}`);
      } catch (error) { if (attempt === 3 || diagnostics.requests >= maxRequests) throw error; }
      if (attempt === 3 || diagnostics.requests >= maxRequests) throw new Error(`Wikidata request failed after ${diagnostics.requests} requests`);
      diagnostics.retries++;
      await sleep(retryDelay(response, attempt));
    }
    if (!body?.entities) throw new Error('Wikidata response has no entities');
    const byId = new Map(body.entities.map(entity => [entity.id, entity]));
    for (const qid of group) {
      const next = entityValues(byId.get(qid), qid, queryLanguages, now());
      const previous = cache.entities[qid];
      cache.entities[qid] = previous ? { ...previous, ...next, labels: { ...previous.labels, ...next.labels }, summaries: { ...previous.summaries, ...next.summaries } } : next;
      diagnostics.fetchedQids++;
    }
    checkpoint.complete = [...new Set([...(checkpoint.complete || []), ...group])];
    checkpoint.updatedAt = now();
    await atomicJson(cachePath, cache);
    await atomicJson(checkpointPath, checkpoint);
  }
  return { diagnostics, links, cache };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = Object.fromEntries(process.argv.slice(2).map(arg => { const [key, ...rest] = arg.replace(/^--/, '').split('='); return [key, rest.join('=') || true]; }));
  if (!options.input || !options.cache || !options.checkpoint) throw new Error('Use --input=verified-links.json --cache=cache.json --checkpoint=checkpoint.json');
  if (!options['dry-run'] && !options['user-agent']) throw new Error('Set --user-agent=SpotFinder/1.0_(contact@example.org) for live requests');
  const rows = JSON.parse(await readFile(resolve(options.input), 'utf8'));
  const languages = String(options.languages || 'cs,en').split(',');
  const result = await enrichWikidata({ rows, languages, cachePath: resolve(options.cache), checkpointPath: resolve(options.checkpoint),
    maxRequests: Number(options.budget ?? 10), batchSize: Number(options.batch ?? 20), dryRun: Boolean(options['dry-run']),
    ...(options['user-agent'] ? { userAgent: String(options['user-agent']) } : {}) });
  console.log(JSON.stringify(result.diagnostics, null, 2));
}
