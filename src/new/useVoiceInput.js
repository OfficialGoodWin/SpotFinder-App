import { useCallback, useEffect, useRef, useState } from 'react';

let activeSession = null;

const speechLanguage = language => {
  const selected = String(language || 'cs').replace('_', '-');
  if (/^[a-z]{2}-[a-z]{2}$/i.test(selected)) return selected.slice(0, 3).toLowerCase() + selected.slice(3).toUpperCase();
  return { cs: 'cs-CZ', sk: 'sk-SK', en: 'en-US', de: 'de-DE', pl: 'pl-PL' }[selected.toLowerCase()] || selected;
};

function speechError(code) {
  if (['not-allowed', 'service-not-allowed', 'NotAllowedError', 'SecurityError'].includes(code)) return 'Přístup k mikrofonu byl zamítnut. Povol ho v nastavení prohlížeče nebo piš ručně.';
  if (['audio-capture', 'NotFoundError', 'DevicesNotFoundError'].includes(code)) return 'Mikrofon není dostupný. Připoj ho nebo piš ručně.';
  if (code === 'no-speech') return 'Nebyla rozpoznána žádná řeč. Zkus to znovu nebo piš ručně.';
  if (code === 'network') return 'Rozpoznávání řeči se nepodařilo připojit. Zkontroluj síť nebo piš ručně.';
  if (code === 'aborted') return '';
  return 'Rozpoznávání řeči se nezdařilo. Zkus to znovu nebo piš ručně.';
}

export function appendSpeechText(previous, transcript, maxLength = Infinity) {
  const text = transcript.trim();
  if (!text) return previous;
  return `${previous.trimEnd()}${previous.trim() ? ' ' : ''}${text}`.slice(0, maxLength);
}

export function useVoiceInput(language, onTranscript) {
  const [state, setState] = useState({ field: '', listening: false, error: '' });
  const recognitionRef = useRef(null);
  const callbackRef = useRef(onTranscript);
  callbackRef.current = onTranscript;

  const stop = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    recognitionRef.current = null;
    if (activeSession?.recognition === recognition) activeSession = null;
    recognition.abort();
    setState(current => ({ ...current, field: '', listening: false, error: '' }));
  }, []);

  useEffect(() => () => {
    const recognition = recognitionRef.current;
    if (recognition) {
      recognitionRef.current = null;
      if (activeSession?.recognition === recognition) activeSession = null;
      recognition.abort();
    }
  }, []);

  const start = useCallback(field => {
    const Recognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
    if (!Recognition) {
      setState({ field, listening: false, error: 'Hlasové zadávání tento prohlížeč nepodporuje. Text můžeš zadat klávesnicí.' });
      return;
    }
    if (activeSession) activeSession.stop();
    let recognition;
    try { recognition = new Recognition(); }
    catch (error) { setState({ field, listening: false, error: speechError(error?.name) }); return; }
    recognitionRef.current = recognition;
    activeSession = { recognition, stop };
    recognition.lang = speechLanguage(language);
    recognition.interimResults = false;
    recognition.continuous = false;
    let received = false;
    let failed = false;
    const handled = new Set();
    recognition.onstart = () => {
      if (recognitionRef.current === recognition) setState({ field, listening: true, error: '' });
    };
    recognition.onresult = event => {
      if (recognitionRef.current !== recognition) return;
      for (let index = event.resultIndex || 0; index < event.results.length; index += 1) {
        if (handled.has(index) || !event.results[index].isFinal) continue;
        handled.add(index);
        const transcript = event.results[index][0]?.transcript?.trim();
        if (transcript) { received = true; callbackRef.current(field, transcript); }
      }
    };
    recognition.onerror = event => {
      if (recognitionRef.current !== recognition) return;
      failed = true;
      setState({ field, listening: false, error: speechError(event.error) });
    };
    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      recognitionRef.current = null;
      if (activeSession?.recognition === recognition) activeSession = null;
      setState(current => ({ field, listening: false, error: current.error || (!received && !failed ? speechError('no-speech') : '') }));
    };
    try { recognition.start(); }
    catch (error) {
      recognitionRef.current = null;
      if (activeSession?.recognition === recognition) activeSession = null;
      setState({ field, listening: false, error: speechError(error?.name) });
    }
  }, [language, stop]);

  return { ...state, start, stop };
}
