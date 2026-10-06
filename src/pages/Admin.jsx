import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import StatusAdmin from './StatusAdmin';
import {
  addSocialPost, adminBlockReporter, adminDeletePOIPhoto, adminDeleteReport,
  adminResolveReport, adminSetSocialPostStatus, adminUpdateSpot, deleteSpotAsSuperAdmin,
  getAdminPOIPhotos, getAdminReports, getAdminSocialPosts, getAdminSpots,
} from '@/api/firebaseClient';
import { INVALID_SOCIAL_URL_MESSAGE, validateSocialPostUrl } from '@/lib/socialUrlPolicy';

const tabs = ['Reports', 'Spots', 'Photos', 'Social', 'Status'];

export default function Admin() {
  const { user, isAdmin, isLoadingAuth } = useAuth();
  const [tab, setTab] = useState('Reports');
  const [reports, setReports] = useState([]);
  const [spots, setSpots] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [socialPosts, setSocialPosts] = useState([]);
  const [filter, setFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [reasonFilter, setReasonFilter] = useState('all');
  const [q, setQ] = useState('');

  const refresh = async () => {
    if (!isAdmin) return;
    const [nextReports, nextSpots, nextPhotos, nextSocial] = await Promise.all([
      getAdminReports(), getAdminSpots(), getAdminPOIPhotos(), getAdminSocialPosts(),
    ]);
    setReports(nextReports); setSpots(nextSpots); setPhotos(nextPhotos); setSocialPosts(nextSocial);
  };
  useEffect(() => { refresh(); }, [isAdmin]);

  const visibleReports = useMemo(() => reports.filter(report =>
    (filter === 'all' || report.status === filter)
    && (typeFilter === 'all' || report.target_type === typeFilter)
    && (reasonFilter === 'all' || report.category === reasonFilter)
    && (!q || JSON.stringify(report).toLowerCase().includes(q.toLowerCase()))
  ), [reports, filter, typeFilter, reasonFilter, q]);

  if (isLoadingAuth) return <div className="p-10">Loading…</div>;
  if (!isAdmin) return <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950"><div className="w-full max-w-lg bg-white dark:bg-slate-900 border rounded-2xl p-6 shadow-sm"><h1 className="text-xl font-semibold">Admin access required</h1><p className="text-sm text-slate-500 mt-2">This area requires the Firebase <code>admin: true</code> custom claim.</p>{user ? <p className="text-sm mt-4">Signed in as <strong>{user.email}</strong>.</p> : <p className="text-sm text-amber-600 mt-4">Sign in with an authorized admin account first.</p>}</div></div>;

  return <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8"><div className="max-w-6xl mx-auto">
    <h1 className="text-2xl font-bold mb-1">SpotFinder Admin</h1><p className="text-sm text-slate-500 mb-6">Moderation and operations. Privileged writes run through logged Cloud Functions.</p>
    <div className="flex gap-2 flex-wrap mb-6">{tabs.map(name => <button key={name} onClick={() => setTab(name)} className={`px-4 py-2 rounded-lg text-sm ${tab === name ? 'bg-slate-900 text-white' : 'bg-white border dark:bg-slate-900'}`}>{name}</button>)}</div>
    {tab === 'Reports' && <ReportsTab reports={visibleReports} q={q} setQ={setQ} filter={filter} setFilter={setFilter} typeFilter={typeFilter} setTypeFilter={setTypeFilter} reasonFilter={reasonFilter} setReasonFilter={setReasonFilter} refresh={refresh} />}
    {tab === 'Spots' && <section><input value={q} onChange={event => setQ(event.target.value)} placeholder="Filter spots…" className="w-full border rounded-lg px-3 py-2 mb-4 bg-white dark:bg-slate-900" /><div className="space-y-3">{spots.filter(spot => !q || JSON.stringify(spot).toLowerCase().includes(q.toLowerCase())).map(spot => <SpotRow key={spot.id} spot={spot} refresh={refresh} />)}</div></section>}
    {tab === 'Photos' && <section><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{photos.map(photo => <div key={photo.id} className="bg-white dark:bg-slate-900 border rounded-xl overflow-hidden">{photo.image && <img src={photo.image} alt="POI upload" className="w-full h-40 object-cover" />}<div className="p-3"><p className="text-xs break-all">POI: {photo.poi_id}</p><p className="text-xs text-slate-500">By {photo.created_by}</p><button onClick={async () => { if (confirm('Delete this photo?')) { await adminDeletePOIPhoto(photo.id); refresh(); } }} className="mt-3 text-xs bg-red-600 text-white rounded px-3 py-1.5">Delete image</button></div></div>)}</div></section>}
    {tab === 'Social' && <SocialAdmin posts={socialPosts} onRefresh={refresh} />}
    {tab === 'Status' && <div className="-mx-4 md:-mx-8 -mt-10"><StatusAdmin /></div>}
  </div></div>;
}

function ReportsTab({ reports, q, setQ, filter, setFilter, typeFilter, setTypeFilter, reasonFilter, setReasonFilter, refresh }) {
  return <section><div className="flex gap-2 mb-4 flex-wrap"><input value={q} onChange={event => setQ(event.target.value)} placeholder="Search reports, device, user…" className="min-w-56 flex-1 border rounded-lg px-3 py-2 bg-white dark:bg-slate-900" /><select value={filter} onChange={event => setFilter(event.target.value)} className="border rounded-lg px-3 bg-white dark:bg-slate-900"><option value="all">All statuses</option><option value="open">Open</option><option value="resolved">Resolved</option></select><select value={typeFilter} onChange={event => setTypeFilter(event.target.value)} className="border rounded-lg px-3 bg-white dark:bg-slate-900"><option value="all">All targets</option><option value="spot">Spots</option><option value="poi">POIs</option><option value="poi_photo">POI photos</option><option value="social_post">Social posts</option></select><select value={reasonFilter} onChange={event => setReasonFilter(event.target.value)} className="border rounded-lg px-3 bg-white dark:bg-slate-900"><option value="all">All reasons</option><option value="wrong_info">Wrong info</option><option value="wrong_location">Wrong location</option><option value="duplicate">Duplicate</option><option value="inappropriate">Inappropriate</option><option value="spam">Spam</option><option value="unrelated">Unrelated</option><option value="privacy">Privacy</option><option value="unavailable">Unavailable</option><option value="misleading">Misleading</option><option value="other">Other</option></select></div><div className="space-y-3">{reports.map(report => <div key={report.id} className="bg-white dark:bg-slate-900 border rounded-xl p-4"><div className="flex justify-between gap-3"><div><span className="text-xs uppercase text-slate-500">{report.target_type || 'other'} · {report.category || 'other'} · {report.status || 'open'}</span><h3 className="font-semibold">{report.subject || 'Report'}</h3><p className="text-sm mt-2 whitespace-pre-wrap">{report.message || 'No additional details.'}</p>{report.target_snapshot && <div className="mt-2 text-xs bg-slate-50 dark:bg-slate-800 rounded p-2"><strong>Target:</strong> {report.target_snapshot.title || report.target_snapshot.name || report.target_id}<br /><span className="break-all">ID: {report.target_id}</span></div>}<p className="text-xs text-slate-400 mt-2">{report.created_at} · reporter {report.reporter_uid || 'guest'}</p></div><div className="flex gap-2 flex-wrap content-start justify-end">{report.target_type === 'social_post' && <button onClick={async () => { await adminSetSocialPostStatus(report.target_id, 'hidden'); await adminResolveReport(report.id, 'hidden'); refresh(); }} className="text-xs bg-amber-600 text-white rounded px-2 py-1">Hide post</button>}<button onClick={async () => { await adminResolveReport(report.id); refresh(); }} className="text-xs border rounded px-2 py-1">Resolve</button><button onClick={async () => { await adminBlockReporter(report.id); refresh(); }} className="text-xs border rounded px-2 py-1">Block spammer</button><button onClick={async () => { if (confirm('Delete this report?')) { await adminDeleteReport(report.id); refresh(); } }} className="text-xs bg-red-600 text-white rounded px-2 py-1">Delete</button></div></div></div>)}</div></section>;
}

function SocialAdmin({ posts, onRefresh }) {
  const [targetType, setTargetType] = useState('spot'); const [targetId, setTargetId] = useState(''); const [targetName, setTargetName] = useState(''); const [url, setUrl] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const parsed = useMemo(() => validateSocialPostUrl(url), [url]);
  const submit = async () => { if (!parsed.ok || !targetId.trim() || busy) return; setBusy(true); setError(''); try { await addSocialPost({ url, targetType, targetId: targetId.trim(), targetName: targetName.trim() }); setUrl(''); setTargetId(''); setTargetName(''); await onRefresh(); } catch (submitError) { setError(submitError?.message || 'Could not add social post.'); } finally { setBusy(false); } };
  return <section><div className="mb-5 rounded-2xl border bg-white p-4 dark:bg-slate-900"><h2 className="font-semibold">Attach social post</h2><p className="mt-1 text-xs text-slate-500">Use the exact Spot or POI target ID. Provider metadata is derived by the backend.</p><div className="mt-4 grid gap-3 md:grid-cols-2"><select value={targetType} onChange={event => setTargetType(event.target.value)} className="rounded-lg border bg-transparent px-3 py-2"><option value="spot">Community spot</option><option value="poi">POI</option></select><input value={targetId} onChange={event => setTargetId(event.target.value)} placeholder="Target ID" className="rounded-lg border bg-transparent px-3 py-2" /><input value={targetName} onChange={event => setTargetName(event.target.value)} placeholder="Place name" className="rounded-lg border bg-transparent px-3 py-2 md:col-span-2" /><input value={url} onChange={event => { setUrl(event.target.value); setError(''); }} placeholder="Instagram or TikTok post URL" className="rounded-lg border bg-transparent px-3 py-2 md:col-span-2" /></div>{url && (parsed.ok ? <p className="mt-2 text-xs font-medium text-green-600">✓ Provider: {parsed.provider === 'instagram' ? 'Instagram' : 'TikTok'}</p> : <p className="mt-2 text-xs text-red-600">{INVALID_SOCIAL_URL_MESSAGE}</p>)}{error && <p className="mt-2 text-sm text-red-600">{error}</p>}<button onClick={submit} disabled={!parsed.ok || !targetId.trim() || busy} className="mt-3 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{busy ? 'Adding…' : 'Add social post'}</button></div><div className="space-y-3">{posts.map(post => <div key={post.id} className="rounded-xl border bg-white p-4 dark:bg-slate-900"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{post.provider === 'instagram' ? 'Instagram' : 'TikTok'} <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] uppercase ${post.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{post.status}</span></p><p className="mt-1 text-xs text-slate-500">{post.target_type}: {post.target_name || post.target_id}</p><p className="text-xs text-slate-500">Added by {post.added_by_email || post.added_by} · {post.created_at}</p><a href={post.canonical_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs font-semibold text-blue-600 underline">Original post</a></div><div className="flex gap-2">{post.status !== 'hidden' && <button onClick={async () => { await adminSetSocialPostStatus(post.id, 'hidden'); onRefresh(); }} className="rounded border px-3 py-1.5 text-xs">Hide</button>}{post.status !== 'unavailable' && <button onClick={async () => { await adminSetSocialPostStatus(post.id, 'unavailable'); onRefresh(); }} className="rounded border px-3 py-1.5 text-xs">Unavailable</button>}{post.status !== 'active' && <button onClick={async () => { await adminSetSocialPostStatus(post.id, 'active'); onRefresh(); }} className="rounded bg-green-600 px-3 py-1.5 text-xs text-white">Restore</button>}</div></div></div>)}</div></section>;
}

function SpotRow({ spot, refresh }) {
  const [editing, setEditing] = useState(false); const [title, setTitle] = useState(spot.title || ''); const [description, setDescription] = useState(spot.description || '');
  return <div className="bg-white dark:bg-slate-900 border rounded-xl p-4"><div className="flex gap-4 justify-between"><div className="flex-1">{editing ? <><input value={title} onChange={event => setTitle(event.target.value)} className="w-full border rounded p-2 mb-2 bg-transparent" /><textarea value={description} onChange={event => setDescription(event.target.value)} className="w-full border rounded p-2 bg-transparent" /></> : <><h3 className="font-semibold">{spot.title || 'Untitled'}</h3><p className="text-sm text-slate-500">{spot.description}</p></>}<p className="text-xs text-slate-400 mt-2">{spot.id} · {spot.status}</p></div><div className="flex gap-2 content-start">{editing ? <button onClick={async () => { await adminUpdateSpot(spot.id, { title, description }); setEditing(false); refresh(); }} className="text-xs border rounded px-2 py-1">Save</button> : <button onClick={() => setEditing(true)} className="text-xs border rounded px-2 py-1">Edit</button>}{(spot.image_url || spot.image_urls?.length > 0) && <button onClick={async () => { if (confirm('Remove all photos from this spot?')) { await adminUpdateSpot(spot.id, { image_url: null, image_urls: [] }); refresh(); } }} className="text-xs border rounded px-2 py-1">Remove photos</button>}<button onClick={async () => { if (confirm('Permanently delete this spot?')) { await deleteSpotAsSuperAdmin(spot.id); refresh(); } }} className="text-xs bg-red-600 text-white rounded px-2 py-1">Delete</button></div></div></div>;
}
