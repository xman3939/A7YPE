// Shared end-of-game results screen for both play pages (Odd One Out,
// Find the ?). Replaces .play's ENTIRE inner content (prompt/rule/timer/
// board/rows) with a dedicated results layout — not a reuse of any of the
// in-game markup — since the two look nothing alike. Sequence: undraw the
// in-game rules that don't exist in this layout, clear the board, draw
// the new (faster) rules, stagger the stats in, then rise the big
// numbers in last (same rise keyframe .mark/.game-mark use).
//
// Mobile and desktop are genuinely different layouts, not one shared DOM
// reshuffled by CSS: mobile mirrors the .game page's structure (score
// full-width between two rules like .game-mark, Overview as a left
// label / right stat-stack instead of a paragraph), desktop is "one
// large grid" — every stat (including Score and Attempt No.) is a row
// in a single list, bottom-anchored against the footer the way
// .game-rows is, with Score/Attempt No.'s values just much bigger than
// the others. Because the DOM shapes differ, crossing the mobile/desktop
// breakpoint mid-session (a resize, not just a fresh load) has to
// rebuild the whole thing, not just re-fit the numbers — see
// showResultsScreen's resize handler.

import { fragmentElement, runReveal, WAVE } from './text-reveal.js';
import { isDesktop, roll } from './pages/chrome.js';
import digit0 from './assets/digits/digit-0.svg?raw';
import digit1 from './assets/digits/digit-1.svg?raw';
import digit2 from './assets/digits/digit-2.svg?raw';
import digit3 from './assets/digits/digit-3.svg?raw';
import digit4 from './assets/digits/digit-4.svg?raw';
import digit5 from './assets/digits/digit-5.svg?raw';
import digit6 from './assets/digits/digit-6.svg?raw';
import digit7 from './assets/digits/digit-7.svg?raw';
import digit8 from './assets/digits/digit-8.svg?raw';
import digit9 from './assets/digits/digit-9.svg?raw';

// score/attempt use these instead of live text — see generate-symbol-svgs.mjs's
// digit-generation comment for why: a font glyph's built-in side-bearing
// (invisible padding around the ink, reserved so body text doesn't look
// cramped) was eating into "make the digits span edge-to-edge" no matter
// how precisely a live text run got measured and scaled, since that
// padding is baked into what gets measured. An SVG path's bounding box
// has none of it.
const DIGIT_SVG = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
  .reduce((map, d, i) => { map[d] = [digit0, digit1, digit2, digit3, digit4, digit5, digit6, digit7, digit8, digit9][i]; return map; }, {});

const UNDRAW_MS = 380;
const RULES_DELAY = 80;
const STATS_DELAY = 380;
const STAT_STAGGER = 90;
const NUMBERS_DELAY = 620;
const NUMBER_STAGGER = 150;
// spacing between composed digits, relative to their own height — this
// is the "character spacing" knob (tighter = smaller). Also directly
// affects how tall the fitted digits end up: a smaller gap means less of
// availW's budget goes to empty space between digits, so the digits
// themselves get sized taller to still fill it — which is also what
// closes most of the leftover top/bottom air in a box that's naturally
// taller than 3 digits need to be at their width-driven size.
const DIGIT_GAP_RATIO = 0.02;
// small deliberate breathing room above/below the digits themselves,
// now that the box is sized tightly to content instead of stretching —
// a flat px value rather than another ratio since this is meant to read
// as a fixed, small gap regardless of how big the digits end up. Total
// reduction split evenly top/bottom by centering, so this is 6px each.
const DIGIT_VPAD = 12;

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatTime(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}

function bigNumber(className, digits, ariaLabel) {
  const digitSpans = [...digits]
    .map(d => `<span class="results-digit">${DIGIT_SVG[d] ?? ''}</span>`)
    .join('');
  return `
    <span class="${className}" role="img" aria-label="${esc(ariaLabel)}">${digitSpans}</span>
  `;
}

// ---------------------------------------------------------------------
// Mobile markup — score full-width like .game-mark, Overview as a
// label/stat-stack row instead of a paragraph, attempt number repeating
// the same framed-number treatment above the footer rule.
// ---------------------------------------------------------------------

// mobileOnly rows (Rounds) only exist on mobile — desktop's grid drops
// that stat entirely
function statEntry(label, value, mobileOnly = false) {
  return `
    <li class="results-stat-entry${mobileOnly ? ' results-stat-entry--mobile-only' : ''}">
      <div class="results-stat-rule"></div>
      <div class="results-stat-inner">
        <span class="results-stat-label">${esc(label)}</span>
        <span class="results-stat-value">&gt;${esc(value)}</span>
      </div>
    </li>
  `;
}

function buildMobileMarkup({ label, score, rounds, roundsLabel, timePlayed, accuracy, accuracyLabel, attemptNo, scoreDigits, attemptDigits }) {
  return `
    <div class="results">
      <p class="results-heading">${esc(label)}</p>
      <div class="results-rule"></div>

      ${bigNumber('results-score', scoreDigits, `Score ${score}`)}
      <div class="results-rule"></div>

      <div class="results-block results-block--overview">
        <div class="results-overview-row">
          <span class="results-block-label">Overview</span>
          <ul class="results-stat-list">
            ${statEntry('Score', String(score))}
            ${statEntry(roundsLabel, String(rounds), true)}
            ${statEntry('Time played', formatTime(timePlayed))}
            ${statEntry(accuracyLabel, `${accuracy}%`)}
          </ul>
        </div>
      </div>

      <div class="results-attempt-row">
        <span class="results-block-label">Attempt No.</span>
        <button type="button" class="results-retry">${roll('&rarr;Retry')}</button>
      </div>
      <div class="results-rule results-attempt-rule"></div>

      ${bigNumber('results-attempt-number', attemptDigits, `Attempt ${attemptNo}`)}
    </div>
  `;
}

// ---------------------------------------------------------------------
// Desktop markup — "one large grid": every stat, including Score and
// Attempt No., is a row in a single list, bottom-anchored against the
// footer (margin-top:auto, same as .game-rows), same thin padding on
// every row, everything right-aligned same as the small stat values —
// Score/Attempt No. just have a much bigger value.
// ---------------------------------------------------------------------

function gridRow(labelHTML, valueHTML, { extraClass = '', rule = true } = {}) {
  return `
    <li class="results-grid-row ${extraClass}">
      ${rule ? '<div class="results-rule"></div>' : ''}
      <div class="results-grid-inner">
        <span class="results-grid-label">${labelHTML}</span>
        ${valueHTML}
      </div>
    </li>
  `;
}

function buildDesktopMarkup({ label, score, rounds, roundsLabel, timePlayed, accuracy, accuracyLabel, attemptNo, scoreDigits, attemptDigits }) {
  return `
    <div class="results">
      <ul class="results-grid">
        ${gridRow(esc(label), `<button type="button" class="results-retry">${roll('&rarr;Retry')}</button>`, { rule: false })}
        ${gridRow('Score', bigNumber('results-score', scoreDigits, `Score ${score}`), { extraClass: 'results-grid-row--big' })}
        ${gridRow('Attempt No.', bigNumber('results-attempt-number', attemptDigits, `Attempt ${attemptNo}`), { extraClass: 'results-grid-row--big' })}
        ${gridRow(esc(roundsLabel), `<span class="results-grid-value">&gt;${esc(String(rounds))}</span>`)}
        ${gridRow('Time played', `<span class="results-grid-value">&gt;${esc(formatTime(timePlayed))}</span>`)}
        ${gridRow(esc(accuracyLabel), `<span class="results-grid-value">&gt;${accuracy}%</span>`)}
      </ul>
    </div>
  `;
}

function buildMarkup(data) {
  const scoreDigits = String(Math.min(Math.max(data.score, 0), 999)).padStart(3, '0');
  const attemptDigits = String(Math.max(data.attemptNo, 1)).padStart(3, '0');
  const withDigits = { ...data, scoreDigits, attemptDigits };
  return isDesktop() ? buildDesktopMarkup(withDigits) : buildMobileMarkup(withDigits);
}

// .results-score/.results-attempt-number are sized to their content
// (flex: 0 0 auto — see style.css), not stretched to fill leftover
// space. On mobile that used to be flex:1 on the numbers themselves,
// which guaranteed no gap on ONE axis but — since a phone's available
// height for these rarely matches 3 digits' natural aspect ratio at
// that width — left the other axis centered with visible top/bottom air
// inside the number's own box. Sizing the box to EXACTLY what the
// digits need removes that air by construction; .results-block--overview
// (mobile) absorbs whatever leftover space exists instead.
//
// Each digit's exact ink aspect ratio (from its own SVG viewBox) is
// already known, so mobile solves directly for the height that makes
// the composed row (3 digits + 2 gaps, all proportional to that height)
// exactly fill availW — no live-measurement probing needed.
//
// Desktop sits inline in a grid row next to its label instead, at one
// fixed, comfortable size — not continuously tracking viewport width.
// It only shrinks below that fixed size if the row is narrow enough
// that it would otherwise overflow (a defensive fallback, not a design
// goal). Both breakpoints compute and apply explicit px in JS rather
// than leaving width to CSS's height:100%/width:auto — relying on a
// browser to resolve an <svg>'s width from its intrinsic viewBox ratio
// wasn't reliable, and a frozen/never-updating width there is exactly
// what an earlier "desktop isn't scaling" bug looked like.
const DESKTOP_HEIGHT = 300;
const DESKTOP_GAP = 4;
// Overview's 4 stat entries (label+value stacked, 19px each, 3px gap,
// 3px inner padding top/bottom = ~47px per entry) plus its own top
// padding — a fixed estimate rather than a live measurement, since at
// the moment this runs (right after the numbers' own fresh markup goes
// in, before either has a real size yet) Overview's box is mid-flex-
// resolution and reading its height back doesn't reflect what it
// actually needs, just whatever it happens to be mid-layout.
const MOBILE_OVERVIEW_MIN = 200;
// heading + 3 hairline rules + the Attempt No./Retry row, none of which
// scale with the numbers — same reasoning as above, a fixed estimate
const MOBILE_FIXED_CHROME = 60;

function fitResultsNumbers(playEl) {
  const nums = playEl.querySelectorAll('.results-score, .results-attempt-number');
  const results = playEl.querySelector('.results');
  const resultsH = results?.clientHeight || 0;
  // both numbers draw from this SAME budget — capping each independently
  // at a flat fraction of resultsH (the old approach) let them together
  // claim up to 100% of it on a wide-but-short mobile viewport (a wide
  // width drives a tall width-fit height for both), squeezing Overview's
  // fixed-content stat list into less room than it needs and spilling
  // it into the Attempt row below instead of actually shrinking (text
  // doesn't compress) — that's what the reported overlap was.
  const combinedNumbersBudget = resultsH
    ? Math.max(resultsH - MOBILE_OVERVIEW_MIN - MOBILE_FIXED_CHROME, 160)
    : null;
  const perNumberCeiling = combinedNumbersBudget ? combinedNumbersBudget / 2 : null;

  nums.forEach(el => {
    const digitEls = [...el.querySelectorAll('.results-digit')];
    const svgs = digitEls.map(d => d.querySelector('svg'));
    if (!digitEls.length || svgs.some(s => !s)) return;

    const aspects = svgs.map(svg => {
      const vb = svg.viewBox.baseVal;
      return vb.height ? vb.width / vb.height : 0.6;
    });

    if (isDesktop()) {
      const availW = el.clientWidth;
      const aspectSum = aspects.reduce((a, b) => a + b, 0);
      const gapCount = digitEls.length - 1;
      // the height that would make the row exactly fill availW at the
      // fixed gap — only used if it's SMALLER than the fixed height,
      // i.e. only when the fixed size would actually overflow
      const maxHeightForWidth = availW > 0
        ? (availW - gapCount * DESKTOP_GAP) / aspectSum
        : DESKTOP_HEIGHT;
      const digitHeight = Math.min(DESKTOP_HEIGHT, Math.max(maxHeightForWidth, 40));
      digitEls.forEach((d, i) => {
        d.style.height = `${digitHeight}px`;
        svgs[i].style.height = `${digitHeight}px`;
        svgs[i].style.width = `${digitHeight * aspects[i]}px`;
      });
      el.style.gap = `${DESKTOP_GAP}px`;
      el.style.flex = '';
      return;
    }

    const availW = el.clientWidth;
    if (!availW) return;

    const aspectSum = aspects.reduce((a, b) => a + b, 0);
    const gapCount = digitEls.length - 1;
    // totalWidth(height) = height * aspectSum + gapCount * (height * DIGIT_GAP_RATIO)
    const heightByWidth = availW / (aspectSum + gapCount * DIGIT_GAP_RATIO);
    // shared budget (see combinedNumbersBudget above) — the real fit
    // constraint on a wide mobile viewport, where availW alone would
    // otherwise size this taller than there's actually room for once
    // Overview and the other number are accounted for
    const ceiling = perNumberCeiling ?? heightByWidth;
    const height = Math.max(Math.min(heightByWidth, ceiling), 24);

    // the box itself keeps the full width-fit height (flex-basis below);
    // only the digits inside it shrink slightly, so DIGIT_VPAD shows up
    // as centered breathing room rather than changing the box's own size
    const digitHeight = Math.max(height - DIGIT_VPAD, 20);
    // set both dimensions directly on each <svg>, in px, instead of
    // relying on height:100% + width:auto resolving the width from the
    // viewBox's intrinsic ratio — that auto-resolution is what was
    // silently failing (some mobile browsers don't reliably compute it
    // for an inline SVG with no width/height attributes inside a flex
    // item), collapsing every digit's wrapper to ~0 width and stacking
    // all 3 digits on top of each other at the same position instead of
    // laying them out left to right.
    digitEls.forEach((d, i) => {
      const svg = svgs[i];
      svg.style.height = `${digitHeight}px`;
      svg.style.width = `${digitHeight * aspects[i]}px`;
      d.style.height = `${digitHeight}px`;
    });
    el.style.gap = `${digitHeight * DIGIT_GAP_RATIO}px`;
    el.style.flex = `0 0 ${height}px`;
  });
}

// getBoundingClientRect() on an element measures its CSS BOX, which kept
// turning out to extend past the actual visible glyph by some amount
// nobody could quite pin down (a button's default rendering, then
// .roll-line's own box being taller than its trimmed content) — every
// fix at that level just moved the mismatch one level deeper. Range
// measures the rendered TEXT itself, ignoring box models entirely, so
// it's correct regardless of what's causing any given element's box to
// disagree with its own visible content.
function textBottom(el) {
  const range = document.createRange();
  range.selectNodeContents(el);
  return range.getBoundingClientRect().bottom;
}

// .roll's internal box geometry has repeatedly refused to line up with
// plain trimmed text's next to it (Retry vs. Attempt No. on mobile,
// Retry vs. "Time's up" on desktop) no matter how closely their CSS box
// models get tuned to match. Measuring the actual rendered text position
// of each (see textBottom above) and correcting the real pixel delta
// sidesteps needing to know *why* they disagree — it's correct
// regardless, and stays correct as font-size changes (desktop's clamp()
// included) since it's re-measured, not guessed.
function alignRetryButton(playEl) {
  const retryBtn = playEl.querySelector('.results-retry');
  if (!retryBtn) return;
  const row = retryBtn.closest('.results-attempt-row, .results-grid-row');
  const label = row?.querySelector('.results-block-label, .results-grid-label');
  const rollLine = retryBtn.querySelector('.roll-line');
  if (!label || !rollLine) return;
  retryBtn.style.transform = '';
  const delta = textBottom(label) - textBottom(rollLine);
  retryBtn.style.transform = `translateY(${delta}px)`;
}

// Wires up whichever markup buildMarkup() produced: fits the numbers,
// fragments text for the wave reveal, and either plays the full
// staggered entrance (a real game over) or snaps straight to the
// finished state (instant — used when a resize crosses the mobile/
// desktop breakpoint mid-session and the whole layout has to be rebuilt
// under an already-visible results screen, where replaying the intro
// would be jarring rather than a first reveal).
function renderResults(playEl, data, onRetry, { instant = false } = {}) {
  playEl.innerHTML = buildMarkup(data);
  fitResultsNumbers(playEl);
  alignRetryButton(playEl);

  const rules = playEl.querySelectorAll('.results-rule, .results-stat-rule');
  const retryBtn = playEl.querySelector('.results-retry');
  const scoreEl = playEl.querySelector('.results-score');
  const attemptEl = playEl.querySelector('.results-attempt-number');

  // Retry uses the same .roll hover-swap markup as the footer links —
  // fragment just the first .roll-line (matching chrome.js's own
  // pattern for those), not the whole button, which would otherwise
  // also tear into the hidden duplicate .roll-line hover copy
  if (retryBtn) fragmentElement(retryBtn.querySelector('.roll-line'));
  retryBtn?.addEventListener('click', onRetry);

  if (isDesktop()) {
    const rows = playEl.querySelectorAll('.results-grid-row');
    rows.forEach(row => {
      const label = row.querySelector('.results-grid-label');
      if (label) fragmentElement(label);
      const value = row.querySelector('.results-grid-value');
      if (value) fragmentElement(value);
    });

    if (instant) {
      rules.forEach(rule => rule.classList.add('is-instant', 'is-drawn'));
      playEl.querySelectorAll('.reveal-chunk').forEach(c => c.classList.add('is-visible'));
      scoreEl?.classList.add('is-rising');
      attemptEl?.classList.add('is-rising');
      return;
    }

    setTimeout(() => {
      rules.forEach(rule => rule.classList.add('is-drawn'));
    }, RULES_DELAY);

    rows.forEach((row, i) => {
      setTimeout(() => {
        runReveal(row, WAVE);
      }, STATS_DELAY + i * STAT_STAGGER);
    });

    setTimeout(() => {
      scoreEl?.classList.add('is-rising');
    }, NUMBERS_DELAY);

    setTimeout(() => {
      attemptEl?.classList.add('is-rising');
    }, NUMBERS_DELAY + NUMBER_STAGGER);

    return;
  }

  const heading = playEl.querySelector('.results-heading');
  const overviewLabel = playEl.querySelector('.results-block--overview .results-block-label');
  const stats = playEl.querySelectorAll('.results-stat-entry');
  const attemptLabel = playEl.querySelector('.results-attempt-row .results-block-label');

  [heading, overviewLabel, attemptLabel].forEach(el => { if (el) fragmentElement(el); });
  stats.forEach(stat => {
    fragmentElement(stat.querySelector('.results-stat-label'));
    fragmentElement(stat.querySelector('.results-stat-value'));
  });

  if (instant) {
    rules.forEach(rule => rule.classList.add('is-instant', 'is-drawn'));
    playEl.querySelectorAll('.reveal-chunk').forEach(c => c.classList.add('is-visible'));
    scoreEl?.classList.add('is-rising');
    attemptEl?.classList.add('is-rising');
    return;
  }

  setTimeout(() => {
    rules.forEach(rule => rule.classList.add('is-drawn'));
  }, RULES_DELAY);

  setTimeout(() => {
    if (heading) runReveal(heading, WAVE);
  }, STATS_DELAY - 180);

  setTimeout(() => {
    if (overviewLabel) runReveal(overviewLabel, WAVE);
    if (attemptLabel) runReveal(attemptLabel, WAVE);
    if (retryBtn) runReveal(retryBtn, WAVE);
    stats.forEach((stat, i) => {
      setTimeout(() => {
        runReveal(stat, WAVE);
      }, i * STAT_STAGGER);
    });
  }, STATS_DELAY);

  setTimeout(() => {
    scoreEl?.classList.add('is-rising');
  }, NUMBERS_DELAY);

  setTimeout(() => {
    attemptEl?.classList.add('is-rising');
  }, NUMBERS_DELAY + NUMBER_STAGGER);
}

// fitResultsNumbers() alone used to be enough to re-run on resize, but
// mobile and desktop are now different DOM shapes (see the file
// comment) — a resize that crosses the breakpoint has to rebuild the
// whole results screen, not just re-fit the numbers, or the layout gets
// stuck in whichever shape it was first built in. Tracked at module
// level so a *new* results screen (a fresh game over, including after a
// retry) tears down the *previous* one's listener instead of piling
// another one on top of it.
let stopResizeFit = null;

// oldRules: the in-game rule elements (.play-rule, the Round/Score
// .row-rules) to undraw first, since none of them exist in this layout —
// topbar-rule/footer-rule are permanent chrome and aren't passed here.
// is-undrawing swaps in a much faster transition than their normal
// 1600ms draw-in so the shrink actually finishes inside UNDRAW_MS instead
// of visibly getting cut off when the DOM underneath them gets replaced.
// misses is accepted but no longer displayed (Misses stat was dropped —
// Accuracy already covers it) — still accepted here so callers don't
// need to change what they pass
export function showResultsScreen({ playEl, oldRules, label, score, rounds, roundsLabel = 'Rounds', timePlayed, misses, accuracy, accuracyLabel = 'Accuracy', attemptNo, onRetry }) {
  stopResizeFit?.();
  stopResizeFit = null;

  oldRules.forEach(rule => {
    if (!rule) return;
    rule.classList.add('is-undrawing');
    rule.classList.remove('is-drawn');
  });

  setTimeout(() => {
    const data = { label, score, rounds, roundsLabel, timePlayed, accuracy, accuracyLabel, attemptNo };
    renderResults(playEl, data, onRetry);

    let lastIsDesktop = isDesktop();
    let resizeTimer;
    const onResize = () => {
      // the page was navigated away from (playEl detached) and nothing
      // ever explicitly tore this listener down — stop reacting instead
      // of quietly re-fitting/rebuilding a screen nobody can see
      if (!document.body.contains(playEl)) {
        window.removeEventListener('resize', onResize);
        return;
      }
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const nowDesktop = isDesktop();
        if (nowDesktop !== lastIsDesktop) {
          lastIsDesktop = nowDesktop;
          renderResults(playEl, data, onRetry, { instant: true });
        } else {
          fitResultsNumbers(playEl);
          alignRetryButton(playEl);
        }
      }, 150);
    };
    window.addEventListener('resize', onResize);
    stopResizeFit = () => {
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', onResize);
    };
  }, UNDRAW_MS);
}
