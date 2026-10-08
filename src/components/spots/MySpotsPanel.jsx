import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, ArrowUpDown, Bookmark, Eye, Heart, MapPin, PlusCircle,
  RefreshCw, Search, Star, Trash2, X,
} from 'lucide-react';
import {
  deleteSpot as firebaseDeleteSpot,
  getLikedSpots,
  getSavedSpots,
  getUserSpots,
} from '@/api/firebaseClient';
import LiquidSegmentedControl from '../ui/LiquidSegmentedControl';
import SmoothSelect from '../ui/SmoothSelect';

const TABS = [
  { id: 'saved', label: 'Saved', icon: Bookmark },
  { id: 'created', label: 'Created', icon: PlusCircle },
  { id: 'liked', label: 'Liked', icon: Heart },
];

const SORTS = [
  ['newest', 'Newest'],
  ['oldest', 'Oldest'],
  ['rating', 'Highest rated'],
  ['liked', 'Most liked'],
  ['alphabetical', 'Alphabetical'],
];

const EMPTY_COPY = {
  saved: ['No saved spots yet', 'Save places you want to come back to.'],
  created: ['No created spots yet', 'Add a spot to start your collection.'],
  liked: ['No liked spots yet', 'Like a spot and it will appear here.'],
};

const timestamp = (spot) => {
  const value = spot.created_date || spot.created_at;
  const parsed = value?.toDate?.() || (value ? new Date(value) : null);
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.getTime() : 0;
};

const locationLabel = (spot) =>
  spot.location || spot.address || spot.city || spot.region ||
  (Number.isFinite(Number(spot.lat)) && Number.isFinite(Number(spot.lng))
    ? `${Number(spot.lat).toFixed(3)}, ${Number(spot.lng).toFixed(3)}`
    : 'Location unavailable');

export default function MySpotsPanel({ user, onClose, onFlyTo }) {
  const [tab, setTab] = useState('saved');
  const [data, setData] = useState({ saved: null, created: null, liked: null });
  const [loading, setLoading] = useState({ saved: false, created: false, liked: false });
  const [errors, setErrors] = useState({ saved: '', created: '', liked: '' });
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('newest');
  const [deletingId, setDeletingId] = useState('');

  const loadTab = useCallback(async (tabId) => {
    if (!user?.id) return;
    setLoading(current => ({ ...current, [tabId]: true }));
    setErrors(current => ({ ...current, [tabId]: '' }));
    try {
      let rows;
      if (tabId === 'saved') rows = await getSavedSpots(user.id, 100);
      else if (tabId === 'liked') rows = await getLikedSpots(user.id, 100);
      else rows = await getUserSpots(user.email, 100);
      setData(current => ({ ...current, [tabId]: rows }));
    } catch (error) {
      console.error(`My Spots ${tabId} load failed`, error);
      setErrors(current => ({ ...current, [tabId]: 'Could not load these spots. Please try again.' }));
    } finally {
      setLoading(current => ({ ...current, [tabId]: false }));
    }
  }, [user?.email, user?.id]);

  useEffect(() => {
    if (data[tab] === null && !loading[tab] && !errors[tab]) loadTab(tab);
  }, [data, errors, loadTab, loading, tab]);

  const visibleSpots = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const filtered = (data[tab] || []).filter(spot => !normalized ||
      [spot.title, spot.description, locationLabel(spot)].some(value =>
        String(value || '').toLocaleLowerCase().includes(normalized)));
    return [...filtered].sort((a, b) => {
      if (sort === 'oldest') return timestamp(a) - timestamp(b);
      if (sort === 'rating') return Number(b.rating || 0) - Number(a.rating || 0);
      if (sort === 'liked') return Number(b.likes_count || 0) - Number(a.likes_count || 0);
      if (sort === 'alphabetical') return String(a.title || '').localeCompare(String(b.title || ''));
      return timestamp(b) - timestamp(a);
    });
  }, [data, query, sort, tab]);

  const selectTab = (nextTab) => {
    setTab(nextTab);
    setQuery('');
  };

  const handleDelete = async (id) => {
    if (deletingId || !window.confirm('Delete this spot permanently?')) return;
    setDeletingId(id);
    try {
      await firebaseDeleteSpot(id);
      setData(current => Object.fromEntries(Object.entries(current).map(([key, rows]) =>
        [key, rows?.filter(spot => spot.id !== id) ?? rows])));
    } catch (error) {
      window.alert(error?.message || 'Could not delete this spot.');
    } finally {
      setDeletingId('');
    }
  };

  const isLoading = loading[tab] && data[tab] === null;
  const error = errors[tab];

  return (
    <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-sm" role="presentation">
      <section className="bg-white/95 dark:bg-card/95 w-full sm:max-w-3xl rounded-t-[28px] sm:rounded-[28px] shadow-2xl h-[92dvh] sm:h-[min(88dvh,760px)] flex flex-col overflow-hidden border border-white/60 dark:border-white/10" aria-labelledby="my-spots-title">
        <header className="px-4 sm:px-6 pt-4 sm:pt-5 pb-4 border-b border-gray-200/70 dark:border-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 id="my-spots-title" className="text-xl font-bold text-gray-900 dark:text-foreground">My Spots</h2>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-muted-foreground mt-0.5">Your places, collected in one view.</p>
            </div>
            <button onClick={onClose} className="w-11 h-11 grid place-items-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500" aria-label="Close My Spots">
              <X className="w-5 h-5" />
            </button>
          </div>

          <LiquidSegmentedControl
            ariaLabel="My Spots collections"
            equal
            value={tab}
            onChange={selectTab}
            options={TABS.map(item => ({ ...item, value: item.id }))}
            renderOption={({ id, label, icon: Icon }) => <><Icon className="w-4 h-4" aria-hidden="true" /><span>{label}</span>{data[id] !== null && <span className="sf-liquid-tabs__count">{data[id].length}</span>}</>}
          />

          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 mt-3">
            <label className="relative min-w-0">
              <span className="sr-only">Search {tab} spots</span>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" aria-hidden="true" />
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder={`Search ${tab} spots`} className="w-full h-11 pl-9 pr-3 rounded-xl border border-gray-200 dark:border-border bg-white/70 dark:bg-black/10 text-sm outline-none focus-visible:ring-2 focus-visible:ring-green-500" />
            </label>
            <div className="relative">
              <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" aria-hidden="true" />
              <SmoothSelect value={sort} onChange={setSort} ariaLabel="Sort spots" options={SORTS.map(([value, label]) => ({ value, label }))} className="max-w-[11rem] pl-9" />
            </div>
          </div>
        </header>

        <div id="my-spots-tabpanel" role="tabpanel" aria-label={`${tab} spots`} tabIndex={0} className="overflow-y-auto flex-1 p-4 sm:p-5 focus:outline-none" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          {isLoading ? (
            <div className="grid sm:grid-cols-2 gap-3" aria-label="Loading spots">
              {[1, 2, 3, 4].map(item => <div key={item} className="h-36 rounded-2xl bg-gray-100 dark:bg-accent animate-pulse" />)}
            </div>
          ) : error ? (
            <div className="min-h-64 grid place-items-center text-center px-8">
              <div><AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" /><p className="font-semibold">{error}</p><button onClick={() => loadTab(tab)} className="mt-4 min-h-11 px-4 rounded-xl border font-semibold inline-flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-green-500"><RefreshCw className="w-4 h-4" />Retry</button></div>
            </div>
          ) : visibleSpots.length === 0 ? (
            <div className="min-h-64 grid place-items-center text-center px-8">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-accent grid place-items-center mx-auto mb-3">
                  {query ? <Search className="w-6 h-6 text-gray-400" /> : tab === 'saved' ? <Bookmark className="w-6 h-6 text-gray-400" /> : tab === 'liked' ? <Heart className="w-6 h-6 text-gray-400" /> : <MapPin className="w-6 h-6 text-gray-400" />}
                </div>
                <p className="font-semibold">{query ? 'No matching spots' : EMPTY_COPY[tab][0]}</p>
                <p className="text-sm text-gray-500 mt-1">{query ? 'Try another title, description, or location.' : EMPTY_COPY[tab][1]}</p>
              </div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {visibleSpots.map(spot => (
                <article key={spot.id} className="group rounded-2xl border border-gray-200/80 dark:border-border bg-white/80 dark:bg-white/[0.03] overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-[transform,box-shadow] duration-200">
                  <div className="flex min-h-[124px]">
                    <div className="w-28 sm:w-32 bg-gray-100 dark:bg-accent shrink-0 overflow-hidden">
                      {spot.image_url ? <img src={spot.image_url} alt="" loading="lazy" decoding="async" width="256" height="256" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" /> : <div className="w-full h-full grid place-items-center"><MapPin className="w-7 h-7 text-gray-300" /></div>}
                    </div>
                    <div className="p-3 min-w-0 flex-1 flex flex-col">
                      <h3 className="font-semibold truncate text-gray-900 dark:text-foreground">{spot.title || 'Spot'}</h3>
                      <p className="text-xs text-gray-500 dark:text-muted-foreground truncate mt-1 flex items-center gap-1"><MapPin className="w-3.5 h-3.5 shrink-0" />{locationLabel(spot)}</p>
                      <p className="text-xs text-gray-500 dark:text-muted-foreground line-clamp-2 mt-1.5 flex-1">{spot.description || 'No description'}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-2" aria-label="Spot statistics">
                        <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5 text-amber-500" />{Number(spot.rating || 0).toFixed(1)}</span>
                        <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" />{Math.max(0, spot.likes_count || 0)}</span>
                        <span className="flex items-center gap-1"><Bookmark className="w-3.5 h-3.5" />{Math.max(0, spot.saves_count || 0)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-gray-100 dark:border-border flex">
                    <button onClick={() => { onFlyTo([spot.lat, spot.lng]); onClose(); }} className="flex-1 min-h-11 text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-gray-50 dark:hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-500"><Eye className="w-4 h-4" />View on map</button>
                    {tab === 'created' && <button onClick={() => handleDelete(spot.id)} disabled={Boolean(deletingId)} className="w-12 min-h-11 grid place-items-center text-red-500 border-l border-gray-100 dark:border-border hover:bg-red-50 dark:hover:bg-red-950/20 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500" aria-label={`Delete ${spot.title || 'spot'}`}><Trash2 className="w-4 h-4" /></button>}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
