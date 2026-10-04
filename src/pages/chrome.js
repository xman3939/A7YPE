import { fragmentElement, runReveal, WAVE, WAVE_SHORT } from '../text-reveal.js';

const menuItems = [
  { label: 'A7', path: '/' },
  { label: '( ! )', path: '/exclaim' },
  { label: '( ? )', path: '/question' },
  { label: '( = )', path: '/equals' },
  { label: '( # )', path: '/hashtag' },
];

const MENU_ITEM_START = 200;
const MENU_ITEM_GAP = 120;

// Sound Effects/Music have no real system behind them at all yet — no
// audio exists to enable/disable, so unlike Fullscreen/Cursor (real,
// working toggles) these are locked to Disabled and non-clickable for
// now, with the hover line explaining why rather than just repeating
// "Disabled" back. Once an actual sound system exists, this goes back
// to a real toggle — not deleting the localStorage plumbing below since
// it'll be exactly what that flip needs.
const SOUND_KEY = 'site-sound-effects-enabled';
const MUSIC_KEY = 'site-music-enabled';

function getSoundEnabled() {
  const stored = localStorage.getItem(SOUND_KEY);
  return stored === null ? false : stored === 'true';
}

function setSoundEnabled(value) {
  localStorage.setItem(SOUND_KEY, String(value));
}

function getMusicEnabled() {
  const stored = localStorage.getItem(MUSIC_KEY);
  return stored === null ? false : stored === 'true';
}

function setMusicEnabled(value) {
  localStorage.setItem(MUSIC_KEY, String(value));
}

function isFullscreenActive() {
  return !!document.fullscreenElement;
}

// a real toggle, same as Fullscreen — swaps body's cursor between the
// site's custom crosshair (CSS, body's own rule) and the system's
// standard arrow. Applied as an inline style rather than a class: body's
// className gets fully overwritten on every navigation (see router.js),
// which would silently wipe a class-based toggle, but an inline style
// attribute isn't touched by that at all.
const CURSOR_KEY = 'site-cursor-style';

function getCursorStyle() {
  return localStorage.getItem(CURSOR_KEY) === 'arrow' ? 'arrow' : 'crosshair';
}

function setCursorStyle(value) {
  localStorage.setItem(CURSOR_KEY, value);
  applyCursorStyle();
}

function applyCursorStyle() {
  document.body.style.cursor = getCursorStyle() === 'arrow' ? 'default' : '';
}

// document itself never gets replaced on navigation the way the chrome's
// own DOM nodes do (a fresh initChrome() call just re-queries new button
// elements, naturally orphaning any listeners on the old ones) — a
// document-level listener has to be explicitly swapped out instead, or
// every navigation would pile on another one for the session's lifetime
let fullscreenChangeHandler = null;

// Desktop is a single-page shell — the nav/footer never actually change
// between pages, so on desktop we skip re-fading/re-animating them on every
// navigation (see initChrome's `instant` option) to show that off instead
// of pretending each page is a fresh load. Mobile keeps the full entrance.
export function isDesktop() {
  return window.matchMedia('(min-width: 769px)').matches;
}

// hoverText defaults to text (every existing call site just sees the
// same line slide up to reveal an identical copy) — passing a different
// hoverText lets a specific roll show something else on hover instead,
// e.g. Sound Effects/Music revealing "Currently Unavailable" rather than
// just repeating "Disabled".
export function roll(text, hoverText = text) {
  return `<span class="roll"><span class="roll-inner"><span class="roll-line">${text}</span><span class="roll-line" aria-hidden="true">${hoverText}</span></span></span>`;
}

// footerHTML lets a page (currently only /info) swap out the standard
// footer entirely instead of reshuffling .infobar's own contents — /info's
// footer looks nothing like the shared one (different columns, different
// bg), so forcing it through the same markup would mean fighting that
// markup's assumptions rather than just writing its own.
export function renderChrome(innerHTML, footerHTML) {
  return `
    <div class="frame">
      <div class="topbar-sticky">
        <header class="topbar">
          <button type="button" class="icon-btn logo-btn" data-route="/" aria-label="Home">${roll('A7')}</button>
          <div class="topbar-actions">
            ${menuItems.slice(1).map(item => `<button type="button" class="topbar-action-btn" data-route="${item.path}">${roll(item.label)}</button>`).join('')}
          </div>
          <button type="button" class="icon-btn icon-menu" data-action="menu" aria-label="Menu">${roll('Menu')}</button>
        </header>
        <div class="topbar-rule"></div>
      </div>

      ${innerHTML}

      ${footerHTML ?? `
        <footer class="infobar">
          <div class="options-row">
            <button type="button" class="option option--toggle is-locked" data-option="sound" aria-disabled="true" title="Currently unavailable"><span class="option-label">${roll('Sound Effects:')}</span><span class="option-value">${roll('Disabled')}</span></button>
            <button type="button" class="option option--toggle is-locked" data-option="music" aria-disabled="true" title="Currently unavailable"><span class="option-label">${roll('Music:')}</span><span class="option-value">${roll('Disabled')}</span></button>
            <button type="button" class="option option--toggle" data-option="fullscreen"><span class="option-label">${roll('Fullscreen:')}</span><span class="option-value">${roll(isFullscreenActive() ? 'Enabled' : 'Disabled')}</span></button>
            <button type="button" class="option option--toggle" data-option="cursor"><span class="option-label">${roll('Cursor:')}</span><span class="option-value">${roll(getCursorStyle() === 'arrow' ? 'Arrow' : 'Crosshair')}</span></button>
          </div>
          <div class="footer-rule"></div>
          <div class="footer-row">
            <p class="filler">Build by Xavier Kania, 2026</p>
            <div class="footer-links">
              <button type="button" class="footer-link" data-route="/info">${roll('&rarr;Information')}</button>
              <a class="footer-link" href="https://xavierkania.com" target="_blank" rel="noopener">${roll('&rarr;Portfolio')}</a>
              <a class="footer-link" href="https://xavierkania.com/contact" target="_blank" rel="noopener">${roll('&rarr;Contact')}</a>
            </div>
          </div>
        </footer>
      `}

      <div class="menu-blur" data-menu-blur></div>
      <div class="menu-overlay" data-menu hidden>
        <div class="menu-topbar">
          <button type="button" class="icon-btn menu-close" data-action="close-menu" aria-label="Close menu">${roll('( x )')}</button>
        </div>
        <ul class="menu-list">
          ${menuItems.map(item => `
            <li class="menu-item" data-route="${item.path}">
              <span class="menu-item-dot"></span>
              <span class="menu-item-label">${item.label}</span>
            </li>
          `).join('')}
        </ul>
        <p class="menu-footer"><span class="menu-item-dot"></span><span>Build by Xavier Kania, 2026</span></p>
      </div>
    </div>
  `;
}

// A route counts as "current" for its own sub-paths too (e.g. "/exclaim/play"
// should still highlight the "( ! )" nav entry for "/exclaim"), not just an
// exact pathname match.
function isRouteCurrent(route) {
  if (!route) return false;
  return location.pathname === route || location.pathname.startsWith(`${route}/`);
}

export function initChrome({ instant = false } = {}) {
  const overlay = document.querySelector('[data-menu]');
  const blur = document.querySelector('[data-menu-blur]');
  const openBtn = document.querySelector('.icon-menu');
  const closeBtn = document.querySelector('.menu-close');
  const items = document.querySelectorAll('.menu-item');
  const logoBtn = document.querySelector('.logo-btn');
  const actionBtns = document.querySelectorAll('.topbar-action-btn');
  const footerRule = document.querySelector('.footer-rule');
  const options = document.querySelectorAll('.option');
  const filler = document.querySelector('.filler');
  const links = document.querySelectorAll('.footer-link');

  if (logoBtn) fragmentElement(logoBtn.querySelector('.roll-line'));
  if (openBtn) fragmentElement(openBtn.querySelector('.roll-line'));
  actionBtns.forEach(btn => {
    fragmentElement(btn.querySelector('.roll-line'));
    btn.classList.toggle('is-current', isRouteCurrent(btn.dataset.route));
  });
  // every option's label+value is wrapped in roll() (the same hover-roll
  // every other clickable label on the site uses) — querySelector just
  // falls back to the plain element if a given option ever isn't
  // roll-wrapped, matching the pattern links/actionBtns use above.
  options.forEach(option => {
    const label = option.querySelector('.option-label');
    const value = option.querySelector('.option-value');
    fragmentElement(label?.querySelector('.roll-line') ?? label);
    fragmentElement(value?.querySelector('.roll-line') ?? value);
  });
  if (filler) fragmentElement(filler);

  // updates BOTH of .option-value's roll-lines (the visible one and its
  // aria-hidden hover duplicate) — leaving the duplicate on stale text
  // would make the hover-roll reveal the WRONG value for a moment
  function setOptionValueText(option, text) {
    option?.querySelectorAll('.option-value .roll-line').forEach(line => {
      line.textContent = text;
    });
  }

  // Sound Effects/Music are locked to Disabled right now (no real audio
  // system to toggle yet) — deliberately no click listener at all, so
  // they're inert; the hover still works (see roll()'s hoverText above),
  // just doesn't lead anywhere.

  const fullscreenOption = document.querySelector('[data-option="fullscreen"]');
  function updateFullscreenValue() {
    setOptionValueText(fullscreenOption, isFullscreenActive() ? 'Enabled' : 'Disabled');
  }
  fullscreenOption?.addEventListener('click', () => {
    // the actual transition is async (and can fail — some browsers refuse
    // it outside a direct user gesture, or if already mid-transition) —
    // updateFullscreenValue() via the fullscreenchange listener below is
    // the real source of truth, not an optimistic update here
    if (isFullscreenActive()) {
      document.exitFullscreen?.().catch(() => {});
    } else {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
  });
  if (fullscreenChangeHandler) document.removeEventListener('fullscreenchange', fullscreenChangeHandler);
  fullscreenChangeHandler = updateFullscreenValue;
  document.addEventListener('fullscreenchange', fullscreenChangeHandler);

  // re-applied on every chrome init, not just on click — it's an inline
  // style so it isn't wiped by router.js's body.className reassignment,
  // but a fresh page load (or a route that skips chrome) could still
  // land on a body that never got it applied this session
  applyCursorStyle();
  const cursorOption = document.querySelector('[data-option="cursor"]');
  cursorOption?.addEventListener('click', () => {
    setCursorStyle(getCursorStyle() === 'arrow' ? 'crosshair' : 'arrow');
    setOptionValueText(cursorOption, getCursorStyle() === 'arrow' ? 'Arrow' : 'Crosshair');
  });

  links.forEach(link => fragmentElement(link.querySelector('.roll-line')));

  items.forEach(item => {
    item.classList.toggle('is-current', isRouteCurrent(item.dataset.route));
    item.addEventListener('click', closeMenu);
  });

  function alignMenuClose() {
    if (!closeBtn) return;
    closeBtn.style.transform = 'translateY(0)';
    const firstLabel = items[0]?.querySelector('.menu-item-label');
    if (!firstLabel) return;
    const labelRect = firstLabel.getBoundingClientRect();
    const closeRect = closeBtn.getBoundingClientRect();
    const delta = (labelRect.top + labelRect.height / 2) - (closeRect.top + closeRect.height / 2);
    closeBtn.style.transform = `translateY(${delta}px)`;
  }

  function openMenu() {
    overlay.hidden = false;
    requestAnimationFrame(() => {
      overlay.classList.add('is-open');
      blur.classList.add('is-active');
      alignMenuClose();
    });
    items.forEach((item, i) => {
      setTimeout(() => {
        item.classList.add('is-visible');
      }, MENU_ITEM_START + i * MENU_ITEM_GAP);
    });
  }

  function closeMenu() {
    overlay.classList.remove('is-open');
    blur.classList.remove('is-active');
    setTimeout(() => {
      overlay.hidden = true;
      items.forEach(item => item.classList.remove('is-visible'));
    }, 380);
  }

  openBtn?.addEventListener('click', openMenu);
  closeBtn?.addEventListener('click', closeMenu);

  return {
    revealNav() {
      if (instant) {
        // desktop: nav never actually changes between pages, so it should
        // never visibly animate either — is-instant kills the reveal-chunk
        // transition so is-visible snaps straight to its end state instead
        // of fading in like a fresh entrance would
        document.querySelectorAll('.topbar .reveal-chunk').forEach(c => c.classList.add('is-instant', 'is-visible'));
        return;
      }
      if (logoBtn) runReveal(logoBtn, WAVE);
      if (openBtn) runReveal(openBtn, WAVE);
      if (actionBtns.length) runReveal('.topbar-actions', WAVE);
    },
    teaseLogo() {
      logoBtn?.classList.add('tease');
    },
    drawFooterRule() {
      if (instant) {
        footerRule?.classList.add('is-instant', 'is-drawn');
        return;
      }
      footerRule?.classList.add('is-drawn');
    },
    revealFooter() {
      if (instant) {
        document.querySelectorAll('.infobar .reveal-chunk').forEach(c => c.classList.add('is-instant', 'is-visible'));
        return;
      }
      if (options.length) runReveal('.options-row', WAVE);
      if (filler) runReveal(filler, WAVE);
      links.forEach(link => runReveal(link, WAVE_SHORT));
    }
  };
}
