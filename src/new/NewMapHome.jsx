import React, { useEffect, useRef, useState } from 'react';
import { Bookmark, Crosshair, Droplets, Layers, MapPin, Mic, Minus, Mountain, Plus, Route, UtensilsCrossed } from 'lucide-react';
import { getSpotDisplayName } from '@/lib/spotPresentation';
import { getSpotRating } from '@/lib/spotDiscovery';
import { SpotPhoto } from '@/mobile-v2/spotDisplay';
import { MAP_HOME_CATEGORIES, mapHomeCategoryOf } from './mapHomeData';
import NewSkeleton from './NewSkeleton';

const icons = { Výhledy: Mountain, Túry: Route, Voda: Droplets, Jídlo: UtensilsCrossed };
const layers = [['basic', 'Základní'], ['outdoor', 'Turistická'], ['aerial', 'Letecká'], ['winter', 'Zimní'], ['traffic', 'Doprava']];
const nextSize = { collapsed: 'expanded', expanded: 'fullscreen', fullscreen: 'collapsed' };
const previousSize = { collapsed: 'collapsed', expanded: 'collapsed', fullscreen: 'expanded' };

function CategoryChips({ category, setCategory, className = '' }) {
  return <div className={`sf-new-categories ${className}`} role="group" aria-label="Kategorie míst">
    {MAP_HOME_CATEGORIES.map(name => {
      const Icon = icons[name];
      return <button type="button" key={name} className={category === name ? 'is-active' : ''} aria-pressed={category === name} onClick={() => setCategory(name)}>{Icon && <Icon size={18} aria-hidden="true" />}{name}</button>;
    })}
  </div>;
}

function SaveButton({ spot, name, saved, busy, onSave }) {
  return <button type="button" className={`sf-new-save ${saved ? 'is-saved' : ''}`} disabled={busy || saved} aria-label={saved ? `Uloženo: ${name}` : `Uložit: ${name}`} onClick={() => onSave(spot)}><Bookmark size={20} fill={saved ? 'currentColor' : 'none'} /></button>;
}

function LayerMenu({ mapLayer, onMapLayer, poiLayers, onPoiLayers, onClose }) {
  const groups = [
    ['community', 'Komunitní místa'],
    ['interesting', 'Zajímavá místa OSM'],
    ['practical', 'Praktická místa OSM'],
    ['food', 'Jídlo a kavárny OSM'],
  ];
  return <div className="sf-new-layer-menu" role="group" aria-label="Mapové vrstvy">
    <strong>Podklad mapy</strong>
    {layers.map(([id, label]) => <button type="button" key={id} aria-pressed={mapLayer === id} onClick={() => { onMapLayer(id); onClose(); }}>{label}</button>)}
    <fieldset><legend>Místa na mapě</legend>{groups.map(([id, label]) => <label key={id}><input type="checkbox" checked={poiLayers[id]} onChange={event => onPoiLayers({ ...poiLayers, [id]: event.target.checked })} />{label}</label>)}</fieldset>
  </div>;
}

export default function NewMapHome({ category, setCategory, spots, language, loading, error, onRetry, onSearch, onVoiceSearch, onGps, geoError, onDismissGeoError, map, mapLayer, onMapLayer, poiLayers, onPoiLayers, terrain, onTerrain, showZoomButtons = false, nearbySize, onNearbySize, onOpen, onSave, savedIds, savingSpotId, collectionMode = false, onExitCollection }) {
  const [layersOpen, setLayersOpen] = useState(false);
  const dragStart = useRef(null);
  const swiped = useRef(false);
  const hasResults = spots.length > 0;
  const sheetSize = nearbySize === 'fullscreen' && !hasResults ? 'expanded' : nearbySize;
  const expanded = sheetSize !== 'collapsed';
  useEffect(() => { if (nearbySize === 'fullscreen' && !hasResults) onNearbySize('expanded'); }, [nearbySize, hasResults, onNearbySize]);
  useEffect(() => { setLayersOpen(false); }, [sheetSize]);
  const changeSize = direction => {
    const next = (direction === 'up' ? nextSize : previousSize)[sheetSize];
    onNearbySize(next === 'fullscreen' && !hasResults ? 'expanded' : next);
  };
  const handlePointerUp = event => {
    if (dragStart.current == null) return;
    const delta = event.clientY - dragStart.current;
    dragStart.current = null;
    if (Math.abs(delta) < 35) return;
    swiped.current = true;
    window.setTimeout(() => { swiped.current = false; }, 100);
    changeSize(delta < 0 ? 'up' : 'down');
  };
  const renderSpot = (spot, index, vertical = false) => {
    const name = getSpotDisplayName(spot, language);
    const rating = getSpotRating(spot);
    const spotCategory = mapHomeCategoryOf(spot);
    const Icon = icons[spotCategory];
    const saved = savedIds.has(spot.id);
    return <article className={vertical ? `sf-new-row ${sheetSize === 'fullscreen' && index === 0 ? 'sf-new-row--hero' : ''}` : 'sf-new-card'} key={spot.id}>
      <button type="button" className={vertical ? 'sf-new-row-open' : 'sf-new-card-open'} onClick={() => onOpen(spot)}>
        <span className={vertical ? 'sf-new-row-image' : 'sf-new-card-image'}><SpotPhoto spot={spot} />{(!vertical || sheetSize === 'fullscreen' && index === 0) && <span className="sf-new-card-category">{Icon && <Icon size={15} />}{spotCategory}</span>}</span>
        <span className="sf-new-card-copy">{vertical && sheetSize !== 'fullscreen' && <span className="sf-new-row-category">{Icon && <Icon size={15} />}{spotCategory}</span>}<strong>{name}</strong><small>{rating === null ? 'Bez hodnocení' : `★ ${rating.toFixed(1).replace('.', ',')}`}</small></span>
      </button>
      <SaveButton spot={spot} name={name} saved={saved} busy={savingSpotId === spot.id} onSave={onSave} />
    </article>;
  };

  return <>
    {sheetSize !== 'fullscreen' && <div className="sf-new-top">
      <div className="sf-new-search"><img src="/mobile-v2/official-logo.png" alt="SpotFinder" /><button type="button" onClick={onSearch}>Hledat místa…</button><button className="sf-new-microphone" type="button" onClick={onVoiceSearch} aria-label="Hledat místa hlasem"><Mic size={21} /></button></div>
      {!collectionMode && sheetSize === 'collapsed' && <CategoryChips category={category} setCategory={setCategory} />}
    </div>}
    {sheetSize === 'collapsed' && <div className="sf-new-controls">
      <button type="button" aria-label="Mapové vrstvy" aria-expanded={layersOpen} onClick={() => setLayersOpen(value => !value)}><Layers size={21} /></button>
      {layersOpen && <LayerMenu mapLayer={mapLayer} onMapLayer={onMapLayer} poiLayers={poiLayers} onPoiLayers={onPoiLayers} onClose={() => setLayersOpen(false)} />}
      <button type="button" aria-label="Přepnout 3D mapu" aria-pressed={terrain} onClick={onTerrain}>3D</button>
      <button type="button" aria-label="Moje poloha" onClick={onGps}><Crosshair size={21} /></button>
      {showZoomButtons && <div className="sf-new-zoom"><button type="button" aria-label="Přiblížit mapu" onClick={() => map?.zoomIn()} disabled={!map}><Plus size={18} /></button><button type="button" aria-label="Oddálit mapu" onClick={() => map?.zoomOut()} disabled={!map}><Minus size={18} /></button></div>}
    </div>}
    {geoError && sheetSize === 'collapsed' && <div className="sf-new-geo-error" role="status">{geoError}<button type="button" onClick={onDismissGeoError}>Zavřít</button></div>}
    <section className={`sf-new-nearby sf-new-nearby--${sheetSize}${!hasResults ? ' is-empty' : ''}`} aria-label="Poblíž">
      <button className="sf-new-handle" type="button" aria-label={expanded ? 'Změnit velikost seznamu míst' : 'Rozbalit místa poblíž'} onPointerDown={event => { dragStart.current = event.clientY; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerUp={handlePointerUp} onPointerCancel={() => { dragStart.current = null; }} onClick={() => { if (swiped.current) { swiped.current = false; return; } changeSize('up'); }}><span /></button>
      <div className="sf-new-nearby-heading"><div><h2>{collectionMode ? 'Moje místa' : 'Poblíž'}</h2><p>{loading ? 'Načítám místa…' : `${spots.length} míst na mapě`}</p></div>{collectionMode ? <button type="button" onClick={onExitCollection}>Komunitní mapa</button> : <button type="button" onClick={onGps}><Crosshair size={18} /> Zapnout polohu</button>}</div>
      {expanded && !collectionMode && <CategoryChips category={category} setCategory={setCategory} className="sf-new-categories--sheet" />}
      {error && !hasResults ? <p className="sf-new-state">Místa se nepodařilo načíst. <button type="button" onClick={onRetry}>Zkusit znovu</button></p> : loading && !hasResults ? <NewSkeleton kind={expanded ? 'nearbyRows' : 'nearbyCards'} /> : !hasResults ? <div className="sf-new-nearby-empty"><MapPin size={23} aria-hidden="true" /><p>{collectionMode ? 'Zatím tu nemáš žádná veřejná místa s polohou.' : category !== 'Vše' ? 'V této kategorii tu zatím nejsou místa.' : 'V zobrazené oblasti zatím nejsou místa.'}</p>{collectionMode ? <button type="button" onClick={onExitCollection}>Zobrazit komunitní mapu</button> : category !== 'Vše' ? <button type="button" onClick={() => setCategory('Vše')}>Zobrazit vše</button> : <button type="button" onClick={onSearch}>Hledat jiné místo</button>}</div> : expanded ? <div className="sf-new-vertical-list">{spots.map((spot, index) => renderSpot(spot, index, true))}</div> : <div className="sf-new-card-list">{spots.slice(0, 20).map((spot, index) => renderSpot(spot, index))}</div>}
    </section>
  </>;
}
