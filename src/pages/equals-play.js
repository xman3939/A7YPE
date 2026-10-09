import { renderChrome, initChrome } from './chrome.js';
import { playSound } from '../audio.js';
import { fragmentElement, runReveal, WAVE } from '../text-reveal.js';
import { showResultsScreen } from '../results-screen.js';
import { LIGHT_COUNT_TIER1, LIGHT_COUNT_TIER2, LIGHT_COUNT_TIER3, TIER1_ROUNDS, TIER2_ROUNDS, TIER2_START_SCORE, TIER3_START_SCORE, WIN_SCORE, getLightCount, getTapWindowMs, getPlaybackStepMs, randomLight } from '../game-equals.js';

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

// pause between the player finishing a round and the next, one-step-longer
// sequence starting to play — long enough to read as "nice, next one" and
// not just an instant continuation. Only used when the board ISN'T also
// changing size that round — an expansion gets its own countdown + deal
// instead (see handleLightClick), which already provides plenty of pause.
const NEXT_ROUND_PAUSE_MS = 650;
// how far apart each light's own deal-in pop fires, left to right, row by
// row — DOM order already matches that reading order since the grid is
// just built index 0..n in sequence and CSS grid auto-places it that way.
// Deliberately slow enough that each one reads as its own distinct
// moment rather than a blur of nearly-simultaneous pops.
const LIGHT_DEAL_STAGGER_MS = 150;
// breathing room after the LAST light finishes dealing in and before the
// first flash of the sequence — without it the sequence started firing
// too fast to even register the board before it was already mid-playback
const POST_DEAL_PAUSE_MS = 500;
// how long undealLights()'s fade-out takes (matches .simon-light's own
// opacity transition in style.css) — the pause before whatever comes
// next (the countdown) needs to be at least this long, or it'd start
// while the old lights are still visibly fading away
const UNDEAL_MS = 240;
// how long a lit light stays visibly lit during computer playback, as a
// fraction of that round's own playback step — short enough that
// consecutive repeats of the same light still read as two distinct flashes
const PLAYBACK_LIT_FRACTION = 0.6;
// how long a light stays lit for the player's OWN tap feedback — fixed,
// not tied to the playback pace, since a tap is an instant action rather
// than a timed beat
const TAP_LIT_MS = 160;

const STATS = [
  { label: 'Round', value: '1' },
  { label: 'Score', value: '0' },
];

// jumps straight to a given tier boundary instead of legitimately
// clearing rounds to reach it — same dev-panel convention the other play
// pages use (see exclaim-play.js), switched off here too now that the
// tier mechanics are done
const DEV_PANEL_ENABLED = false;

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

// explicit layout per tier rather than a generic sqrt() — tier 1 is 2
// lights, which isn't a square (a single row of 2 reads cleanest), while
// tiers 2/3 are true 2x2/3x3 squares
const BOARD_LAYOUT = {
  [LIGHT_COUNT_TIER1]: { cols: 2, rows: 1 },
  [LIGHT_COUNT_TIER2]: { cols: 2, rows: 2 },
  [LIGHT_COUNT_TIER3]: { cols: 3, rows: 3 },
};

function buildBoard(lightCount) {
  const { cols, rows } = BOARD_LAYOUT[lightCount];
  return `
    <div class="simon-board" data-count="${lightCount}">
      <div class="simon-grid" style="grid-template-columns:repeat(${cols},1fr);grid-template-rows:repeat(${rows},1fr)">
        ${Array.from({ length: lightCount }, (_, i) => `
          <button type="button" class="simon-light" data-index="${i}" aria-label="Light ${i + 1}">+</button>
        `).join('')}
      </div>
    </div>
  `;
}

export default {
  title: '( = )',
  bodyClass: 'page-equals-play',
  render() {
    return `
      <main class="page" style="opacity:0">
        ${renderChrome(`
          <div class="play">
            <p class="play-prompt">Copy the pattern.</p>
            <div class="row-rule play-rule"></div>
            <p class="play-timer">:60</p>
            ${buildBoard(LIGHT_COUNT_TIER1)}
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
            <button type="button" data-dev-tier1-end>Jump to round 5 (tier 1 → 2x2 next)</button>
            <button type="button" data-dev-tier2-end>Jump to round 13 (tier 2 → 3x3 next)</button>
            <button type="button" data-dev-expand>Jump to 3x3</button>
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
    // elements are gone once results show, and rebuildPlayArea() creates
    // fresh ones
    let prompt = document.querySelector('.play-prompt');
    let playRule = document.querySelector('.play-rule');
    let timer = document.querySelector('.play-timer');
    let board = document.querySelector('.simon-board');
    let grid = document.querySelector('.simon-grid');
    let rows = document.querySelectorAll('.game-row');
    let lights = [];

    if (prompt) fragmentElement(prompt);
    rows.forEach(r => {
      fragmentElement(r.querySelector('.row-label'));
      const value = r.querySelector('.row-value');
      if (value) fragmentElement(value);
    });

    // the slot .simon-board claims (flex:1) is almost never square — this
    // finds the largest square that fits inside it and pins .simon-grid
    // to exactly that, so cells stay perfectly square with identical
    // gaps on every side instead of stretching to fill a rectangular
    // slot. Re-run any time the board itself gets rebuilt (tier change,
    // retry, dev jump) or the window resizes.
    function fitSimonGrid() {
      if (!board || !grid) return;
      grid.style.width = '';
      grid.style.height = '';
      const size = Math.max(Math.min(board.clientWidth, board.clientHeight), 0);
      grid.style.width = `${size}px`;
      grid.style.height = `${size}px`;
    }

    let resizeTimer;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(fitSimonGrid, 150);
    };
    window.addEventListener('resize', onResize);
    fitSimonGrid();

    let round = 1;
    let score = 0;
    let lightCount = LIGHT_COUNT_TIER1;
    let pattern = [];
    let inputIndex = 0;
    let gameOver = false;
    let boardLocked = true;
    let sessionStartMs = 0;
    let attemptNo = 1;
    let tapTimerHandle = null;
    let initialEntranceTimer = null;
    let tapDeadlineMs = 0;
    let tapsTotal = 0;
    let tapsCorrect = 0;

    function updateRoundDisplay() {
      const el = document.querySelector('.game-rows .game-row:nth-child(1) .row-value');
      if (el) el.textContent = String(round);
    }

    function updateScoreDisplay() {
      const el = document.querySelector('.game-rows .game-row:nth-child(2) .row-value');
      if (el) el.textContent = String(score);
    }

    function updateTimerDisplay(msLeft) {
      if (!timer) return;
      const secs = Math.max(0, Math.ceil(msLeft / 1000));
      timer.textContent = `:${String(secs).padStart(2, '0')}`;
    }

    function lightOn(i) {
      lights[i]?.classList.add('is-lit');
    }

    function lightOff(i) {
      lights[i]?.classList.remove('is-lit');
    }

    // deals the current board's lights in one at a time, left to right,
    // row by row (DOM order already matches — see buildBoard) — each one
    // gets its own little pop via .is-dealt (see style.css). onDone fires
    // once the whole deal has finished AND a short pause has passed, not
    // the instant the last light starts animating.
    function dealInLights(onDone) {
      lights.forEach((light, i) => {
        light.classList.remove('is-dealt');
        setTimeout(() => light.classList.add('is-dealt'), i * LIGHT_DEAL_STAGGER_MS);
      });
      setTimeout(onDone, lights.length * LIGHT_DEAL_STAGGER_MS + POST_DEAL_PAUSE_MS);
    }

    // clears the current board before a countdown plays for the next,
    // differently-sized deal — the countdown squares have no backdrop of
    // their own (see .play-countdown), so without this the old lights
    // would just keep sitting there, fully visible, behind/around them
    function undealLights(onDone) {
      lights.forEach(light => light.classList.remove('is-dealt'));
      setTimeout(onDone, UNDEAL_MS);
    }

    // plays the whole current pattern back at this round's pace, one light
    // at a time, then hands off to onDone (starting the player's turn) —
    // the board stays locked the entire time so an impatient click during
    // playback can't be mistaken for an input
    function playSequence(onDone) {
      boardLocked = true;
      const stepMs = getPlaybackStepMs(round);
      const litMs = stepMs * PLAYBACK_LIT_FRACTION;
      pattern.forEach((lightIndex, i) => {
        setTimeout(() => {
          lightOn(lightIndex);
          setTimeout(() => lightOff(lightIndex), litMs);
        }, i * stepMs);
      });
      setTimeout(onDone, pattern.length * stepMs + 200);
    }

    // resets on every correct tap (not just once at the start of the
    // round) — the constraint is staying responsive tap-to-tap, not
    // racing a single clock down across the whole sequence
    function startTapTimer() {
      stopTapTimer();
      const windowMs = getTapWindowMs(round);
      tapDeadlineMs = Date.now() + windowMs;
      updateTimerDisplay(windowMs);
      tapTimerHandle = setInterval(() => {
        const msLeft = tapDeadlineMs - Date.now();
        updateTimerDisplay(msLeft);
        if (msLeft <= 0) {
          stopTapTimer();
          endGame();
        }
      }, 100);
    }

    function stopTapTimer() {
      if (tapTimerHandle) clearInterval(tapTimerHandle);
      tapTimerHandle = null;
    }

    function startInputPhase() {
      if (gameOver) return;
      inputIndex = 0;
      boardLocked = false;
      startTapTimer();
    }

    function showResults(label) {
      gameOver = true;
      stopTapTimer();

      const accuracy = tapsTotal > 0 ? Math.round((tapsCorrect / tapsTotal) * 100) : 0;
      const timePlayed = (Date.now() - sessionStartMs) / 1000;

      showResultsScreen({
        playEl,
        oldRules: [playRule, rows[0]?.querySelector('.row-rule'), rows[1]?.querySelector('.row-rule')],
        label,
        score,
        rounds: round,
        timePlayed,
        accuracy,
        attemptNo,
        onRetry: retry,
      });
    }

    function endGame() {
      showResults('Game over');
    }

    function winGame() {
      showResults('You win!');
    }

    function handleLightClick(i) {
      if (gameOver || boardLocked) return;

      tapsTotal++;

      if (i !== pattern[inputIndex]) {
        endGame();
        return;
      }

      tapsCorrect++;
      lightOn(i);
      setTimeout(() => lightOff(i), TAP_LIT_MS);
      inputIndex++;

      if (inputIndex < pattern.length) {
        startTapTimer();
        return;
      }

      // full pattern repeated correctly — round clear. Score always
      // climbs by 1 and keeps counting globally across the whole game —
      // round (the pattern-length/difficulty ramp) only climbs WITHIN
      // the current tier, and restarts at 1 the moment a tier change
      // happens below, same as a fresh game would.
      boardLocked = true;
      stopTapTimer();
      score += 1;
      updateScoreDisplay();

      if (score >= WIN_SCORE) {
        winGame();
        return;
      }

      // a board-size change gets the full countdown-then-deal treatment
      // (same as the very first round ever) before the next sequence
      // plays — a normal continuation just gets the short pause
      const needed = getLightCount(score);
      if (needed !== lightCount) {
        lightCount = needed;
        round = 1;
        updateRoundDisplay();
        undealLights(() => {
          runCountdownSquares(() => {
            board.outerHTML = buildBoard(lightCount);
            board = document.querySelector('.simon-board');
            grid = document.querySelector('.simon-grid');
            attachLightListeners();
            fitSimonGrid();
            pattern = [randomLight(lightCount)];
            dealInLights(() => {
              playSequence(startInputPhase);
            });
          });
        });
        return;
      }

      round += 1;
      updateRoundDisplay();
      pattern.push(randomLight(lightCount));
      setTimeout(() => playSequence(startInputPhase), NEXT_ROUND_PAUSE_MS);
    }

    function attachLightListeners() {
      lights = [...board.querySelectorAll('.simon-light')];
      lights.forEach(light => {
        light.addEventListener('click', () => handleLightClick(Number(light.dataset.index)));
      });
    }

    function resetSession() {
      round = 1;
      score = 0;
      // the board itself is already a fresh tier-1 grid by the time this
      // runs either way (render() on first load, rebuildPlayArea() on
      // retry) — this just has the JS-side count catch up to match
      lightCount = LIGHT_COUNT_TIER1;
      pattern = [randomLight(lightCount)];
      inputIndex = 0;
      sessionStartMs = Date.now();
      gameOver = false;
      boardLocked = true;
      tapsTotal = 0;
      tapsCorrect = 0;
      updateRoundDisplay();
      updateScoreDisplay();
      attachLightListeners();
    }

    function beginSession() {
      dealInLights(() => playSequence(startInputPhase));
    }

    // rebuilds the normal in-game markup inside .play (showResultsScreen
    // replaced it entirely) and re-queries every element retry/gameplay
    // code refers to, since the old ones are gone. Draws instantly (no
    // rule-draw wait, no slow text wave) — a retry should feel fast, not
    // replay the first-ever-load intro.
    function rebuildPlayArea() {
      playEl.innerHTML = `
        <p class="play-prompt">Copy the pattern.</p>
        <div class="row-rule play-rule"></div>
        <p class="play-timer">:60</p>
        ${buildBoard(LIGHT_COUNT_TIER1)}
        <ul class="game-rows">
          ${STATS.map(s => statRow(s.label, s.value)).join('')}
        </ul>
      `;

      prompt = document.querySelector('.play-prompt');
      playRule = document.querySelector('.play-rule');
      timer = document.querySelector('.play-timer');
      board = document.querySelector('.simon-board');
      grid = document.querySelector('.simon-grid');
      rows = document.querySelectorAll('.play .game-row');

      if (prompt) fragmentElement(prompt);
      rows.forEach(r => {
        fragmentElement(r.querySelector('.row-label'));
        const value = r.querySelector('.row-value');
        if (value) fragmentElement(value);
      });

      playRule?.classList.add('is-instant', 'is-drawn');
      rows.forEach(r => r.querySelector('.row-rule')?.classList.add('is-instant', 'is-drawn'));
      playEl.querySelectorAll('.reveal-chunk').forEach(c => c.classList.add('is-visible'));
      fitSimonGrid();
    }

    function retry() {
      attemptNo += 1;
      rebuildPlayArea();
      resetSession();
      runCountdownSquares(() => {
        timer?.classList.add('is-visible');
        beginSession();
      });
    }

    function runCountdownSquares(onDone) {
      const squares = [...document.querySelectorAll('.play-square')];
      if (!squares.length) { onDone(); return; }

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

    // jumps straight into a round at a specific score/round/light-count
    // instead of legitimately clearing rounds to reach it — a fresh
    // round-length pattern (matching the real pattern.length === round
    // invariant normal play keeps) rather than a token 1-step sequence.
    // score and round are independent here exactly like real play: score
    // is the global clear count, round is how far into the CURRENT tier
    // you are (see the dev-panel click handlers below for each tier's
    // actual numbers).
    function devJumpTo(targetScore, targetRound, targetLightCount) {
      clearTimeout(initialEntranceTimer);
      stopTapTimer();
      gameOver = false;
      boardLocked = true;
      score = targetScore;
      round = targetRound;
      lightCount = targetLightCount;
      board.outerHTML = buildBoard(lightCount);
      board = document.querySelector('.simon-board');
      grid = document.querySelector('.simon-grid');
      attachLightListeners();
      fitSimonGrid();
      pattern = Array.from({ length: round }, () => randomLight(lightCount));
      inputIndex = 0;
      updateScoreDisplay();
      updateRoundDisplay();
      timer?.classList.add('is-visible');
      dealInLights(() => playSequence(startInputPhase));
    }

    if (DEV_PANEL_ENABLED) {
      const devPanel = document.querySelector('[data-dev-panel]');
      const devBody = devPanel?.querySelector('.dev-panel-body');
      devPanel?.querySelector('[data-dev-toggle]')?.addEventListener('click', () => {
        if (devBody) devBody.hidden = !devBody.hidden;
      });
      // one round short of each tier boundary — clear it normally and
      // watch the board actually switch size live, rather than skipping
      // straight past the transition. score is always global (how many
      // rounds you've ever cleared); round is tier-relative (how many
      // you've cleared SINCE this tier started) — tier 1 being the very
      // first tier means its own round count happens to equal score, but
      // tier 2's own round 7 (one short of its own 8) is score 12.
      devPanel?.querySelector('[data-dev-tier1-end]')?.addEventListener('click', () => {
        devJumpTo(TIER2_START_SCORE - 1, TIER1_ROUNDS - 1, LIGHT_COUNT_TIER1);
      });
      devPanel?.querySelector('[data-dev-tier2-end]')?.addEventListener('click', () => {
        devJumpTo(TIER3_START_SCORE - 1, TIER2_ROUNDS - 1, LIGHT_COUNT_TIER2);
      });
      devPanel?.querySelector('[data-dev-expand]')?.addEventListener('click', () => {
        devJumpTo(TIER3_START_SCORE, 1, LIGHT_COUNT_TIER3);
      });
      devPanel?.querySelector('[data-dev-reset]')?.addEventListener('click', () => {
        clearTimeout(initialEntranceTimer);
        resetSession();
        beginSession();
      });
    }

    requestAnimationFrame(() => {
      page.style.transition = 'opacity 400ms ease';
      page.style.opacity = '1';
      cover?.classList.add('is-down');
    });

    setTimeout(() => {
      topRule?.classList.add('is-drawn');
      playRule?.classList.add('is-drawn');
      rows.forEach(r => r.querySelector('.row-rule')?.classList.add('is-drawn'));
      drawFooterRule();
    }, LINES_DELAY);

    setTimeout(() => {
      if (prompt) runReveal(prompt, WAVE);
    }, ROWS_DELAY);

    setTimeout(() => {
      revealNav();
    }, ROWS_DELAY + 200);

    rows.forEach((r, i) => {
      setTimeout(() => {
        runReveal(r, WAVE);
      }, ROWS_DELAY + i * ROW_STAGGER);
    });

    setTimeout(() => {
      revealFooter();
    }, ROWS_DELAY + STATS.length * ROW_STAGGER + 300);

    // stored so a dev-panel action (which can fire well before this does
    // — the panel is interactive from the instant init() runs) can
    // cancel it; otherwise this still goes off on schedule regardless,
    // stomping whatever the dev action just set up underneath it
    initialEntranceTimer = setTimeout(() => {
      resetSession();
      runCountdownSquares(() => {
        timer?.classList.add('is-visible');
        beginSession();
      });
    }, ROWS_DELAY);

    this._cleanupSimonGrid = () => {
      window.removeEventListener('resize', onResize);
      clearTimeout(resizeTimer);
    };
  },

  exit() {
    this._cleanupSimonGrid?.();
    return new Promise(resolve => {
      const play = document.querySelector('.play');
      if (!play) { resolve(); return; }
      play.style.transition = 'opacity 250ms ease';
      play.style.opacity = '0';
      setTimeout(resolve, EXIT_FADE_MS);
    });
  }
};
