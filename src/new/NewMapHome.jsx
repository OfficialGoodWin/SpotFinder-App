import React, { useRef, useState } from 'react';
import { Bookmark, Crosshair, Droplets, Layers, Mic, Minus, Mountain, Plus, Route, UtensilsCrossed } from 'lucide-react';
import { getSpotDisplayName } from '@/lib/spotPresentation';
import { getSpotRating } from '@/lib/spotDiscovery';
import { SpotPhoto } from '@/mobile-v2/spotDisplay';
import { MAP_HOME_CATEGORIES, mapHomeCategoryOf } from './mapHomeData';

const icons = { Výhledy: Mountain, Túry: Route, Voda: Droplets, Jídlo: UtensilsCrossed };
const layers = [['basic', 'Základní'], ['outdoor', 'Turistická'], ['aerial', 'Letecká'], ['winter', 'Zimní'], ['traffic', 'Doprava']];
const nextSize = { collapsed: 'partial', partial: 'full', full: 'collapsed' };
const previousSize = { collapsed: 'collapsed', partial: 'collapsed', full: 'partial' };

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

export default function NewMapHome({ category, setCategory, spots, language, loading, error, onRetry, onSearch, onVoiceSearch, onGps, geoError, onDismissGeoError, map, mapLayer, onMapLayer, terrain, onTerrain, nearbySize, onNearbySize, onOpen, onSave, savedIds, savingSpotId }) {
  const [layersOpen, setLayersOpen] = useState(false);
  const touchStart = useRef(null);
  const swiped = useRef(false);
  const expanded = nearbySize !== 'collapsed';
  const handleTouchEnd = event => {
    if (touchStart.current == null) return;
    const delta = event.changedTouches[0]?.clientY - touchStart.current;
    touchStart.current = null;
    if (Math.abs(delta) < 35) return;
    swiped.current = true;
    window.setTimeout(() => { swiped.current = false; }, 500);
    onNearbySize(delta < 0 ? nearbySize === 'full' ? 'full' : nextSize[nearbySize] : previousSize[nearbySize]);
  };
  const renderSpot = (spot, index, vertical = false) => {
    const name = getSpotDisplayName(spot, language);
    const rating = getSpotRating(spot);
    const spotCategory = mapHomeCategoryOf(spot);
    const Icon = icons[spotCategory];
    const saved = savedIds.has(spot.id);
    return <article className={vertical ? `sf-new-row ${nearbySize === 'full' && index === 0 ? 'sf-new-row--hero' : ''}` : 'sf-new-card'} key={spot.id}>
      <button type="button" className={vertical ? 'sf-new-row-open' : 'sf-new-card-open'} onClick={() => onOpen(spot)}>
        <span className={vertical ? 'sf-new-row-image' : 'sf-new-card-image'}><SpotPhoto spot={spot} />{(!vertical || nearbySize === 'full' && index === 0) && <span className="sf-new-card-category">{Icon && <Icon size={15} />}{spotCategory}</span>}</span>
        <span className="sf-new-card-copy">{vertical && nearbySize !== 'full' && <span className="sf-new-row-category">{Icon && <Icon size={15} />}{spotCategory}</span>}<strong>{name}</strong><small>{rating === null ? 'Bez hodnocení' : `★ ${rating.toFixed(1).replace('.', ',')}`}</small></span>
      </button>
      <SaveButton spot={spot} name={name} saved={saved} busy={savingSpotId === spot.id} onSave={onSave} />
    </article>;
  };

  return <>
    <div className="sf-new-top">
      <div className="sf-new-search"><img src="/mobile-v2/official-logo.png" alt="SpotFinder" /><button type="button" onClick={onSearch}>Hledat místa…</button><button className="sf-new-microphone" type="button" onClick={onVoiceSearch} aria-label="Hledat místa hlasem"><Mic size={21} /></button></div>
      <CategoryChips category={category} setCategory={setCategory} />
    </div>
    <div className="sf-new-controls">
      <button type="button" aria-label="Mapové vrstvy" aria-expanded={layersOpen} onClick={() => setLayersOpen(value => !value)}><Layers size={21} /></button>
      {layersOpen && <div className="sf-new-layer-menu" role="group" aria-label="Mapové vrstvy">{layers.map(([id, label]) => <button type="button" key={id} aria-pressed={mapLayer === id} onClick={() => { onMapLayer(id); setLayersOpen(false); }}>{label}</button>)}</div>}
      <button type="button" aria-label="Přepnout 3D mapu" aria-pressed={terrain} onClick={onTerrain}>3D</button>
      <button type="button" aria-label="Moje poloha" onClick={onGps}><Crosshair size={21} /></button>
      <div className="sf-new-zoom"><button type="button" aria-label="Přiblížit mapu" onClick={() => map?.zoomIn()} disabled={!map}><Plus size={18} /></button><button type="button" aria-label="Oddálit mapu" onClick={() => map?.zoomOut()} disabled={!map}><Minus size={18} /></button></div>
    </div>
    {geoError && <div className="sf-new-geo-error" role="status">{geoError}<button type="button" onClick={onDismissGeoError}>Zavřít</button></div>}
    <section className={`sf-new-nearby sf-new-nearby--${nearbySize}`} aria-label="Poblíž">
      <button className="sf-new-handle" type="button" aria-label={expanded ? 'Změnit velikost seznamu míst' : 'Rozbalit místa poblíž'} onTouchStart={event => { touchStart.current = event.touches[0]?.clientY ?? null; }} onTouchEnd={handleTouchEnd} onClick={() => { if (swiped.current) { swiped.current = false; return; } onNearbySize(nextSize[nearbySize]); }}><span /></button>
      <div className="sf-new-nearby-heading"><div><h2>Poblíž</h2><p>{loading ? 'Načítám místa…' : `${spots.length} míst na mapě`}</p></div><button type="button" onClick={onGps}><Crosshair size={18} /> Zapnout polohu</button></div>
      {nearbySize === 'full' && <CategoryChips category={category} setCategory={setCategory} className="sf-new-categories--sheet" />}
      {error ? <p className="sf-new-state">Místa se nepodařilo načíst. <button type="button" onClick={onRetry}>Zkusit znovu</button></p> : !loading && !spots.length ? <p className="sf-new-state">V této části mapy nejsou místa v dané kategorii. Posuň mapu nebo změň filtr.</p> : expanded ? <div className="sf-new-vertical-list">{spots.map((spot, index) => renderSpot(spot, index, true))}</div> : <div className="sf-new-card-list">{spots.slice(0, 20).map((spot, index) => renderSpot(spot, index))}</div>}
    </section>
  </>;
}
