import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Flag, Instagram, Loader2, Play, Plus, ShieldCheck } from 'lucide-react';
import { addSocialPost, getSocialPosts } from '@/api/firebaseClient';
import { INVALID_SOCIAL_URL_MESSAGE, validateSocialPostUrl } from '@/lib/socialUrlPolicy';
import ReportDialog from '@/components/moderation/ReportDialog';

function safeSocialRecord(post) {
  const parsed = validateSocialPostUrl(post?.canonical_url);
  if (!parsed.ok || parsed.provider !== post.provider || parsed.contentId !== post.content_id || parsed.contentType !== post.content_type) return null;
  return parsed;
}

function embedUrl(parsed) {
  if (parsed.provider === 'instagram') {
    return `https://www.instagram.com/${parsed.contentType}/${parsed.contentId}/embed/`;
  }
  if (parsed.provider === 'tiktok') {
    return `https://www.tiktok.com/player/v1/${parsed.contentId}?controls=1&description=1&rel=0`;
  }
  return null;
}

function ProviderIcon({ provider, className = 'h-4 w-4' }) {
  return provider === 'instagram' ? <Instagram className={className} /> : <Play className={className} />;
}

function SocialEmbed({ post, parsed, onReport }) {
  const [consented, setConsented] = useState(false);
  const [frameState, setFrameState] = useState('idle');
  const src = embedUrl(parsed);

  useEffect(() => {
    if (frameState !== 'loading') return undefined;
    const timer = window.setTimeout(() => setFrameState('failed'), 12000);
    return () => window.clearTimeout(timer);
  }, [frameState]);

  const providerName = parsed.provider === 'instagram' ? 'Instagram' : 'TikTok';
  const start = () => {
    setConsented(true);
    setFrameState('loading');
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <div className="flex items-center gap-2 text-sm font-semibold"><ProviderIcon provider={parsed.provider} />{providerName}</div>
        <div className="flex items-center gap-1">
          <a href={parsed.canonicalUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 dark:hover:bg-slate-800" aria-label={`Open original on ${providerName}`}><ExternalLink className="h-4 w-4" /></a>
          <button type="button" onClick={() => onReport(post)} className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:hover:bg-red-950/30" aria-label={`Report ${providerName} post`}><Flag className="h-4 w-4" /></button>
        </div>
      </div>

      {!consented ? (
        <div className="flex min-h-52 flex-col items-center justify-center bg-slate-50 px-6 py-8 text-center dark:bg-slate-950/40">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300"><ProviderIcon provider={parsed.provider} className="h-5 w-5" /></span>
          <p className="font-semibold">Video from {providerName}</p>
          <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">Loading may share your IP address and browser data with {providerName}.</p>
          <button type="button" onClick={start} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"><Play className="h-4 w-4" />Load post</button>
        </div>
      ) : frameState === 'failed' ? (
        <div className="flex min-h-40 flex-col items-center justify-center px-5 py-7 text-center">
          <p className="font-semibold">Post unavailable</p>
          <p className="mt-1 text-xs text-slate-500">It may be private, deleted, blocked, or temporarily unavailable.</p>
          <a href={parsed.canonicalUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-green-700 underline underline-offset-2 dark:text-green-400">Open on {providerName}<ExternalLink className="h-3.5 w-3.5" /></a>
        </div>
      ) : (
        <div className={`relative w-full bg-slate-100 dark:bg-slate-950 ${parsed.provider === 'instagram' ? 'min-h-[520px]' : 'min-h-[560px]'}`}>
          {frameState === 'loading' && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-green-600 motion-reduce:animate-none" /><span className="sr-only">Loading post</span></div>}
          <iframe
            src={src}
            title={`${providerName} post from this place`}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="fullscreen; encrypted-media; picture-in-picture"
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
            className={`relative w-full border-0 ${parsed.provider === 'instagram' ? 'h-[640px]' : 'h-[720px]'} ${frameState === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setFrameState('loaded')}
            onError={() => setFrameState('failed')}
          />
        </div>
      )}
    </article>
  );
}

export default function SocialPostsSection({ targetType, targetId, targetName, user }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reportPost, setReportPost] = useState(null);
  const parsedInput = useMemo(() => validateSocialPostUrl(url), [url]);
  const verified = Boolean(user && !user.isAnonymous && user.emailVerified === true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getSocialPosts(targetType, targetId).then(items => {
      if (active) setPosts(items.filter(post => safeSocialRecord(post)));
    }).catch(() => {
      if (active) setError('Social posts could not be loaded.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [targetType, targetId]);

  const submit = async () => {
    if (!parsedInput.ok || busy) { setError(INVALID_SOCIAL_URL_MESSAGE); return; }
    setBusy(true);
    setError('');
    try {
      const created = await addSocialPost({ url, targetType, targetId, targetName });
      setPosts(current => [created, ...current]);
      setUrl('');
    } catch (submitError) {
      const message = submitError?.message || '';
      setError(message.includes('already') ? 'This post is already attached to this place.' : message || 'Could not add this post.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="my-5" aria-labelledby={`social-posts-${targetType}-${targetId}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 id={`social-posts-${targetType}-${targetId}`} className="text-sm font-bold text-foreground">Recent posts from this place</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Posts load only when you choose to view them.</p>
        </div>
        <ShieldCheck className="h-5 w-5 shrink-0 text-green-600" aria-hidden="true" />
      </div>

      {loading ? <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />Loading posts…</div> : (
        <div className="space-y-4">
          {posts.map(post => {
            const parsed = safeSocialRecord(post);
            return parsed ? <SocialEmbed key={post.id} post={post} parsed={parsed} onReport={setReportPost} /> : null;
          })}
          {!posts.length && <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">No social posts have been added yet.</p>}
        </div>
      )}

      {verified && (
        <div className="mt-4 rounded-2xl border bg-slate-50/80 p-4 dark:bg-slate-900/60">
          <label htmlFor={`social-url-${targetType}-${targetId}`} className="text-sm font-semibold">Add social post</label>
          <p className="mt-1 text-xs text-muted-foreground">Instagram posts/reels and TikTok videos only.</p>
          <input id={`social-url-${targetType}-${targetId}`} type="url" value={url} onChange={event => { setUrl(event.target.value); setError(''); }} autoCapitalize="none" autoCorrect="off" spellCheck="false" placeholder="Paste Instagram or TikTok post link" className="mt-3 w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-green-500 dark:bg-slate-950" />
          {url && parsedInput.ok && <p className="mt-2 text-xs font-medium text-green-700 dark:text-green-400">✓ {parsedInput.provider === 'instagram' ? 'Instagram post' : 'TikTok video'} recognized</p>}
          {url && !parsedInput.ok && <p className="mt-2 text-xs text-red-600">{INVALID_SOCIAL_URL_MESSAGE}</p>}
          <button type="button" onClick={submit} disabled={!parsedInput.ok || busy} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"><Plus className="h-4 w-4" />{busy ? 'Adding…' : 'Add to SpotFinder'}</button>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}

      <ReportDialog open={Boolean(reportPost)} onClose={() => setReportPost(null)} user={user} targetType="social_post" targetId={reportPost?.id || ''} targetLabel={`${reportPost?.provider || 'Social'} post at ${targetName}`} targetSnapshot={{ name: targetName, created_by: reportPost?.added_by || '' }} />
    </section>
  );
}
