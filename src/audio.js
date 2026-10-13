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

// Sound Effects volume levels — chosen on desktop by clicking the Sound
// Effects option, which cycles through these in order (chrome.js). Each
// value is the master volume every effect plays at; 'default' is the
// level the site has been tuned at.
export const SOUND_LEVELS = [
  { key: 'disabled', label: 'Disabled', volume: 0 },
  { key: 'very-low', label: 'Very Low', volume: 0.03 },
  { key: 'low', label: 'Low', volume: 0.06 },
  { key: 'default', label: 'Default', volume: 0.1 },
  { key: 'high', label: 'High', volume: 0.18 },
  { key: 'maximum', label: 'Maximum', volume: 0.3 },
];
const DEFAULT_LEVEL = SOUND_LEVELS.find(l => l.key === 'default');

const LEVEL_KEY = 'site-sound-effects-level';
// the old on/off toggle's key — an explicit "off" there carries over as
// Disabled instead of silently switching that visitor's sound back on
const LEGACY_KEY = 'site-sound-effects-enabled';

// phones/tablets never get Disabled — the mobile layout hides the Sound
// Effects option, so there'd be no way to turn it back on. Checked two
// ways: phone-width screens (same breakpoint as chrome.js's isDesktop()),
// AND any touch-only device whatever its width, since a phone in
// landscape or a tablet can be wider than that breakpoint.
function isSoundForcedOn() {
  return !window.matchMedia('(min-width: 769px)').matches
    || window.matchMedia('(hover: none) and (pointer: coarse)').matches;
}

export function getSoundLevel() {
  let level = null;
  try {
    const stored = localStorage.getItem(LEVEL_KEY);
    level = SOUND_LEVELS.find(l => l.key === stored) ?? null;
    if (!level && localStorage.getItem(LEGACY_KEY) === 'false') level = SOUND_LEVELS[0];
  } catch {}
  level ??= DEFAULT_LEVEL;
  if (level.volume === 0 && isSoundForcedOn()) return DEFAULT_LEVEL;
  return level;
}

export function setSoundLevel(key) {
  try { localStorage.setItem(LEVEL_KEY, key); } catch {}
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

// per-sound trims on top of the Sound Effects level (1 = unchanged) — the hover
// plays constantly, so it sits well under everything else
const SOUND_VOLUME = {
  hoverClickable: 0.3,
  menuButton: 0.35,
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

// { force: true } plays even with sound effects disabled (at the Default
// level) — only for the Sound Effects option's own "switched off"
// confirmation, which by definition happens right after sound went off
export function playSound(name, { force = false } = {}) {
  let { volume: levelVolume } = getSoundLevel();
  if (levelVolume === 0) {
    if (!force) return;
    levelVolume = DEFAULT_LEVEL.volume;
  }
  const buffer = buffers[name];
  if (!buffer) return; // not decoded yet — skip rather than queue/delay
  const context = getContext();
  masterGain.gain.value = levelVolume;
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
