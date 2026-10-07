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
import correctAnswerUrl from './assets/sounds/correct-answer.mp3?url';
import hoverClickableUrl from './assets/sounds/hover-clickable.mp3?url';
import incorrectAnswerUrl from './assets/sounds/incorrect-answer.mp3?url';
import settingOffUrl from './assets/sounds/setting-off.mp3?url';
import soundOnUrl from './assets/sounds/sound-on.mp3?url';

// reads the sound-enabled preference straight from localStorage rather
// than importing getSoundEnabled from chrome.js — chrome.js needs to
// call playSound() too (the Sound Effects toggle's own confirmation
// chime, the settings-adjusted chime), which would make that import
// circular. Same key chrome.js's own getSoundEnabled()/
// setSoundEnabled() read/write.
const SOUND_KEY = 'site-sound-effects-enabled';

function getSoundEnabled() {
  return localStorage.getItem(SOUND_KEY) === 'true';
}

const SOUND_URLS = {
  adjustSetting: adjustSettingUrl,
  correctAnswer: correctAnswerUrl,
  hoverClickable: hoverClickableUrl,
  incorrectAnswer: incorrectAnswerUrl,
  settingOff: settingOffUrl,
  soundOn: soundOnUrl,
};

// master volume for every effect — the raw files are mixed loud, and
// these sit under constant hovering/clicking, so they're kept well back
const MASTER_VOLUME = 0.1;

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
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = MASTER_VOLUME;
    masterGain.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
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
  source.connect(masterGain);
  source.start(0);
}
