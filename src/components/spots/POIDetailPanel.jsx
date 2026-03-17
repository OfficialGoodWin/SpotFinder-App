import React, { useState, useEffect, useRef } from 'react';
import {
  X, Navigation, Share2, Camera, Star, Phone, Mail, Globe,
  MapPin, ChevronUp, Clock
} from 'lucide-react';
import { fetchPOIDetails } from '@/api/mapyClient';
import {
  getPOIPhotos, getPOIRatings, addPOIPhoto, addPOIRating,
  uploadSpotImage
} from '@/api/firebaseClient';

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
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-1 px-4 py-2.5 rounded-2xl bg-gray-100 dark:bg-accent/60 hover:bg-gray-200 dark:hover:bg-accent active:scale-95 transition-all disabled:opacity-40 flex-1"
    >
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
      <span className="text-sm text-foreground truncate">{value}</span>
    </div>
  );
  return href
    ? <a href={href} target="_blank" rel="noopener noreferrer" className="block hover:bg-gray-50 dark:hover:bg-accent/40 rounded-xl transition-colors">{inner}</a>
    : <div>{inner}</div>;
}

// ─── Mini bar ─────────────────────────────────────────────────────────────────

function MiniBar({ poi, category, detail, sfRating, onExpand, onClose, onNavigate, onShare, onAddPhoto, user }) {
  const photo = detail?.photos?.[0]?.url || null;
  const mr = detail?.rating;
  const combinedAvg = (() => {
    const mc = mr?.count || 0; const ma = mr?.average || 0;
    const sc = sfRating?.count || 0; const sa = sfRating?.avg || 0;
    const t = mc + sc; if (!t) return 0;
    return Math.round(((ma * mc + sa * sc) / t) * 10) / 10;
  })();
  const totalCount = (mr?.count || 0) + (sfRating?.count || 0);

  return (
    <div className="fixed left-0 right-0 z-[1200] bg-white dark:bg-card shadow-2xl border-t border-gray-100 dark:border-border rounded-t-2xl" style={{ bottom: 56 }}>
      {/* Drag handle */}
      <button className="w-full flex justify-center pt-2.5 pb-0" onClick={onExpand}>
        <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-border" />
      </button>

      {/* Close */}
      <button onClick={onClose} className="absolute top-3 right-3 w-7 h-7 rounded-full bg-gray-100 dark:bg-accent flex items-center justify-center z-10">
        <X className="w-3.5 h-3.5" />
      </button>

      {/* Info row */}
      <div className="flex items-center gap-3 px-4 pt-2 pb-3 cursor-pointer" onClick={onExpand}>
        <div className="w-14 h-14 rounded-full flex-shrink-0 overflow-hidden border-2 flex items-center justify-center"
          style={{ borderColor: category.color, background: `${category.color}18` }}>
          {photo
            ? <img src={photo} alt={poi.name} className="w-full h-full object-cover" />
            : <span className="text-2xl">{category.icon}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground text-sm leading-tight truncate">{poi.name}</p>
          {poi.address && <p className="text-xs text-muted-foreground truncate mt-0.5">{poi.address}</p>}
          {combinedAvg > 0 && (
            <div className="flex items-center gap-1.5 mt-1">
              <Stars value={combinedAvg} size={12} />
              <span className="text-xs font-semibold text-green-600 dark:text-green-400">{combinedAvg.toFixed(1)}</span>
              {totalCount > 0 && <span className="text-xs text-muted-foreground">({totalCount})</span>}
            </div>
          )}
        </div>
        <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0 mr-8" />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 pb-4">
        <ActionBtn icon={Navigation} label="Navigate" onClick={onNavigate} color={category.color} />
        <ActionBtn icon={Share2} label="Share" onClick={onShare} />
        <ActionBtn icon={Camera} label="Add Photo" onClick={onAddPhoto} disabled={!user} />
      </div>
    </div>
  );
}

// ─── Full sheet ───────────────────────────────────────────────────────────────

function FullSheet({ poi, category, detail, sfPhotos, sfRating, onClose, onNavigate, onShare, onAddPhoto, onSubmitRating, user }) {
  const [ratingVal, setRatingVal] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [ratingDone, setRatingDone] = useState(false);

  const mapyPhotos = detail?.photos || [];
  const mr = detail?.rating;
  const hours = detail?.openingHours;
  const contact = detail?.contact;

  const allPhotos = [
    ...mapyPhotos.map(p => ({ url: p.url, source: 'mapy' })),
    ...sfPhotos.map(p => ({ url: p.photo, source: 'sf' })),
  ];

  const combinedAvg = (() => {
    const mc = mr?.count || 0; const ma = mr?.average || 0;
    const sc = sfRating?.count || 0; const sa = sfRating?.avg || 0;
    const t = mc + sc; if (!t) return 0;
    return Math.round(((ma * mc + sa * sc) / t) * 10) / 10;
  })();
  const combinedCount = (mr?.count || 0) + (sfRating?.count || 0);

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
        <div className="relative bg-gray-100 dark:bg-accent" style={{ height: 220 }}>
          {allPhotos[0]?.url
            ? <img src={allPhotos[0].url} alt={poi.name} className="w-full h-full object-cover" />
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

        {/* Body */}
        <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: 'calc(92vh - 220px)' }}>
          <div className="px-5 pt-4 pb-10">

            {/* Name + badge */}
            <h1 className="text-xl font-bold text-foreground">{poi.name}</h1>
            <div className="mt-1.5 mb-4">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-white"
                style={{ background: category.color }}>
                {category.icon} {category.name}
              </span>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mb-5">
              <ActionBtn icon={Navigation} label="Navigate" onClick={onNavigate} color={category.color} />
              <ActionBtn icon={Share2} label="Share" onClick={onShare} />
              <ActionBtn icon={Camera} label="Add Photo" onClick={onAddPhoto} disabled={!user} />
            </div>

            <div className="h-px bg-gray-100 dark:bg-border mb-4" />

            {/* Open/Closed */}
            {hours && (
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className={`text-sm font-semibold ${hours.isOpen ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                  {hours.isOpen ? 'Open now' : 'Closed'}
                </span>
                {hours.currentStatus && <span className="text-xs text-muted-foreground">· {hours.currentStatus}</span>}
              </div>
            )}

            {/* Ratings */}
            <div className="mb-4">
              {combinedAvg > 0 ? (
                <div className="flex items-center gap-2 mb-3">
                  <Stars value={combinedAvg} size={20} />
                  <span className="text-lg font-bold text-green-600 dark:text-green-400">{combinedAvg.toFixed(1)}</span>
                  <span className="text-sm text-muted-foreground">({combinedCount} {combinedCount === 1 ? 'review' : 'reviews'})</span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mb-3">No ratings yet — be the first!</p>
              )}

              {!ratingDone ? (
                <div className="bg-gray-50 dark:bg-accent/40 rounded-2xl p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Rate this place</p>
                  {user ? (
                    <>
                      <Stars value={ratingVal} size={26} interactive onRate={setRatingVal} />
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
            {detail?.description && (
              <>
                <p className="text-sm text-foreground leading-relaxed mb-4">{detail.description}</p>
                <div className="h-px bg-gray-100 dark:bg-border mb-4" />
              </>
            )}

            {/* Contact */}
            {(contact?.phone || contact?.email || contact?.url || contact?.website || poi.lat) && (
              <>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Contact & Info</p>
                {contact?.phone && <ContactRow icon={Phone} value={contact.phone} href={`tel:${contact.phone}`} />}
                {contact?.email && <ContactRow icon={Mail} value={contact.email} href={`mailto:${contact.email}`} />}
                {(contact?.url || contact?.website) && <ContactRow icon={Globe} value={contact.url || contact.website} href={contact.url || contact.website} />}
                <ContactRow icon={MapPin} value={`${poi.lat.toFixed(6)}, ${poi.lon.toFixed(6)}`} href={`https://maps.google.com/?q=${poi.lat},${poi.lon}`} />
                <div className="h-px bg-gray-100 dark:bg-border mt-2 mb-4" />
              </>
            )}

            {/* Photos */}
            {allPhotos.length > 0 && (
              <>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Photos {sfPhotos.length > 0 && <span className="text-green-600 dark:text-green-400 normal-case font-normal ml-1">· {sfPhotos.length} from SpotFinder</span>}
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

// ─── Entry point ─────────────────────────────────────────────────────────────

export default function POIDetailPanel({ poi, category, onClose, onNavigate, user }) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState(null);
  const [sfPhotos, setSfPhotos] = useState([]);
  const [sfRating, setSfRating] = useState({ ratings: [], avg: 0, count: 0 });
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!poi) return;
    setDetail(null);
    setExpanded(false);
    fetchPOIDetails(poi.name, poi.lat, poi.lon).then(d => setDetail(d || null));
    getPOIPhotos(poi.id).then(setSfPhotos);
    getPOIRatings(poi.id).then(setSfRating);
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
    try {
      const dataUrl = await uploadSpotImage(file);
      await addPOIPhoto(poi.id, dataUrl, user.email);
      setSfPhotos(prev => [{ id: Date.now(), photo: dataUrl, created_by: user.email }, ...prev]);
    } catch (err) { console.error('Photo upload failed:', err); }
    e.target.value = '';
  };

  const handleSubmitRating = async (rating, comment) => {
    await addPOIRating(poi.id, rating, comment, user?.email);
    getPOIRatings(poi.id).then(setSfRating);
  };

  const handleNavigate = () => { onNavigate?.({ lat: poi.lat, lng: poi.lon, label: poi.name }); onClose(); };

  if (!poi) return null;

  const sharedProps = {
    poi, category, detail, sfPhotos, sfRating,
    onClose, onNavigate: handleNavigate, onShare: handleShare, onAddPhoto: handleAddPhoto, user,
  };

  return (
    <>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      {expanded
        ? <FullSheet {...sharedProps} onSubmitRating={handleSubmitRating} />
        : <MiniBar {...sharedProps} onExpand={() => setExpanded(true)} />}
    </>
  );
}
