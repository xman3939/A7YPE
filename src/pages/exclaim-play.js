import gsap from 'gsap';
import { renderChrome, initChrome } from './chrome.js';
import { fragmentElement, runReveal, WAVE } from '../text-reveal.js';
import { showResultsScreen } from '../results-screen.js';
import { playSound } from '../audio.js';
import { START_TIME, CORRECT_BONUS, POINTS_PER_ITEM, MISS_PENALTY, WIN_SCORE, getRoundConfig, generateItems, generateChaosItems, COLOR_MODES, CHAOS_SPEED_MODES } from '../game-odd-one-out.js';

const GRID_GAP = 12;

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
// can be jumped to directly for testing instead of grinding through 25
// rounds to reach it. Currently switched off here (moved to question-play.js
// instead) — flip DEV_PANEL_ENABLED back to import.meta.env.DEV to restore it.
const DEV_PANEL_ENABLED = false;

const DEV_ROUNDS = [
  { key: 'color', label: 'Color', config: { desiredCount: 9, mode: 'color', minCell: 56 } },
  { key: 'size', label: 'Size', config: { desiredCount: 9, mode: 'size', minCell: 56 } },
  { key: 'density', label: 'Density (packed grid)', config: { desiredCount: 20, mode: 'size', minCell: 34 } },
  { key: 'wave', label: 'Motion: wave', config: { desiredCount: 20, mode: 'motion', minCell: 40, motionVariant: 'wave' } },
  { key: 'wave-random', label: 'Motion: wave random', config: { desiredCount: 20, mode: 'motion', minCell: 40, motionVariant: 'wave-random' } },
  { key: 'grid-shift', label: 'Motion: grid shift', config: { desiredCount: 20, mode: 'motion', minCell: 40, motionVariant: 'grid-shift' } },
  { key: 'chaos-speed', label: 'Chaos: speed', config: { desiredCount: 25, mode: 'motion', minCell: 40, motionVariant: 'chaos-speed' } },
  // color/speed aren't fixed here — picked fresh at random on every click,
  // same as real gameplay (see the dev-round click handler below), so
  // these buttons are purely a density shortcut, not a locked-in combo
  { key: 'chaos-bounce', label: 'Chaos: bounce', config: { desiredCount: 35, mode: 'motion', minCell: 40, motionVariant: 'chaos-bounce' } },
  { key: 'chaos-bounce-dense', label: 'Chaos: bounce (dense)', config: { desiredCount: 110, mode: 'motion', minCell: 40, motionVariant: 'chaos-bounce' } },
  { key: 'chaos-bounce-ultra', label: 'Chaos: bounce (ultra dense)', config: { desiredCount: 220, mode: 'motion', minCell: 40, motionVariant: 'chaos-bounce' } },
  { key: 'chaos-wrap', label: 'Chaos: wrap', config: { desiredCount: 35, mode: 'motion', minCell: 40, motionVariant: 'chaos-wrap' } },
  { key: 'chaos-wrap-dense', label: 'Chaos: wrap (dense)', config: { desiredCount: 110, mode: 'motion', minCell: 40, motionVariant: 'chaos-wrap' } },
  { key: 'chaos-wrap-ultra', label: 'Chaos: wrap (ultra dense)', config: { desiredCount: 220, mode: 'motion', minCell: 40, motionVariant: 'chaos-wrap' } },
];

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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
  title: '( ! )',
  bodyClass: 'page-exclaim-play',
  render() {
    return `
      <main class="page" style="opacity:0">
        ${renderChrome(`
          <div class="play">
            <p class="play-prompt">Find the odd one out.</p>
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

    if (prompt) fragmentElement(prompt);
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
        topRule?.classList.add('is-drawn');
        playRule?.classList.add('is-drawn');
        rows.forEach(r => r.querySelector('.row-rule')?.classList.add('is-drawn'));
        drawFooterRule();
      }, LINES_DELAY);

      setTimeout(() => {
        revealNav();
      }, LINES_DELAY + 200);

      setTimeout(() => {
        teaseLogo();
      }, LINES_DELAY + 1400);

      setTimeout(() => {
        if (prompt) runReveal(prompt, WAVE);
      }, ROWS_DELAY);

      rows.forEach((r, i) => {
        setTimeout(() => {
          runReveal(r, WAVE);
        }, ROWS_DELAY + i * ROW_STAGGER);
      });

      setTimeout(() => {
        revealFooter();
      }, ROWS_DELAY + rows.length * ROW_STAGGER + 300);

      setTimeout(() => {
        runCountdownSquares(() => {
          timer?.classList.add('is-visible');
          startSession();
        });
      }, ROWS_DELAY);
    }

    // --- game state (Phase 1-ish — see game-odd-one-out.js) ---
    let round = 1;
    let score = 0;
    let timeLeft = START_TIME;
    let itemCount = 0;
    let timerHandle = null;
    let gameOver = false;
    let boardTween = null;
    let constantMotionRaf = null;
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
      if (constantMotionRaf) {
        cancelAnimationFrame(constantMotionRaf);
        constantMotionRaf = null;
      }
      gsap.killTweensOf('.play-item');
      gsap.set('.play-item', { clearProps: 'transform' });
      board.style.removeProperty('--item-font-size');
      // undo the horizontal bleed renderConstantMotionRound applies —
      // board is reused across every round, so a grid/chaos-speed round
      // right after a constant-motion one would otherwise inherit it
      board.style.removeProperty('margin-left');
      board.style.removeProperty('margin-right');
      board.style.removeProperty('width');
    }

    // re-rolls a dev-forced config's colorMode (every mode except 'color')
    // and, for chaos-bounce/chaos-wrap, oddSpeedMode too — same
    // randomization real gameplay applies per round. Used both when a
    // dev-panel button is first clicked and every time handleCorrect()
    // re-renders the same forced round afterward, so repeatedly clicking
    // through it cycles combos instead of freezing on whichever one got
    // picked first.
    function randomizeDevColorMode(config) {
      if (config.mode === 'color') return;
      config.colorMode = COLOR_MODES[Math.floor(Math.random() * COLOR_MODES.length)];
      if (config.motionVariant === 'chaos-bounce' || config.motionVariant === 'chaos-wrap') {
        config.oddSpeedMode = CHAOS_SPEED_MODES[Math.floor(Math.random() * CHAOS_SPEED_MODES.length)];
      }
    }

    function renderRound() {
      stopMotion();

      const { desiredCount, mode, minCell, motionVariant, colorMode, oddSpeedMode } = devForcedConfig ?? getRoundConfig(round);

      if (motionVariant === 'chaos-speed') {
        renderChaosRound(desiredCount, colorMode);
        return;
      }

      if (motionVariant === 'chaos-bounce' || motionVariant === 'chaos-wrap') {
        renderConstantMotionRound(motionVariant, desiredCount, colorMode, oddSpeedMode);
        return;
      }

      // snap up to a complete rectangle — never a ragged partial last row —
      // by figuring out how many columns actually fit this screen first,
      // then rounding the item count up to a full multiple of that. Same
      // logic on mobile and desktop, so the shape stays consistent; only
      // the column count (and therefore row count) differs by width.
      const availableW = board.clientWidth || window.innerWidth;
      const availableH = board.clientHeight || window.innerHeight;
      const naturalColumns = Math.max(1, Math.floor((availableW + GRID_GAP) / (minCell + GRID_GAP)));
      // on a wide desktop board, naturalColumns alone lets a small
      // desiredCount fit entirely on one row — a single row/column instead
      // of a real 2D grid. Capping columns to roughly sqrt(desiredCount)
      // keeps the shape close to square (same multi-row grid feel mobile
      // gets for free from its narrower width)...
      const squareColumns = Math.max(1, Math.ceil(Math.sqrt(desiredCount)));
      // ...but a square-ish layout assumes there's enough HEIGHT for that
      // many rows, which isn't true on a short mobile viewport with a
      // dense late-game round — .play-board has no scroll, so rows that
      // don't fit just get silently clipped. naturalRows is how many rows
      // can actually fit; if a square grid would need more than that,
      // widen it (more columns, fewer rows) until it doesn't, still never
      // past what the width can physically fit either.
      //
      // ROW_MIN has to match .play-board's real CSS floor — clamp(30px,
      // 6vh, 56px), not a flat 30. A flat 30 assumes every row can be as
      // short as 30px, but on a typical tall mobile viewport 6vh alone is
      // already 40-50px+, well above that assumed floor: the real minimum
      // row height is bigger than what this math accounted for, so it
      // consistently overestimated how many rows actually fit and
      // clipped the last one(s) off-screen.
      const ROW_MIN = Math.min(Math.max(30, window.innerHeight * 0.06), 56);
      const naturalRows = Math.max(1, Math.floor((availableH + GRID_GAP) / (ROW_MIN + GRID_GAP)));
      const minColumnsForHeight = Math.ceil(desiredCount / naturalRows);
      const columns = Math.min(naturalColumns, Math.max(squareColumns, minColumnsForHeight));
      // still capped at naturalRows even after the above — minColumnsForHeight
      // only solves for enough columns to fit the height IF the width can
      // actually support that many; when naturalColumns is the binding
      // constraint (a narrow board, a dense round), columns gets capped
      // there instead and desiredCount can still need more rows than fit.
      // That's how the odd one out could end up rendered but clipped below
      // the last visible row, invisible and unreachable — capping rows
      // here (and shrinking finalCount below the original desiredCount to
      // match) guarantees every row .play-board renders is one this
      // viewport can actually show.
      const rows = Math.min(Math.max(1, Math.ceil(desiredCount / columns)), naturalRows);
      const finalCount = columns * rows;

      const { items, sizeUp } = generateItems(finalCount);
      itemCount = finalCount;
      delete board.dataset.layout;
      board.dataset.mode = mode;
      board.dataset.sizeDir = sizeUp ? 'up' : 'down';
      board.style.gridTemplateColumns = `repeat(${columns}, minmax(${minCell}px, 1fr))`;
      board.innerHTML = items
        .map(item => {
          // 'color' mode's own black/white-for-the-odd-one IS the puzzle —
          // colorMode is only set for every other mode, so this is a no-op
          // there regardless
          const isWhite = colorMode === 'mono-white' || (colorMode === 'mixed' && Math.random() < 0.5);
          return `<button type="button" class="play-item${item.isOdd ? ' is-odd' : ''}${isWhite ? ' is-red' : ''}">${esc(item.char)}</button>`;
        })
        .join('');

      if (mode === 'motion') {
        runMotion(motionVariant, columns, rows);
      }
    }

    function renderChaosRound(desiredCount, colorMode) {
      const { items, sizeUp } = generateItems(desiredCount);
      itemCount = desiredCount;
      board.dataset.mode = 'motion';
      board.dataset.sizeDir = sizeUp ? 'up' : 'down';
      board.dataset.layout = 'chaos';
      board.style.gridTemplateColumns = '';
      board.style.setProperty('--item-font-size', '56px');
      // scattered, overlapping, no grid at all — random spot per item
      board.innerHTML = items
        .map(item => {
          const left = 8 + Math.random() * 84;
          const top = 8 + Math.random() * 84;
          const isWhite = colorMode === 'mono-white' || (colorMode === 'mixed' && Math.random() < 0.5);
          return `<button type="button" class="play-item${item.isOdd ? ' is-odd' : ''}${isWhite ? ' is-red' : ''}" style="left:${left}%;top:${top}%;">${esc(item.char)}</button>`;
        })
        .join('');

      runChaosMotion();
    }

    function runChaosMotion() {
      const items = [...board.querySelectorAll('.play-item')];
      gsap.set(items, { xPercent: -50, yPercent: -50 });

      const oddEl = board.querySelector('.play-item.is-odd');
      const faster = Math.random() < 0.5;

      // true aimless wandering, not a back-and-forth bounce: each item
      // repeatedly picks a fresh random point near its anchor and eases
      // toward it, then immediately picks another — x/y targets are always
      // absolute offsets from the item's fixed left/top anchor (never
      // "+="), so nothing drifts outside clickable bounds over time. Every
      // item wanders the same way at the same pace, except the odd one:
      // half the time it's much faster than the rest, the other half it
      // doesn't move at all — a "much slower" wander still read as just
      // another item and played too hard, standing dead still is the
      // unambiguous version of the same idea.
      items.forEach(el => {
        const isOdd = el === oddEl;
        if (isOdd && !faster) return;

        const legDuration = isOdd ? 0.35 : 1.3 + Math.random() * 0.5;

        const wander = () => {
          gsap.to(el, {
            x: (Math.random() - 0.5) * 44,
            y: (Math.random() - 0.5) * 44,
            duration: legDuration,
            ease: 'sine.inOut',
            onComplete: wander,
          });
        };
        wander();
      });
    }

    // "constant motion" — unlike chaos-speed above (which picks a waypoint
    // and tweens to it, over and over), every item here moves at one fixed
    // velocity forever, stepped by hand each frame instead of through GSAP
    // tweens. Vertically, the board's own flex slot is already exactly the
    // area between the two rule lines (the one above the timer, the one
    // above "Round") — it's a normal flex sibling wedged between them, so
    // that's left alone. Horizontally .play insets everything by the page
    // gutter, so the board is bled out by that same amount on both sides
    // to reach the true screen edges, instead of the (much more fragile)
    // approach of measuring the rules by hand and going position:fixed.
    // The odd one is identified purely by motion (see oddSpeedMode) —
    // never by size or symbol; color is deliberately decoupled from it too
    // (colorMode), so a black/white field can't accidentally give it away.
    function renderConstantMotionRound(motionVariant, desiredCount, colorMode = 'mono-black', oddSpeedMode = 'still') {
      const items = generateChaosItems(desiredCount);
      itemCount = desiredCount;
      board.dataset.mode = 'motion';
      board.dataset.layout = 'chaos';
      board.style.gridTemplateColumns = '';
      board.style.setProperty('--item-font-size', '56px');
      board.style.marginLeft = 'calc(-1 * var(--gutter))';
      board.style.marginRight = 'calc(-1 * var(--gutter))';
      board.style.width = 'calc(100% + 2 * var(--gutter))';

      board.innerHTML = items
        .map(item => {
          // "is-red" is the existing white-on-this-bg class (see the
          // comment on the rule itself) — reused here rather than adding
          // a new one
          const isWhite = colorMode === 'mono-white' || (colorMode === 'mixed' && Math.random() < 0.5);
          return `<button type="button" class="play-item${item.isOdd ? ' is-odd' : ''}${isWhite ? ' is-red' : ''}">${esc(item.char)}</button>`;
        })
        .join('');

      runConstantMotion(motionVariant, oddSpeedMode);
    }

    function runConstantMotion(motionVariant, oddSpeedMode) {
      const els = [...board.querySelectorAll('.play-item')];
      const boardW = board.clientWidth;
      const boardH = board.clientHeight;
      const bounce = motionVariant === 'chaos-bounce';

      const movers = els.map(el => {
        const isOdd = el.classList.contains('is-odd');
        let speed;
        if (!isOdd) {
          speed = 40 + Math.random() * 90;
        } else if (oddSpeedMode === 'slow') {
          speed = 10 + Math.random() * 12;
        } else if (oddSpeedMode === 'fast') {
          speed = 240 + Math.random() * 90;
        } else {
          speed = 0; // 'still'
        }
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
            if (m.x < 0) m.x = boardW;
            if (m.x > boardW) m.x = 0;
            if (m.y < 0) m.y = boardH;
            if (m.y > boardH) m.y = 0;
          }

          gsap.set(m.el, { x: m.x, y: m.y });
        });

        constantMotionRaf = requestAnimationFrame(frame);
      }

      constantMotionRaf = requestAnimationFrame(frame);
    }

    function runMotion(variant, columns, rows) {
      const all = [...board.children];
      const nonOdd = all.filter(el => !el.classList.contains('is-odd'));

      if (variant === 'wave') {
        // one clean, dramatic wave rippling through the grid — the odd one
        // holds still while everything else moves, easy to read at first
        boardTween = gsap.to(nonOdd, {
          y: 30,
          duration: 1,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
          stagger: { each: 0.05, grid: [rows, columns], from: 'start' },
        });
        return;
      }

      if (variant === 'wave-random') {
        // same idea, but every item gets its own randomized amplitude,
        // duration and delay — no more clean predictable stagger, so the
        // still one doesn't stand out against an obviously uniform pattern
        nonOdd.forEach(el => {
          gsap.to(el, {
            y: 18 + Math.random() * 22,
            duration: 0.8 + Math.random() * 0.7,
            delay: Math.random() * 0.6,
            ease: 'sine.inOut',
            yoyo: true,
            repeat: -1,
          });
        });
        return;
      }

      // grid-shift: alternating rows shift horizontally, alternating
      // columns shift vertically — the whole grid moves as rows/columns
      // against each other instead of a per-item wave
      all.forEach((el, i) => {
        if (el.classList.contains('is-odd')) return;
        const rowIndex = Math.floor(i / columns);
        const colIndex = i % columns;
        const xDir = rowIndex % 2 === 0 ? 1 : -1;
        const yDir = colIndex % 2 === 0 ? 1 : -1;
        gsap.to(el, {
          x: 18 * xDir,
          y: 12 * yDir,
          duration: 1.3,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
        });
      });
    }

    function handleCorrect() {
      playSound('correctAnswer');
      if (devForcedConfig) {
        // stay on the same forced round type instead of progressing —
        // this is for studying one round flavor, not playing normally
        randomizeDevColorMode(devForcedConfig);
        renderRound();
        return;
      }
      round += 1;
      score = Math.min(score + itemCount * POINTS_PER_ITEM, WIN_SCORE);
      timeLeft += CORRECT_BONUS;
      updateRoundDisplay();
      updateScoreDisplay();
      updateTimerDisplay();
      if (score >= WIN_SCORE) {
        winGame();
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

    function onBoardClick(e) {
      if (gameOver) return;
      const btn = e.target.closest('.play-item');
      if (!btn) return;
      if (btn.classList.contains('is-odd')) {
        handleCorrect();
      } else {
        handleMiss(btn);
      }
    }
    board.addEventListener('click', onBoardClick);

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
      // position in motion/chaos modes — items have no top/left, just x/y)
      // but doesn't remove the items themselves, so for the ~380ms results
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
        <p class="play-prompt">Find the odd one out.</p>
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

      if (prompt) fragmentElement(prompt);
      rows.forEach(r => {
        fragmentElement(r.querySelector('.row-label'));
        fragmentElement(r.querySelector('.row-value'));
      });

      playRule?.classList.add('is-instant', 'is-drawn');
      rows.forEach(r => r.querySelector('.row-rule')?.classList.add('is-instant', 'is-drawn'));
      playEl.querySelectorAll('.reveal-chunk').forEach(c => c.classList.add('is-visible'));

      board.addEventListener('click', onBoardClick);
    }

    function retry() {
      attemptNo += 1;
      rebuildPlayArea();
      runCountdownSquares(() => {
        timer?.classList.add('is-visible');
        resetSession();
      });
    }

    function resetSession() {
      round = 1;
      score = 0;
      timeLeft = START_TIME;
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
          randomizeDevColorMode(devForcedConfig);
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
