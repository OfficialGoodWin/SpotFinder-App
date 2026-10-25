import React, { useState } from 'react';
import { Bookmark, Crosshair, Droplets, Layers, Mic, Mountain, Route, Search, UtensilsCrossed } from 'lucide-react';
import { getSpotDisplayName } from '@/lib/spotPresentation';
import { getSpotRating } from '@/lib/spotDiscovery';
import { SpotPhoto } from '@/mobile-v2/spotDisplay';
import { MAP_HOME_CATEGORIES, mapHomeCategoryOf } from './mapHomeData';

const icons = { 'Výhledy': Mountain, 'Túry': Route, 'Voda': Droplets, 'Jídlo': UtensilsCrossed };
const layers = [['basic', 'Základní'], ['outdoor', 'Turistická'], ['aerial', 'Letecká'], ['winter', 'Zimní'], ['traffic', 'Doprava']];

export default function NewMapHome({ category, setCategory, spots, language, loading, error, onRetry, onSearch, onGps, geoError, onDismissGeoError, mapLayer, onMapLayer, terrain, onTerrain, nearbySize, onNearbySize, onOpen, onSave, savedIds, savingSpotId }) {
  const [layersOpen, setLayersOpen] = useState(false);
  const count = spots.length;
  return <>
    <div className="sf-new-top">
      <button className="sf-new-search" type="button" onClick={onSearch}><img src="/mobile-v2/official-logo.png" alt="SpotFinder" /><span>Hledat místa…</span><Search size={18} aria-hidden="true" /><Mic size={20} aria-hidden="true" /></button>
      <div className="sf-new-categories" role="group" aria-label="Kategorie míst">
        {MAP_HOME_CATEGORIES.map(name => { const Icon = icons[name]; return <button type="button" key={name} className={category === name ? 'is-active' : ''} aria-pressed={category === name} onClick={() => setCategory(name)}>{Icon && <Icon size={18} aria-hidden="true" />}{name}</button>; })}
      </div>
    </div>
    <div className="sf-new-controls">
      <button type="button" aria-label="Mapové vrstvy" aria-expanded={layersOpen} onClick={() => setLayersOpen(value => !value)}><Layers size={21} /></button>
      {layersOpen && <div className="sf-new-layer-menu" role="group" aria-label="Mapové vrstvy">{layers.map(([id, label]) => <button type="button" key={id} aria-pressed={mapLayer === id} onClick={() => { onMapLayer(id); setLayersOpen(false); }}>{label}</button>)}</div>}
      <button type="button" aria-label="Přepnout 3D mapu" aria-pressed={terrain} onClick={onTerrain}>3D</button>
      <button type="button" aria-label="Moje poloha" onClick={onGps}><Crosshair size={21} /></button>
    </div>
    {geoError && <div className="sf-new-geo-error" role="status">{geoError}<button type="button" onClick={onDismissGeoError}>Zavřít</button></div>}
    <section className={`sf-new-nearby sf-new-nearby--${nearbySize}`} aria-label="Poblíž">
      <button className="sf-new-handle" type="button" aria-label={nearbySize === 'collapsed' ? 'Rozbalit místa poblíž' : 'Zmenšit místa poblíž'} onClick={() => onNearbySize(nearbySize === 'collapsed' ? 'partial' : 'collapsed')}><span /></button>
      <div className="sf-new-nearby-heading"><div><h2>Poblíž</h2><p>{loading ? 'Načítám místa…' : `${count} míst na mapě`}</p></div><button type="button" onClick={onGps}><Crosshair size={18} /> Zapnout polohu</button></div>
      <div className="sf-new-card-list">
        {error ? <p className="sf-new-state">Místa se nepodařilo načíst. <button type="button" onClick={onRetry}>Zkusit znovu</button></p> : !loading && !count ? <p className="sf-new-state">V této části mapy nejsou místa v dané kategorii. Posuň mapu nebo změň filtr.</p> : spots.slice(0, nearbySize === 'collapsed' ? 8 : 20).map(spot => {
          const name = getSpotDisplayName(spot, language);
          const rating = getSpotRating(spot);
          const spotCategory = mapHomeCategoryOf(spot);
          const Icon = icons[spotCategory];
          const saved = savedIds.has(spot.id);
          return <article className="sf-new-card" key={spot.id}>
            <button type="button" className="sf-new-card-open" onClick={() => onOpen(spot)}><span className="sf-new-card-image"><SpotPhoto spot={spot} /><span className="sf-new-card-category">{Icon && <Icon size={15} />}{spotCategory}</span></span><strong>{name}</strong><small>{rating === null ? 'Bez hodnocení' : `★ ${rating.toFixed(1).replace('.', ',')}`}</small></button>
            <button type="button" className={`sf-new-save ${saved ? 'is-saved' : ''}`} disabled={savingSpotId === spot.id || saved} aria-label={saved ? `Uloženo: ${name}` : `Uložit: ${name}`} onClick={() => onSave(spot)}><Bookmark size={20} fill={saved ? 'currentColor' : 'none'} /></button>
          </article>;
        })}
      </div>
    </section>
  </>;
}
