import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { inspectImageFile, MAX_PREPARED_EDGE, prepareImageFile } from '@/lib/imagePreparation';
import { useLanguage } from '@/lib/LanguageContext';

const mb = bytes => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export default function ImagePreparationDialog({ file, onConfirm, onCancel }) {
  const { t } = useLanguage();
  const [info, setInfo] = useState(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [result, setResult] = useState(null);
  const [resultUrl, setResultUrl] = useState('');
  const [mode, setMode] = useState('resize');
  const [edge, setEdge] = useState(3072);
  const [crop, setCrop] = useState({ x: 0, y: 0, width: 100, height: 100 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let url = '';
    inspectImageFile(file).then(async value => {
      if (!active) return;
      const previewFile = value.needsPreparation
        ? (await prepareImageFile(file, { info: value, mode: 'resize', maxEdge: 1600 })).file : file;
      url = URL.createObjectURL(previewFile);
      if (active) { setInfo(value); setMode(value.needsPreparation ? 'resize' : 'full'); setSourceUrl(url); }
      else URL.revokeObjectURL(url);
    })
      .catch(cause => { if (active) { setError(cause.message); toast.error(cause.message); } });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [file]);
  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);
  const clearResult = () => { setResult(null); setResultUrl(''); };

  const change = (field, value) => {
    clearResult();
    setCrop(current => {
      const next = { ...current, [field]: Number(value) };
      next.width = Math.min(next.width, 100 - next.x);
      next.height = Math.min(next.height, 100 - next.y);
      return next;
    });
  };
  const reset = () => {
    setMode(info?.needsPreparation ? 'resize' : 'full');
    setEdge(3072);
    setCrop({ x: 0, y: 0, width: 100, height: 100 });
    clearResult();
    setError('');
  };
  const makePreview = async () => {
    if (!info) return;
    setBusy(true);
    setError('');
    try {
      const prepared = await prepareImageFile(file, {
        info, mode, maxEdge: edge,
        crop: { x: crop.x / 100, y: crop.y / 100, width: crop.width / 100, height: crop.height / 100 },
      });
      setResult(prepared);
      setResultUrl(URL.createObjectURL(prepared.file));
    } catch (cause) {
      setError(cause.message);
      toast.error(cause.message);
    } finally { setBusy(false); }
  };
  const confirm = async () => {
    if (!result || busy) return;
    setBusy(true);
    setError('');
    try { await onConfirm(result.file); }
    catch (cause) { setError(cause.message || t('imagePrep.uploadInterrupted')); toast.error(cause.message || t('imagePrep.uploadInterrupted')); }
    finally { setBusy(false); }
  };
  const fullAllowed = Boolean(info && Math.max(info.width, info.height) <= MAX_PREPARED_EDGE && info.width * info.height <= 16_000_000);

  return (
    <div className="fixed inset-0 z-[3100] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={t('imagePrep.title')}>
      <div className="sf-sheet flex max-h-[94dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-background shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-bold text-foreground">{t('imagePrep.title')}</h2>
          <button type="button" onClick={onCancel} disabled={busy} className="min-h-11 rounded-xl px-3 text-sm text-foreground">{t('common.cancel')}</button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <p className="text-sm text-muted-foreground">{info ? `${info.width} × ${info.height} · ${mb(file.size)} · ${info.type}` : t('imagePrep.checking')}</p>
          <div className="relative flex min-h-36 max-h-[32dvh] justify-center overflow-hidden rounded-xl bg-black/90">
            <div className="relative inline-flex max-h-[32dvh] max-w-full">
              {sourceUrl && <img src={sourceUrl} alt={t('imagePrep.sourcePreview')} className="max-h-[32dvh] max-w-full object-contain" />}
              {mode === 'crop' && <div className="pointer-events-none absolute border-2 border-white shadow-[0_0_0_999px_rgba(0,0,0,0.3)]" style={{ left: `${crop.x}%`, top: `${crop.y}%`, width: `${crop.width}%`, height: `${crop.height}%` }} />}
            </div>
          </div>
          {info && <fieldset className="space-y-2 text-sm text-foreground">
            <legend className="mb-2 font-semibold">{t('imagePrep.question')}</legend>
            <label className="flex min-h-11 items-center gap-2"><input type="radio" name="image-mode" value="full" checked={mode === 'full'} disabled={!fullAllowed} onChange={() => { setMode('full'); clearResult(); }} /> {t('imagePrep.full')}{!fullAllowed && ` ${t('imagePrep.requiresResize')}`}</label>
            <label className="flex min-h-11 items-center gap-2"><input type="radio" name="image-mode" value="resize" checked={mode === 'resize'} onChange={() => { setMode('resize'); clearResult(); }} /> {t('imagePrep.resize')}</label>
            <label className="flex min-h-11 items-center gap-2"><input type="radio" name="image-mode" value="crop" checked={mode === 'crop'} onChange={() => { setMode('crop'); clearResult(); }} /> {t('imagePrep.crop')}</label>
          </fieldset>}
          {(mode === 'resize' || mode === 'crop') && <label className="block text-sm font-medium text-foreground">{t('imagePrep.longestSide')}
            <select value={edge} onChange={event => { setEdge(Number(event.target.value)); clearResult(); }} className="mt-1 block min-h-11 w-full rounded-xl border border-border bg-background px-3">
              {[1600, 2048, 3072, 4096].map(value => <option key={value} value={value}>{t('imagePrep.maxPixels', { value })}</option>)}
            </select>
          </label>}
          {mode === 'crop' && <div className="grid grid-cols-2 gap-3">
            {[
              ['x', t('imagePrep.left'), 100 - crop.width], ['y', t('imagePrep.top'), 100 - crop.height],
              ['width', t('imagePrep.width'), 100 - crop.x], ['height', t('imagePrep.height'), 100 - crop.y],
            ].map(([field, label, max]) => <label key={field} className="text-xs font-medium text-foreground">{label}: {crop[field]}%
              <input type="range" min={field === 'width' || field === 'height' ? 10 : 0} max={max} value={crop[field]} onChange={event => change(field, event.target.value)} className="mt-2 w-full" />
            </label>)}
          </div>}
          {result && <div className="rounded-xl border border-border p-3">
            <img src={resultUrl} alt={t('imagePrep.resultPreview')} className="max-h-48 w-full object-contain" />
            <p className="mt-2 text-sm font-medium text-foreground">{t('imagePrep.ready')}: {result.width} × {result.height} · {mb(result.bytes)}</p>
          </div>}
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-200">{error}</p>}
          <p className="text-xs text-muted-foreground">{t('imagePrep.privacy')}</p>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border px-5 pt-3" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <button type="button" onClick={reset} disabled={busy} className="min-h-11 rounded-xl border border-border px-4 text-sm">{t('imagePrep.reset')}</button>
          <button type="button" onClick={makePreview} disabled={busy || !info} className="min-h-11 rounded-xl border border-border px-4 text-sm">{busy ? t('imagePrep.preparing') : t('imagePrep.preview')}</button>
          <button type="button" onClick={confirm} disabled={busy || !result} className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">{t('imagePrep.usePhoto')}</button>
        </div>
      </div>
    </div>
  );
}
