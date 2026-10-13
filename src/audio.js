// Shared sound-effects system. Web Audio API, not plain <audio>
// elements/new Audio() — several of these need to retrigger rapidly and
// overlap (the hover sound while sweeping across a dense grid, correct/
// incorrect taps in quick succession), and calling .play() again on a
// plain <audio> element restarts/cuts off whatever it's already playing
// instead of layering a new instance on top. Each sound is decoded into
// an AudioBuffer once; playing it just spins up a fresh
// AudioBufferSourceNode per trigger — those can overlap freely and are
// cleaned up by the browser on their own once they finish.
import adjustSettingUrl from './assets/sounds/adjust-setting.mp3?url';
import countdownUrl from './assets/sounds/countdown.mp3?url';
import correctAnswerUrl from './assets/sounds/correct-answer.mp3?url';
import hoverClickableUrl from './assets/sounds/hover-clickable.mp3?url';
import incorrectAnswerUrl from './assets/sounds/incorrect-answer.mp3?url';
import menuButtonUrl from './assets/sounds/menu-button.mp3?url';
import pressStartUrl from './assets/sounds/press-start.mp3?url';
import pressStartSpotItUrl from './assets/sounds/press-start-spot-it.mp3?url';
import settingOffUrl from './assets/sounds/setting-off.mp3?url';
import simon1Url from './assets/sounds/simon-1.mp3?url';
import simon2Url from './assets/sounds/simon-2.mp3?url';
import simon3Url from './assets/sounds/simon-3.mp3?url';
import simon4Url from './assets/sounds/simon-4.mp3?url';
import simon5Url from './assets/sounds/simon-5.mp3?url';
import simon6Url from './assets/sounds/simon-6.mp3?url';
import simon7Url from './assets/sounds/simon-7.mp3?url';
import simon8Url from './assets/sounds/simon-8.mp3?url';
import simon9Url from './assets/sounds/simon-9.mp3?url';
import soundOnUrl from './assets/sounds/sound-on.mp3?url';
import wantedUrl from './assets/sounds/wanted.mp3?url';

// reads the sound-enabled preference straight from localStorage rather
// than importing getSoundEnabled from chrome.js — chrome.js needs to
// call playSound() too (the Sound Effects toggle's own confirmation
// chime, the settings-adjusted chime), which would make that import
// circular. Same key chrome.js's own getSoundEnabled()/
// setSoundEnabled() read/write.
const SOUND_KEY = 'site-sound-effects-enabled';

// phones/tablets always have sound effects on, regardless of the stored
// preference — the mobile layout hides the Sound Effects toggle, so
// there'd be no way to turn it on. Checked two ways: phone-width screens
// (same breakpoint as chrome.js's isDesktop()), AND any touch-only device
// whatever its width, since a phone in landscape or a tablet can be wider
// than that breakpoint and would otherwise fall back to "disabled".
export function isSoundForcedOn() {
  return !window.matchMedia('(min-width: 769px)').matches
    || window.matchMedia('(hover: none) and (pointer: coarse)').matches;
}

function getSoundEnabled() {
  if (isSoundForcedOn()) return true;
  // on by default — only an explicit "off" from the desktop toggle
  // turns it off
  try {
    return localStorage.getItem(SOUND_KEY) !== 'false';
  } catch {
    return true;
  }
}

const SOUND_URLS = {
  adjustSetting: adjustSettingUrl,
  correctAnswer: correctAnswerUrl,
  countdown: countdownUrl,
  hoverClickable: hoverClickableUrl,
  incorrectAnswer: incorrectAnswerUrl,
  menuButton: menuButtonUrl,
  pressStart: pressStartUrl,
  pressStartSpotIt: pressStartSpotItUrl,
  settingOff: settingOffUrl,
  simon1: simon1Url,
  simon2: simon2Url,
  simon3: simon3Url,
  simon4: simon4Url,
  simon5: simon5Url,
  simon6: simon6Url,
  simon7: simon7Url,
  simon8: simon8Url,
  simon9: simon9Url,
  soundOn: soundOnUrl,
  wanted: wantedUrl,
};

// sounds that only ever play one at a time — a new trigger cuts off the
// previous instance instead of layering on top (sweeping across several
// buttons, or a retry restarting the countdown mid-play)
const EXCLUSIVE = new Set(['hoverClickable', 'countdown', 'wanted']);
const playing = {};

// master volume for every effect — the raw files are mixed loud, and
// these sit under constant hovering/clicking, so they're kept well back
const MASTER_VOLUME = 0.1;

// per-sound trims on top of MASTER_VOLUME (1 = unchanged) — the hover
// plays constantly, so it sits well under everything else
const SOUND_VOLUME = {
  hoverClickable: 0.3,
  pressStart: 0.6,
  pressStartSpotIt: 0.6,
  // Simon's keypad tones — gameplay feedback heard on every single tap
  // and every playback step, so kept soft
  simon1: 0.4,
  simon2: 0.4,
  simon3: 0.4,
  simon4: 0.4,
  simon5: 0.4,
  simon6: 0.4,
  simon7: 0.4,
  simon8: 0.4,
  simon9: 0.4,
};

let ctx = null;
let masterGain = null;
const buffers = {};
let loadPromise = null;

// most browsers refuse to let an AudioContext actually produce sound
// until it's created/resumed from inside a real user gesture — created
// lazily on the first one (see primeAudio) rather than at module load,
// which would otherwise start "suspended" and silently do nothing
function getContext() {
  if (!ctx) {
    // iOS: 'playback' plays even with the ringer/silent switch on (Safari's
    // default, 'ambient', is muted by it). Safari 16.4+; ignored elsewhere.
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = MASTER_VOLUME;
    masterGain.connect(ctx.destination);
  }
  // iOS also uses 'interrupted' (after a call, Siri, or switching apps)
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  return ctx;
}

function loadAll() {
  const context = getContext();
  return Promise.all(
    Object.entries(SOUND_URLS).map(([name, url]) =>
      fetch(url)
        .then(res => res.arrayBuffer())
        .then(data => context.decodeAudioData(data))
        .then(buffer => { buffers[name] = buffer; })
    )
  );
}

// call once, on the very first interaction anywhere on the site (see
// main.js) — creates the AudioContext AND kicks off decoding every
// sound up front, so by the time any real playSound() call happens
// later, the buffers are already there instead of each one waiting on
// its own fetch the first time it's needed
export function primeAudio() {
  getContext(); // resumes it too, if a browser re-suspended it
  if (!loadPromise) loadPromise = loadAll();
  return loadPromise;
}

// { force: true } plays even with sound effects disabled — only for the
// Sound Effects toggle's own "switched off" confirmation, which by
// definition happens right after sound was turned off
export function playSound(name, { force = false } = {}) {
  if (!force && !getSoundEnabled()) return;
  const buffer = buffers[name];
  if (!buffer) return; // not decoded yet — skip rather than queue/delay
  const context = getContext();
  const source = context.createBufferSource();
  source.buffer = buffer;
  const volume = SOUND_VOLUME[name] ?? 1;
  if (volume === 1) {
    source.connect(masterGain);
  } else {
    const gain = context.createGain();
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(masterGain);
  }
  if (EXCLUSIVE.has(name)) {
    try { playing[name]?.stop(); } catch {}
    playing[name] = source;
    source.onended = () => { if (playing[name] === source) delete playing[name]; };
  }
  source.start(0);
}
