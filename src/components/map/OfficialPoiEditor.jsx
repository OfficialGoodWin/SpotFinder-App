import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Marker } from 'maplibre-gl';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/LanguageContext';
import { readImportedPoi, validEditorPosition } from '@/lib/officialPoiImport';
import { adminSaveOfficialPoi, findOfficialPoiChanges, getOfficialPoiChange, getOfficialPoiRevisions } from '@/api/firebaseClient';

const CATEGORIES = ['train', 'fuel', 'charging', 'hotel', 'museum', 'heritage', 'hospital', 'restaurant', 'cafe', 'bar', 'pharmacy', 'bank', 'supermarket', 'atm', 'bakery', 'parking', 'viewpoint', 'camp_site', 'caravan_site', 'toilets', 'drinking_water', 'picnic_site'];
const inputClass = 'w-full min-h-10 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground';
const buttonClass = 'min-h-10 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-40';
const emptyForm = { name: '', category: 'museum', description: '', lat: '', lon: '', website: '', phone: '', openingHours: '', address: '', email: '', wheelchair: '', region: 'CZ', privateNote: '', language: 'cs', workflow: 'draft', visibility: 'visible', photoRefs: [] };
const localized = (items, language) => (items || []).find(item => item.language === language && item.source === 'human')?.text || '';
const baseFromSaved = item => item?.sourceKind === 'osm' && item.base ? {
  canonicalId: item.id, sourceId: `${item.osm?.type}/${item.osm?.id}`,
  position: item.base.position, name: item.base.originalName, category: item.base.category,
  description: item.base.originalDescription || '', website: item.base.website || '',
  phone: item.base.phone || '', openingHours: item.base.openingHours || '',
  wikidata: item.base.wikidata?.id || null, localizedNames: item.base.osmNames || {},
  localizedDescriptions: item.base.osmDescriptions || {}, raw: item.base.sourceFields || {},
} : null;
const mapRecord = (base, record, language) => ({
  name: localized(record?.patch?.nameOverrides, language) || base?.name || record?.base?.originalName || '',
  category: record?.patch?.category || base?.category || record?.base?.category || 'museum',
  description: localized(record?.patch?.descriptions, language) || base?.description || record?.base?.originalDescription || '',
  lat: String(record?.patch?.position?.lat ?? base?.position?.lat ?? record?.base?.position?.lat ?? ''),
  lon: String(record?.patch?.position?.lon ?? base?.position?.lon ?? record?.base?.position?.lon ?? ''),
  website: record?.patch?.website ?? base?.website ?? '', phone: record?.patch?.phone ?? base?.phone ?? '',
  openingHours: record?.patch?.openingHours ?? base?.openingHours ?? '',
  address: record?.patch?.attributes?.address || base?.raw?.tile?.address || '',
  email: record?.patch?.attributes?.email || base?.raw?.tile?.email || '',
  wheelchair: record?.patch?.accessibility?.wheelchair || base?.raw?.tile?.wheelchair || '',
  region: record?.region || record?.base?.region || 'CZ', privateNote: record?.privateNote || '',
  language, workflow: record?.workflow || 'draft', visibility: record?.patch?.visibility || 'visible', photoRefs: record?.patch?.photoRefs || [],
});

function Field({ label, children }) { return <label className="block space-y-1 text-xs font-medium text-muted-foreground"><span>{label}</span>{children}</label>; }
function Section({ title, children }) { return <section className="space-y-3 rounded-xl border border-border p-3"><h3 className="text-sm font-semibold text-foreground">{title}</h3>{children}</section>; }

export default function OfficialPoiEditor({ map, selectedHit, pickedPosition, onClose, onOpenLegacy, onPickPosition, legacyPois = [] }) {
  const { t, language } = useLanguage();
  const L = key => t(`officialEditor.${key}`);
  const [base, setBase] = useState(null);
  const [record, setRecord] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [initial, setInitial] = useState(emptyForm);
  const [history, setHistory] = useState([]);
  const [list, setList] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [areaOnly, setAreaOnly] = useState(false);
  const [areaVersion, setAreaVersion] = useState(0);
  const [section, setSection] = useState('basic');
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [latestConflict, setLatestConflict] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [moveMode, setMoveMode] = useState(false);
  const marker = useRef(null);
  const previewMarker = useRef(null);
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initial), [form, initial]);
  const id = base?.canonicalId || record?.id || null;
  const unresolved = base && !base.canonicalId;
  const setField = (key, value) => setForm(current => ({ ...current, [key]: value }));

  const loadRecord = useCallback(async (canonicalId, imported = null) => {
    setBusy(true);
    try {
      const saved = canonicalId ? await getOfficialPoiChange(canonicalId) : null;
      const lang = imported ? language.split('-')[0] : form.language;
      const next = mapRecord(imported, saved, lang);
      setRecord(saved); setForm(next); setInitial(next); setConflict(false); setLatestConflict(null);
      setHistory(canonicalId && saved ? await getOfficialPoiRevisions(canonicalId) : []);
    } catch (error) { toast.error(error.message || L('loadFailed')); }
    finally { setBusy(false); }
  }, [language, form.language]);

  useEffect(() => {
    if (!selectedHit) return;
    if (dirty) {
      setConfirmAction({ label: L('discardQuestion'), run: () => {
        const imported = readImportedPoi(selectedHit);
        setBase(imported); setMoveMode(false); loadRecord(imported.canonicalId, imported);
      } });
      return;
    }
    const imported = readImportedPoi(selectedHit);
    setBase(imported); setMoveMode(false); loadRecord(imported.canonicalId, imported);
  // A marker click is the intentional selection boundary; form edits should not reload it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHit]);
  useEffect(() => { if (pickedPosition) setForm(current => ({ ...current, lat: String(pickedPosition.lat), lon: String(pickedPosition.lon) })); }, [pickedPosition]);
  useEffect(() => { if (!map) return; const refresh = () => setAreaVersion(value => value + 1); map.on('moveend', refresh); return () => map.off('moveend', refresh); }, [map]);

  useEffect(() => {
    if (!map || !moveMode || !validEditorPosition(form.lat, form.lon)) return;
    const el = document.createElement('button'); el.type = 'button'; el.className = 'h-9 w-9 rounded-full border-4 border-white bg-blue-600 shadow-lg';
    el.setAttribute('aria-label', L('dragPosition'));
    const next = new Marker({ element: el, draggable: true }).setLngLat([Number(form.lon), Number(form.lat)]).addTo(map);
    marker.current = next;
    next.on('dragend', () => { const point = next.getLngLat(); setForm(current => ({ ...current, lat: point.lat.toFixed(7), lon: point.lng.toFixed(7) })); });
    return () => { next.remove(); if (marker.current === next) marker.current = null; };
  // Only create the marker when entering move mode or changing selection.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, moveMode, id]);
  useEffect(() => { if (marker.current && validEditorPosition(form.lat, form.lon)) marker.current.setLngLat([Number(form.lon), Number(form.lat)]); }, [form.lat, form.lon]);
  useEffect(() => {
    if (!map || !record) return;
    const position = record.patch?.position || record.base?.position;
    if (!position || record.patch?.visibility === 'hidden') return;
    // Admin-only preview. The public tile and its search entry are untouched.
    const el = document.createElement('div');
    el.className = 'h-7 w-7 rounded-full border-4 border-white bg-blue-600 shadow-lg';
    el.title = L('previewOnly');
    const preview = new Marker({ element: el }).setLngLat([position.lon, position.lat]).addTo(map);
    previewMarker.current = preview;
    return () => { preview.remove(); if (previewMarker.current === preview) previewMarker.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, record]);
  useEffect(() => {
    if (!map || !base?.sourceId || !record || (!record.patch?.position && record.patch?.visibility !== 'hidden')) return;
    const originals = new Map();
    const hideOriginal = () => {
      for (const layer of map.getStyle()?.layers || []) {
        if (!layer.id.startsWith('ambient-poi-z') || !map.getLayer(layer.id)) continue;
        const old = map.getFilter(layer.id);
        if (!originals.has(layer.id)) originals.set(layer.id, old);
        map.setFilter(layer.id, ['all', old || true, ['!=', ['get', 'id'], base.sourceId]]);
      }
    };
    hideOriginal(); map.on('style.load', hideOriginal);
    return () => {
      map.off('style.load', hideOriginal);
      for (const [layer, filter] of originals) if (map.getLayer(layer)) map.setFilter(layer, filter);
    };
  }, [map, base, record]);
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);

  const chooseRecord = async item => {
    if (dirty) { setConfirmAction({ label: L('discardQuestion'), run: () => chooseRecordUnsafe(item) }); return; }
    chooseRecordUnsafe(item);
  };
  const chooseRecordUnsafe = item => {
    const imported = baseFromSaved(item);
    setBase(imported); setRecord(item); setMoveMode(false);
    const next = mapRecord(imported, item, form.language);
    setForm(next); setInitial(next);
    getOfficialPoiRevisions(item.id).then(setHistory).catch(error => toast.error(error.message));
    if (map && validEditorPosition(next.lat, next.lon)) map.flyTo({ center: [Number(next.lon), Number(next.lat)], zoom: Math.max(map.getZoom(), 14) });
  };
  const refreshList = async () => { try { setList(await findOfficialPoiChanges()); } catch (error) { toast.error(error.message); } };
  useEffect(() => { refreshList(); }, []);
  const searchItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    const inArea = item => { const position = item.patch?.position || item.base?.position; return !areaOnly || !position || map?.getBounds().contains([position.lon, position.lat]); };
    const matches = item => (categoryFilter === 'all' || (item.patch?.category || item.base?.category) === categoryFilter)
      && (sourceFilter === 'all' || item.sourceKind === sourceFilter) && inArea(item);
    const official = list.filter(item => (!q || item.id.toLowerCase().includes(q) || item.base?.originalName?.toLowerCase().includes(q)) && (filter === 'all' || (filter === 'hidden' ? item.patch?.visibility === 'hidden' : item.workflow === filter)) && matches(item));
    if (!map || !q || q.startsWith('osm:') || q.startsWith('sf:')) return official;
    const layers = map.getStyle()?.layers?.filter(layer => layer.id.startsWith('ambient-poi-z')).map(layer => layer.id) || [];
    let features = [];
    try { features = layers.length ? map.queryRenderedFeatures({ layers }) : []; } catch { features = []; }
    const visible = features.slice(0, 100).filter(feature => feature.geometry?.type === 'Point').map(feature => readImportedPoi({ properties: feature.properties, position: { lat: feature.geometry.coordinates[1], lon: feature.geometry.coordinates[0] } }));
    return [...official, ...visible.filter(item => (item.name.toLowerCase().includes(q) || item.sourceId.toLowerCase().includes(q)) && (categoryFilter === 'all' || item.category === categoryFilter) && sourceFilter !== 'spotfinder').map(item => ({ id: item.canonicalId || item.sourceId, basePreview: item }))];
  }, [list, map, search, filter, categoryFilter, sourceFilter, areaOnly, areaVersion]);

  const save = async (override = {}) => {
    if (unresolved) return toast.error(L('unresolved'));
    if (!validEditorPosition(form.lat, form.lon)) return toast.error(L('invalidPosition'));
    if (!form.name.trim()) return toast.error(L('nameRequired'));
    if (!CATEGORIES.includes(form.category)) return toast.error(L('categoryRequired'));
    const isNew = !id;
    const visibility = override.visibility || form.visibility;
  const source = record?.base || base;
    const patch = {};
    const position = { lat: Number(form.lat), lon: Number(form.lon) };
    if (!isNew && (record?.patch?.position || position.lat !== Number(source?.position?.lat) || position.lon !== Number(source?.position?.lon))) patch.position = position;
    if (!isNew && (record?.patch?.category || form.category !== source?.category)) patch.category = form.category;
    if (!isNew && (record?.patch?.nameOverrides || form.name.trim() !== (source?.originalName || source?.name || ''))) patch.nameOverrides = form.name.trim() === (source?.originalName || source?.name || '') ? [] : [{ language: form.language, text: form.name.trim(), source: 'human', approval: 'approved' }];
    if (!isNew && (record?.patch?.descriptions || form.description.trim() !== (source?.originalDescription || source?.description || ''))) patch.descriptions = form.description.trim() ? [{ language: form.language, text: form.description.trim(), source: 'human', approval: 'approved' }] : [];
    for (const [field, sourceField] of [['website', 'website'], ['phone', 'phone'], ['openingHours', 'openingHours']]) if (record?.patch?.[field] !== undefined || form[field] !== (source?.[sourceField] || '')) patch[field] = form[field].trim() || null;
    const attributes = {};
    if (form.address.trim()) attributes.address = form.address.trim();
    if (form.email.trim()) attributes.email = form.email.trim();
    if (Object.keys(attributes).length || record?.patch?.attributes) patch.attributes = attributes;
    if (form.wheelchair.trim() || record?.patch?.accessibility) patch.accessibility = form.wheelchair.trim() ? { wheelchair: form.wheelchair.trim() } : {};
    if (JSON.stringify(form.photoRefs) !== JSON.stringify(record?.patch?.photoRefs || [])) patch.photoRefs = form.photoRefs.map(photo => ({ ...photo, sourceUrl: photo.sourceUrl || null, approval: 'draft' }));
    if (visibility !== 'visible' || record?.patch?.visibility) patch.visibility = visibility;
    const workflow = override.workflow || form.workflow;
    if (!Object.keys(patch).length) patch.visibility = 'visible';
    const input = isNew ? { expectedRevision: 0, base: { position, category: form.category, originalName: form.name.trim(), originalDescription: form.description.trim() || null, region: form.region.toUpperCase() }, patch: { visibility }, workflow, privateNote: form.privateNote } :
      { id, expectedRevision: record?.revision || 0, patch, workflow, privateNote: form.privateNote, region: form.region.toUpperCase(),
        ...(!record && base ? { importedBase: { id, position: base.position, category: base.category, originalName: base.name, originalDescription: base.description || null, osmNames: base.localizedNames, osmDescriptions: base.localizedDescriptions, wikidata: base.wikidata ? { id: base.wikidata, linkMethod: 'osm_tag' } : null, region: form.region.toUpperCase(), website: base.website || null, phone: base.phone || null, openingHours: base.openingHours || null, sourceFields: base.raw } } : {}) };
    setBusy(true);
    try {
      const result = await adminSaveOfficialPoi(input);
      const saved = await getOfficialPoiChange(result.id);
      setRecord(saved); setBase(isNew ? null : base);
      const next = mapRecord(base, saved, form.language); setForm(next); setInitial(next);
      setHistory(await getOfficialPoiRevisions(result.id)); setMoveMode(false); setConflict(false); refreshList();
      toast.success(L('savedUnpublished'));
    } catch (error) {
      if (error.code === 'functions/aborted' || error.code === 'aborted') {
        setConflict(true);
        if (id) getOfficialPoiChange(id).then(setLatestConflict).catch(() => {});
      }
      toast.error(error.message || L('saveFailed'));
    } finally { setBusy(false); }
  };
  const rollback = async revision => {
    if (!record) return;
    setBusy(true);
    try {
      await adminSaveOfficialPoi({ id: record.id, expectedRevision: record.revision, rollbackRevision: revision, workflow: 'draft' });
      await loadRecord(record.id, base); refreshList(); toast.success(L('rollbackSaved'));
    } catch (error) { if (error.code === 'functions/aborted') { setConflict(true); getOfficialPoiChange(record.id).then(setLatestConflict).catch(() => {}); } toast.error(error.message); }
    finally { setBusy(false); }
  };
  const resetToBase = async () => {
    if (!record) return;
    setBusy(true);
    try {
      await adminSaveOfficialPoi({ id: record.id, expectedRevision: record.revision, resetToBase: true, workflow: 'draft' });
      await loadRecord(record.id, base); refreshList(); toast.success(L('rollbackSaved'));
    } catch (error) { if (error.code === 'functions/aborted') { setConflict(true); getOfficialPoiChange(record.id).then(setLatestConflict).catch(() => {}); } toast.error(error.message); }
    finally { setBusy(false); }
  };
  const startNew = () => {
    if (dirty) { setConfirmAction({ label: L('discardQuestion'), run: startNewUnsafe }); return; }
    startNewUnsafe();
  };
  const startNewUnsafe = () => { setBase(null); setRecord(null); setHistory([]); setMoveMode(false); const next = { ...emptyForm, language: language.split('-')[0] }; setForm(next); setInitial(next); onPickPosition?.(); };
  const close = () => { if (dirty) setConfirmAction({ label: L('discardQuestion'), run: onClose }); else onClose(); };
  const nearbyLegacy = base && legacyPois.some(p => Number.isFinite(Number(p.lat)) && Math.abs(Number(p.lat) - Number(base.position?.lat)) < 0.0001 && Math.abs(Number(p.lon) - Number(base.position?.lon)) < 0.0001);

  return <div className="fixed inset-x-0 bottom-[env(safe-area-inset-bottom)] z-[2000] flex max-h-[78dvh] flex-col rounded-t-2xl border border-border bg-background shadow-2xl md:inset-y-16 md:left-auto md:right-4 md:w-[440px] md:max-h-none md:rounded-2xl" role="dialog" aria-label={L('title')}>
    <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3"><div><h2 className="font-bold">{L('title')}</h2><p className="text-xs text-muted-foreground">{L('authoringOnly')}</p></div><div className="flex gap-1"><button className={buttonClass} onClick={() => dirty ? setConfirmAction({ label: L('discardQuestion'), run: onOpenLegacy }) : onOpenLegacy?.()}>{L('legacyEditor')}</button><button className={buttonClass} onClick={close} aria-label={L('close')}>×</button></div></header>
    <div className="shrink-0 border-b border-border p-3"><div className="flex gap-2"><input className={inputClass} value={search} onChange={event => setSearch(event.target.value)} onKeyDown={async event => { if (event.key !== 'Enter' || !/^(osm:(node|way|relation):[1-9]\d*|sf:[0-9a-f-]{36})$/.test(search.trim())) return; try { const found = await getOfficialPoiChange(search.trim()); if (found) chooseRecord(found); else toast.info(L('notIndexed')); } catch (error) { toast.error(error.message); } }} placeholder={L('searchPlaceholder')} aria-label={L('search')} /><button className={buttonClass} onClick={startNew}>{L('add')}</button></div><div className="mt-2 flex gap-2"><select className={inputClass} value={filter} onChange={event => setFilter(event.target.value)} aria-label={L('status')}><option value="all">{L('all')}</option><option value="draft">{L('draft')}</option><option value="ready">{L('ready')}</option><option value="hidden">{L('hidden')}</option></select><select className={inputClass} value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)} aria-label={L('category')}><option value="all">{L('all')}</option>{CATEGORIES.map(cat => <option key={cat}>{cat}</option>)}</select><select className={inputClass} value={sourceFilter} onChange={event => setSourceFilter(event.target.value)} aria-label={L('source')}><option value="all">{L('all')}</option><option value="osm">OSM</option><option value="spotfinder">SpotFinder</option></select><label className="flex shrink-0 items-center gap-1 text-xs"><input type="checkbox" checked={areaOnly} onChange={event => setAreaOnly(event.target.checked)} />{L('area')}</label></div></div>
    {search && <div className="max-h-32 shrink-0 overflow-auto border-b border-border px-3 text-xs"><p className="py-1 text-muted-foreground">{L('boundedSearch')}</p>{searchItems.map((item, index) => <button key={`${item.id}-${index}`} className="block w-full truncate rounded p-2 text-left hover:bg-accent" onClick={() => {
      if (!item.basePreview) return chooseRecord(item);
      const choose = () => { setBase(item.basePreview); loadRecord(item.basePreview.canonicalId, item.basePreview); };
      if (dirty) setConfirmAction({ label: L('discardQuestion'), run: choose }); else choose();
    }}>{item.basePreview?.name || item.base?.originalName || item.id} · {item.id}</button>)}</div>}
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      {unresolved && <p className="rounded-lg bg-amber-100 p-3 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">{L('unresolved')} <span className="block break-all">{base.sourceId}</span></p>}
      {nearbyLegacy && <p className="rounded-lg bg-amber-100 p-3 text-xs text-amber-900">{L('legacyOverlap')}</p>}
      {conflict && <div className="rounded-lg border border-red-400 p-3 text-sm"><p>{L('conflict')}</p><p className="text-xs">{L('revision')} {latestConflict?.revision ?? '…'} · {L('reviewBeforeRetry')}</p><pre className="max-h-24 overflow-auto text-xs">{JSON.stringify(latestConflict?.patch || {}, null, 2)}</pre><div className="flex flex-wrap gap-2"><button className={buttonClass} onClick={() => setConfirmAction({ label: L('discardQuestion'), run: () => loadRecord(id, base) })}>{L('reviewLatest')}</button><button className={buttonClass} disabled={!latestConflict} onClick={() => setConfirmAction({ label: L('retryQuestion'), run: () => { setRecord(latestConflict); setConflict(false); toast.info(L('retryNotice')); } })}>{L('retryOnLatest')}</button></div></div>}
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground"><span>{id || L('newCustom')}</span><span>{base ? 'OSM' : 'SpotFinder'}</span><span>{L('revision')} {record?.revision || 0}</span><span>{L('unpublished')}</span></div>
      {base && <details className="rounded-xl border border-border p-3 text-xs"><summary className="cursor-pointer font-semibold">{L('originalSource')}</summary><p>{L('sourceId')}: {base.sourceId}</p><p>{L('wikidata')}: {base.wikidata || '—'}</p><p>{L('originalPosition')}: {base.position?.lat}, {base.position?.lon}</p><pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all">{JSON.stringify(base.raw, null, 2)}</pre></details>}
      {record?.patch?.position && <p className="rounded-lg bg-blue-50 p-2 text-xs text-blue-900 dark:bg-blue-900/30 dark:text-blue-100">{L('previewOnly')}</p>}
      <nav className="flex gap-1 overflow-x-auto" aria-label={L('sections')}>{['basic', 'contact', 'accessibility', 'languages', 'media', 'history'].map(name => <button key={name} className={`${buttonClass} shrink-0 ${section === name ? 'bg-blue-600 text-white' : ''}`} onClick={() => setSection(name)}>{L(name)}</button>)}</nav>
      {section === 'basic' && <Section title={L('basic')}><Field label={L('name')}><input className={inputClass} value={form.name} maxLength={250} onChange={e => setField('name', e.target.value)} /></Field><Field label={L('category')}><select className={inputClass} value={form.category} onChange={e => setField('category', e.target.value)}>{CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select></Field><Field label={L('description')}><textarea className={inputClass} rows={3} maxLength={4000} value={form.description} onChange={e => setField('description', e.target.value)} /></Field><div className="grid grid-cols-2 gap-2"><Field label={L('latitude')}><input className={inputClass} type="number" step="any" value={form.lat} onChange={e => setField('lat', e.target.value)} /></Field><Field label={L('longitude')}><input className={inputClass} type="number" step="any" value={form.lon} onChange={e => setField('lon', e.target.value)} /></Field></div><div className="flex flex-wrap gap-2"><button className={buttonClass} onClick={() => setMoveMode(value => !value)} disabled={!validEditorPosition(form.lat, form.lon)}>{moveMode ? L('stopMove') : L('move')}</button><button className={buttonClass} onClick={() => { setField('lat', String(base?.position?.lat ?? record?.base?.position?.lat ?? '')); setField('lon', String(base?.position?.lon ?? record?.base?.position?.lon ?? '')); }}>{L('resetPosition')}</button><button className={buttonClass} onClick={onPickPosition}>{L('pickOnMap')}</button></div><Field label={L('region')}><input className={inputClass} value={form.region} maxLength={12} onChange={e => setField('region', e.target.value)} /></Field><Field label={L('visibility')}><select className={inputClass} value={form.visibility} onChange={e => setField('visibility', e.target.value)}><option value="visible">{L('visible')}</option><option value="hidden">{L('hidden')}</option></select></Field></Section>}
      {section === 'contact' && <Section title={L('contact')}>{[['website', 'website'], ['phone', 'telephone'], ['email', 'email'], ['address', 'address'], ['openingHours', 'openingHours']].map(([key, label]) => <Field key={key} label={L(label)}><input className={inputClass} value={form[key]} maxLength={key === 'website' ? 1000 : 300} onChange={e => setField(key, e.target.value)} /></Field>)}</Section>}
      {section === 'accessibility' && <Section title={L('accessibility')}><Field label={L('wheelchair')}><select className={inputClass} value={form.wheelchair} onChange={e => setField('wheelchair', e.target.value)}><option value="">—</option>{['yes', 'no', 'limited', 'designated'].map(value => <option key={value}>{value}</option>)}</select></Field></Section>}
      {section === 'languages' && <Section title={L('languages')}><p className="text-xs text-muted-foreground">{L('languageNote')}</p><Field label={L('editLanguage')}><input className={inputClass} value={form.language} onChange={e => setField('language', e.target.value)} maxLength={12} /></Field><p className="text-xs">{L('originalName')}: {base?.name || record?.base?.originalName || '—'}</p><pre className="overflow-auto text-xs">{JSON.stringify({ osmNames: base?.localizedNames || {}, osmDescriptions: base?.localizedDescriptions || {} }, null, 2)}</pre><p className="text-xs">{L('nameAndDescriptionAbove')}</p></Section>}
      {section === 'media' && <Section title={L('media')}><p className="text-xs text-muted-foreground">{L('mediaUnavailable')}</p>{form.photoRefs.map((photo, index) => <div key={index} className="space-y-2 rounded-lg border border-border p-2"><Field label={L('storagePath')}><input className={inputClass} value={photo.storagePath} onChange={e => setField('photoRefs', form.photoRefs.map((item, i) => i === index ? { ...item, storagePath: e.target.value } : item))} /></Field>{[['credit', 'credit'], ['creator', 'creator'], ['license', 'license'], ['rightsReference', 'rightsReference'], ['sourceUrl', 'sourceUrl']].map(([field, label]) => <Field key={field} label={L(label)}><input className={inputClass} value={photo[field] || ''} onChange={e => setField('photoRefs', form.photoRefs.map((item, i) => i === index ? { ...item, [field]: e.target.value } : item))} /></Field>)}<p className="text-xs">{L('draftRights')}</p><div className="flex gap-2"><button className={buttonClass} disabled={index === 0} onClick={() => { const next = [...form.photoRefs]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; setField('photoRefs', next); }}>{L('moveFirst')}</button><button className={buttonClass} onClick={() => setField('photoRefs', form.photoRefs.filter((_, i) => i !== index))}>{L('remove')}</button></div></div>)}<button className={buttonClass} onClick={() => setField('photoRefs', [...form.photoRefs, { storagePath: 'official-poi-photos/', license: '', credit: '', sourceUrl: '', approval: 'draft' }])}>{L('addMetadata')}</button></Section>}
      {section === 'history' && <Section title={L('history')}><button className={buttonClass} disabled={!record || busy} onClick={() => setConfirmAction({ label: L('resetQuestion'), run: resetToBase })}>{L('resetAll')}</button>{history.map(item => <div key={item.revision} className="rounded-lg border border-border p-2 text-xs"><p className="font-semibold">#{item.revision} · {item.action} · {item.actorUid}</p><p>{item.createdAt?.toDate?.().toLocaleString() || ''} · {item.workflow === 'ready' ? L('ready') : L('draft')} · {L('unpublished')}</p><p>{(item.changedFields || Object.keys(item.patch || {})).join(', ')}</p><pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all">{JSON.stringify({ before: item.previousValues || null, after: item.newValues || item.patch }, null, 2)}</pre><button className={buttonClass} disabled={busy || item.revision === record?.revision} onClick={() => setConfirmAction({ label: L('rollbackQuestion'), run: () => rollback(item.revision) })}>{L('rollback')}</button></div>)}</Section>}
      <Field label={L('privateNote')}><textarea className={inputClass} rows={2} maxLength={2000} value={form.privateNote} onChange={e => setField('privateNote', e.target.value)} /></Field>
    </div>
    <footer className="flex shrink-0 flex-wrap gap-2 border-t border-border bg-background p-3"><button className={buttonClass} disabled={!dirty || busy} onClick={() => { setForm(initial); setMoveMode(false); }}>{L('cancel')}</button><button className={buttonClass} disabled={busy || unresolved} onClick={() => save({ workflow: 'draft' })}>{busy ? L('saving') : L('saveDraft')}</button><button className="min-h-10 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40" disabled={busy || unresolved} onClick={() => save({ workflow: 'ready' })}>{L('markReady')}</button>{record && <button className={buttonClass} disabled={busy} onClick={() => setConfirmAction({ label: form.visibility === 'hidden' ? L('restoreQuestion') : L('hideQuestion'), run: () => save({ visibility: form.visibility === 'hidden' ? 'visible' : 'hidden', workflow: 'draft' }) })}>{form.visibility === 'hidden' ? L('restore') : L('hide')}</button>}</footer>
    {confirmAction && <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 p-4"><div role="alertdialog" aria-modal="true" aria-label={confirmAction.label} className="w-full rounded-xl bg-background p-4 shadow-xl"><p className="mb-4 text-sm">{confirmAction.label}</p><div className="flex justify-end gap-2"><button className={buttonClass} onClick={() => setConfirmAction(null)}>{L('cancel')}</button><button className={buttonClass} onClick={() => { const action = confirmAction.run; setConfirmAction(null); action(); }}>{L('confirm')}</button></div></div></div>}
  </div>;
}
