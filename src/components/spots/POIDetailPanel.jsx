import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Navigation, Share2, Camera, Star, Phone, Mail, Globe, MapPin, ChevronUp, Clock, ChevronLeft, ChevronRight, Flag } from 'lucide-react';
import { getPOIPhotos, getPOIRatings, addPOIPhoto, addPOIRating, uploadSpotImage, makePOIId } from '@/api/firebaseClient';
import { moderateSubmission } from '@/lib/moderation';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/LanguageContext';
import { iconGlyphSVG } from '@/lib/mapIcons';
import ReportDialog from '@/components/moderation/ReportDialog';

const SocialPostsSection = React.lazy(() => import('@/components/social/SocialPostsSection'));

// ─── OSM tag helpers ──────────────────────────────────────────────────────────
function getPhone(tags = {}) { return tags.phone || tags['contact:phone'] || tags['contact:mobile'] || null; }
function getWebsite(tags = {}) { return tags.website || tags['contact:website'] || tags.url || null; }
function getEmail(tags = {}) { return tags.email || tags['contact:email'] || null; }
function getHours(tags = {}) { return tags.opening_hours || null; }
function getDescription(tags = {}) { return tags.description || tags.note || null; }

function parseOpenStatus(ohString, t) {
  if (!ohString) return null;
  if (ohString.toLowerCase().includes('24/7')) return { isOpen: true, label: t('poiDetail.open247') };
  try {
    const now = new Date();
    const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    const today = days[now.getDay()];
    const timeNow = now.getHours() * 60 + now.getMinutes();
    for (const rule of ohString.split(';').map(s => s.trim())) {
      const match = rule.match(/^([A-Za-z,\-\s]+)\s+(\d{2}:\d{2})-(\d{2}:\d{2})$/);
      if (!match) continue;
      const [, dayPart, open, close] = match;
      let todayMatches = false;
      for (const seg of dayPart.split(',').map(s => s.trim())) {
        const range = seg.match(/^([A-Z][a-z])-([A-Z][a-z])$/);
        if (range) {
          const s = days.indexOf(range[1]), e = days.indexOf(range[2]), c = days.indexOf(today);
          if (s !== -1 && e !== -1 && c >= s && c <= e) todayMatches = true;
        } else if (seg === today) todayMatches = true;
      }
      if (!todayMatches) continue;
      const [oh, om] = open.split(':').map(Number);
      const [ch, cm] = close.split(':').map(Number);
      const isOpen = timeNow >= oh * 60 + om && timeNow < ch * 60 + cm;
      return { isOpen, label: `${isOpen ? t('poiDetail.open') : t('poiDetail.closed')} · ${open}–${close}` };
    }
  } catch {}
  return null;
}

// ─── Photo fetching ───────────────────────────────────────────────────────────
// Priority order, each tier only tried if the previous one found nothing:
//   1. OSM tags (`image=` / `wikimedia_commons=File:...`) — a human curated
//      this specific photo for this specific place. Most accurate, least common.
//   2. Wikidata's P18 "image" claim (needs an OSM `wikidata=` tag) —
//      subject-accurate (a specific claim about a specific entity).
// A prior version fell back further to `commons.wikimedia.org` geosearch
// (nearby-by-coordinate, no subject check) — removed because it returned
// photos of whatever else happened to be within the search radius (e.g. a
// neighboring building or streetscape), not the actual POI. Showing no photo
// is better than showing a wrong one. If none of the above match, the UI
// falls back to its existing "no photo yet" state.
//
// ATTRIBUTION: every photo below is returned as { url, credit } rather than
// a bare URL. `credit` is a plain-text line rendered near the photo —
// Google Places Photos Terms require showing `html_attributions`, and
// Wikimedia Commons images are almost always CC-BY-SA or similar, which
// legally requires an author + license credit wherever the image is used.
// `credit` is null only for sources that genuinely carry none (a raw
// `image=` tag URL with no attribution metadata attached).

// Fetch author + license for a Wikimedia Commons file via the official
// imageinfo/extmetadata API. Best-effort: any failure just means the photo
// renders without a credit line rather than blocking the photo entirely.
async function fetchCommonsCredit(fileTitle) {
  try {
    const r = await fetch(
      `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(`File:${fileTitle}`)}` +
      `&prop=imageinfo&iiprop=extmetadata&format=json&origin=*`
    );
    if (!r.ok) return null;
    const pages = (await r.json())?.query?.pages || {};
    const page = Object.values(pages)[0];
    const meta = page?.imageinfo?.[0]?.extmetadata;
    if (!meta) return null;
    // Artist/LicenseShortName come back as HTML in some cases (e.g. linked
    // author names) — strip tags so we only ever render plain text, never
    // markup pulled from a third-party API.
    const strip = (html) => (html || '').replace(/<[^>]*>/g, '').trim();
    const author = strip(meta.Artist?.value);
    const license = strip(meta.LicenseShortName?.value);
    if (!author && !license) return null;
    return `Photo: ${author || 'Unknown author'}${license ? ` (${license})` : ''}, via Wikimedia Commons`;
  } catch { return null; }
}

async function getTagPhotos(tags = {}) {
  const results = [];
  if (tags.wikimedia_commons?.startsWith('File:')) {
    const file = tags.wikimedia_commons.replace('File:', '');
    const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=1200`;
    results.push({ url, credit: await fetchCommonsCredit(file) });
  }
  // Arbitrary image URLs have unknown licensing, so they are intentionally
  // not reused here. The build-time enrichment script accepts Wikimedia-hosted
  // image URLs after checking the Commons license metadata.
  return results;
}

async function fetchWikidataPhoto(wikidataId) {
  if (!wikidataId) return [];
  try {
    const r = await fetch(
      `https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${encodeURIComponent(wikidataId)}` +
      `&property=P18&format=json&origin=*`
    );
    if (!r.ok) return [];
    const claims = (await r.json()).claims?.P18 || [];
    const files = claims.map(c => c.mainsnak?.datavalue?.value).filter(Boolean);
    return Promise.all(files.map(async file => ({
      url: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=1200`,
      credit: await fetchCommonsCredit(file),
    })));
  } catch { return []; }
}

// Wikipedia article lead image (subject-accurate: it's the article's own picture).
// `wikipedia` tag format is "lang:Title" (e.g. "cs:Hrad Křivoklát").
async function fetchWikipediaPhoto(wikipediaTag) {
  if (typeof wikipediaTag !== 'string' || !wikipediaTag.includes(':')) return [];
  const [lang, ...rest] = wikipediaTag.split(':');
  const title = rest.join(':');
  try {
    const r = await fetch(`https://${encodeURIComponent(lang)}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`);
    if (!r.ok) return [];
    const data = await r.json();
    const src = data.originalimage?.source || data.thumbnail?.source;
    if (!src) return [];
    // Resize via Commons' FilePath redirect when the image is a Commons file so
    // we can also fetch its credit; otherwise use the thumbnail as-is.
    const m = src.match(/\/commons\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/]+)/);
    if (m) {
      const file = decodeURIComponent(m[1]);
      return [{ url: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=1200`, credit: await fetchCommonsCredit(file) }];
    }
    return [{ url: src, credit: `Photo via Wikipedia (${lang})` }];
  } catch { return []; }
}

function distMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000, toRad = d => d * Math.PI / 180;
  const a = Math.sin(toRad(lat2 - lat1) / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lon2 - lon1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// For POIs with no wikidata tag: search Wikidata by name, then ACCEPT a hit only
// if it has a photo (P18) AND its own coordinates (P625) are within 150 m of the
// POI. The coordinate check is what keeps this subject-accurate — it's the same
// guarantee the old (removed) blind geosearch lacked.
async function fetchWikidataPhotoByName(name, lat, lon) {
  if (!name || name.length < 3) return [];
  try {
    const sr = await fetch(
      `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=cs&uselang=cs&limit=5&format=json&origin=*`
    );
    if (!sr.ok) return [];
    const hits = (await sr.json()).search || [];
    for (const h of hits) {
      const er = await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${h.id}&props=claims&format=json&origin=*`);
      if (!er.ok) continue;
      const claims = (await er.json()).entities?.[h.id]?.claims || {};
      const c = claims.P625?.[0]?.mainsnak?.datavalue?.value;
      if (!c || distMeters(lat, lon, c.latitude, c.longitude) > 150) continue;
      const photos = await fetchWikidataPhoto(h.id);
      if (photos.length) return photos;
    }
  } catch {}
  return [];
}

// Returns [{ url, credit }], credit possibly null.
// Every tier is subject-verified (a human-curated tag, the place's own Wikipedia
// article, its own Wikidata item, or a name+coordinate-matched Wikidata item).
// We still never do a blind proximity photo search — a missing photo beats a
// photo of the neighbouring building.
async function tryFetchPhotos(name, lat, lon, tags = {}) {
  const tagPhotos = await getTagPhotos(tags);
  if (tagPhotos.length) return tagPhotos;
  const wp = await fetchWikipediaPhoto(tags.wikipedia);
  if (wp.length) return wp;
  const wd = await fetchWikidataPhoto(tags.wikidata);
  if (wd.length) return wd;
  return fetchWikidataPhotoByName(name, lat, lon);
}

// ─── Address fallback ─────────────────────────────────────────────────────────
// Ambient tiles only carry an address when OSM had addr:* tags. Reverse-geocode
// via Geoapify (already allowed by the CSP and already used by the app) so the
// sheet always shows a location line: "Hlavní 27, 337 01 Ejpovice, Czechia".
const GEOAPIFY_KEY = import.meta.env.VITE_GEOAPIFY_KEY || '';
const addressCache = new Map();
async function reverseGeocodeAddress(lat, lon, lang = 'en') {
  if (!GEOAPIFY_KEY) return '';
  const key = `${lat.toFixed(5)},${lon.toFixed(5)}`;
  if (addressCache.has(key)) return addressCache.get(key);
  try {
    const r = await fetch(
      `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lon}&lang=${encodeURIComponent(lang)}&limit=1&format=json&apiKey=${GEOAPIFY_KEY}`
    );
    if (!r.ok) return '';
    const p = (await r.json()).results?.[0];
    if (!p) return '';
    const street = [p.street, p.housenumber].filter(Boolean).join(' ');
    const city = [p.postcode, p.city || p.town || p.village || p.suburb].filter(Boolean).join(' ');
    const out = [street, city, p.country].filter(Boolean).join(', ') || p.formatted || '';
    addressCache.set(key, out);
    return out;
  } catch { return ''; }
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────
function Lightbox({ photos, startIndex, onClose }) {
  const [idx, setIdx] = useState(startIndex);
  const touchStartX = useRef(null);

  const prev = useCallback(() => setIdx(i => (i - 1 + photos.length) % photos.length), [photos.length]);
  const next = useCallback(() => setIdx(i => (i + 1) % photos.length), [photos.length]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prev, next, onClose]);

  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) dx < 0 ? next() : prev();
    touchStartX.current = null;
  };

  return (
    <div
      className="fixed inset-0 z-[2000] bg-black flex items-center justify-center"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Close */}
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white backdrop-blur-sm transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Counter */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-black/50 backdrop-blur-sm text-white text-sm font-medium px-3 py-1 rounded-full">
        {idx + 1} / {photos.length}
      </div>

      {/* Prev */}
      {photos.length > 1 && (
        <button
          onClick={prev}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white backdrop-blur-sm transition-all active:scale-95 shadow-lg"
        >
          <ChevronLeft className="w-7 h-7" />
        </button>
      )}

      {/* Image */}
      <img
        key={idx}
        src={photos[idx].url}
        alt=""
        className="max-w-full max-h-full object-contain select-none"
        style={{ maxHeight: '100dvh', maxWidth: '100dvw', padding: '0 60px' }}
        onError={e => { e.target.src = ''; }}
      />

      {/* Attribution — Google Places Photos and Wikimedia Commons both
          legally require a visible credit; omitted when the source has none. */}
      {photos[idx].credit && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 max-w-[90vw] truncate bg-black/50 backdrop-blur-sm text-white/90 text-xs px-3 py-1 rounded-full">
          {photos[idx].credit}
        </div>
      )}

      {/* Next */}
      {photos.length > 1 && (
        <button
          onClick={next}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white backdrop-blur-sm transition-all active:scale-95 shadow-lg"
        >
          <ChevronRight className="w-7 h-7" />
        </button>
      )}

      {/* Dot indicators */}
      {photos.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5">
          {photos.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`w-1.5 h-1.5 rounded-full transition-all ${i === idx ? 'bg-white w-4' : 'bg-white/40'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Stars ────────────────────────────────────────────────────────────────────
function Stars({ value = 0, size = 14, interactive = false, onRate }) {
  const [hover, setHover] = useState(0);
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => {
        const fill = interactive ? (hover || value) >= i ? 1 : 0 : Math.min(Math.max(value - (i - 1), 0), 1);
        return (
          <span key={i} className="relative inline-block leading-none"
            style={{ width: size, height: size, fontSize: size, cursor: interactive ? 'pointer' : 'default' }}
            onMouseEnter={() => interactive && setHover(i)}
            onMouseLeave={() => interactive && setHover(0)}
            onClick={() => interactive && onRate?.(i)}
          >
            <span className="text-gray-200 dark:text-gray-600">★</span>
            <span className="absolute inset-0 overflow-hidden text-amber-400" style={{ width: `${fill * 100}%` }}>★</span>
          </span>
        );
      })}
    </span>
  );
}

function ActionBtn({ icon: Icon, label, onClick, color, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="flex flex-col items-center gap-1 px-3 py-2.5 rounded-2xl bg-gray-100 dark:bg-accent/60 hover:bg-gray-200 dark:hover:bg-accent active:scale-95 transition-all disabled:opacity-40 flex-1">
      <Icon className="w-5 h-5" style={{ color: color || undefined }} />
      <span className="text-[11px] font-medium text-gray-700 dark:text-foreground whitespace-nowrap">{label}</span>
    </button>
  );
}

function ContactRow({ icon: Icon, value, href }) {
  const inner = (
    <div className="flex items-center gap-3 py-2.5">
      <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-accent/60 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-gray-500 dark:text-muted-foreground" />
      </div>
      <span className="text-sm text-foreground break-all">{value}</span>
    </div>
  );
  return href
    ? <a href={href} target="_blank" rel="noopener noreferrer" className="block hover:bg-gray-50 dark:hover:bg-accent/40 rounded-xl transition-colors">{inner}</a>
    : <div>{inner}</div>;
}

// ─── Mini bar ─────────────────────────────────────────────────────────────────
function MiniBar({ poi, category, sfRating, photoUrl, onExpand, onClose, onNavigate, onShare, onAddPhoto, user, onOpenLightbox }) {
  const { t } = useLanguage();
  const avg = sfRating?.count > 0 ? sfRating.avg : 0;
  const count = sfRating?.count || 0;

  return (
    <div className="fixed left-0 right-0 z-[1200] bg-white dark:bg-card shadow-2xl border-t border-gray-100 dark:border-border rounded-t-2xl"
      style={{ bottom: 0 }}>
      <button className="w-full flex justify-center pt-2.5 pb-0" onClick={onExpand} aria-label="Expand details">
        <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-border" />
      </button>
      <button onClick={onClose}
        aria-label="Close"
        className="absolute top-3 right-3 w-7 h-7 rounded-full bg-gray-100 dark:bg-accent flex items-center justify-center z-10">
        <X className="w-3.5 h-3.5 text-foreground" />
      </button>

      <div
        className="flex items-center gap-3 px-4 pt-2 pb-3 cursor-pointer"
        onClick={onExpand}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onExpand(); } }}
      >
        <div
          className="w-14 h-14 rounded-full flex-shrink-0 overflow-hidden border-2 flex items-center justify-center"
          style={{ borderColor: category.color, background: `${category.color}18` }}
          onClick={photoUrl ? (e => { e.stopPropagation(); onOpenLightbox(0); }) : undefined}
        >
          {photoUrl
            ? <img src={photoUrl} alt={poi.name} className="w-full h-full object-cover cursor-zoom-in"
                onError={e => { e.target.style.display = 'none'; }} />
            : <span dangerouslySetInnerHTML={{ __html: iconGlyphSVG(category.key, 24, category.color) }} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground text-sm leading-tight truncate">{poi.name}</p>
          {poi.address && <p className="text-xs text-muted-foreground truncate mt-0.5">{poi.address}</p>}
          {avg > 0 && (
            <div className="flex items-center gap-1.5 mt-1">
              <Stars value={avg} size={12} />
              <span className="text-xs font-semibold text-green-600 dark:text-green-400">{avg.toFixed(1)}</span>
              {count > 0 && <span className="text-xs text-muted-foreground">({count})</span>}
            </div>
          )}
        </div>
        <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0 mr-8" />
      </div>

      <div className="flex items-center gap-2 px-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        <ActionBtn icon={Navigation} label={t('poiDetail.navigate')} onClick={onNavigate} color={category.color} />
        <ActionBtn icon={Share2} label={t('poiDetail.share')} onClick={onShare} />
        <ActionBtn icon={Camera} label={t('poiDetail.addPhoto')} onClick={onAddPhoto} disabled={!user} />
      </div>
    </div>
  );
}

// ─── Full sheet ───────────────────────────────────────────────────────────────
function FullSheet({ poi, category, sfPhotos, sfRating, photos, onClose, onNavigate, onShare, onAddPhoto, onSubmitRating, user, onOpenLightbox, onReportPOI, onReportPhoto, socialTargetId }) {
  const { t } = useLanguage();
  const [ratingVal, setRatingVal] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [ratingDone, setRatingDone] = useState(false);

  const tags = poi.tags || {};
  const phone = getPhone(tags), website = getWebsite(tags), email = getEmail(tags);
  const ohRaw = getHours(tags), desc = getDescription(tags), status = parseOpenStatus(ohRaw, t);
  const avg = sfRating?.count > 0 ? sfRating.avg : 0;
  const count = sfRating?.count || 0;

  const allPhotos = [
    ...photos.map(p => ({ url: p.url, credit: p.credit, source: 'remote' })),
    ...sfPhotos.map(p => ({ url: p.image || p.photo, source: 'sf', photoId: p.id })),
  ];

  const handleRateSubmit = async () => {
    if (!ratingVal || submitting) return;
    setSubmitting(true);
    await onSubmitRating(ratingVal, ratingComment);
    setSubmitting(false);
    setRatingDone(true);
  };

  return (
    <div className="fixed inset-0 z-[1200] flex flex-col bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="mt-auto bg-white dark:bg-card rounded-t-3xl shadow-2xl overflow-hidden"
        style={{ maxHeight: '92vh' }} onClick={e => e.stopPropagation()}>

        {/* Hero — clickable to open lightbox */}
        <div
          className="relative bg-gray-100 dark:bg-accent cursor-zoom-in"
          style={{ height: 200 }}
          onClick={allPhotos.length ? () => onOpenLightbox(0) : undefined}
        >
          {allPhotos[0]?.url
            ? <img src={allPhotos[0].url} alt={poi.name} className="w-full h-full object-cover"
                onError={e => { e.target.style.display = 'none'; }} />
            : <div className="w-full h-full flex items-center justify-center" style={{ background: `${category.color}18` }}>
                <span dangerouslySetInnerHTML={{ __html: iconGlyphSVG(category.key, 64, category.color) }} />
              </div>}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/50 pointer-events-none" />
          {/* Photo count badge */}
          {allPhotos.length > 1 && (
            <div className="absolute bottom-3 right-3 bg-black/50 backdrop-blur-sm text-white text-xs font-medium px-2 py-1 rounded-full pointer-events-none">
              1 / {allPhotos.length}
            </div>
          )}
          <button
            onClick={e => { e.stopPropagation(); onClose(); }}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: 'calc(92vh - 200px)' }}>
          <div className="px-5 pt-4" style={{ paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom))' }}>
            <h1 className="text-xl font-bold text-foreground leading-tight">{poi.name}</h1>
            {poi.address && <p className="text-sm text-muted-foreground mt-0.5">{poi.address}</p>}
            <div className="mt-1.5 mb-4">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-white"
                style={{ background: category.color }}>
                <span dangerouslySetInnerHTML={{ __html: iconGlyphSVG(category.key, 14, 'white') }} /> {category.name}
              </span>
            </div>

            <div className="flex gap-2 mb-5">
              <ActionBtn icon={Navigation} label={t('poiDetail.navigate')} onClick={onNavigate} color={category.color} />
              <ActionBtn icon={Share2} label={t('poiDetail.share')} onClick={onShare} />
              <ActionBtn icon={Camera} label={t('poiDetail.addPhoto')} onClick={onAddPhoto} disabled={!user} />
            </div>

            <div className="h-px bg-gray-100 dark:bg-border mb-4" />

            {status && (
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className={`text-sm font-semibold ${status.isOpen ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                  {status.label}
                </span>
              </div>
            )}
            {ohRaw && !status && (
              <div className="flex items-start gap-2 mb-4">
                <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <span className="text-sm text-muted-foreground">{ohRaw}</span>
              </div>
            )}

            {/* Ratings */}
            <div className="mb-4">
              {avg > 0 ? (
                <div className="flex items-center gap-2 mb-3">
                  <Stars value={avg} size={20} />
                  <span className="text-lg font-bold text-green-600 dark:text-green-400">{avg.toFixed(1)}</span>
                  <span className="text-sm text-muted-foreground">({count} {count === 1 ? t('poiDetail.review') : t('poiDetail.reviews')})</span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mb-3">{t('poiDetail.noRatings')}</p>
              )}
              {!ratingDone ? (
                <div className="bg-gray-50 dark:bg-accent/40 rounded-2xl p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t('poiDetail.rateThisPlace')}</p>
                  {user ? (
                    <>
                      <Stars value={ratingVal} size={28} interactive onRate={setRatingVal} />
                      {ratingVal > 0 && (
                        <>
                          <textarea value={ratingComment} onChange={e => setRatingComment(e.target.value)}
                            placeholder={t('poiDetail.addComment')}
                            className="mt-3 w-full text-sm px-3 py-2 rounded-xl border border-gray-200 dark:border-border bg-white dark:bg-background text-foreground resize-none outline-none focus:ring-2 focus:ring-blue-300"
                            rows={2} />
                          <button onClick={handleRateSubmit} disabled={submitting}
                            className="mt-2 w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-95 disabled:opacity-50"
                            style={{ background: category.color }}>
                            {submitting ? t('poiDetail.submitting') : t('poiDetail.submitRating')}
                          </button>
                        </>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t('poiDetail.signInToRate')}</p>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm font-medium">
                  <Star className="w-4 h-4 fill-current" /> {t('poiDetail.thanksRating')}
                </div>
              )}
            </div>

            <div className="h-px bg-gray-100 dark:bg-border mb-4" />

            {desc && (
              <>
                <p className="text-sm text-foreground leading-relaxed mb-4">{desc}</p>
                <div className="h-px bg-gray-100 dark:bg-border mb-4" />
              </>
            )}
            {poi.enrichment?.wikipedia?.text && (
              <>
                <p className="text-sm text-foreground leading-relaxed mb-2">{poi.enrichment.wikipedia.text}</p>
                <p className="text-[10px] text-muted-foreground mb-4 leading-snug">{poi.enrichment.wikipedia.attribution}{' '}
                  <a href={poi.enrichment.wikipedia.url} target="_blank" rel="noopener noreferrer" className="underline">Source</a>
                </p>
                <div className="h-px bg-gray-100 dark:bg-border mb-4" />
              </>
            )}

            <React.Suspense fallback={<div className="my-5 h-24 animate-pulse rounded-2xl bg-gray-100 motion-reduce:animate-none dark:bg-accent" />}>
              <SocialPostsSection targetType="poi" targetId={socialTargetId} targetName={poi.name} user={user} />
            </React.Suspense>

            {(phone || email || website || poi.lat) && (
              <>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{t('poiDetail.contactInfo')}</p>
                {phone && <ContactRow icon={Phone} value={phone} href={`tel:${phone}`} />}
                {email && <ContactRow icon={Mail} value={email} href={`mailto:${email}`} />}
                {website && <ContactRow icon={Globe} value={website} href={website.startsWith('http') ? website : `https://${website}`} />}
                <ContactRow icon={MapPin} value={`${poi.lat.toFixed(6)}, ${poi.lon.toFixed(6)}`}
                  href={`https://maps.google.com/?q=${poi.lat},${poi.lon}`} />
                <div className="h-px bg-gray-100 dark:bg-border mt-2 mb-4" />
              </>
            )}

            <button onClick={onReportPOI} className="w-full mb-4 flex items-center justify-center gap-2 border rounded-xl py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"><Flag className="w-4 h-4"/>Report this place</button>

            {/* Photo gallery — full grid, all photos visible */}
            {allPhotos.length > 0 && (
              <>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  {t('poiDetail.photos')} ({allPhotos.length})
                  {sfPhotos.length > 0 && <span className="text-green-600 dark:text-green-400 normal-case font-normal ml-1">· {sfPhotos.length} {t('poiDetail.fromSpotFinder')}</span>}
                </p>
                <div className="grid grid-cols-3 gap-1.5 mb-4">
                  {allPhotos.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => onOpenLightbox(i)}
                      aria-label={`View photo ${i + 1} of ${allPhotos.length}`}
                      className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-accent cursor-zoom-in hover:opacity-90 active:scale-95 transition-all"
                    >
                      <img src={p.url} alt="" className="w-full h-full object-cover"
                        onError={e => { e.target.parentNode.style.display = 'none'; }} />
                      {p.source === 'sf' && (<>
                        <div className="absolute bottom-1 right-1 bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">SF</div>
                        <span role="button" tabIndex={0} onClick={(e)=>{e.stopPropagation();onReportPhoto?.(p)}} onKeyDown={(e)=>{if(e.key==='Enter'){e.stopPropagation();onReportPhoto?.(p)}}} className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-1" title="Report this photo"><Flag className="w-3.5 h-3.5"/></span>
                      </>)}
                    </button>
                  ))}
                  {user && (
                    <button onClick={onAddPhoto}
                      className="aspect-square rounded-xl border-2 border-dashed border-gray-300 dark:border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-gray-400 transition-colors">
                      <Camera className="w-5 h-5" />
                      <span className="text-xs">{t('poiDetail.add')}</span>
                    </button>
                  )}
                </div>
                {/* Attribution for any remote (Google/Wikimedia) photos shown above —
                    legally required credit, shown wherever those images are displayed. */}
                {allPhotos.some(p => p.credit) && (
                  <p className="text-[10px] text-muted-foreground mb-4 -mt-2 leading-snug">
                    {[...new Set(allPhotos.map(p => p.credit).filter(Boolean))].join(' · ')}
                  </p>
                )}
              </>
            )}

            {allPhotos.length === 0 && user && (
              <button onClick={onAddPhoto}
                className="w-full h-20 rounded-xl border-2 border-dashed border-gray-300 dark:border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-gray-400 transition-colors mb-4">
                <Camera className="w-5 h-5" />
                <span className="text-xs">{t('poiDetail.beFirstPhoto')}</span>
              </button>
            )}

            {sfRating?.ratings?.length > 0 && (
              <>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t('poiDetail.spotfinderReviews')}</p>
                <div className="space-y-3">
                  {sfRating.ratings.slice(0, 5).map(r => (
                    <div key={r.id} className="bg-gray-50 dark:bg-accent/40 rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Stars value={r.rating} size={12} />
                        <span className="text-xs text-muted-foreground">{r.created_by?.split('@')[0] || t('poiDetail.review')}</span>
                      </div>
                      {r.comment && <p className="text-sm text-foreground">{r.comment}</p>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function POIDetailPanel({ poi, category, onClose, onNavigate, user }) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const [sfPhotos, setSfPhotos] = useState([]);
  const [sfRating, setSfRating] = useState({ ratings: [], avg: 0, count: 0 });
  const [photos, setPhotos] = useState([]);
  const [lightboxIndex, setLightboxIndex] = useState(null); // null = closed
  const [resolvedAddress, setResolvedAddress] = useState('');
  const [reportTarget, setReportTarget] = useState(null);
  const fileInputRef = useRef(null);
  const { language } = useLanguage();

  // Always show a location line: use the tile's address, else reverse-geocode.
  useEffect(() => {
    setResolvedAddress('');
    if (!poi || poi.address) return;
    let cancelled = false;
    reverseGeocodeAddress(poi.lat, poi.lon, language || 'en').then(a => { if (!cancelled && a) setResolvedAddress(a); });
    return () => { cancelled = true; };
  }, [poi?.id]);

  useEffect(() => {
    if (!poi) return;
    setExpanded(false);
    setPhotos([]);
    setLightboxIndex(null);

    const poiId = makePOIId(poi.lat, poi.lon, poi.name);
    getPOIPhotos(poiId).then(setSfPhotos);
    getPOIRatings(poiId).then(r => setSfRating(
      Array.isArray(r)
        ? { ratings: r, avg: r.length ? Math.round(r.reduce((s, x) => s + x.rating, 0) / r.length * 10) / 10 : 0, count: r.length }
        : (r || { ratings: [], avg: 0, count: 0 })
    ));

    // Ambient vector-tile clicks may carry static build-time enrichment.
    // Only fall back to live photo lookups when no enrichment was baked in.
    // Baked-in enrichment photos win; otherwise (including when enrichment exists
    // but found no photo) fall back to the live subject-verified lookup.
    if (poi.enrichment?.photos?.length) setPhotos(poi.enrichment.photos.map(p => ({ url: p.url, credit: p.credit })));
    else tryFetchPhotos(poi.name, poi.lat, poi.lon, poi.tags || {}).then(res => { if (res.length) setPhotos(res); });
  }, [poi?.id]);

  const handleShare = async () => {
    const url = `https://maps.google.com/?q=${poi.lat},${poi.lon}`;
    try {
      if (navigator.share) await navigator.share({ title: poi.name, text: poi.address || resolvedAddress || poi.name, url });
      else if (navigator.clipboard) { await navigator.clipboard.writeText(`${poi.name}\n${url}`); alert(t('poiDetail.linkCopied')); }
      else window.open(url, '_blank');
    } catch (e) { if (e.name !== 'AbortError') window.open(url, '_blank'); }
  };

  const handleAddPhoto = () => { if (user) fileInputRef.current?.click(); };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const poiId = makePOIId(poi.lat, poi.lon, poi.name);
    try {
      const dataUrl = await uploadSpotImage(file);
      await addPOIPhoto(poiId, dataUrl, user.email);
      setSfPhotos(prev => [{ id: Date.now(), image: dataUrl, created_by: user.email }, ...prev]);
    } catch (err) { console.error('Photo upload failed:', err); }
    e.target.value = '';
  };

  const handleSubmitRating = async (rating, comment) => {
    // Anti-spam / moderation pre-check (client-side UX only — the
    // authoritative check runs server-side in the Cloud Functions trigger
    // on `poi_ratings` creation; see functions/index.js).
    const modCheck = moderateSubmission({
      text: comment,
      rateLimitKey: `rate:poi_rating:${user?.email || 'anon'}`,
      maxPerWindow: 10,
      windowMs: 10 * 60 * 1000,
    });
    if (!modCheck.allowed) {
      toast.error(
        modCheck.reasonKey === 'moderation.tooManySubmissions'
          ? 'You are submitting reviews too quickly. Please wait a few minutes.'
          : 'This review looks like spam. Please rewrite it and try again.'
      );
      return;
    }

    const poiId = makePOIId(poi.lat, poi.lon, poi.name);
    await addPOIRating(poiId, rating, comment, user?.email);
    getPOIRatings(poiId).then(r => setSfRating(
      Array.isArray(r)
        ? { ratings: r, avg: r.length ? Math.round(r.reduce((s, x) => s + x.rating, 0) / r.length * 10) / 10 : 0, count: r.length }
        : r
    ));
  };

  const handleNavigate = () => { onNavigate?.({ lat: poi.lat, lng: poi.lon, label: poi.name }); onClose(); };

  // All photos merged for lightbox — { url, credit } shape throughout;
  // SpotFinder-hosted photos have no third-party attribution requirement.
  const allPhotoUrls = [
    ...photos,
    ...sfPhotos.map(p => p.image || p.photo).filter(Boolean).map(url => ({ url, credit: null })),
  ];

  if (!poi) return null;

  const poiForView = poi.address || !resolvedAddress ? poi : { ...poi, address: resolvedAddress };

  const sharedProps = {
    poi: poiForView, category, sfPhotos, sfRating, photos,
    socialTargetId: makePOIId(poi.lat, poi.lon, poi.name),
    onClose, onNavigate: handleNavigate, onShare: handleShare,
    onAddPhoto: handleAddPhoto, user,
    onOpenLightbox: (i) => setLightboxIndex(i),
    onReportPOI: () => setReportTarget({ type: 'poi', id: makePOIId(poi.lat, poi.lon, poi.name), label: poi.name, snapshot: { name: poi.name, lat: poi.lat, lon: poi.lon } }),
    onReportPhoto: (p) => setReportTarget({ type: 'poi_photo', id: String(p.photoId), label: `photo at ${poi.name}`, snapshot: { name: poi.name, lat: poi.lat, lon: poi.lon, image: p.url } }),
  };

  return (
    <>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      {expanded
        ? <FullSheet {...sharedProps} onSubmitRating={handleSubmitRating} />
        : <MiniBar {...sharedProps} photoUrl={photos[0]?.url || null} onExpand={() => setExpanded(true)} />}

      {lightboxIndex !== null && allPhotoUrls.length > 0 && (
        <Lightbox
          photos={allPhotoUrls}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
      <ReportDialog open={!!reportTarget} onClose={() => setReportTarget(null)} user={user} targetType={reportTarget?.type} targetId={reportTarget?.id || ''} targetLabel={reportTarget?.label} targetSnapshot={reportTarget?.snapshot || {}} />
    </>
  );
}
