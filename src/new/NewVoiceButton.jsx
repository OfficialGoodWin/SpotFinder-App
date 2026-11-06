import React from 'react';
import { Mic, Square } from 'lucide-react';
import './new-voice.css';
import { useLanguage } from '@/lib/LanguageContext';

export default function NewVoiceButton({ voice, field, label, className = '' }) {
  const { t } = useLanguage();
  const active = voice.listening && voice.field === field;
  return <button type="button" className={`sf-new-voice-button${active ? ' is-listening' : ''} ${className}`} aria-label={active ? t('newVoice.stop') : label} aria-pressed={active} onClick={active ? voice.stop : () => voice.start(field)}>{active ? <Square size={15} fill="currentColor" /> : <Mic size={19} />}</button>;
}

export function NewVoiceStatus({ voice, field }) {
  const { t } = useLanguage();
  if (voice.field !== field || !voice.listening && !voice.error) return null;
  return <span className={`sf-new-voice-status${voice.error ? ' is-error' : ''}`} role="status">{voice.error || t('newVoice.listening')}</span>;
}
