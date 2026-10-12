import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, ArrowUpDown, Bookmark, Eye, FilePenLine, Heart, MapPin, PlusCircle,
  RefreshCw, Search, Star, Trash2, X,
} from 'lucide-react';
import {
  deleteSpot as firebaseDeleteSpot,
  getLikedSpots,
  getSavedSpots,
  getUserSpots,
  deleteCloudSpotDraft,
  getCloudSpotDrafts,
  loadDraftImageFile,
} from '@/api/firebaseClient';
import LiquidSegmentedControl from '../ui/LiquidSegmentedControl';
import SmoothSelect from '../ui/SmoothSelect';
import { getSpotDisplayName, getSpotLocationLabel } from '@/lib/spotPresentation';
import SpotImage from './SpotImage';
import { sortSpotCollection } from '@/lib/spotDiscovery';
import { useLanguage } from '@/lib/LanguageContext';
import { deleteGuestDraft, draftDisplayName, listGuestDrafts } from '@/lib/spotDrafts';
import { deleteGuestDraftPhotos, loadGuestDraftPhoto } from '@/lib/guestDraftPhotos';

const TABS = [
  { id: 'saved', label: 'Favorites', icon: Bookmark },
  { id: 'created', label: 'Contributions', icon: PlusCircle },
  { id: 'liked', label: 'Liked', icon: Heart },
  { id: 'drafts', label: 'Drafts', icon: FilePenLine },
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
  drafts: ['No drafts yet', 'Saved drafts stay private until you publish them.'],
};

function DraftThumbnail({ draft, user, draftOwnerKey }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let url = '';
    let active = true;
    if (!draft.photo_refs?.[0]) return undefined;
    const loader = user ? loadDraftImageFile(draft.photo_refs[0]) : loadGuestDraftPhoto(draft.photo_refs[0], draftOwnerKey);
    loader.then(file => {
      if (!active) return;
      url = URL.createObjectURL(file);
      setSrc(url);
    }).catch(() => {});
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [draft.id, draft.photo_refs, draftOwnerKey, user]);
  return src ? <img src={src} alt="" onError={() => setSrc('')} className="h-full w-full object-cover" /> : <FilePenLine className="h-7 w-7 text-gray-400" aria-hidden="true" />;
}

export default function MySpotsPanel({ user, draftOwnerKey, draftOnly = false, initialTab, onClose, onSelectSpot, onResumeDraft }) {
  const { language } = useLanguage();
  const tabs = draftOnly ? TABS.filter(item => item.id === 'drafts') : TABS;
  const [tab, setTab] = useState(initialTab || (draftOnly ? 'drafts' : 'saved'));
  const [data, setData] = useState({ saved: null, created: null, liked: null, drafts: null });
  const [loading, setLoading] = useState({ saved: false, created: false, liked: false, drafts: false });
  const [errors, setErrors] = useState({ saved: '', created: '', liked: '', drafts: '' });
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('newest');
  const [deletingId, setDeletingId] = useState('');

  const loadTab = useCallback(async (tabId) => {
    if (tabId !== 'drafts' && !user?.id) return;
    setLoading(current => ({ ...current, [tabId]: true }));
    setErrors(current => ({ ...current, [tabId]: '' }));
    try {
      let rows;
      if (tabId === 'drafts') rows = user ? await getCloudSpotDrafts() : listGuestDrafts(localStorage, draftOwnerKey);
      else if (tabId === 'saved') rows = await getSavedSpots(user.id, 100);
      else if (tabId === 'liked') rows = await getLikedSpots(user.id, 100);
      else rows = await getUserSpots(user.email, 100, user.id);
      setData(current => ({ ...current, [tabId]: rows }));
    } catch (error) {
      console.error(`My Spots ${tabId} load failed`, error);
      setErrors(current => ({ ...current, [tabId]: 'Could not load these spots. Please try again.' }));
    } finally {
      setLoading(current => ({ ...current, [tabId]: false }));
    }
  }, [draftOwnerKey, user?.email, user?.id]);

  useEffect(() => {
    if (data[tab] === null && !loading[tab] && !errors[tab]) loadTab(tab);
  }, [data, errors, loadTab, loading, tab]);

  const visibleSpots = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const filtered = (data[tab] || []).filter(spot => !normalized ||
      [tab === 'drafts' ? draftDisplayName(spot) : getSpotDisplayName(spot, language), spot.description, getSpotLocationLabel(spot)].some(value =>
        String(value || '').toLocaleLowerCase().includes(normalized)));
    if (tab === 'drafts') return [...filtered].sort((a, b) => sort === 'alphabetical'
      ? draftDisplayName(a).localeCompare(draftDisplayName(b))
      : sort === 'oldest' ? a.updated_at.localeCompare(b.updated_at) : b.updated_at.localeCompare(a.updated_at));
    return sortSpotCollection(filtered, sort, { relationFirst: tab !== 'created', getTitle: spot => getSpotDisplayName(spot, language) });
  }, [data, language, query, sort, tab]);

  const selectTab = (nextTab) => {
    setTab(nextTab);
    setQuery('');
  };

  const handleDelete = async (id) => {
    const isDraft = tab === 'drafts';
    if (deletingId || !window.confirm(isDraft ? 'Delete this unpublished draft permanently?' : 'Delete this spot permanently?')) return;
    setDeletingId(id);
    try {
      if (isDraft) {
        if (user) await deleteCloudSpotDraft(id);
        else {
          deleteGuestDraft(localStorage, draftOwnerKey, id);
          await deleteGuestDraftPhotos(draftOwnerKey, id);
        }
        window.dispatchEvent(new CustomEvent('spotfinder:drafts-changed'));
      } else await firebaseDeleteSpot(id);
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
      <section className="sf-collection-panel sf-sheet flex h-[92vh] h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl sm:h-[min(88vh,760px)] sm:h-[min(88dvh,760px)] sm:max-w-3xl sm:rounded-3xl" aria-labelledby="my-spots-title">
        <header className="sf-collection-header px-4 sm:px-6 pt-4 sm:pt-5 pb-4 border-b border-gray-200/70 dark:border-border">
          <div className="sf-collection-heading relative flex items-center justify-between mb-4">
            <div className="min-w-0">
              <h2 id="my-spots-title" className="text-xl font-bold text-gray-900 dark:text-foreground">{draftOnly ? 'Drafts' : 'My collection'}</h2>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-muted-foreground mt-0.5">{user ? 'Favorites, contributions, likes, and private drafts.' : 'Drafts saved only on this device and guest session.'}</p>
            </div>
            <button onClick={onClose} className="sf-collection-close w-11 h-11 shrink-0 grid place-items-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500" aria-label="Close My Spots">
              <X className="w-5 h-5" />
            </button>
          </div>

          <LiquidSegmentedControl
            ariaLabel="My Spots collections"
            equal
            className="sf-collection-tabs"
            value={tab}
            onChange={selectTab}
            options={tabs.map(item => ({ ...item, value: item.id }))}
            renderOption={({ id, label, icon: Icon }) => <><Icon className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="truncate">{label}</span>{data[id] !== null && <span className="sf-collection-tabs__count">{data[id].length}</span>}</>}
          />

          <div className="sf-collection-tools grid grid-cols-[minmax(0,1fr)_auto] gap-2 mt-3">
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
                  {query ? <Search className="w-6 h-6 text-gray-400" /> : tab === 'saved' ? <Bookmark className="w-6 h-6 text-gray-400" /> : tab === 'liked' ? <Heart className="w-6 h-6 text-gray-400" /> : tab === 'drafts' ? <FilePenLine className="w-6 h-6 text-gray-400" /> : <MapPin className="w-6 h-6 text-gray-400" />}
                </div>
                <p className="font-semibold">{query ? 'No matching spots' : EMPTY_COPY[tab][0]}</p>
                <p className="text-sm text-gray-500 mt-1">{query ? 'Try another title, description, or location.' : EMPTY_COPY[tab][1]}</p>
              </div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {visibleSpots.map(spot => (
                tab === 'drafts' ? (
                <article key={spot.id} className="rounded-2xl border border-gray-200/80 bg-white/80 overflow-hidden dark:border-border dark:bg-white/[0.03]">
                  <div className="sf-collection-card-body flex min-h-[124px]">
                    <div className="sf-collection-thumb grid w-28 shrink-0 place-items-center overflow-hidden bg-gray-100 dark:bg-accent"><DraftThumbnail draft={spot} user={user} draftOwnerKey={draftOwnerKey} /></div>
                    <div className="min-w-0 flex-1 p-3">
                      <h3 className="truncate font-semibold">{draftDisplayName(spot)}</h3>
                      <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{getSpotLocationLabel(spot)}</p>
                      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{spot.description || 'No description yet'}</p>
                      <p className="mt-2 text-[11px] text-muted-foreground">Edited {new Date(spot.updated_at).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex border-t border-gray-100 dark:border-border">
                    <button onClick={() => { onResumeDraft?.(spot); onClose(); }} className="flex min-h-11 flex-1 items-center justify-center gap-1.5 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-accent"><FilePenLine className="h-4 w-4" />Resume editing</button>
                    <button onClick={() => handleDelete(spot.id)} disabled={Boolean(deletingId)} className="grid min-h-11 w-12 place-items-center border-l border-gray-100 text-red-500 hover:bg-red-50 disabled:opacity-50 dark:border-border dark:hover:bg-red-950/20" aria-label={`Delete ${draftDisplayName(spot)}`}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </article>
                ) : (
                <article key={spot.id} className="group rounded-2xl border border-gray-200/80 dark:border-border bg-white/80 dark:bg-white/[0.03] overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-[transform,box-shadow] duration-200">
                  <div className="sf-collection-card-body flex min-h-[124px]">
                    <div className="sf-collection-thumb w-28 sm:w-32 bg-gray-100 dark:bg-accent shrink-0 overflow-hidden">
                      <SpotImage spot={spot} alt="" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                    </div>
                    <div className="p-3 min-w-0 flex-1 flex flex-col">
                      <h3 className="font-semibold truncate text-gray-900 dark:text-foreground">{getSpotDisplayName(spot, language)}</h3>
                      <p className="text-xs text-gray-500 dark:text-muted-foreground truncate mt-1 flex items-center gap-1"><MapPin className="w-3.5 h-3.5 shrink-0" />{getSpotLocationLabel(spot)}</p>
                      <p className="text-xs text-gray-500 dark:text-muted-foreground line-clamp-2 mt-1.5 flex-1">{spot.description || 'No description'}</p>
                      {(spot.rating_count > 0 || spot.likes_count > 0 || spot.saves_count > 0) && <div className="flex items-center gap-3 text-xs text-gray-500 mt-2" aria-label="Spot statistics">
                        {spot.rating_count > 0 && <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5 text-amber-500" />{Number(spot.rating).toFixed(1)}</span>}
                        {spot.likes_count > 0 && <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" />{spot.likes_count}</span>}
                        {spot.saves_count > 0 && <span className="flex items-center gap-1"><Bookmark className="w-3.5 h-3.5" />{spot.saves_count}</span>}
                      </div>}
                    </div>
                  </div>
                  <div className="border-t border-gray-100 dark:border-border flex">
                    <button onClick={() => { onSelectSpot?.(spot); onClose(); }} className="flex-1 min-h-11 text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-gray-50 dark:hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-500"><Eye className="w-4 h-4" />Open spot</button>
                    {tab === 'created' && <button onClick={() => handleDelete(spot.id)} disabled={Boolean(deletingId)} className="w-12 min-h-11 grid place-items-center text-red-500 border-l border-gray-100 dark:border-border hover:bg-red-50 dark:hover:bg-red-950/20 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500" aria-label={`Delete ${getSpotDisplayName(spot, language)}`}><Trash2 className="w-4 h-4" /></button>}
                  </div>
                </article>
                )
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
