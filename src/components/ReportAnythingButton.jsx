import { useState } from 'react';
import { Flag, X } from 'lucide-react';
import { submitGeneralReport } from '@/api/firebaseClient';

function deviceId() {
  let id = localStorage.getItem('sf_device_id');
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('sf_device_id', id); }
  return id;
}

export default function ReportAnythingButton() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({ category: 'bug', subject: '', message: '' });
  const submit = async (e) => {
    e.preventDefault();
    if (!form.message.trim()) return;
    setBusy(true);
    try {
      await submitGeneralReport({ ...form, deviceId: deviceId() });
      setDone(true); setForm({ category: 'bug', subject: '', message: '' });
    } catch (err) { alert(err?.message || 'Could not send report.'); }
    finally { setBusy(false); }
  };
  return <>
    <button onClick={() => { setOpen(true); setDone(false); }} className="fixed bottom-5 right-5 z-[9000] rounded-full bg-slate-900 text-white px-4 py-3 shadow-lg flex items-center gap-2 text-sm"><Flag size={16}/> Report</button>
    {open && <div className="fixed inset-0 z-[10000] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-md p-5 relative">
        <button onClick={() => setOpen(false)} className="absolute right-4 top-4"><X size={18}/></button>
        <h2 className="font-semibold text-lg mb-1">Report anything</h2>
        <p className="text-sm text-slate-500 mb-4">Report a bug, unsafe content, spam, wrong map data, or another problem.</p>
        {done ? <div className="py-8 text-center"><p className="font-medium">Report sent. Thank you.</p></div> :
        <form onSubmit={submit} className="space-y-3">
          <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} className="w-full border rounded-lg p-2 bg-transparent">
            <option value="bug">Bug / broken feature</option><option value="content">Bad or unsafe content</option><option value="spam">Spam / abuse</option><option value="map">Wrong map / POI data</option><option value="security">Security concern</option><option value="other">Other</option>
          </select>
          <input value={form.subject} maxLength={120} onChange={e=>setForm({...form,subject:e.target.value})} placeholder="Short title (optional)" className="w-full border rounded-lg p-2 bg-transparent"/>
          <textarea value={form.message} maxLength={3000} onChange={e=>setForm({...form,message:e.target.value})} rows={5} placeholder="What happened?" className="w-full border rounded-lg p-2 bg-transparent" required/>
          <button disabled={busy} className="w-full bg-slate-900 text-white rounded-lg py-2.5 disabled:opacity-50">{busy?'Sending…':'Send report'}</button>
        </form>}
      </div>
    </div>}
  </>;
}
