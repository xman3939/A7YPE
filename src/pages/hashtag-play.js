import { renderChrome, initChrome } from './chrome.js';
import { playSound } from '../audio.js';
import { fragmentElement, runReveal, WAVE } from '../text-reveal.js';
import { showResultsScreen } from '../results-screen.js';
import { GRID_SIZE, MAX_APPLES, DIRECTIONS, isOpposite, cellKey, createInitialSnake, getTickMs, spawnApple, scoreForApples } from '../game-hashtag.js';

const EXIT_FADE_MS = 400;
const LINES_DELAY = 200;
const ROWS_DELAY = LINES_DELAY + 500;
const ROW_STAGGER = 90;

// how long each cell takes to pop in, one at a time, following
// DEAL_ORDER's boustrophedon path across the whole board — same idea as
// ( = )'s lights dealing in, just much smaller/faster per-cell since
// there are 225 of them instead of up to 9
const CELL_DEAL_STAGGER_MS = 6;
// the last cell triggers at (225-1)*6 = 1344ms into the sweep, then its
// own 420ms pop keyframe (style.css) still has to finish — this needs to
// cover that remainder (plus a little breathing room) or gameplay starts
// while the tail end of the board is still visibly popping in
const POST_DEAL_PAUSE_MS = 450;

// a swipe needs to travel at least this many px before it counts as a
// turn — well short of that is more likely an accidental tap/jitter
const SWIPE_THRESHOLD = 24;

const SQUARE_APPEAR_GAP = 130;
const SQUARE_APPEAR_MS = 220;
const LIGHT_PAUSE_MS = 300;
const LIGHT_GAP = 550;
const LIGHT_MS = 150;
const LIT_HOLD_MS = 400;
const SQUARE_HIDE_MS = 300;

const KEY_DIRECTIONS = {
  w: 'up', arrowup: 'up',
  s: 'down', arrowdown: 'down',
  a: 'left', arrowleft: 'left',
  d: 'right', arrowright: 'right',
};

const STATS = [
  { label: 'Apples', value: '0' },
  { label: 'Score', value: '0' },
];

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

// row-major, so a flat GRID_SIZE*GRID_SIZE list of these, queried back in
// the same order, lines up directly with cellKey(r, c) = r*GRID_SIZE + c
function buildCellsHTML() {
  return Array.from({ length: GRID_SIZE * GRID_SIZE }, () => '<span class="hashtag-cell">#</span>').join('');
}

// the order dealInCells reveals cells in — a boustrophedon ("as the ox
// plows") sweep: row 0 left-to-right, row 1 right-to-left, row 2
// left-to-right, and so on, snake-ing back and forth down the board
// instead of hard-cutting back to the left edge every row. Purely a
// reveal-order list of cellKey()s — doesn't touch the cells array's own
// indexing, which stays row-major since gameplay logic (cellKey/
// snakeSet) depends on that. Only depends on GRID_SIZE, so it's the same
// list every time — computed once here instead of rebuilt per call.
const DEAL_ORDER = (() => {
  const order = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    if (r % 2 === 0) {
      for (let c = 0; c < GRID_SIZE; c++) order.push(cellKey(r, c));
    } else {
      for (let c = GRID_SIZE - 1; c >= 0; c--) order.push(cellKey(r, c));
    }
  }
  return order;
})();

export default {
  title: '( # )',
  bodyClass: 'page-hashtag-play',
  render() {
    return `
      <main class="page" style="opacity:0">
        ${renderChrome(`
          <div class="play">
            <p class="play-prompt">Consume the <span class="text-white">#</span></p>
            <div class="row-rule play-rule"></div>
            <div class="hashtag-board">
              <div class="hashtag-grid" style="grid-template-columns:repeat(${GRID_SIZE}, 1fr);grid-template-rows:repeat(${GRID_SIZE}, 1fr);"></div>
            </div>
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
    `;
  },
  init() {
    const { revealNav, teaseLogo, drawFooterRule, revealFooter } = initChrome();

    const page = document.querySelector('.page');
    const cover = document.querySelector('.play-cover');
    const topRule = document.querySelector('.topbar-rule');
    const playEl = document.querySelector('.play');
    // these get rebuilt (and reassigned) on retry — showResultsScreen()
    // replaces playEl's entire content, so the original prompt/rule/board/
    // rows elements are gone once results show, and rebuildPlayArea()
    // creates fresh ones
    let prompt = document.querySelector('.play-prompt');
    let playRule = document.querySelector('.play-rule');
    let board = document.querySelector('.hashtag-board');
    let grid = document.querySelector('.hashtag-grid');
    let rows = document.querySelectorAll('.play .game-row');
    let applesValue = rows[0]?.querySelector('.row-value');
    let scoreValue = rows[1]?.querySelector('.row-value');
    let cells = [];

    if (prompt) fragmentElement(prompt);
    rows.forEach(r => {
      fragmentElement(r.querySelector('.row-label'));
      const value = r.querySelector('.row-value');
      if (value) fragmentElement(value);
    });

    // --- game state ---
    let snake = [];
    let snakeSet = new Set();
    let dir = 'right';
    let pendingDir = null;
    let appleKey = null;
    let applesEaten = 0;
    let totalTicks = 0;
    let tickHandle = null;
    let gameOver = false;
    let sessionStartMs = 0;
    let attemptNo = 1;
    let touchStartX = 0;
    let touchStartY = 0;

    // the slot .hashtag-board claims (flex:1, same as every other play
    // page's board) is almost never square — this finds the largest
    // square that fits inside it and pins .hashtag-grid to exactly that,
    // so cells stay perfectly square with identical gaps on every side
    // instead of stretching to fill a rectangular slot.
    function fitHashtagGrid() {
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
      resizeTimer = setTimeout(fitHashtagGrid, 150);
    };
    window.addEventListener('resize', onResize);

    function updateApplesDisplay() {
      if (applesValue) applesValue.textContent = String(applesEaten);
    }

    function updateScoreDisplay() {
      if (scoreValue) scoreValue.textContent = String(scoreForApples(applesEaten));
    }

    function paintCell(key, add, remove) {
      const cell = cells[key];
      if (!cell) return;
      if (remove) cell.classList.remove(remove);
      if (add) cell.classList.add(add);
    }

    // deals every cell in, one at a time, in DEAL_ORDER's boustrophedon
    // sweep — purely visual, no game state touched yet. Driven by
    // requestAnimationFrame against a real elapsed-time clock rather than
    // firing 225 independent setTimeouts: the browser's timer queue has
    // no obligation to run that many callbacks evenly spaced, so under
    // any load the stagger could visibly stutter/bunch up. A single rAF
    // loop checking "how many cells are due by now" always stays in step
    // with the actual paint clock, and naturally catches up smoothly
    // (revealing more than one cell in a frame) instead of queuing a
    // backlog if a frame runs long.
    let dealRaf = null;
    function dealInCells(onDone) {
      if (dealRaf) cancelAnimationFrame(dealRaf);
      cells.forEach(c => c.classList.remove('is-dealt'));
      const total = cells.length;
      const start = performance.now();
      let nextIndex = 0;

      function frame(now) {
        const elapsed = now - start;
        while (nextIndex < total && nextIndex * CELL_DEAL_STAGGER_MS <= elapsed) {
          cells[DEAL_ORDER[nextIndex]].classList.add('is-dealt');
          nextIndex++;
        }
        if (nextIndex < total) {
          dealRaf = requestAnimationFrame(frame);
        } else {
          dealRaf = null;
          setTimeout(onDone, POST_DEAL_PAUSE_MS);
        }
      }

      dealRaf = requestAnimationFrame(frame);
    }

    function layoutInitialBoard() {
      snake = createInitialSnake();
      snakeSet = new Set(snake.map(s => cellKey(s.r, s.c)));
      dir = 'right';
      pendingDir = null;
      snake.forEach(s => paintCell(cellKey(s.r, s.c), 'is-snake'));
      appleKey = spawnApple(snakeSet);
      if (appleKey !== null) paintCell(appleKey, 'is-apple');
    }

    function onKeyDown(e) {
      if (gameOver) return;
      const wanted = KEY_DIRECTIONS[e.key.toLowerCase()];
      if (!wanted) return;
      if (!isOpposite(wanted, dir)) pendingDir = wanted;
    }
    window.addEventListener('keydown', onKeyDown);

    function onTouchStart(e) {
      if (gameOver) return;
      const t = e.touches[0];
      touchStartX = t.clientX;
      touchStartY = t.clientY;
    }

    function onTouchEnd(e) {
      if (gameOver) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) return;
      const wanted = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      if (!isOpposite(wanted, dir)) pendingDir = wanted;
    }

    function attachBoardControls() {
      board.addEventListener('touchstart', onTouchStart, { passive: true });
      board.addEventListener('touchend', onTouchEnd, { passive: true });
    }

    function tick() {
      totalTicks += 1;
      if (pendingDir && !isOpposite(pendingDir, dir)) dir = pendingDir;
      pendingDir = null;

      const { dr, dc } = DIRECTIONS[dir];
      const head = snake[0];
      const newR = head.r + dr;
      const newC = head.c + dc;

      if (newR < 0 || newR >= GRID_SIZE || newC < 0 || newC >= GRID_SIZE) {
        endGame();
        return;
      }

      const newKey = cellKey(newR, newC);
      const growing = newKey === appleKey;
      const tail = snake[snake.length - 1];
      const tailKey = cellKey(tail.r, tail.c);

      if (snakeSet.has(newKey) && (growing || newKey !== tailKey)) {
        endGame();
        return;
      }

      snake.unshift({ r: newR, c: newC });
      snakeSet.add(newKey);
      paintCell(newKey, 'is-snake', 'is-apple');

      if (growing) {
        applesEaten += 1;
        updateScoreDisplay();
        updateApplesDisplay();
        if (applesEaten >= MAX_APPLES) {
          winGame();
          return;
        }
        appleKey = spawnApple(snakeSet);
        if (appleKey !== null) paintCell(appleKey, 'is-apple');
      } else {
        snake.pop();
        snakeSet.delete(tailKey);
        paintCell(tailKey, null, 'is-snake');
      }
    }

    // rAF-driven, not setTimeout-chained — a timer queue has no
    // obligation to fire exactly on schedule once other work is
    // competing for the main thread, which reads as stutter on
    // something this fast-paced. Tracking real elapsed time against
    // performance.now() and only ticking once that much time has
    // actually passed keeps movement locked to the paint clock instead.
    let lastTickAt = 0;

    function loopFrame(now) {
      if (now - lastTickAt >= getTickMs(snake.length)) {
        lastTickAt = now;
        tick();
      }
      if (!gameOver) {
        tickHandle = requestAnimationFrame(loopFrame);
      }
    }

    function startLoop() {
      stopLoop();
      lastTickAt = performance.now();
      tickHandle = requestAnimationFrame(loopFrame);
    }

    function stopLoop() {
      if (tickHandle) cancelAnimationFrame(tickHandle);
      tickHandle = null;
    }

    function showResults(label) {
      gameOver = true;
      stopLoop();
      const timePlayed = (Date.now() - sessionStartMs) / 1000;
      // what fraction of your moves actually landed an apple — a direct
      // read on how optimal the routing was, not just whether you
      // survived. Every apple costs exactly one tick, every other tick
      // is pure wandering, so this is naturally already a 0-100% ratio.
      const efficiency = totalTicks > 0 ? Math.round((applesEaten / totalTicks) * 100) : 0;
      showResultsScreen({
        playEl,
        oldRules: [playRule, rows[0]?.querySelector('.row-rule'), rows[1]?.querySelector('.row-rule')],
        label,
        score: scoreForApples(applesEaten),
        rounds: applesEaten,
        roundsLabel: '# Eaten',
        timePlayed,
        accuracy: efficiency,
        accuracyLabel: 'Efficiency',
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

    // rebuilds the normal in-game markup inside .play (showResultsScreen
    // replaced it entirely) and re-queries every element retry/gameplay
    // code refers to, since the old ones are gone. Draws instantly (no
    // slow rule-draw, no slow text wave) — a retry should feel fast, not
    // replay the first-ever-load intro. The board itself still deals back
    // in (see retry() below) — that part's the point.
    function rebuildPlayArea() {
      playEl.innerHTML = `
        <p class="play-prompt">Consume the <span class="text-white">#</span></p>
        <div class="row-rule play-rule"></div>
        <div class="hashtag-board">
          <div class="hashtag-grid" style="grid-template-columns:repeat(${GRID_SIZE}, 1fr);grid-template-rows:repeat(${GRID_SIZE}, 1fr);"></div>
        </div>
        <ul class="game-rows">
          ${STATS.map(s => statRow(s.label, s.value)).join('')}
        </ul>
      `;

      prompt = document.querySelector('.play-prompt');
      playRule = document.querySelector('.play-rule');
      board = document.querySelector('.hashtag-board');
      grid = document.querySelector('.hashtag-grid');
      rows = document.querySelectorAll('.play .game-row');
      applesValue = rows[0]?.querySelector('.row-value');
      scoreValue = rows[1]?.querySelector('.row-value');

      if (prompt) fragmentElement(prompt);
      rows.forEach(r => {
        fragmentElement(r.querySelector('.row-label'));
        const value = r.querySelector('.row-value');
        if (value) fragmentElement(value);
      });

      playRule?.classList.add('is-instant', 'is-drawn');
      rows.forEach(r => r.querySelector('.row-rule')?.classList.add('is-instant', 'is-drawn'));
      playEl.querySelectorAll('.reveal-chunk').forEach(c => c.classList.add('is-visible'));

      grid.innerHTML = buildCellsHTML();
      cells = [...grid.querySelectorAll('.hashtag-cell')];
      attachBoardControls();
      fitHashtagGrid();
    }

    function resetSessionState() {
      sessionStartMs = Date.now();
      gameOver = false;
      applesEaten = 0;
      totalTicks = 0;
      if (applesValue) applesValue.textContent = '0';
      if (scoreValue) scoreValue.textContent = '0';
    }

    function retry() {
      attemptNo += 1;
      rebuildPlayArea();
      resetSessionState();
      runCountdownSquares(() => {
        dealInCells(() => {
          layoutInitialBoard();
          startLoop();
        });
      });
    }

    // 4 squares appear left-to-right at low opacity, then light up one at
    // a time (3, 2, 1, Go!), then all disappear together — THEN the board
    // deals in. Same mechanic every other play page's countdown uses.
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

    grid.innerHTML = buildCellsHTML();
    cells = [...grid.querySelectorAll('.hashtag-cell')];
    attachBoardControls();
    fitHashtagGrid();

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

    setTimeout(() => {
      teaseLogo();
    }, ROWS_DELAY + 1400);

    rows.forEach((r, i) => {
      setTimeout(() => {
        runReveal(r, WAVE);
      }, ROWS_DELAY + i * ROW_STAGGER);
    });

    setTimeout(() => {
      revealFooter();
    }, ROWS_DELAY + STATS.length * ROW_STAGGER + 300);

    setTimeout(() => {
      resetSessionState();
      fitHashtagGrid();
      runCountdownSquares(() => {
        dealInCells(() => {
          layoutInitialBoard();
          startLoop();
        });
      });
    }, ROWS_DELAY);

    this._cleanupHashtag = () => {
      stopLoop();
      if (dealRaf) cancelAnimationFrame(dealRaf);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
      clearTimeout(resizeTimer);
    };
  },

  exit() {
    this._cleanupHashtag?.();
    return new Promise(resolve => {
      const play = document.querySelector('.play');
      if (!play) { resolve(); return; }
      play.style.transition = 'opacity 250ms ease';
      play.style.opacity = '0';
      setTimeout(resolve, EXIT_FADE_MS);
    });
  }
};
