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
// iOS Safari only unlocks audio from certain gestures (touchend/click, not
// always pointerdown), so all three try — cheap after the first success
['pointerdown', 'touchend', 'click'].forEach(type => {
  window.addEventListener(type, primeAudio, { passive: true });
});

// one delegated, document-level listener for the whole site rather than
// something each page has to wire up itself — document itself is never
// replaced by the router's per-navigation DOM swap (only #app's
// contents are), so this only ever needs attaching once, here, for the
// session's entire lifetime.
const HOVER_SOUND_SELECTOR = 'button:not(.is-locked):not(:disabled), a[href], [data-route], .play-item';
let lastHoverTarget = null;

// the game area itself (.play — board, pieces, lights, cells) gets no
// hover sounds: game pieces are buttons too, so sweeping across a board
// was a constant stream of blips competing with the actual correct/
// incorrect feedback. Everything around it (nav, menu, A7 logo, footer)
// still does, and so does the game-over screen (results-screen.js),
// which renders inside .play but isn't gameplay.
function isGameArea(el) {
  return !!el.closest('.play') && !el.closest('.results');
}

document.addEventListener('pointerover', e => {
  // touch has no real hover — a tap fires pointerover too, which would
  // play the hover blip on every tap
  if (e.pointerType !== 'mouse') return;
  const target = e.target.closest(HOVER_SOUND_SELECTOR);
  if (!target || target === lastHoverTarget || isGameArea(target)) return;
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
