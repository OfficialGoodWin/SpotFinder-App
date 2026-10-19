import { useState } from 'react';
import { Flag, X } from 'lucide-react';
import { submitGeneralReport } from '@/api/firebaseClient';
import SmoothSelect from '@/components/ui/SmoothSelect';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/LanguageContext';

function deviceId() {
  let id = localStorage.getItem('sf_device_id');
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('sf_device_id', id); }
  return id;
}

export default function ReportAnythingButton() {
  const { t } = useLanguage();
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
    } catch { toast.error(t('reportUi.sendFailed'), { description: t('reportAnythingUi.retry') }); }
    finally { setBusy(false); }
  };
  return <>
    <button onClick={() => { setOpen(true); setDone(false); }} className="fixed bottom-5 right-5 z-[9000] rounded-full bg-slate-900 text-white px-4 py-3 shadow-lg flex items-center gap-2 text-sm"><Flag size={16}/> {t('reportAnythingUi.report')}</button>
    {open && <div className="fixed inset-0 z-[10000] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-md p-5 relative">
        <button onClick={() => setOpen(false)} className="absolute right-4 top-4" aria-label={t('common.close')}><X size={18}/></button>
        <h2 className="font-semibold text-lg mb-1">{t('reportAnythingUi.title')}</h2>
        <p className="text-sm text-slate-500 mb-4">{t('reportAnythingUi.description')}</p>
        {done ? <div className="py-8 text-center"><p className="font-medium">{t('reportUi.sent')}</p></div> :
        <form onSubmit={submit} className="space-y-3">
          <SmoothSelect value={form.category} onChange={category => setForm({ ...form, category })} ariaLabel={t('reportAnythingUi.category')} options={['bug','content','spam','map','security','other'].map(value => ({ value, label: t(`reportAnythingUi.${value}`) }))} />
          <input value={form.subject} maxLength={120} onChange={e=>setForm({...form,subject:e.target.value})} placeholder={t('reportAnythingUi.subject')} className="w-full border rounded-lg p-2 bg-transparent"/>
          <textarea value={form.message} maxLength={3000} onChange={e=>setForm({...form,message:e.target.value})} rows={5} placeholder={t('reportAnythingUi.message')} className="w-full border rounded-lg p-2 bg-transparent" required/>
          <p className="text-[11px] leading-4 text-slate-400">
            {t('reportUi.recaptchaStart')}{' '}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" className="underline">{t('reportUi.privacyPolicy')}</a>{' '}
            {t('common.and')}{' '}<a href="https://policies.google.com/terms" target="_blank" rel="noreferrer" className="underline">{t('reportUi.termsService')}</a>{' '}{t('reportUi.apply')}
          </p>
          <button disabled={busy} className="w-full bg-slate-900 text-white rounded-lg py-2.5 disabled:opacity-50">{t(busy ? 'reportUi.sending' : 'reportUi.send')}</button>
        </form>}
      </div>
    </div>}
  </>;
}
