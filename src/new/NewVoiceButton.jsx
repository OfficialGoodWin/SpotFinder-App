import React from 'react';
import { Mic, Square } from 'lucide-react';
import './new-voice.css';

export default function NewVoiceButton({ voice, field, label, className = '' }) {
  const active = voice.listening && voice.field === field;
  return <button type="button" className={`sf-new-voice-button${active ? ' is-listening' : ''} ${className}`} aria-label={active ? 'Zastavit rozpoznávání řeči' : label} aria-pressed={active} onClick={active ? voice.stop : () => voice.start(field)}>{active ? <Square size={15} fill="currentColor" /> : <Mic size={19} />}</button>;
}

export function NewVoiceStatus({ voice, field }) {
  if (voice.field !== field || !voice.listening && !voice.error) return null;
  return <span className={`sf-new-voice-status${voice.error ? ' is-error' : ''}`} role="status">{voice.error || 'Poslouchám… mluv do mikrofonu'}</span>;
}
