import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import {
  getStatusServices, createStatusService, publishServiceStatus,
  getOpenIncidents, getRecentIncidents, startIncident, addIncidentUpdate,
} from '@/api/firebaseClient';

// Superadmin-only publishing tool for the /Status page. Every timestamp and
// date here is computed automatically inside firebaseClient.js — this page
// never asks the admin to type a date or time.
//
// Real access control is enforced by firestore.rules (isSuperAdmin()); the
// email check below is just so non-admins don't see a confusing UI, not the
// actual security boundary.

const STATUS_OPTIONS = [
  { value: 'up', label: 'Operational', color: 'bg-[#4C7A52]' },
  { value: 'degraded', label: 'Degraded', color: 'bg-[#C98A2C]' },
  { value: 'down', label: 'Down', color: 'bg-[#B4453A]' },
];

const UPDATE_TYPES = ['investigating', 'identified', 'monitoring', 'resolved'];

export default function StatusAdmin() {
  const { user } = useAuth();
  const isSuperAdmin = user?.email === 'superadmin@spotfinder.cz';

  const [services, setServices] = useState([]);
  const [openIncidents, setOpenIncidents] = useState([]);
  const [recentIncidents, setRecentIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newServiceName, setNewServiceName] = useState('');
  const [newIncidentTitle, setNewIncidentTitle] = useState('');
  const [newIncidentMsg, setNewIncidentMsg] = useState('');
  const [updateDrafts, setUpdateDrafts] = useState({}); // { [incidentId]: { type, message } }
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const [svcs, open, recent] = await Promise.all([
      getStatusServices(), getOpenIncidents(), getRecentIncidents(8),
    ]);
    setServices(svcs);
    setOpenIncidents(open);
    setRecentIncidents(recent);
    setLoading(false);
  };

  useEffect(() => { if (isSuperAdmin) refresh(); }, [isSuperAdmin]);

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#5C5546]">
        Not authorized.
      </div>
    );
  }

  const handlePublish = async (service, status) => {
    setBusy(true);
    await publishServiceStatus(service, status);
    await refresh();
    setBusy(false);
  };

  const handleAddService = async (e) => {
    e.preventDefault();
    if (!newServiceName.trim()) return;
    setBusy(true);
    await createStatusService(newServiceName.trim(), services.length);
    setNewServiceName('');
    await refresh();
    setBusy(false);
  };

  const handleStartIncident = async (e) => {
    e.preventDefault();
    if (!newIncidentTitle.trim() || !newIncidentMsg.trim()) return;
    setBusy(true);
    await startIncident(newIncidentTitle.trim(), 'investigating', newIncidentMsg.trim());
    setNewIncidentTitle('');
    setNewIncidentMsg('');
    await refresh();
    setBusy(false);
  };

  const handleAddUpdate = async (incidentId) => {
    const draft = updateDrafts[incidentId];
    if (!draft?.message?.trim()) return;
    setBusy(true);
    await addIncidentUpdate(incidentId, draft.type || 'monitoring', draft.message.trim());
    setUpdateDrafts(prev => ({ ...prev, [incidentId]: { type: 'monitoring', message: '' } }));
    await refresh();
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-[#F3F1EA]">
      <div className="max-w-2xl mx-auto px-6 py-14">
        <p className="font-mono text-xs tracking-wide text-[#8A8270] mb-1">SPOTFINDER · ADMIN</p>
        <h1 className="text-2xl font-semibold text-[#1B2A1E] mb-8">Publish status</h1>

        {loading ? (
          <p className="text-sm text-[#8A8270]">Loading…</p>
        ) : (
          <>
            {/* ── Services ─────────────────────────────────────────────── */}
            <section className="mb-10">
              <h2 className="font-mono text-xs tracking-wide text-[#8A8270] mb-3">SERVICES — SET TODAY'S STATUS</h2>
              <div className="space-y-3">
                {services.map(s => {
                  const current = s.days?.at(-1) || 'up';
                  return (
                    <div key={s.id} className="flex items-center justify-between py-2 border-b border-[#DDD6C8]">
                      <span className="font-medium text-[#1B2A1E]">{s.name}</span>
                      <div className="flex gap-2">
                        {STATUS_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            disabled={busy}
                            onClick={() => handlePublish(s, opt.value)}
                            className={`text-xs px-3 py-1.5 rounded-md text-white disabled:opacity-40 ${opt.color} ${current === opt.value ? 'ring-2 ring-offset-1 ring-[#1B2A1E]' : 'opacity-70 hover:opacity-100'}`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {services.length === 0 && (
                  <p className="text-sm text-[#8A8270]">No services yet — add your first one below.</p>
                )}
              </div>
              <form onSubmit={handleAddService} className="flex gap-2 mt-4">
                <input
                  value={newServiceName}
                  onChange={e => setNewServiceName(e.target.value)}
                  placeholder="New service name (e.g. Map Tiles)"
                  className="flex-1 px-3 py-2 rounded-md border border-[#DDD6C8] bg-white text-sm"
                />
                <button disabled={busy} className="px-4 py-2 rounded-md bg-[#1B2A1E] text-white text-sm disabled:opacity-40">
                  Add
                </button>
              </form>
            </section>

            {/* ── Open incidents ───────────────────────────────────────── */}
            <section className="mb-10">
              <h2 className="font-mono text-xs tracking-wide text-[#8A8270] mb-3">OPEN INCIDENTS</h2>
              {openIncidents.length === 0 && (
                <p className="text-sm text-[#8A8270] mb-4">No open incidents.</p>
              )}
              {openIncidents.map(inc => {
                const draft = updateDrafts[inc.id] || { type: 'monitoring', message: '' };
                return (
                  <div key={inc.id} className="border border-[#DDD6C8] rounded-md p-4 mb-3">
                    <p className="font-medium text-[#1B2A1E] mb-2">{inc.title}</p>
                    <div className="space-y-1 mb-3">
                      {inc.updates?.map((u, i) => (
                        <p key={i} className="text-xs text-[#5C5546]">
                          <span className="font-medium">{u.type}</span> — {u.message}
                        </p>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <select
                        value={draft.type}
                        onChange={e => setUpdateDrafts(prev => ({ ...prev, [inc.id]: { ...draft, type: e.target.value } }))}
                        className="px-2 py-1.5 rounded-md border border-[#DDD6C8] bg-white text-xs"
                      >
                        {UPDATE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <input
                        value={draft.message}
                        onChange={e => setUpdateDrafts(prev => ({ ...prev, [inc.id]: { ...draft, message: e.target.value } }))}
                        placeholder="Update message…"
                        className="flex-1 px-3 py-1.5 rounded-md border border-[#DDD6C8] bg-white text-xs"
                      />
                      <button
                        disabled={busy}
                        onClick={() => handleAddUpdate(inc.id)}
                        className="px-3 py-1.5 rounded-md bg-[#1B2A1E] text-white text-xs disabled:opacity-40"
                      >
                        Post
                      </button>
                    </div>
                  </div>
                );
              })}
            </section>

            {/* ── Start new incident ───────────────────────────────────── */}
            <section className="mb-10">
              <h2 className="font-mono text-xs tracking-wide text-[#8A8270] mb-3">START A NEW INCIDENT</h2>
              <form onSubmit={handleStartIncident} className="space-y-2">
                <input
                  value={newIncidentTitle}
                  onChange={e => setNewIncidentTitle(e.target.value)}
                  placeholder="Incident title (e.g. Elevated errors on map loading)"
                  className="w-full px-3 py-2 rounded-md border border-[#DDD6C8] bg-white text-sm"
                />
                <textarea
                  value={newIncidentMsg}
                  onChange={e => setNewIncidentMsg(e.target.value)}
                  placeholder="First update — this posts as 'investigating' automatically"
                  rows={2}
                  className="w-full px-3 py-2 rounded-md border border-[#DDD6C8] bg-white text-sm"
                />
                <button disabled={busy} className="px-4 py-2 rounded-md bg-[#B4453A] text-white text-sm disabled:opacity-40">
                  Open incident
                </button>
              </form>
            </section>

            {/* ── Recent history (read-only) ───────────────────────────── */}
            <section>
              <h2 className="font-mono text-xs tracking-wide text-[#8A8270] mb-3">RECENT HISTORY</h2>
              {recentIncidents.map(inc => (
                <p key={inc.id} className="text-sm text-[#5C5546] py-1">
                  {inc.date} — {inc.title} {inc.resolved ? '(resolved)' : '(open)'}
                </p>
              ))}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
