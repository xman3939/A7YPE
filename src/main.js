import './style.css';
import { render } from './router.js';
import { runIntro } from './loader.js';
import { primeAudio, playSound } from './audio.js';

window.addEventListener('DOMContentLoaded', () => {
  runIntro(() => render(location.pathname));
});

// most browsers won't let an AudioContext actually produce sound until
// it's created inside a real user gesture — primed on the very first
// one, whatever it is, rather than waiting for a specific button
window.addEventListener('pointerdown', primeAudio, { once: true });

// one delegated, document-level listener for the whole site rather than
// something each page has to wire up itself — document itself is never
// replaced by the router's per-navigation DOM swap (only #app's
// contents are), so this only ever needs attaching once, here, for the
// session's entire lifetime.
const HOVER_SOUND_SELECTOR = 'button:not(.is-locked):not(:disabled), a[href], [data-route], .play-item';
let lastHoverTarget = null;

// in-game screens (every /<game>/play page) get no hover sounds at all —
// game pieces are buttons too, so sweeping across a board was a constant
// stream of blips competing with the actual correct/incorrect feedback.
// The game-over screen (results-screen.js) lives on that same play page
// but isn't gameplay, so hover sounds come back once it's showing.
function isInGame() {
  return /(^|\s)page-[a-z-]+-play(\s|$)/.test(document.body.className)
    && !document.querySelector('.results');
}

document.addEventListener('pointerover', e => {
  if (isInGame()) return;
  const target = e.target.closest(HOVER_SOUND_SELECTOR);
  if (!target || target === lastHoverTarget) return;
  lastHoverTarget = target;
  playSound('hoverClickable');
});

document.addEventListener('pointerout', e => {
  // only actually left the hovered target once the pointer has moved to
  // somewhere outside it too — e.relatedTarget is null at the viewport's
  // own edge (moving the mouse off-screen), which should still count as
  // "left" rather than getting stuck remembering a stale target forever
  if (!lastHoverTarget) return;
  const related = e.relatedTarget;
  if (!related || !lastHoverTarget.contains(related)) {
    lastHoverTarget = null;
  }
});
