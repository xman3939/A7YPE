import { customEase } from './ease.js';
import { fragmentElement, runReveal, runUnreveal } from './text-reveal.js';

// a quicker version of the site's usual WAVE stagger — same cascading
// feel, just compressed, since this swaps every ~1.3s and a full-length
// reveal would still be running when the next message wants to start
const QUICK_WAVE_IN = { burstCount: 10, burstGap: 20, chunkGap: 8 };
// even snappier for the way out — a quick stagger-out reads as a beat,
// not a lingering fade
const QUICK_WAVE_OUT = { burstCount: 10, burstGap: 12, chunkGap: 6 };
// the one exception — right as the loader's about to swipe away for
// good, the final message gets a slow, deliberate stagger-out instead
// of the quick in-between-message one
const SLOW_WAVE_OUT = { burstCount: 8, burstGap: 50, chunkGap: 18 };

const COUNT_DURATION = 6000;
const HOLD_MS = 250;
const BAR_LEAVE_MS = 800;
const SWIPE_MS = 450;
const FADE_MS = 400;

// just an experiment — one line, bottom right, that swaps through this
// list. Every message does the same quick character-wave stagger reveal.
const LOADER_MESSAGES = [
  'Initializing glyphs',
  'Jumbling compositions',
  'A7YPE loading',
];
const MESSAGE_START_DELAY = 400;
// how long a message sits fully up before swapping to the next one —
// the last message (A7YPE loading) skips this and just stays
const MESSAGE_HOLD_MS = 1250;

// Pages with their own entrance swipe already built in — landing here
// directly (refresh/deep link) should skip the loader's own cover-swipe
// rather than showing a second, redundant one right before the page's own.
const OWN_REVEAL_ROUTES = new Set(['/exclaim/play']);

export function runIntro(onReady) {
  document.title = '...';
  const skipCoverSwipe = OWN_REVEAL_ROUTES.has(location.pathname);

  const loader = document.createElement('div');
  loader.className = 'loader';
  loader.innerHTML = `
    <div class="loader-bar-track">
      <div class="loader-bar-fill"></div>
    </div>
    <p class="loader-message">
      <span class="loader-message-text"></span><span class="loader-dots"><span class="loader-dot">.</span><span class="loader-dot">.</span><span class="loader-dot">.</span></span>
    </p>
  `;

  // The dots run on their own continuous CSS loop, independent of the
  // text — except during a swap, where they drop out instantly right as
  // the text's own quick stagger-out begins, then both come back
  // together once the next message starts its stagger-in.
  const messageText = loader.querySelector('.loader-message-text');
  const messageDots = loader.querySelector('.loader-dots');

  function playMessage(index) {
    messageText.textContent = `>${LOADER_MESSAGES[index]}`;
    fragmentElement(messageText);
    runReveal(messageText, QUICK_WAVE_IN);
    messageDots.classList.add('is-visible');

    if (index === LOADER_MESSAGES.length - 1) return;

    setTimeout(() => {
      messageDots.classList.remove('is-visible');
      runUnreveal(messageText, QUICK_WAVE_OUT, () => playMessage(index + 1));
    }, MESSAGE_HOLD_MS);
  }

  setTimeout(() => playMessage(0), MESSAGE_START_DELAY);

  const cover = document.createElement('div');
  cover.className = 'loader-cover';

  document.body.append(loader, cover);

  // iOS Safari sometimes doesn't repaint a dvh-sized fixed element in
  // sync with its own toolbar settling in right on first load, leaving
  // a stale gap of the page's background exposed along the bottom edge
  // for a beat — pin the height from the live viewport in px instead of
  // trusting CSS dvh to repaint promptly for this specific
  // always-visible-on-load element. The CSS dvh fallback still covers
  // browsers with no visualViewport/resize support.
  function syncViewportHeight() {
    const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    loader.style.height = `${h}px`;
    cover.style.height = `${h}px`;
  }
  syncViewportHeight();
  window.addEventListener('resize', syncViewportHeight);
  window.visualViewport?.addEventListener('resize', syncViewportHeight);

  function stopViewportSync() {
    window.removeEventListener('resize', syncViewportHeight);
    window.visualViewport?.removeEventListener('resize', syncViewportHeight);
  }

  const barTrack = loader.querySelector('.loader-bar-track');
  const barFill = loader.querySelector('.loader-bar-fill');

  const startTime = performance.now();

  function frame(now) {
    const t = Math.min((now - startTime) / COUNT_DURATION, 1);
    const eased = customEase(t);
    barFill.style.width = `${eased * 100}%`;

    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      // fire the final stagger-out right as the bar hits 100%, rather
      // than waiting through the HOLD_MS pause below — it's already
      // slow enough on its own, no need to delay the start of it too
      messageDots.classList.add('is-leaving');
      messageDots.classList.remove('is-visible');
      runUnreveal(messageText, SLOW_WAVE_OUT);

      setTimeout(finish, HOLD_MS);
    }
  }

  requestAnimationFrame(frame);

  function finish() {
    barTrack.classList.add('is-leaving');

    setTimeout(() => {
      if (skipCoverSwipe) {
        // keep the loader in place while the new page mounts and runs its
        // own swipe underneath. Its own swipe (.play-cover, 450ms) finishes
        // before this loader is removed (SWIPE_MS+50 below), so by the time
        // the loader disappears the page's own bg is already fully revealed
        // — same color as this loader (both this and the play pages' bg
        // are orange), so removing it is a seamless no-op, not a flash
        stopViewportSync();
        cover.remove();
        onReady();
        setTimeout(() => loader.remove(), SWIPE_MS + 50);
        return;
      }

      cover.classList.add('is-up');

      setTimeout(async () => {
        stopViewportSync();
        loader.remove();
        // onReady (render()) is async — it fetches the page's module and
        // its own imports before body.className/app.innerHTML are set. If
        // the cover starts fading before that's done, whatever body's
        // background was BEFORE the new page's class landed (the site
        // default, white) is what's briefly visible underneath — awaiting
        // it here means the black cover only ever fades onto the new
        // page's own already-correct (black) background, never a flash of
        // the wrong one. The gap is normally too short to notice on
        // localhost, but real network latency (a phone hitting the dev
        // server over LAN) makes it easy to see.
        await onReady();

        requestAnimationFrame(() => {
          cover.classList.add('is-hidden');
          setTimeout(() => cover.remove(), FADE_MS);
        });
      }, SWIPE_MS);
    }, BAR_LEAVE_MS);
  }
}
