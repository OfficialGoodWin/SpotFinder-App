/**
 * voiceService.js
 *
 * Offline-capable TTS for navigation instructions.
 *
 * Priority order:
 *   1. Capacitor native TTS — detected via window.Capacitor at runtime (no npm install).
 *      Works if @capacitor-community/text-to-speech is added to the Android project.
 *   2. Web Speech API — always available in Android WebView and desktop Chrome.
 *      Fully offline on Android (uses device TTS engine).
 *
 * No build-time imports of Capacitor plugins — safe to deploy on Vercel without
 * the plugin installed as a JS dependency.
 */

let _muted     = false;
let _lang      = 'en-US';
let _rate      = 0.95;
let _nativeTTS = null;
let _useNative = false;

// ── Init ──────────────────────────────────────────────────────────────────────

/**
 * Call once at app startup. Detects native Capacitor TTS availability.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export async function initVoice() {
  if (_nativeTTS !== null) return;

  try {
    // Capacitor exposes plugins via window.Capacitor.Plugins at runtime — no import needed
    const plugin = window?.Capacitor?.Plugins?.TextToSpeech;
    if (plugin && typeof plugin.speak === 'function') {
      await plugin.getSupportedLanguages?.();
      _nativeTTS = plugin;
      _useNative  = true;
      console.info('[voice] Using native Capacitor TTS');
    } else {
      throw new Error('plugin not present');
    }
  } catch (_) {
    _nativeTTS = null;
    _useNative  = false;
    console.info('[voice] Using Web Speech API');
  }
}

// ── Configuration ─────────────────────────────────────────────────────────────

/** Set BCP-47 language tag (e.g. 'cs-CZ', 'en-US'). Takes effect on next speak(). */
export function setVoiceLanguage(lang) {
  _lang = lang || 'en-US';
}

/** Set speech rate: 0.5 = slow, 1.0 = normal, 1.5 = fast. */
export function setVoiceRate(rate) {
  _rate = Math.max(0.1, Math.min(2.0, rate));
}

/**
 * Mute or unmute. When muted, speak() is silently ignored.
 * Calling setVoiceMuted(true) also stops any ongoing speech.
 */
export function setVoiceMuted(muted) {
  _muted = muted;
  if (muted) stopSpeaking();
}

export function isVoiceMuted() { return _muted; }

// ── Core functions ────────────────────────────────────────────────────────────

/**
 * Speak a string. Cancels any ongoing speech first.
 * Safe to call rapidly — always replaces the previous utterance.
 */
export async function speak(text) {
  if (_muted || !text?.trim()) return;

  // 1. Native Capacitor TTS (Android: best quality, best offline support)
  if (_useNative && _nativeTTS) {
    try {
      await _nativeTTS.stop?.();
      await _nativeTTS.speak({
        text:     text.trim(),
        lang:     _lang,
        rate:     _rate,
        pitch:    1.0,
        volume:   1.0,
        category: 'ambient',
      });
      return;
    } catch (e) {
      console.warn('[voice] Native TTS error, falling back:', e.message);
      _useNative = false;
    }
  }

  // 2. Web Speech API — works offline on Android WebView via device TTS engine
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

/** Stop any ongoing speech immediately. */
export async function stopSpeaking() {
  if (_useNative && _nativeTTS) {
    try { await _nativeTTS.stop?.(); } catch (_) {}
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

/** Returns true if speech is currently playing. */
export function isSpeaking() {
  return 'speechSynthesis' in window && window.speechSynthesis.speaking;
}