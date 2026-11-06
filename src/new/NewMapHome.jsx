import React, { useEffect, useRef, useState } from 'react';
import { Bookmark, Crosshair, Layers, MapPin, Mic, Minus, Plus } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { getSpotDisplayName } from '@/lib/spotPresentation';
import { getSpotRating } from '@/lib/spotDiscovery';
import { categoryLabel } from '@/lib/spotCategories';
import { SpotPhoto } from '@/mobile-v2/spotDisplay';
import { MAP_HOME_ALL, MAP_HOME_CATEGORIES, mapHomeCategoryOf } from './mapHomeData';
import { SPOT_CATEGORY_ICONS } from './spotCategoryIcons';
import NewSkeleton from './NewSkeleton';
import { newMotion, reducedTransition } from './motion';
import { useLanguage } from '@/lib/LanguageContext';

const layers = ['basic', 'outdoor', 'aerial', 'winter', 'traffic'];
const nextSize = { collapsed: 'expanded', expanded: 'fullscreen', fullscreen: 'collapsed' };
const previousSize = { collapsed: 'collapsed', expanded: 'collapsed', fullscreen: 'expanded' };

function CategoryChips({ category, setCategory, language, className = '' }) {
  const { t } = useLanguage();
  const cs = String(language || '').startsWith('cs');
  const reduced = useReducedMotion();
  return <div className={`sf-new-categories ${className}`} role="group" aria-label={t('newMap.categories')}>
    {MAP_HOME_CATEGORIES.map(name => {
      const isAll = name === MAP_HOME_ALL;
      const Icon = isAll ? null : SPOT_CATEGORY_ICONS[name];
      const label = isAll ? (cs ? 'Vše' : 'All') : categoryLabel(name, language, { short: true });
      return <button type="button" key={name} className={category === name ? 'is-active' : ''} aria-pressed={category === name} onClick={() => setCategory(name)}>{category === name && <motion.span className="sf-new-chip-highlight" layoutId="sf-new-map-category-highlight" transition={reduced ? reducedTransition : newMotion.selection} />}{Icon && <Icon size={18} aria-hidden="true" />}{label}</button>;
    })}
  </div>;
}

function SaveButton({ spot, name, saved, busy, onSave }) {
  const { t } = useLanguage();
  return <button type="button" className={`sf-new-save ${saved ? 'is-saved' : ''}`} disabled={busy || saved} aria-label={t(saved ? 'newMap.savedName' : 'newMap.saveName', { name })} onClick={() => onSave(spot)}><Bookmark size={20} fill={saved ? 'currentColor' : 'none'} /></button>;
}

function LayerMenu({ mapLayer, onMapLayer, poiLayers, onPoiLayers, onClose }) {
  const { t } = useLanguage();
  const groups = ['community', 'interesting', 'parking', 'practical', 'food'];
  return <div className="sf-new-layer-menu" role="group" aria-label={t('newMap.layers')}>
    <strong>{t('newMap.baseLayer')}</strong>
    {layers.map(id => <button type="button" key={id} aria-pressed={mapLayer === id} onClick={() => { onMapLayer(id); onClose(); }}>{t(`newMap.${id}`)}</button>)}
    <fieldset><legend>{t('newMap.placesLayer')}</legend>{groups.map(id => <label key={id}><input type="checkbox" checked={poiLayers[id]} onChange={event => onPoiLayers({ ...poiLayers, [id]: event.target.checked })} />{t(`newMap.${id}`)}</label>)}</fieldset>
  </div>;
}

export default function NewMapHome({ category, setCategory, spots, language, loading, error, onRetry, onSearch, onVoiceSearch, onGps, geoError, onDismissGeoError, map, mapLayer, onMapLayer, poiLayers, onPoiLayers, terrain, onTerrain, showZoomButtons = false, nearbySize, onNearbySize, onOpen, onSave, savedIds, savingSpotId, collectionMode = false, onExitCollection }) {
  const { t } = useLanguage();
  const [layersOpen, setLayersOpen] = useState(false);
  const dragStart = useRef(null);
  const swiped = useRef(false);
  const hasResults = spots.length > 0;
  const sheetSize = nearbySize;
  const expanded = sheetSize !== 'collapsed';
  useEffect(() => { setLayersOpen(false); }, [sheetSize]);
  const changeSize = direction => {
    const next = (direction === 'up' ? nextSize : previousSize)[sheetSize];
    onNearbySize(next);
  };
  const handlePointerUp = event => {
    if (dragStart.current == null) return;
    const delta = event.clientY - dragStart.current;
    dragStart.current = null;
    if (Math.abs(delta) < 35) return;
    swiped.current = true;
    window.setTimeout(() => { swiped.current = false; }, 400);
    changeSize(delta < 0 ? 'up' : 'down');
  };
  const renderSpot = (spot, index, vertical = false) => {
    const name = getSpotDisplayName(spot, language);
    const rating = getSpotRating(spot);
    const spotCategory = mapHomeCategoryOf(spot);
    const Icon = spotCategory ? SPOT_CATEGORY_ICONS[spotCategory] : null;
    const categoryName = spotCategory ? categoryLabel(spotCategory, language, { short: true }) : (String(language || '').startsWith('cs') ? 'Místo' : 'Spot');
    const saved = savedIds.has(spot.id);
    return <article className={vertical ? `sf-new-row ${sheetSize === 'fullscreen' && index === 0 ? 'sf-new-row--hero' : ''}` : 'sf-new-card'} key={spot.id}>
      <button type="button" className={vertical ? 'sf-new-row-open' : 'sf-new-card-open'} onClick={() => onOpen(spot)}>
        <span className={vertical ? 'sf-new-row-image' : 'sf-new-card-image'}><SpotPhoto spot={spot} />{(!vertical || sheetSize === 'fullscreen' && index === 0) && <span className="sf-new-card-category">{Icon && <Icon size={15} />}{categoryName}</span>}</span>
        <span className="sf-new-card-copy">{vertical && sheetSize !== 'fullscreen' && <span className="sf-new-row-category">{Icon && <Icon size={15} />}{categoryName}</span>}<strong>{name}</strong><small>{rating === null ? t('newMap.unrated') : `★ ${rating.toFixed(1).replace('.', ',')}`}</small></span>
      </button>
      <SaveButton spot={spot} name={name} saved={saved} busy={savingSpotId === spot.id} onSave={onSave} />
    </article>;
  };

  return <>
    {sheetSize !== 'fullscreen' && <div className="sf-new-top">
      <div className="sf-new-search"><img src="/app-icon-v2-192.png?v=3" alt="SpotFinder" /><button type="button" onClick={onSearch}>{t('newMobile.searchPlaceholder')}</button><button className="sf-new-microphone" type="button" onClick={onVoiceSearch} aria-label={t('newMap.voice')}><Mic size={21} /></button></div>
      {!collectionMode && sheetSize === 'collapsed' && <CategoryChips category={category} setCategory={setCategory} language={language} />}
    </div>}
    {sheetSize === 'collapsed' && <div className="sf-new-controls">
      <button type="button" aria-label={t('newMap.layers')} aria-expanded={layersOpen} onClick={() => setLayersOpen(value => !value)}><Layers size={21} /></button>
      {layersOpen && <LayerMenu mapLayer={mapLayer} onMapLayer={onMapLayer} poiLayers={poiLayers} onPoiLayers={onPoiLayers} onClose={() => setLayersOpen(false)} />}
      <button type="button" aria-label={t('newMap.terrain')} aria-pressed={terrain} onClick={onTerrain}>3D</button>
      <button type="button" aria-label={t('newMap.location')} onClick={onGps}><Crosshair size={21} /></button>
      {showZoomButtons && <div className="sf-new-zoom"><button type="button" aria-label={t('newMap.zoomIn')} onClick={() => map?.zoomIn()} disabled={!map}><Plus size={18} /></button><button type="button" aria-label={t('newMap.zoomOut')} onClick={() => map?.zoomOut()} disabled={!map}><Minus size={18} /></button></div>}
    </div>}
    {geoError && sheetSize === 'collapsed' && <div className="sf-new-geo-error" role="status">{geoError}<button type="button" onClick={onDismissGeoError}>{t('newMap.close')}</button></div>}
    <section className={`sf-new-nearby sf-new-nearby--${sheetSize}${!hasResults ? ' is-empty' : ''}`} aria-label={t('newMap.nearby')}>
      <button className="sf-new-handle" type="button" aria-label={t(expanded ? 'newMap.resize' : 'newMap.expand')} onPointerDown={event => { dragStart.current = event.clientY; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerUp={handlePointerUp} onPointerCancel={() => { dragStart.current = null; }} onClick={() => { if (swiped.current) { swiped.current = false; return; } changeSize('up'); }}><span /></button>
      <div className="sf-new-nearby-heading"><div><h2>{t(collectionMode ? 'newMap.myPlaces' : 'newMap.nearby')}</h2><p>{loading ? t('newMap.loading') : t('newMap.count', { count: spots.length })}</p></div>{collectionMode ? <button type="button" onClick={onExitCollection}>{t('newMap.communityMap')}</button> : <button type="button" onClick={onGps}><Crosshair size={18} /> {t('newMap.enableLocation')}</button>}</div>
      {expanded && !collectionMode && <CategoryChips category={category} setCategory={setCategory} language={language} className="sf-new-categories--sheet" />}
      {error && !hasResults ? <p className="sf-new-state">{t('newMap.loadFailed')} <button type="button" onClick={onRetry}>{t('newMap.retry')}</button></p> : loading && !hasResults ? <NewSkeleton kind={expanded ? 'nearbyRows' : 'nearbyCards'} /> : !hasResults ? <div className="sf-new-nearby-empty"><MapPin size={23} aria-hidden="true" /><p>{t(collectionMode ? 'newMap.emptyCollection' : category !== MAP_HOME_ALL ? 'newMap.emptyCategory' : 'newMap.emptyArea')}</p>{collectionMode ? <button type="button" onClick={onExitCollection}>{t('newMap.showCommunity')}</button> : category !== MAP_HOME_ALL ? <button type="button" onClick={() => setCategory(MAP_HOME_ALL)}>{t('newMap.showAll')}</button> : <button type="button" onClick={onSearch}>{t('newMap.searchElsewhere')}</button>}</div> : expanded ? <div className="sf-new-vertical-list">{spots.map((spot, index) => renderSpot(spot, index, true))}</div> : <div className="sf-new-card-list">{spots.slice(0, 20).map((spot, index) => renderSpot(spot, index))}</div>}
    </section>
  </>;
}
