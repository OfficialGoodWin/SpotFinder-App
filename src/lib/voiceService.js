/**
 * voiceService.js
 *
 * Unified text-to-speech for navigation instructions.
 * Uses Capacitor's native TTS plugin when available (best quality, best offline support),
 * falls back to the Web Speech API (always present in Android WebView).
 *
 * Setup:
 *   npm install @capacitor-community/text-to-speech
 *   npx cap sync android
 *
 * Usage:
 *   import { speak, stopSpeaking, setLanguage, setMuted } from '@/lib/voiceService';
 *   speak('Turn left in 200 meters');
 */

let _capacitorTTS = null;
let _useCapacitor = false;
let _muted        = false;
let _lang         = 'en-US';
let _rate         = 0.95;

/**
 * Initialize the voice service.
 * Call once at app startup (or before first use).
 * Automatically detects Capacitor TTS availability.
 */
export async function initVoice() {
  try {
    // Dynamic import — doesn't crash if the plugin isn't installed
    const mod = await import('@capacitor-community/text-to-speech');
    _capacitorTTS = mod.TextToSpeech;

    // Quick smoke test: getSupportedLanguages should resolve if the plugin is wired up
    await _capacitorTTS.getSupportedLanguages();
    _useCapacitor = true;
    console.info('[voice] Using Capacitor TTS (native)');
  } catch (_) {
    _useCapacitor = false;
    console.info('[voice] Capacitor TTS unavailable, falling back to Web Speech API');
  }
}

/**
 * Set the BCP-47 language tag for speech (e.g. 'cs-CZ', 'en-US', 'de-DE').
 * Takes effect on the next speak() call.
 */
export function setVoiceLanguage(lang) {
  _lang = lang || 'en-US';
}

/**
 * Set speech rate (0.5 = slow, 1.0 = normal, 1.5 = fast).
 */
export function setVoiceRate(rate) {
  _rate = Math.max(0.1, Math.min(2.0, rate));
}

/**
 * Mute or unmute voice output.
 * When muted, speak() calls are silently ignored.
 */
export function setVoiceMuted(muted) {
  _muted = muted;
  if (muted) stopSpeaking();
}

export function isVoiceMuted() { return _muted; }

/**
 * Speak a string aloud. Cancels any currently playing speech first.
 * Safe to call rapidly — always cancels the previous utterance.
 */
export async function speak(text) {
  if (_muted || !text?.trim()) return;

  if (_useCapacitor && _capacitorTTS) {
    try {
      await _capacitorTTS.stop();
      await _capacitorTTS.speak({
        text:  text.trim(),
        lang:  _lang,
        rate:  _rate,
        pitch: 1.0,
        volume: 1.0,
        category: 'ambient', // doesn't interrupt music/calls
      });
      return;
    } catch (e) {
      console.warn('[voice] Capacitor TTS error, falling back:', e.message);
      _useCapacitor = false;
    }
  }

  // Web Speech API fallback
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utt  = new SpeechSynthesisUtterance(text.trim());
    utt.lang   = _lang;
    utt.rate   = _rate;
    utt.pitch  = 1.0;
    utt.volume = 1.0;
    window.speechSynthesis.speak(utt);
  }
}

/**
 * Immediately stop any ongoing speech.
 */
export async function stopSpeaking() {
  if (_useCapacitor && _capacitorTTS) {
    try { await _capacitorTTS.stop(); } catch (_) {}
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Returns true if speech is currently playing.
 */
export function isSpeaking() {
  if ('speechSynthesis' in window) return window.speechSynthesis.speaking;
  return false;
}

/**
 * Returns list of available language codes (best-effort, may be empty on some devices).
 */
export async function getSupportedLanguages() {
  if (_useCapacitor && _capacitorTTS) {
    try {
      const { languages } = await _capacitorTTS.getSupportedLanguages();
      return languages;
    } catch (_) {}
  }
  // Web Speech API
  if ('speechSynthesis' in window) {
    return window.speechSynthesis.getVoices().map(v => v.lang);
  }
  return [];
}
