import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { getDiscoverSpotsPage } from '@/api/firebaseClient';
import { getSpotRating } from '@/lib/spotDiscovery';
import { isDiscoverEligible } from '@/mobile-v2/discoverSpots';
import DiscoverCard from '@/mobile-v2/DiscoverCard';
import NewSkeleton from './NewSkeleton';
import { DISCOVER_ALL, appendUniqueDiscoverSpots, discoverCategoryLabel, matchesDiscoverCategory } from './discoverCategory';
import { SPOT_CATEGORY_KEYS, categoryLabel } from '@/lib/spotCategories';
import './new-discover.css';
import { newMotion, reducedTransition } from './motion';

const CATEGORIES = [DISCOVER_ALL, ...SPOT_CATEGORY_KEYS];
const QUERY_SIZE = 24;
const TARGET_MATCHES = 12;

function ratingLabel(spot) {
  const rating = getSpotRating(spot);
  if (rating === null) return 'Zatím bez hodnocení';
  const count = Number(spot.rating_count);
  return `★ ${rating.toFixed(1).replace('.', ',')}${Number.isFinite(count) && count > 0 ? ` (${count})` : ''}`;
}

export default function NewDiscover({ language, titleOf, locationOf, savedIds, savingSpotId, onSave, onOpen, onMap }) {
  const reduced = useReducedMotion();
  const [category, setCategory] = useState(DISCOVER_ALL);
  const [pageState, setPageState] = useState({ spots: [], cursor: null, hasMore: true, loading: true, error: false, initialized: false });
  const generation = useRef(0);
  const inFlight = useRef(false);

  const fetchNext = useCallback(async ({ filter, cursor, replace, request }) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPageState(previous => ({ ...previous, loading: true, error: false }));
    let nextCursor = cursor;
    let hasMore = true;
    const matches = [];
    try {
      while (hasMore && matches.length < TARGET_MATCHES) {
        const page = await getDiscoverSpotsPage(nextCursor, QUERY_SIZE);
        if (request !== generation.current) return;
        matches.push(...page.spots.filter(spot => isDiscoverEligible(spot) && matchesDiscoverCategory(spot, filter)));
        nextCursor = page.cursor;
        hasMore = Boolean(page.hasMore && nextCursor);
      }
      if (request !== generation.current) return;
      setPageState(previous => ({
        spots: replace ? appendUniqueDiscoverSpots([], matches) : appendUniqueDiscoverSpots(previous.spots, matches),
        cursor: nextCursor, hasMore, loading: false, error: false, initialized: true,
      }));
    } catch {
      if (request === generation.current) setPageState(previous => ({
        ...previous,
        spots: appendUniqueDiscoverSpots(replace ? [] : previous.spots, matches),
        cursor: nextCursor,
        hasMore: true,
        loading: false,
        error: true,
        initialized: true,
      }));
    } finally {
      if (request === generation.current) inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    const request = ++generation.current;
    inFlight.current = false;
    setPageState({ spots: [], cursor: null, hasMore: true, loading: true, error: false, initialized: false });
    void fetchNext({ filter: category, cursor: null, replace: true, request });
    return () => { generation.current += 1; inFlight.current = false; };
  }, [category, fetchNext]);

  const loadMore = () => {
    if (inFlight.current || !pageState.hasMore || pageState.loading) return;
    void fetchNext({ filter: category, cursor: pageState.cursor, replace: false, request: generation.current });
  };

  return <section className="v2-page sf-new-discover-page">
    <header className="v2-page-header"><h1>Objevit</h1><p>Místa sdílená komunitou</p></header>
    <div className="v2-chips" role="group" aria-label="Kategorie míst">{CATEGORIES.map(name => <button type="button" key={name} className={category === name ? 'active' : ''} aria-pressed={category === name} onClick={() => setCategory(name)}>{category === name && <motion.span className="sf-new-chip-highlight" layoutId="sf-new-discover-category-highlight" transition={reduced ? reducedTransition : newMotion.selection} />}{name === DISCOVER_ALL ? (String(language || '').startsWith('cs') ? 'Vše' : 'All') : categoryLabel(name, language, { short: true })}</button>)}</div>
    <div className="v2-scroll sf-new-discover-scroll">
      <div className="sf-new-discover-grid">
        {pageState.spots.map(spot => <DiscoverCard key={String(spot.id)} spot={spot} title={titleOf(spot, language)} location={locationOf(spot)} categoryLabel={discoverCategoryLabel(spot, language)} ratingLabel={ratingLabel(spot)} landscape compact savingSpotId={savingSpotId} savedIds={savedIds} onSave={onSave} onOpen={onOpen} onMap={onMap} />)}
        {pageState.loading && <NewSkeleton kind="discoverCards" />}
      </div>
      {!pageState.loading && !pageState.spots.length && !pageState.error && <p className="sf-new-discover-state">V této kategorii zatím nejsou dostupná místa.</p>}
      {pageState.error && <p className="sf-new-discover-state" role="alert">Místa se nepodařilo načíst. Dosavadní výsledky zůstaly zachované.</p>}
      {(pageState.hasMore || pageState.error) && pageState.initialized && <div className="sf-new-discover-more"><button type="button" onClick={loadMore} disabled={pageState.loading} aria-label={pageState.error ? 'Zkusit načíst další místa znovu' : undefined}>{pageState.loading && <span className="sf-new-discover-spinner" aria-hidden="true" />}{pageState.loading ? 'Načítám…' : pageState.error ? 'Zkusit znovu' : 'Načíst další místa'}</button></div>}
    </div>
  </section>;
}
