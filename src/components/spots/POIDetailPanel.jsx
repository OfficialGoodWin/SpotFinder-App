import React, { useState, useEffect, useRef } from 'react';
import { X, Navigation, Share2, Camera, Star, Phone, Mail, Globe, MapPin, ChevronUp, Clock } from 'lucide-react';
import { getPOIPhotos, getPOIRatings, addPOIPhoto, addPOIRating, uploadSpotImage, makePOIId } from '@/api/firebaseClient';

// ─── OSM tag helpers ─────────────────────────────────────────────────────────
// Extract contact + hours directly from the OSM tags already loaded by Overpass
// (no extra API calls needed — this data is already in poi.tags)

function getPhone(tags = {}) {
  return tags.phone || tags['contact:phone'] || tags['contact:mobile'] || null;
}
function getWebsite(tags = {}) {
  return tags.website || tags['contact:website'] || tags.url || null;
}
function getEmail(tags = {}) {
  return tags.email || tags['contact:email'] || null;
}
function getHours(tags = {}) {
  return tags.opening_hours || null;
}
function getDescription(tags = {}) {
  return tags.description || tags.note || null;
}

// Parse opening_hours string into open/closed status
// Supports simple "Mo-Fr 08:00-18:00" style strings
function parseOpenStatus(ohString) {
  if (!ohString) return null;
  if (ohString.toLowerCase().includes('24/7')) return { isOpen: true, label: 'Open 24/7' };

  try {
    const now = new Date();
    const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    const today = days[now.getDay()];
    const timeNow = now.getHours() * 60 + now.getMinutes();

    // Match patterns like "Mo-Fr 08:00-18:00" or "Mo,Tu 09:00-17:00"
    const rules = ohString.split(';').map(s => s.trim());
    for (const rule of rules) {
      const match = rule.match(/^([A-Za-z,\-\s]+)\s+(\d{2}:\d{2})-(\d{2}:\d{2})$/);
      if (!match) continue;
      const [, dayPart, open, close] = match;

      // Check if today matches
      let todayMatches = false;
      const segments = dayPart.split(',').map(s => s.trim());
      for (const seg of segments) {
        const range = seg.match(/^([A-Z][a-z])-([A-Z][a-z])$/);
        if (range) {
          const start = days.indexOf(range[1]);
          const end   = days.indexOf(range[2]);
          const cur   = days.indexOf(today);
          if (start !== -1 && end !== -1 && cur >= start && cur <= end) todayMatches = true;
        } else if (seg === today) {
          todayMatches = true;
        }
      }

      if (!todayMatches) continue;

      const [oh, om] = open.split(':').map(Number);
      const [ch, cm] = close.split(':').map(Number);
      const openMin  = oh * 60 + om;
      const closeMin = ch * 60 + cm;
      const isOpen   = timeNow >= openMin && timeNow < closeMin;
      return { isOpen, label: `${isOpen ? 'Open' : 'Closed'} · ${open}–${close}` };
    }
  } catch {}
  return null;
}

// ─── Stars ───────────────────────────────────────────────────────────────────
function Stars({ value = 0, size = 14, interactive = false, onRate }) {
  const [hover, setHover] = useState(0);
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => {
        const fill = interactive
          ? (hover || value) >= i ? 1 : 0
          : Math.min(Math.max(value - (i - 1), 0), 1);
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

// ─── Action button ────────────────────────────────────────────────────────────
function ActionBtn({ icon: Icon, label, onClick, color, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="flex flex-col items-center gap-1 px-3 py-2.5 rounded-2xl bg-gray-100 dark:bg-accent/60 hover:bg-gray-200 dark:hover:bg-accent active:scale-95 transition-all disabled:opacity-40 flex-1">
      <Icon className="w-5 h-5" style={{ color: color || undefined }} />
      <span className="text-[11px] font-medium text-gray-700 dark:text-foreground whitespace-nowrap">{label}</span>
    </button>
  );
}

// ─── Contact row ──────────────────────────────────────────────────────────────
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
function MiniBar({ poi, category, sfRating, mapyPhoto, onExpand, onClose, onNavigate, onShare, onAddPhoto, user }) {
  const avg   = sfRating?.count > 0 ? sfRating.avg : 0;
  const count = sfRating?.count || 0;

  return (
    <div className="fixed left-0 right-0 z-[1200] bg-white dark:bg-card shadow-2xl border-t border-gray-100 dark:border-border rounded-t-2xl"
      style={{ bottom: 56 }}>
      <button className="w-full flex justify-center pt-2.5 pb-0" onClick={onExpand}>
        <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-border" />
      </button>
      <button onClick={onClose}
        className="absolute top-3 right-3 w-7 h-7 rounded-full bg-gray-100 dark:bg-accent flex items-center justify-center z-10">
        <X className="w-3.5 h-3.5" />
      </button>

      {/* Info row */}
      <div className="flex items-center gap-3 px-4 pt-2 pb-3 cursor-pointer" onClick={onExpand}>
        <div className="w-14 h-14 rounded-full flex-shrink-0 overflow-hidden border-2 flex items-center justify-center"
          style={{ borderColor: category.color, background: `${category.color}18` }}>
          {mapyPhoto
            ? <img src={mapyPhoto} alt={poi.name} className="w-full h-full object-cover"
                onError={e => { e.target.style.display = 'none'; e.target.parentNode.innerHTML = `<span style="font-size:24px">${category.icon}</span>`; }} />
            : <span className="text-2xl">{category.icon}</span>}
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

      <div className="flex items-center gap-2 px-4 pb-4">
        <ActionBtn icon={Navigation} label="Navigate" onClick={onNavigate} color={category.color} />
        <ActionBtn icon={Share2}     label="Share"    onClick={onShare} />
        <ActionBtn icon={Camera}     label="Add Photo" onClick={onAddPhoto} disabled={!user} />
      </div>
    </div>
  );
}

// ─── Full sheet ───────────────────────────────────────────────────────────────
function FullSheet({ poi, category, sfPhotos, sfRating, mapyPhotos, onClose, onNavigate, onShare, onAddPhoto, onSubmitRating, user }) {
  const [ratingVal, setRatingVal]         = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [submitting, setSubmitting]       = useState(false);
  const [ratingDone, setRatingDone]       = useState(false);

  const tags    = poi.tags || {};
  const phone   = getPhone(tags);
  const website = getWebsite(tags);
  const email   = getEmail(tags);
  const ohRaw   = getHours(tags);
  const desc    = getDescription(tags);
  const status  = parseOpenStatus(ohRaw);

  const avg   = sfRating?.count > 0 ? sfRating.avg : 0;
  const count = sfRating?.count || 0;

  // Combine Mapy.cz photos + SpotFinder photos
  const allPhotos = [
    ...mapyPhotos.map(u => ({ url: u, source: 'mapy' })),
    ...sfPhotos.map(p => ({ url: p.image || p.photo, source: 'sf' })),
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

        {/* Hero */}
        <div className="relative bg-gray-100 dark:bg-accent" style={{ height: 200 }}>
          {allPhotos[0]?.url
            ? <img src={allPhotos[0].url} alt={poi.name} className="w-full h-full object-cover"
                onError={e => { e.target.style.display = 'none'; }} />
            : <div className="w-full h-full flex items-center justify-center" style={{ background: `${category.color}18` }}>
                <span className="text-7xl">{category.icon}</span>
              </div>}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/50" />
          <button onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: 'calc(92vh - 200px)' }}>
          <div className="px-5 pt-4 pb-10">

            {/* Name + category badge */}
            <h1 className="text-xl font-bold text-foreground leading-tight">{poi.name}</h1>
            <div className="mt-1.5 mb-4">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-white"
                style={{ background: category.color }}>
                {category.icon} {category.name}
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 mb-5">
              <ActionBtn icon={Navigation} label="Navigate" onClick={onNavigate} color={category.color} />
              <ActionBtn icon={Share2}     label="Share"    onClick={onShare} />
              <ActionBtn icon={Camera}     label="Add Photo" onClick={onAddPhoto} disabled={!user} />
            </div>

            <div className="h-px bg-gray-100 dark:bg-border mb-4" />

            {/* Opening hours */}
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
                  <span className="text-sm text-muted-foreground">({count} {count === 1 ? 'review' : 'reviews'})</span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mb-3">No ratings yet — be the first!</p>
              )}

              {!ratingDone ? (
                <div className="bg-gray-50 dark:bg-accent/40 rounded-2xl p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Rate this place</p>
                  {user ? (
                    <>
                      <Stars value={ratingVal} size={28} interactive onRate={setRatingVal} />
                      {ratingVal > 0 && (
                        <>
                          <textarea value={ratingComment} onChange={e => setRatingComment(e.target.value)}
                            placeholder="Add a comment (optional)"
                            className="mt-3 w-full text-sm px-3 py-2 rounded-xl border border-gray-200 dark:border-border bg-white dark:bg-background text-foreground resize-none outline-none focus:ring-2 focus:ring-blue-300"
                            rows={2} />
                          <button onClick={handleRateSubmit} disabled={submitting}
                            className="mt-2 w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-95 disabled:opacity-50"
                            style={{ background: category.color }}>
                            {submitting ? 'Submitting…' : 'Submit Rating'}
                          </button>
                        </>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">Sign in to rate this place</p>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm font-medium">
                  <Star className="w-4 h-4 fill-current" /> Thanks for your rating!
                </div>
              )}
            </div>

            <div className="h-px bg-gray-100 dark:bg-border mb-4" />

            {/* Description */}
            {desc && (
              <>
                <p className="text-sm text-foreground leading-relaxed mb-4">{desc}</p>
                <div className="h-px bg-gray-100 dark:bg-border mb-4" />
              </>
            )}

            {/* Contact info — sourced directly from OSM tags, instant, no extra API */}
            {(phone || email || website || poi.lat) && (
              <>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Contact & Info</p>
                {phone   && <ContactRow icon={Phone}  value={phone}   href={`tel:${phone}`} />}
                {email   && <ContactRow icon={Mail}   value={email}   href={`mailto:${email}`} />}
                {website && <ContactRow icon={Globe}  value={website} href={website.startsWith('http') ? website : `https://${website}`} />}
                <ContactRow icon={MapPin} value={`${poi.lat.toFixed(6)}, ${poi.lon.toFixed(6)}`}
                  href={`https://maps.google.com/?q=${poi.lat},${poi.lon}`} />
                <div className="h-px bg-gray-100 dark:bg-border mt-2 mb-4" />
              </>
            )}

            {/* Photo gallery */}
            {allPhotos.length > 0 && (
              <>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Photos
                  {sfPhotos.length > 0 && <span className="text-green-600 dark:text-green-400 normal-case font-normal ml-1">· {sfPhotos.length} from SpotFinder</span>}
                </p>
                <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
                  {allPhotos.map((p, i) => (
                    <div key={i} className="flex-shrink-0 w-28 h-20 rounded-xl overflow-hidden bg-gray-100 dark:bg-accent relative">
                      <img src={p.url} alt="" className="w-full h-full object-cover" />
                      {p.source === 'sf' && <div className="absolute bottom-1 right-1 bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">SF</div>}
                    </div>
                  ))}
                  {user && (
                    <button onClick={onAddPhoto}
                      className="flex-shrink-0 w-28 h-20 rounded-xl border-2 border-dashed border-gray-300 dark:border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-gray-400 transition-colors">
                      <Camera className="w-5 h-5" />
                      <span className="text-xs">Add photo</span>
                    </button>
                  )}
                </div>
              </>
            )}

            {/* If no photos yet, still show add button */}
            {allPhotos.length === 0 && user && (
              <button onClick={onAddPhoto}
                className="w-full h-20 rounded-xl border-2 border-dashed border-gray-300 dark:border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-gray-400 transition-colors mb-4">
                <Camera className="w-5 h-5" />
                <span className="text-xs">Be the first to add a photo</span>
              </button>
            )}

            {/* SpotFinder reviews */}
            {sfRating?.ratings?.length > 0 && (
              <>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">SpotFinder Reviews</p>
                <div className="space-y-3">
                  {sfRating.ratings.slice(0, 5).map(r => (
                    <div key={r.id} className="bg-gray-50 dark:bg-accent/40 rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Stars value={r.rating} size={12} />
                        <span className="text-xs text-muted-foreground">{r.created_by?.split('@')[0] || 'User'}</span>
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

// ─── Main export ─────────────────────────────────────────────────────────────

const MAPY_API_KEY = 'aZQcHL3uznHNI_dIUHIMrc9Oes4EhkbMBS6muOSNUNk';

/** Try to fetch Mapy.cz photos for a POI — non-blocking, fails silently */
async function tryFetchMapyPhotos(name, lat, lon) {
  try {
    const near = `&preferNear=${lon},${lat}&preferNearPrecision=500`;
    const url  = `https://api.mapy.com/v1/suggest?apikey=${MAPY_API_KEY}&query=${encodeURIComponent(name)}&lang=en&limit=5${near}`;
    const res  = await fetch(url);
    if (!res.ok) return [];

    const data  = await res.json();
    const items = data.items || [];

    // Find closest match
    let best = null, bestDist = Infinity;
    for (const item of items) {
      const pos = item.position;
      if (!pos) continue;
      const d = Math.hypot(pos.lat - lat, pos.lon - lon);
      if (d < bestDist) { bestDist = d; best = item; }
    }
    if (!best || bestDist > 0.005) return [];

    // Extract source + id from userData
    const ud     = best.userData || {};
    const source = ud.source || best.source;
    const id     = ud.id     || best.id;
    if (!source || !id) return [];

    const detailRes = await fetch(
      `https://api.mapy.com/v1/place/${encodeURIComponent(`${source}:${id}`)}?apikey=${MAPY_API_KEY}&lang=en`
    );
    if (!detailRes.ok) return [];

    const detail = await detailRes.json();
    // photos is an array of {url, ...} objects
    return (detail.photos || []).map(p => p.url).filter(Boolean);
  } catch {
    return [];
  }
}

export default function POIDetailPanel({ poi, category, onClose, onNavigate, user }) {
  const [expanded, setExpanded]   = useState(false);
  const [sfPhotos, setSfPhotos]   = useState([]);
  const [sfRating, setSfRating]   = useState({ ratings: [], avg: 0, count: 0 });
  const [mapyPhotos, setMapyPhotos] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!poi) return;
    setExpanded(false);
    setMapyPhotos([]);

    const poiId = makePOIId(poi.lat, poi.lon, poi.name);
    getPOIPhotos(poiId).then(setSfPhotos);
    getPOIRatings(poiId).then(r => setSfRating(
      Array.isArray(r)
        ? { ratings: r, avg: r.length ? Math.round(r.reduce((s, x) => s + x.rating, 0) / r.length * 10) / 10 : 0, count: r.length }
        : (r || { ratings: [], avg: 0, count: 0 })
    ));

    // Fetch Mapy.cz photos in background — non-blocking
    tryFetchMapyPhotos(poi.name, poi.lat, poi.lon).then(urls => {
      if (urls.length) setMapyPhotos(urls);
    });
  }, [poi?.id]);

  const handleShare = async () => {
    const url = `https://maps.google.com/?q=${poi.lat},${poi.lon}`;
    try {
      if (navigator.share) await navigator.share({ title: poi.name, url });
      else await navigator.clipboard.writeText(`${poi.name}\n${url}`);
    } catch {}
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
    const poiId = makePOIId(poi.lat, poi.lon, poi.name);
    await addPOIRating(poiId, rating, comment, user?.email);
    getPOIRatings(poiId).then(r => setSfRating(
      Array.isArray(r)
        ? { ratings: r, avg: r.length ? Math.round(r.reduce((s, x) => s + x.rating, 0) / r.length * 10) / 10 : 0, count: r.length }
        : r
    ));
  };

  const handleNavigate = () => { onNavigate?.({ lat: poi.lat, lng: poi.lon, label: poi.name }); onClose(); };

  if (!poi) return null;

  const sharedProps = {
    poi, category, sfPhotos, sfRating, mapyPhotos,
    onClose, onNavigate: handleNavigate, onShare: handleShare, onAddPhoto: handleAddPhoto, user,
  };

  return (
    <>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      {expanded
        ? <FullSheet {...sharedProps} onSubmitRating={handleSubmitRating} />
        : <MiniBar {...sharedProps} mapyPhoto={mapyPhotos[0] || null} onExpand={() => setExpanded(true)} />}
    </>
  );
}