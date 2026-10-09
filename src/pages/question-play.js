import gsap from 'gsap';
import { renderChrome, initChrome, isDesktop } from './chrome.js';
import { fragmentElement, runReveal, runUnreveal, WAVE } from '../text-reveal.js';
import { showResultsScreen } from '../results-screen.js';
import { playSound } from '../audio.js';
import { START_TIME, ROUND_RESET_EVERY, CORRECT_BONUS, POINTS_PER_ROUND, MISS_PENALTY, WIN_SCORE, getRoundConfig, getBaseTime, generateItems, pickNewTarget } from '../game-red-question.js';

const GRID_GAP = 12;
// motion tiers (game-red-question.js's MOTION_TIERS) are sized/counted
// as flat numbers with no idea what viewport they'll render into — the
// same item count/size reads far denser on a narrow mobile screen than
// on a spacious desktop one, "huge many" especially (140px items, up to
// 260 of them). Trimming the count on mobile eases the clutter side of
// that without touching the desktop difficulty curve at all.
const MOBILE_MOTION_SCALE = 0.7;
// huge (140px) and medium (100px) tiles also just read way too big on a
// narrow mobile screen, independent of clutter — desktop's board is
// spacious enough for them as-is, so this only kicks in on mobile.
// small (70px) isn't in here — it already reads fine, left untouched.
const MOBILE_MOTION_SIZE = { 140: 90, 100: 80 };

function getMotionItemSize(size) {
  if (isDesktop()) return size;
  return MOBILE_MOTION_SIZE[size] ?? size;
}

const SWIPE_MS = 450;
const EXIT_FADE_MS = 400;
const LINES_DELAY = 200;
const ROWS_DELAY = LINES_DELAY + 500;
const ROW_STAGGER = 90;

const SQUARE_APPEAR_GAP = 130;
const SQUARE_APPEAR_MS = 220;
const LIGHT_PAUSE_MS = 300;
const LIGHT_GAP = 550;
const LIGHT_MS = 150;
const LIT_HOLD_MS = 400;
const SQUARE_HIDE_MS = 300;

const STATS = [
  { label: 'Round', value: '1' },
  { label: 'Score', value: '0' },
];

// dev-only round picker (see the panel wired up in init()) — one entry per
// round "flavor" the real getRoundConfig() curve produces, so any of them
// can be jumped to directly for testing instead of grinding through rounds
// to reach it. Every dev entry still needs mixFraction/axis even for
// jumble/motion modes — generateItems() always reads them for the
// non-target distractors regardless of mode. Switched off for now — flip
// back to true to restore it.
const DEV_PANEL_ENABLED = false;

const DEV_ROUNDS = [
  { key: 'grid-color', label: 'Grid: color axis', config: { desiredCount: 9, mode: 'grid', minCell: 60, mixFraction: 0, axis: 'color' } },
  { key: 'grid-symbol', label: 'Grid: symbol axis', config: { desiredCount: 9, mode: 'grid', minCell: 60, mixFraction: 0, axis: 'symbol' } },
  { key: 'grid-mixed', label: 'Grid: mixed (hard)', config: { desiredCount: 40, mode: 'grid', minCell: 48, mixFraction: 0.6, axis: 'color' } },
  { key: 'grid-mixed-ultra', label: 'Grid: mixed (ultra hard)', config: { desiredCount: 200, mode: 'grid', minCell: 36, mixFraction: 0.85, axis: 'color' } },
  { key: 'jumble-light', label: 'Jumble: light', config: { mode: 'jumble', jumbleCount: 30, mixFraction: 0.4, axis: 'color' } },
  { key: 'jumble-dense', label: 'Jumble: dense', config: { mode: 'jumble', jumbleCount: 150, mixFraction: 0.6, axis: 'color' } },
  { key: 'jumble-ultra', label: 'Jumble: ultra dense', config: { mode: 'jumble', jumbleCount: 400, mixFraction: 0.8, axis: 'color' } },
  // motionPattern/motionColorMode aren't fixed here — picked fresh at
  // random on every click (see the dev-round click handler below), same
  // as real gameplay, so these buttons are purely a size/density
  // shortcut — text size (huge/medium/small) x density (few/medium/many)
  { key: 'motion-huge-few', label: 'Motion: huge, few', config: { mode: 'motion', motionCount: 26, motionItemSize: 140, mixFraction: 0.5, axis: 'color' } },
  { key: 'motion-huge-medium', label: 'Motion: huge, medium', config: { mode: 'motion', motionCount: 80, motionItemSize: 140, mixFraction: 0.6, axis: 'color' } },
  { key: 'motion-huge-many', label: 'Motion: huge, many', config: { mode: 'motion', motionCount: 160, motionItemSize: 140, mixFraction: 0.7, axis: 'color' } },
  { key: 'motion-medium-few', label: 'Motion: medium, few', config: { mode: 'motion', motionCount: 40, motionItemSize: 100, mixFraction: 0.5, axis: 'color' } },
  { key: 'motion-medium-medium', label: 'Motion: medium, medium', config: { mode: 'motion', motionCount: 120, motionItemSize: 100, mixFraction: 0.6, axis: 'color' } },
  { key: 'motion-medium-many', label: 'Motion: medium, many', config: { mode: 'motion', motionCount: 220, motionItemSize: 100, mixFraction: 0.7, axis: 'color' } },
  { key: 'motion-small-few', label: 'Motion: small, few', config: { mode: 'motion', motionCount: 45, motionItemSize: 70, mixFraction: 0.5, axis: 'color' } },
  { key: 'motion-small-medium', label: 'Motion: small, medium', config: { mode: 'motion', motionCount: 70, motionItemSize: 70, mixFraction: 0.6, axis: 'color' } },
  { key: 'motion-small-many', label: 'Motion: small, many', config: { mode: 'motion', motionCount: 150, motionItemSize: 70, mixFraction: 0.7, axis: 'color' } },
  // direction is rolled per-strip now (staggered, not one board-wide
  // reverse flag) — these are purely speed/axis shortcuts
  { key: 'scroll-row-slow', label: 'Scroll: row, slow', config: { mode: 'scroll', desiredCount: 60, minCell: 46, scrollAxis: 'row', scrollSpeedMs: 9000, mixFraction: 0.6, axis: 'color' } },
  { key: 'scroll-row-fast', label: 'Scroll: row, fast', config: { mode: 'scroll', desiredCount: 90, minCell: 36, scrollAxis: 'row', scrollSpeedMs: 2500, mixFraction: 0.8, axis: 'color' } },
  { key: 'scroll-column-slow', label: 'Scroll: column, slow', config: { mode: 'scroll', desiredCount: 60, minCell: 46, scrollAxis: 'column', scrollSpeedMs: 9000, mixFraction: 0.6, axis: 'color' } },
  { key: 'scroll-column-fast', label: 'Scroll: column, fast', config: { mode: 'scroll', desiredCount: 90, minCell: 36, scrollAxis: 'column', scrollSpeedMs: 2500, mixFraction: 0.8, axis: 'color' } },
];

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// shared by plain grid mode AND scroll mode — scroll mode used to run
// its own separate, density-maximizing fit (as many items as physically
// fit minCell-wise), which produced a far denser grid than this same
// config would ever get in plain grid mode, and was most of the real
// performance/stutter problem (way more concurrent DOM/animation work
// than intended, not just a math bug). Snaps up to a complete rectangle
// — never a ragged partial last row — by figuring out how many columns
// actually fit this screen first, then capping that against a
// roughly-square target column count derived from desiredCount.
function computeGridDims(config, availableW, availableH) {
  const { minCell, desiredCount } = config;
  const maxFitColumns = Math.max(1, Math.floor((availableW + GRID_GAP) / (minCell + GRID_GAP)));
  const squareColumns = Math.max(1, Math.ceil(Math.sqrt(desiredCount)));
  // a square-ish layout assumes there's enough HEIGHT for that many
  // rows, which isn't true on a short mobile viewport with a dense
  // round — .play-board has no scroll, so rows that don't fit just get
  // silently clipped. maxFitRows is how many rows can actually fit; if
  // a square grid would need more than that, widen it (more columns,
  // fewer rows) until it doesn't, still never past what the width can
  // physically fit either.
  //
  // ROW_MIN has to match .play-board's real CSS floor — clamp(30px,
  // 6vh, 56px), not a flat 30. A flat 30 assumes every row can be as
  // short as 30px, but on a typical tall mobile viewport 6vh alone is
  // already 40-50px+, well above that assumed floor: the real minimum
  // row height is bigger than what this math accounted for, so it
  // consistently overestimated how many rows actually fit and clipped
  // the last one(s) off-screen — this was the actual bug behind the
  // target tile sometimes never rendering on mobile.
  const ROW_MIN = Math.min(Math.max(30, window.innerHeight * 0.06), 56);
  const maxFitRows = Math.max(1, Math.floor((availableH + GRID_GAP) / (ROW_MIN + GRID_GAP)));
  const minColumnsForHeight = Math.ceil(desiredCount / maxFitRows);
  const columns = Math.min(maxFitColumns, Math.max(squareColumns, minColumnsForHeight));
  // still capped at maxFitRows even after the above — minColumnsForHeight
  // only solves for enough columns to fit the height IF the width can
  // actually support that many; when maxFitColumns is the binding
  // constraint (a narrow board, a dense round), columns gets capped
  // there instead and desiredCount can still need more rows than fit.
  // That's how a round's actual target ended up rendered but clipped
  // below the last visible row, invisible and unreachable — capping
  // rows here guarantees every row rendered is one this viewport can
  // actually show.
  const rows = Math.min(Math.max(1, Math.ceil(desiredCount / columns)), maxFitRows);
  return { columns, rows };
}

function statRow(label, value) {
  return `
    <li class="game-row">
      <div class="row-rule"></div>
      <div class="row-inner">
        <span class="row-label">${label}</span>
        <span class="row-value">${value}</span>
      </div>
    </li>
  `;
}

export default {
  title: '( ? )',
  bodyClass: 'page-question-play',
  render() {
    return `
      <main class="page" style="opacity:0">
        ${renderChrome(`
          <div class="play">
            <p class="play-prompt"></p>
            <div class="row-rule play-rule"></div>
            <p class="play-timer">:30</p>
            <div class="play-board"></div>
            <ul class="game-rows">
              ${STATS.map(s => statRow(s.label, s.value)).join('')}
            </ul>
          </div>
        `)}
      </main>
      <div class="play-countdown">
        <span class="play-square"></span>
        <span class="play-square"></span>
        <span class="play-square"></span>
        <span class="play-square"></span>
      </div>
      <div class="play-cover"></div>
      ${DEV_PANEL_ENABLED ? `
        <div class="dev-panel" data-dev-panel>
          <button type="button" data-dev-toggle>Dev</button>
          <div class="dev-panel-body" hidden>
            ${DEV_ROUNDS.map(r => `<button type="button" data-dev-round="${r.key}">${r.label}</button>`).join('')}
            <button type="button" data-dev-reset>Reset (normal play)</button>
          </div>
        </div>
      ` : ''}
    `;
  },
  init() {
    const { revealNav, teaseLogo, drawFooterRule, revealFooter } = initChrome();

    const page = document.querySelector('.page');
    const cover = document.querySelector('.play-cover');
    const topRule = document.querySelector('.topbar-rule');
    const playEl = document.querySelector('.play');
    // these get rebuilt (and reassigned) on retry — showResultsScreen()
    // replaces playEl's entire content, so the original prompt/board/rows
    // elements are gone once results show, and retry rebuilds fresh ones
    let prompt = document.querySelector('.play-prompt');
    let playRule = document.querySelector('.play-rule');
    let timer = document.querySelector('.play-timer');
    let board = document.querySelector('.play-board');
    let rows = document.querySelectorAll('.play .game-row');
    let roundValue = rows[0]?.querySelector('.row-value');
    let scoreValue = rows[1]?.querySelector('.row-value');

    // prompt starts empty — its text depends on currentTarget, which isn't
    // picked until playNewTargetSequence() runs (see below), so there's
    // nothing to fragment yet
    rows.forEach(r => {
      fragmentElement(r.querySelector('.row-label'));
      fragmentElement(r.querySelector('.row-value'));
    });

    requestAnimationFrame(() => {
      cover.classList.add('is-down');
    });

    setTimeout(() => {
      page.style.opacity = '1';
      startReveal();
    }, SWIPE_MS);

    function startReveal() {
      setTimeout(() => {
        // playRule is deliberately NOT drawn here — it draws in together
        // with the prompt text, after the big target-reveal exits (see
        // playNewTargetSequence)
        topRule?.classList.add('is-drawn');
        rows.forEach(r => r.querySelector('.row-rule')?.classList.add('is-drawn'));
        drawFooterRule();
      }, LINES_DELAY);

      setTimeout(() => {
        revealNav();
      }, LINES_DELAY + 200);

      setTimeout(() => {
        teaseLogo();
      }, LINES_DELAY + 1400);

      rows.forEach((r, i) => {
        setTimeout(() => {
          runReveal(r, WAVE);
        }, ROWS_DELAY + i * ROW_STAGGER);
      });

      setTimeout(() => {
        revealFooter();
      }, ROWS_DELAY + rows.length * ROW_STAGGER + 300);

      setTimeout(() => {
        playNewTargetSequence(startSession);
      }, ROWS_DELAY);
    }

    // --- game state — see game-red-question.js. No round cap — round
    // keeps climbing forever, but score now caps at WIN_SCORE like Odd
    // One Out (see handleCorrect).
    let round = 1;
    let score = 0;
    let timeLeft = START_TIME;
    let timerHandle = null;
    let gameOver = false;
    let boardTween = null;
    let flowRaf = null;
    // results-screen stats — misses/sessionStartMs reset every session
    // (including retry); attemptNo does NOT, it only increments on an
    // actual retry click, not the very first session start
    let misses = 0;
    let sessionStartMs = 0;
    let attemptNo = 1;
    // dev panel state — devForcedConfig, when set, overrides the normal
    // round-number-driven curve; devUnlimitedTimer freezes the countdown
    // so a forced round can be studied without the clock ending it
    let devForcedConfig = null;
    let devUnlimitedTimer = false;
    // the current {char, isRed} everyone's hunting for — re-rolled by
    // playNewTargetSequence() every ROUND_RESET_EVERY rounds (and at
    // session start/retry), not fixed to "?"/orange anymore
    let currentTarget = null;
    // invisible extra hit area around the target, in px past its visible
    // box — only the moving rounds set this (see renderMotionRound/
    // renderScrollRound); static grid/jumble rounds keep exact hitboxes
    // so a neighboring tile never counts as the target
    let hitSlop = { x: 0, y: 0 };

    function updateTimerDisplay() {
      if (!timer) return;
      timer.textContent = devUnlimitedTimer ? ':∞' : `:${String(Math.max(timeLeft, 0)).padStart(2, '0')}`;
    }

    function updateRoundDisplay() {
      if (roundValue) roundValue.textContent = String(round);
    }

    function updateScoreDisplay() {
      if (scoreValue) scoreValue.textContent = String(score);
    }

    function stopMotion() {
      if (boardTween) {
        boardTween.kill();
        boardTween = null;
      }
      if (flowRaf) {
        cancelAnimationFrame(flowRaf);
        flowRaf = null;
      }
      // guarded — stopMotion() now also runs before any round has ever
      // rendered (playTargetReveal calls it going into the target-reveal
      // spectacle), when .play-item can legitimately match nothing; a
      // string-selector gsap call against zero elements is a harmless
      // no-op but logs a console warning every time, which this avoids
      if (board.querySelector('.play-item')) {
        gsap.killTweensOf('.play-item');
        gsap.set('.play-item', { clearProps: 'transform' });
      }
      board.style.removeProperty('--item-font-size');
      // undo the horizontal bleed renderMotionRound applies (same
      // technique as Odd One Out's chaos-bounce/chaos-wrap) — board is
      // reused across every round, so a grid/jumble round right after a
      // motion one would otherwise inherit it
      board.style.removeProperty('margin-left');
      board.style.removeProperty('margin-right');
      board.style.removeProperty('width');
    }

    // shows the current target character huge and alone, centered in the
    // board, rising in — holds, then shrinks/fades out — then hands back
    // to onDone. Board's grid sizing (set by whatever round last used it)
    // is swapped for plain flex centering for the duration, then handed
    // back untouched — renderRound() sets its own grid sizing fresh
    // afterward regardless, so there's nothing to restore.
    function playTargetReveal(target, onDone) {
      stopMotion();
      board.style.display = 'flex';
      board.style.alignItems = 'center';
      board.style.justifyContent = 'center';
      board.innerHTML = `<span class="play-target-char${target.isRed ? ' is-red' : ''}">${esc(target.char)}</span>`;
      const el = board.querySelector('.play-target-char');

      gsap.set(el, { scale: 0.4, opacity: 0 });
      gsap.to(el, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.6)' });
      playSound('wanted');

      setTimeout(() => {
        gsap.to(el, {
          scale: 0.6,
          opacity: 0,
          duration: 0.35,
          ease: 'power2.in',
          onComplete: () => {
            board.innerHTML = '';
            board.style.removeProperty('display');
            board.style.removeProperty('align-items');
            board.style.removeProperty('justify-content');
            onDone();
          },
        });
      }, 1200);
    }

    function applyTargetToPrompt() {
      if (!prompt || !currentTarget) return;
      prompt.innerHTML = `Spot the <span class="${currentTarget.isRed ? 'text-red' : 'play-target-glyph'}">${esc(currentTarget.char)}</span>`;
    }

    // the full "new target" spectacle, strictly sequential so nothing
    // visually clashes: 1) the OLD prompt text (if any) fades out chunk by
    // chunk, inverse-stagger, alongside the timer fading out the same way
    // it fades in (its existing opacity/scale transition, just reversed —
    // not a new animation) — rule not moving yet; 2) only once text is
    // fully gone does the rule quickly retract (is-undrawing's fast
    // transition, not the slow draw-in one reversed); 3) the big target
    // character rises, holds, exits; 4) the rule draws back in at its
    // normal slow pace while the new prompt text staggers in and the
    // timer fades back in, both together, alongside the countdown
    // squares; 5) onDone fires once the countdown finishes. Used
    // identically at first load, on retry, and every ROUND_RESET_EVERY
    // rounds mid-session.
    function playNewTargetSequence(onDone) {
      const UNDRAW_MS = 320; // matches .is-undrawing's own transition duration

      function revealNewTarget() {
        currentTarget = pickNewTarget(currentTarget?.char);
        playTargetReveal(currentTarget, () => {
          applyTargetToPrompt();
          fragmentElement(prompt);
          if (prompt) prompt.style.minHeight = ''; // let it size to the new content now
          playRule?.classList.remove('is-undrawing');
          playRule?.classList.add('is-drawn');
          runReveal(prompt, WAVE);
          timer?.classList.add('is-visible');
          runCountdownSquares(onDone);
        });
      }

      if (prompt?.querySelector('.reveal-chunk.is-visible')) {
        // lock the prompt's current rendered height before clearing it —
        // an empty <p> collapses to a fraction of that, which yanks the
        // rule (and everything below it) upward in an instant snap the
        // moment innerHTML is cleared, before the rule's own undraw
        // animation even starts. That snap, not the rule's transform, was
        // the "line moves up" — scaleX can't move anything vertically on
        // its own.
        prompt.style.minHeight = `${prompt.offsetHeight}px`;
        timer?.classList.remove('is-visible');
        runUnreveal(prompt, WAVE, () => {
          prompt.innerHTML = '';
          playRule?.classList.add('is-undrawing');
          playRule?.classList.remove('is-drawn');
          setTimeout(revealNewTarget, UNDRAW_MS);
        });
      } else {
        // first load / retry — nothing drawn or revealed yet, nothing to undo
        revealNewTarget();
      }
    }

    function renderRound() {
      stopMotion();
      hitSlop = { x: 0, y: 0 };

      // defensive fallback — normally always set by playNewTargetSequence
      // before renderRound() is ever called, but the dev panel can call
      // this directly before any session has started
      if (!currentTarget) currentTarget = pickNewTarget();

      const baseConfig = devForcedConfig ?? getRoundConfig(round);
      const config = { ...baseConfig, targetChar: currentTarget.char, targetIsRed: currentTarget.isRed };
      const { mode, minCell } = config;

      if (mode === 'jumble') {
        renderJumbleRound(config);
        return;
      }

      if (mode === 'motion') {
        renderMotionRound(config);
        return;
      }

      if (mode === 'scroll') {
        renderScrollRound(config);
        return;
      }

      const availableW = board.clientWidth || window.innerWidth;
      const availableH = board.clientHeight || window.innerHeight;
      const { columns, rows } = computeGridDims(config, availableW, availableH);
      const finalCount = columns * rows;

      const items = generateItems(finalCount, config);
      delete board.dataset.layout;
      board.style.gridTemplateColumns = `repeat(${columns}, minmax(${minCell}px, 1fr))`;
      board.innerHTML = items
        .map(item => `<button type="button" class="play-item${item.isRed ? ' is-red' : ''}${item.isTarget ? ' is-target' : ''}">${esc(item.char)}</button>`)
        .join('');
    }

    function renderJumbleRound(config) {
      // real overlapping clutter, not a loosely-jittered grid — count is
      // still a controlled target (config.jumbleCount) fit to the actual
      // board (deriving tile size from it, not the other way around, so
      // it never produces hundreds of items by accident), and columns/
      // rows are still picked to roughly match the board's aspect ratio,
      // but each tile now drifts up to a FULL cell width/height off that
      // grid anchor (not a fraction of one) so neighbors genuinely stack
      // and overlap, and gets its own random rotation on top.
      const target = config.jumbleCount;
      const boardW = board.clientWidth || window.innerWidth;
      const boardH = board.clientHeight || window.innerHeight;
      const aspect = boardW / boardH;
      const columns = Math.max(2, Math.round(Math.sqrt(target * aspect)));
      const tileRows = Math.max(2, Math.ceil(target / columns));
      const count = columns * tileRows;
      const cell = boardW / columns;

      const items = generateItems(count, config);
      board.dataset.layout = 'chaos';
      board.style.gridTemplateColumns = '';
      // a bit bigger than the tile itself, so adjacent items genuinely
      // overlap a little rather than just touching edges
      board.style.setProperty('--item-font-size', `${Math.round(cell * 0.95)}px`);
      const boardHPx = board.clientHeight || window.innerHeight;
      // .play-board has overflow:hidden — an edge tile's jitter had no
      // clamp at all, so it could land (or rotate) partially or fully
      // past the board's actual bounds and just get silently clipped
      // off. Computing position as real pixels (not the old %+px calc())
      // makes it clampable; half a cell of margin keeps every tile's
      // rotated bounding box clear of the edge, not just its center.
      const margin = cell * 0.5;
      board.innerHTML = items
        .map((item, i) => {
          const col = i % columns;
          const row = Math.floor(i / columns);
          const jitterX = Math.round((Math.random() - 0.5) * cell * 1.1);
          const jitterY = Math.round((Math.random() - 0.5) * cell * 1.1);
          const rotate = Math.round((Math.random() - 0.5) * 90);
          const rawLeft = ((col + 0.5) / columns) * boardW + jitterX;
          const rawTop = ((row + 0.5) / tileRows) * boardHPx + jitterY;
          const left = Math.min(Math.max(rawLeft, margin), boardW - margin);
          const top = Math.min(Math.max(rawTop, margin), boardHPx - margin);
          const style = `left:${Math.round(left)}px;top:${Math.round(top)}px;transform:translate(-50%,-50%) rotate(${rotate}deg);`;
          return `<button type="button" class="play-item${item.isRed ? ' is-red' : ''}${item.isTarget ? ' is-target' : ''}" style="${style}">${esc(item.char)}</button>`;
        })
        .join('');
    }

    // same continuous-velocity engine as Odd One Out's chaos-bounce/
    // chaos-wrap — every item moves at its own constant velocity forever,
    // stepped by hand each frame (not tweened point-to-point, and not the
    // old top-to-bottom "conveyor" this replaced). There's no odd one out
    // here: every item, including the target, moves the same way — it's
    // just one more thing buried in the clutter. Bounds/bleed match Odd
    // One Out's approach too: the board's own flex slot is already the
    // right vertical space, only horizontal needs bleeding out to the
    // true screen edges past the page gutter.
    function renderMotionRound(config) {
      const motionCount = isDesktop()
        ? config.motionCount
        : Math.max(Math.round(config.motionCount * MOBILE_MOTION_SCALE), 1);
      const items = generateItems(motionCount, config);
      board.dataset.layout = 'chaos';
      board.style.gridTemplateColumns = '';
      board.style.setProperty('--item-font-size', `${getMotionItemSize(config.motionItemSize)}px`);
      board.style.marginLeft = 'calc(-1 * var(--gutter))';
      board.style.marginRight = 'calc(-1 * var(--gutter))';
      board.style.width = 'calc(100% + 2 * var(--gutter))';

      board.innerHTML = items
        .map(item => `<button type="button" class="play-item${item.isRed ? ' is-red' : ''}${item.isTarget ? ' is-target' : ''}">${esc(item.char)}</button>`)
        .join('');

      const els = [...board.querySelectorAll('.play-item')];
      const boardW = board.clientWidth;
      const boardH = board.clientHeight;

      // items fly in every direction at up to ~130px/s (runConstantMotion),
      // so the slop is the same on both axes — a fraction of the glyph
      // size plus roughly how far the fastest item drifts during a
      // player's reaction lag
      const slop = Math.round(16 + getMotionItemSize(config.motionItemSize) * 0.2 + 130 * 0.12);
      hitSlop = { x: slop, y: slop };

      runConstantMotion(els, boardW, boardH, config.motionPattern);
    }

    function runConstantMotion(els, boardW, boardH, pattern) {
      const bounce = pattern === 'bounce';

      const movers = els.map(el => {
        const speed = 40 + Math.random() * 90;
        const angle = Math.random() * Math.PI * 2;
        const x = Math.random() * boardW;
        const y = Math.random() * boardH;
        gsap.set(el, { xPercent: -50, yPercent: -50, x, y });
        return { el, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };
      });

      let last = performance.now();

      function frame(now) {
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;

        movers.forEach(m => {
          m.x += m.vx * dt;
          m.y += m.vy * dt;

          if (bounce) {
            if (m.x < 0) { m.x = 0; m.vx = Math.abs(m.vx); }
            if (m.x > boardW) { m.x = boardW; m.vx = -Math.abs(m.vx); }
            if (m.y < 0) { m.y = 0; m.vy = Math.abs(m.vy); }
            if (m.y > boardH) { m.y = boardH; m.vy = -Math.abs(m.vy); }
          } else {
            // phase — teleports through the opposite edge instead of
            // bouncing off it
            if (m.x < 0) m.x = boardW;
            if (m.x > boardW) m.x = 0;
            if (m.y < 0) m.y = boardH;
            if (m.y > boardH) m.y = 0;
          }

          gsap.set(m.el, { x: m.x, y: m.y });
        });

        flowRaf = requestAnimationFrame(frame);
      }

      flowRaf = requestAnimationFrame(frame);
    }

    // "scroll" — a real grid, unlike motion/jumble, but every row (or
    // column, config.scrollAxis) is its own independently-scrolling
    // strip, each wrapping seamlessly through itself (phase/portal
    // style — the one that exits the bottom/right re-enters at the
    // top/left, never bounces) rather than looping back instantly. Every
    // strip's items are rendered TWICE back to back (the classic
    // infinite-marquee trick) so there's always a duplicate ready to
    // slide into the spot the original just vacated.
    //
    // Driven by requestAnimationFrame against measured pixel extents,
    // not a CSS @keyframes/-50% animation — a percentage transform is
    // only as seamless as the browser's layout engine resolving it in
    // perfect sync with how it actually laid out the duplicated content.
    //
    // Scrapped the whole duplicated-strip/seam-math approach — every
    // fix just uncovered another layer of the same problem. Each
    // character now just moves independently, all at the same uniform
    // speed/direction (one shared velocity per round, not per-strip),
    // wrapping via simple modulo teleport when it exits the board —
    // literally the same mechanism chaos-bounce/chaos-wrap already use
    // reliably elsewhere in this file (GSAP gsap.set() every frame),
    // just constrained to one steady direction instead of per-item
    // random velocity. No duplicated content, no seam, nothing to
    // measure or get subtly wrong.
    function renderScrollRound(config) {
      const { scrollAxis, scrollSpeedMs } = config;
      const availableW = board.clientWidth || window.innerWidth;
      const availableH = board.clientHeight || window.innerHeight;

      // the exact same fit plain grid mode uses for this config — no
      // more duplication, so no more density compensation needed either
      const { columns, rows } = computeGridDims(config, availableW, availableH);
      const count = columns * rows;
      const cellW = availableW / columns;
      const cellH = availableH / rows;

      board.dataset.layout = 'chaos';
      board.style.gridTemplateColumns = '';
      board.style.setProperty('--item-font-size', `${Math.round(Math.min(cellW, cellH) * 0.6)}px`);

      const items = generateItems(count, config);
      board.innerHTML = items
        .map(item => `<button type="button" class="play-item${item.isRed ? ' is-red' : ''}${item.isTarget ? ' is-target' : ''}">${esc(item.char)}</button>`)
        .join('');

      // row axis (horizontal motion): every item in the same ROW shares
      // a direction, rolled once per row — column axis: same idea per
      // COLUMN. Not one board-wide direction, so it doesn't read as one
      // uniform sheet sliding, but still coherent (a whole row/column
      // moves together) rather than fully random per character.
      const lineCount = scrollAxis === 'row' ? rows : columns;
      const dirByLine = Array.from({ length: lineCount }, () => (Math.random() < 0.5 ? 1 : -1));

      const els = [...board.querySelectorAll('.play-item')];
      const movers = els.map((el, i) => {
        const col = i % columns;
        const row = Math.floor(i / columns);
        const baseX = (col + 0.5) * cellW;
        const baseY = (row + 0.5) * cellH;
        gsap.set(el, { xPercent: -50, yPercent: -50, x: baseX, y: baseY });
        const dir = dirByLine[scrollAxis === 'row' ? row : col];
        return { el, baseX, baseY, dir };
      });

      const extentPx = scrollAxis === 'row' ? availableW : availableH;
      // scrollSpeedMs is "time for one full lap" (same meaning it's had
      // all along, just reused directly here instead of feeding a CSS
      // duration) — converted to a flat px/sec so every character
      // covers the same distance in the same time regardless of extent.
      // Shared by every mover — only direction varies per line now.
      const speedPxPerSec = extentPx / (scrollSpeedMs / 1000);

      // fast rows/columns move the target a long way between seeing it
      // and the press landing — generous along the direction of travel
      // (scaled by speed), tight across it so the neighboring row/column
      // never counts as a hit
      const across = Math.round(Math.max(10, Math.min(cellW, cellH) * 0.25));
      const along = across + Math.round(speedPxPerSec * 0.15);
      hitSlop = scrollAxis === 'row' ? { x: along, y: across } : { x: across, y: along };

      runScrollConveyor(movers, scrollAxis, speedPxPerSec, extentPx);
    }

    // every mover shares the same speedPxPerSec/extentPx but carries its
    // OWN dir (see dirByLine above). Position wraps via plain modulo
    // (kept positive by adding extentPx before the final %, since JS's
    // % can return negative for a negative dividend) rather than an
    // edge-check-and-snap like chaos-bounce/wrap's bounce mode does —
    // there's no "edge" here, just a repeating cycle, so there's nothing
    // to detect or react to, only a position to compute fresh each frame.
    function runScrollConveyor(movers, axis, speedPxPerSec, extentPx) {
      const start = performance.now();

      function frame(now) {
        const elapsed = (now - start) / 1000;
        movers.forEach(m => {
          const travelled = m.dir * speedPxPerSec * elapsed;
          if (axis === 'row') {
            const x = (((m.baseX + travelled) % extentPx) + extentPx) % extentPx;
            gsap.set(m.el, { x });
          } else {
            const y = (((m.baseY + travelled) % extentPx) + extentPx) % extentPx;
            gsap.set(m.el, { y });
          }
        });
        flowRaf = requestAnimationFrame(frame);
      }

      flowRaf = requestAnimationFrame(frame);
    }

    // re-rolls a dev-forced motion config's pattern (bounce/phase) and
    // colorMode (mixed/all-white) — same randomization real gameplay
    // applies per round. Used both when a dev-panel button is first
    // clicked and every time handleCorrect() re-renders the same forced
    // round afterward, so repeatedly clicking through it cycles combos
    // instead of freezing on whichever one got picked first.
    function randomizeDevMotionMode(config) {
      if (config.mode !== 'motion') return;
      config.motionPattern = Math.random() < 0.5 ? 'bounce' : 'phase';
      config.motionColorMode = Math.random() < 0.3 ? 'all-white' : 'mixed';
    }

    function handleCorrect() {
      playSound('correctAnswer');
      if (devForcedConfig) {
        // stay on the same forced round type instead of progressing —
        // this is for studying one round flavor, not playing normally
        randomizeDevMotionMode(devForcedConfig);
        renderRound();
        return;
      }
      round += 1;
      score = Math.min(score + round * POINTS_PER_ROUND, WIN_SCORE);
      // every ROUND_RESET_EVERY rounds the clock snaps back to a fresh
      // base instead of accumulating the usual bonus — a periodic reset
      // rather than one long continuously-banked countdown. The target
      // also changes on this exact boundary (see playNewTargetSequence)
      // — same cadence, one less thing to track. The base itself shrinks
      // once the harder phases kick in (see getBaseTime) — less breathing
      // room exactly when the game starts asking more of you.
      const isNewTargetBoundary = (round - 1) % ROUND_RESET_EVERY === 0;
      if (isNewTargetBoundary) {
        timeLeft = getBaseTime(round);
      } else {
        timeLeft += CORRECT_BONUS;
      }
      updateRoundDisplay();
      updateScoreDisplay();
      updateTimerDisplay();
      if (score >= WIN_SCORE) {
        winGame();
        return;
      }
      if (isNewTargetBoundary) {
        // pause play for the spectacle — clock's already been reset above,
        // so nothing drains while the player can't act anyway
        clearInterval(timerHandle);
        playNewTargetSequence(() => {
          startTimer();
          renderRound();
        });
        return;
      }
      renderRound();
    }

    function handleMiss(btn) {
      playSound('incorrectAnswer');
      misses += 1;
      btn.classList.remove('is-shaking');
      void btn.offsetWidth;
      btn.classList.add('is-shaking');
      setTimeout(() => btn.classList.remove('is-shaking'), 280);
      if (devUnlimitedTimer) return;
      timeLeft -= MISS_PENALTY;
      if (timeLeft <= 0) {
        timeLeft = 0;
        updateTimerDisplay();
        endGame();
        return;
      }
      updateTimerDisplay();
    }

    function isWithinTargetSlop(targetEl, x, y) {
      const r = targetEl.getBoundingClientRect();
      const dx = Math.max(r.left - x, 0, x - r.right);
      const dy = Math.max(r.top - y, 0, y - r.bottom);
      return dx <= hitSlop.x && dy <= hitSlop.y;
    }

    function resolveBoardHit(btn, x, y) {
      if (gameOver) return;
      const targetEl = board.querySelector('.play-item.is-target');
      if (targetEl && (btn === targetEl || isWithinTargetSlop(targetEl, x, y))) {
        handleCorrect();
      } else if (btn) {
        handleMiss(btn);
      }
    }

    // resolved on press, not 'click' — a click only fires if press AND
    // release land on the same element, and in the motion/scroll rounds
    // the character has usually moved out from under the pointer by the
    // time the button comes back up, so most hits silently never counted
    function onBoardPointerDown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      resolveBoardHit(e.target.closest('.play-item'), e.clientX, e.clientY);
    }

    // keyboard activation (Enter/Space on a focused tile) still arrives as
    // a click with detail 0 — real pointer clicks are already handled above
    function onBoardClick(e) {
      if (e.detail !== 0) return;
      const btn = e.target.closest('.play-item');
      if (btn) resolveBoardHit(btn, -Infinity, -Infinity);
    }

    function bindBoard() {
      board.addEventListener('pointerdown', onBoardPointerDown);
      board.addEventListener('click', onBoardClick);
    }
    bindBoard();

    function startTimer() {
      clearInterval(timerHandle);
      if (devUnlimitedTimer) return;
      timerHandle = setInterval(() => {
        timeLeft -= 1;
        if (timeLeft <= 0) {
          timeLeft = 0;
          updateTimerDisplay();
          endGame();
          return;
        }
        updateTimerDisplay();
      }, 1000);
    }

    function showResults(label) {
      gameOver = true;
      clearInterval(timerHandle);
      stopMotion();
      // stopMotion() clears each item's GSAP transform (its only source of
      // position in motion mode — items have no top/left, just x/y) but
      // doesn't remove the items themselves, so for the ~380ms results
      // screen takes to actually swap playEl's content, every item snaps
      // to the board's top-left corner and sits there, fully visible —
      // the "characters flash in the corner" glitch. Clearing the board
      // right away removes them before that gap ever renders a frame.
      board.innerHTML = '';
      const correct = round - 1;
      const totalClicks = correct + misses;
      const accuracy = totalClicks > 0 ? Math.round((correct / totalClicks) * 100) : 0;
      const timePlayed = (Date.now() - sessionStartMs) / 1000;
      showResultsScreen({
        playEl,
        oldRules: [playRule, rows[0]?.querySelector('.row-rule'), rows[1]?.querySelector('.row-rule')],
        label,
        score,
        rounds: round,
        timePlayed,
        misses,
        accuracy,
        attemptNo,
        onRetry: retry,
      });
    }

    function endGame() {
      showResults("Time's up");
    }

    function winGame() {
      showResults('You win!');
    }

    // rebuilds the normal in-game markup inside .play (showResultsScreen
    // replaced it entirely) and re-queries every element retry/gameplay
    // code refers to, since the old ones are gone. Draws instantly (no
    // 1600ms rule-draw, no slow text wave) — a retry should feel fast,
    // not replay the first-ever-load intro.
    function rebuildPlayArea() {
      playEl.innerHTML = `
        <p class="play-prompt"></p>
        <div class="row-rule play-rule"></div>
        <p class="play-timer">:30</p>
        <div class="play-board"></div>
        <ul class="game-rows">
          ${STATS.map(s => statRow(s.label, s.value)).join('')}
        </ul>
      `;

      prompt = document.querySelector('.play-prompt');
      playRule = document.querySelector('.play-rule');
      timer = document.querySelector('.play-timer');
      board = document.querySelector('.play-board');
      rows = document.querySelectorAll('.play .game-row');
      roundValue = rows[0]?.querySelector('.row-value');
      scoreValue = rows[1]?.querySelector('.row-value');

      rows.forEach(r => {
        fragmentElement(r.querySelector('.row-label'));
        fragmentElement(r.querySelector('.row-value'));
      });

      // playRule/prompt intentionally left undrawn/empty — retry() plays
      // the same target-reveal spectacle a first load does, which draws
      // and fills them itself
      rows.forEach(r => r.querySelector('.row-rule')?.classList.add('is-instant', 'is-drawn'));
      playEl.querySelectorAll('.reveal-chunk').forEach(c => c.classList.add('is-visible'));

      bindBoard();
    }

    function retry() {
      attemptNo += 1;
      rebuildPlayArea();
      playNewTargetSequence(resetSession);
    }

    function resetSession() {
      round = 1;
      score = 0;
      timeLeft = getBaseTime(round);
      misses = 0;
      sessionStartMs = Date.now();
      gameOver = false;
      updateRoundDisplay();
      updateScoreDisplay();
      updateTimerDisplay();
      renderRound();
      startTimer();
    }

    function startSession() {
      resetSession();
    }

    if (DEV_PANEL_ENABLED) {
      const devPanel = document.querySelector('[data-dev-panel]');
      const devBody = devPanel?.querySelector('.dev-panel-body');
      devPanel?.querySelector('[data-dev-toggle]')?.addEventListener('click', () => {
        if (devBody) devBody.hidden = !devBody.hidden;
      });
      devPanel?.querySelectorAll('[data-dev-round]').forEach(btn => {
        btn.addEventListener('click', () => {
          const found = DEV_ROUNDS.find(r => r.key === btn.dataset.devRound);
          if (!found) return;
          devForcedConfig = { ...found.config };
          randomizeDevMotionMode(devForcedConfig);
          devUnlimitedTimer = true;
          clearInterval(timerHandle);
          gameOver = false;
          updateTimerDisplay();
          renderRound();
        });
      });
      devPanel?.querySelector('[data-dev-reset]')?.addEventListener('click', () => {
        devForcedConfig = null;
        devUnlimitedTimer = false;
        resetSession();
        startTimer();
      });
    }
  },
  exit() {
    return new Promise(resolve => {
      // leaving the dark play screen for a red page is a full background
      // change, not a shared-chrome swap — cover it with a red swipe-up
      // (appended to body, not #app, so it survives the router's DOM
      // replacement) rather than trying to fade/persist mismatched chrome
      const cover = document.createElement('div');
      cover.className = 'play-exit-cover';
      document.body.appendChild(cover);

      requestAnimationFrame(() => {
        cover.classList.add('is-up');
      });

      setTimeout(() => {
        resolve();

        requestAnimationFrame(() => {
          cover.classList.add('is-hidden');
          setTimeout(() => cover.remove(), EXIT_FADE_MS);
        });
      }, SWIPE_MS);
    });
  }
};

// 4 squares appear left-to-right at low opacity, then light up one at a
// time (3, 2, 1, Go!), then all disappear together, then the real game
// (timer + board) starts.
function runCountdownSquares(onDone) {
  const squares = [...document.querySelectorAll('.play-square')];
  if (!squares.length) { onDone(); return; }

  // none of these classes get removed once a run finishes (is-hiding is
  // the square's final resting state) — without clearing them first, a
  // second run (retry) was a complete no-op: every classList.add() below
  // just re-added a class that was already there, so nothing visibly
  // transitioned and the whole animation silently didn't play
  squares.forEach(sq => sq.classList.remove('is-dim', 'is-lit', 'is-final', 'is-hiding'));

  squares.forEach((sq, i) => {
    setTimeout(() => sq.classList.add('is-dim'), i * SQUARE_APPEAR_GAP);
  });

  const appearDone = (squares.length - 1) * SQUARE_APPEAR_GAP + SQUARE_APPEAR_MS;

  setTimeout(() => {
    playSound('countdown');
    squares.forEach((sq, i) => {
      setTimeout(() => {
        sq.classList.add('is-lit');
        if (i === squares.length - 1) {
          squares.forEach(s => s.classList.add('is-final'));
        }
      }, i * LIGHT_GAP);
    });

    const lightDone = (squares.length - 1) * LIGHT_GAP + LIGHT_MS;

    setTimeout(() => {
      squares.forEach(sq => sq.classList.add('is-hiding'));
      setTimeout(onDone, SQUARE_HIDE_MS);
    }, lightDone + LIT_HOLD_MS);
  }, appearDone + LIGHT_PAUSE_MS);
}
