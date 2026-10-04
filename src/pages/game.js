import { renderChrome, initChrome, roll, isDesktop } from './chrome.js';
import { fragmentElement, runReveal, WAVE, WAVE_LONG } from '../text-reveal.js';
import exclaimSvg from '../assets/symbols/exclaim.svg?raw';
import questionSvg from '../assets/symbols/question.svg?raw';
import equalsSvg from '../assets/symbols/equals.svg?raw';
import hashtagSvg from '../assets/symbols/hashtag.svg?raw';

// "( ! )" etc. render as this pre-generated SVG (see
// scripts/generate-symbol-svgs.mjs) instead of live text — different
// rendering engines don't agree on a font's ascent/descent metrics
// (that's what made this symbol sit off-center differently on iOS
// Chrome vs desktop Chrome for identical CSS), but an SVG's viewBox is
// exact and fixed, so there's nothing left for a renderer to disagree
// about.
const SYMBOL_SVG = {
  '!': exclaimSvg,
  '?': questionSvg,
  '=': equalsSvg,
  '#': hashtagSvg,
};

const LINES_DELAY = 400;
const LINES_DURATION = 1600; // must match .row-rule / .topbar-rule transition duration in style.css
const RISE_DELAY = LINES_DELAY + LINES_DURATION + 200;
const RISE_DURATION = 520; // must match .game-mark.is-rising animation duration in style.css
const NAV_DELAY = RISE_DELAY + RISE_DURATION + 200;
const ROWS_DELAY = NAV_DELAY + 180;
const ROW_STAGGER = 90;
const ROW_COUNT = 5; // ready x1, stats x4
const FOOTER_DELAY = ROWS_DELAY + ROW_COUNT * ROW_STAGGER + 300;

// .game-mark's old clamp() guessed available height via a hardcoded
// "520px reserved for rows/footer" constant — same class of bug as the
// home mark had: on a desktop window resized narrow enough to hit the
// mobile layout but not especially short, the width term scales up with
// the (often wide-relative-to-a-phone) viewport while that fixed guess
// doesn't track the real leftover space, so the glyph renders larger
// than what's actually left above .game-rows and visually bleeds into
// the description text below it. This measures the real numbers instead.
//
// Now that the mark is an SVG rather than live text, its aspect ratio is
// exact and known (the viewBox) instead of something that has to be
// measured by rendering at a reference size first — so this only needs
// to solve for one box that fits both the real available height and
// width, not also account for font-metric guesswork.
function fitGameMark() {
  const game = document.querySelector('.game');
  const hero = document.querySelector('.game-hero');
  const mark = document.querySelector('.game-mark');
  const svg = mark?.querySelector('svg');
  const heroRule = document.querySelector('.hero-rule');
  const desc = document.querySelector('.game-desc');
  const rows = document.querySelector('.game-rows');
  if (!game || !hero || !mark || !svg || !rows) return;
  if (getComputedStyle(hero).display === 'none') return; // desktop uses .game-header-mark instead

  const vb = svg.viewBox.baseVal;
  const aspect = vb.width / vb.height;

  const heroPaddingTop = parseFloat(getComputedStyle(hero).paddingTop) || 0;
  const availH = game.clientHeight - rows.offsetHeight - (heroRule?.offsetHeight ?? 0) - (desc?.offsetHeight ?? 0) - heroPaddingTop;
  const availW = hero.clientWidth;

  const SAFETY = 0.55;
  const height = Math.max(Math.min(availH, availW / aspect) * SAFETY, 40);
  mark.style.height = `${height}px`;
  mark.style.width = `${height * aspect}px`;
}

// fallback only — used by whichever game hasn't gotten its real copy yet,
// so it still renders something coherent instead of a blank description/
// stat grid
const DEFAULT_DESC = 'Epirus ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laborisnisi ut aliquip ex ea commodo consequat.';

const DEFAULT_STATS = [
  { label: 'Levels', value: '3' },
  { label: 'Data', value: '3' },
  { label: 'Data', value: '3' },
  { label: 'Data', value: '3' },
];

const PLAY_ROUTES = {
  '!': '/exclaim/play',
  '?': '/question/play',
  '=': '/equals/play',
  '#': '/hashtag/play',
};

function row(label, valueHTML, extraClass = '') {
  return `
    <li class="game-row ${extraClass}">
      <div class="row-rule"></div>
      <div class="row-inner">
        <span class="row-label">${label}</span>
        ${valueHTML}
      </div>
    </li>
  `;
}

export function createGamePage(mark, { description = DEFAULT_DESC, stats = DEFAULT_STATS } = {}) {
  const markLabel = `( ${mark} )`;
  const markSvg = SYMBOL_SVG[mark];
  const playRoute = PLAY_ROUTES[mark];
  const startAttr = playRoute ? ` data-route="${playRoute}"` : '';

  return {
    title: markLabel,
    bodyClass: 'page-game',
    render() {
      return `
        <main class="page" style="opacity:0">
          ${renderChrome(`
            <div class="game">
              <div class="game-hero">
                <span class="game-mark" role="img" aria-label="${markLabel}">${markSvg}</span>
                <div class="row-rule hero-rule"></div>
                <p class="game-desc">${description}</p>
              </div>

              <div class="game-header">
                <span class="game-header-mark" role="img" aria-label="${markLabel}">${markSvg}</span>
                <p class="game-desc-side">${description}</p>
              </div>

              <ul class="game-rows">
                ${row('Ready?', `<button type="button" class="ready-start"${startAttr}>${roll('Start &rarr;')}</button>`, 'game-row--ready')}
                ${stats.map(s => row(s.label, `<span class="row-value">${s.value}</span>`)).join('')}
              </ul>
            </div>
          `)}
        </main>
      `;
    },
    init() {
      const persistChrome = isDesktop();
      const { revealNav, teaseLogo, drawFooterRule, revealFooter } = initChrome({ instant: persistChrome });

      fitGameMark();
      if (document.fonts?.ready) document.fonts.ready.then(fitGameMark);
      let resizeTimer;
      const onResize = () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(fitGameMark, 150);
      };
      window.addEventListener('resize', onResize);
      this._cleanupFitGameMark = () => {
        clearTimeout(resizeTimer);
        window.removeEventListener('resize', onResize);
      };

      const page = document.querySelector('.page');
      const gameMark = document.querySelector('.game-mark');
      const topRule = document.querySelector('.topbar-rule');
      const heroRule = document.querySelector('.hero-rule');
      const rows = document.querySelectorAll('.game-row');
      const desc = document.querySelector('.game-desc');
      const descSide = document.querySelector('.game-desc-side');
      const headerMark = document.querySelector('.game-header-mark');

      if (desc) fragmentElement(desc);
      if (descSide) fragmentElement(descSide);
      // headerMark is an SVG now, not text — fragmentElement() reads
      // el.childNodes expecting text content, and an SVG's textContent is
      // empty, so it was overwriting the SVG with an empty string. It gets
      // a simple scaleY reveal (same mechanism as .game-mark) instead of
      // the character-wave reveal, wired in below where runReveal used to be.
      rows.forEach(r => {
        fragmentElement(r.querySelector('.row-label'));
        const value = r.querySelector('.row-value');
        if (value) fragmentElement(value);
        const start = r.querySelector('.ready-start .roll-line');
        if (start) fragmentElement(start);
      });

      if (persistChrome) {
        // desktop: nav/footer never actually change between pages, so they
        // snap straight to their settled state instead of re-animating —
        // only the header/rows (what's actually different) get a fresh
        // entrance, and it starts immediately instead of waiting on chrome
        page.style.opacity = '1';
        topRule?.classList.add('is-instant', 'is-drawn');
        revealNav();
        teaseLogo();
        drawFooterRule();
        revealFooter();

        setTimeout(() => {
          rows.forEach(r => r.querySelector('.row-rule')?.classList.add('is-drawn'));
          heroRule?.classList.add('is-drawn');
        }, 80);

        setTimeout(() => {
          headerMark?.classList.add('is-rising');
          if (descSide) runReveal(descSide, WAVE_LONG);
          // this desktop ("persist chrome") branch never used to touch the
          // MOBILE-only .game-mark/.game-desc at all, since it's display:none
          // on desktop anyway — but if the window gets resized down to the
          // mobile breakpoint afterward without a fresh navigation (no re-run
          // of init()), those elements suddenly become visible while still
          // stuck in their initial hidden state, since nothing had ever
          // revealed them. Revealing them here too is a no-op visually on
          // an actual desktop width, and correct if the window shrinks later.
          gameMark?.classList.add('is-rising');
          if (desc) runReveal(desc, WAVE_LONG);
        }, 150);

        rows.forEach((r, i) => {
          setTimeout(() => {
            runReveal(r, WAVE);
          }, 150 + i * ROW_STAGGER);
        });
        return;
      }

      requestAnimationFrame(() => {
        page.style.transition = 'opacity 400ms ease';
        page.style.opacity = '1';
      });

      setTimeout(() => {
        topRule?.classList.add('is-drawn');
        heroRule?.classList.add('is-drawn');
        rows.forEach(r => r.querySelector('.row-rule')?.classList.add('is-drawn'));
        drawFooterRule();
      }, LINES_DELAY);

      setTimeout(() => {
        gameMark?.classList.add('is-rising');
      }, RISE_DELAY);

      setTimeout(() => {
        revealNav();
      }, NAV_DELAY);

      setTimeout(() => {
        teaseLogo();
      }, NAV_DELAY + 1200);

      setTimeout(() => {
        if (desc) runReveal(desc, WAVE_LONG);
        if (descSide) runReveal(descSide, WAVE_LONG);
        headerMark?.classList.add('is-rising');
      }, ROWS_DELAY);

      rows.forEach((r, i) => {
        setTimeout(() => {
          runReveal(r, WAVE);
        }, ROWS_DELAY + i * ROW_STAGGER);
      });

      setTimeout(() => {
        revealFooter();
      }, FOOTER_DELAY);
    },
    exit() {
      this._cleanupFitGameMark?.();
      return new Promise(resolve => {
        if (isDesktop()) {
          const header = document.querySelector('.game-header');
          const rows = document.querySelector('.game-rows');
          if (!header && !rows) { resolve(); return; }
          [header, rows].forEach(el => {
            if (!el) return;
            el.style.transition = 'opacity 200ms ease';
            el.style.opacity = '0';
          });
          setTimeout(resolve, 200);
          return;
        }
        const page = document.querySelector('.page');
        if (!page) { resolve(); return; }
        page.style.transition = 'opacity 250ms ease';
        page.style.opacity = '0';
        setTimeout(resolve, 250);
      });
    }
  };
}
