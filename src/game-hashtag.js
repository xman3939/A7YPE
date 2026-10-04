// Round/state logic for "( # )" — Snake, on a 15x15 grid of "#" glyphs.
// The snake is a line of yellow "#"s; the apple is a single white "#".
// Eating an apple grows the snake by one and scores a point. Hitting a
// wall or your own body ends the run immediately — no miss tolerance,
// same instant-death tension every other game here is built around.
//
// "Winning" is filling the entire board (no empty cell left for another
// apple to spawn in) — score is just apples eaten x POINTS_PER_APPLE, no
// artificial scaling, so MAX_SCORE (the real ceiling, not a round 999)
// is whatever that comes out to for a 15x15 board starting at length 3.

export const GRID_SIZE = 15;
export const START_LENGTH = 3;
export const MAX_APPLES = GRID_SIZE * GRID_SIZE - START_LENGTH;
export const POINTS_PER_APPLE = 4;
export const MAX_SCORE = MAX_APPLES * POINTS_PER_APPLE;

export function scoreForApples(applesEaten) {
  return applesEaten * POINTS_PER_APPLE;
}

export const DIRECTIONS = {
  up: { dr: -1, dc: 0 },
  down: { dr: 1, dc: 0 },
  left: { dr: 0, dc: -1 },
  right: { dr: 0, dc: 1 },
};

const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

export function isOpposite(a, b) {
  return OPPOSITE[a] === b;
}

export function cellKey(r, c) {
  return r * GRID_SIZE + c;
}

// center row, growing leftward so the head starts facing right — a
// normal, readable starting pose rather than spawning mid-turn
export function createInitialSnake() {
  const row = Math.floor(GRID_SIZE / 2);
  const headCol = Math.floor(GRID_SIZE / 2);
  return Array.from({ length: START_LENGTH }, (_, i) => ({ r: row, c: headCol - i }));
}

// ticks get faster as the snake grows, same difficulty-ramp idea as
// every other game's round curve — floors out instead of ever becoming
// unplayable
const TICK_MS_START = 220;
const TICK_MS_FLOOR = 90;
const TICK_MS_DROP_PER_LENGTH = 4;

export function getTickMs(length) {
  return Math.max(TICK_MS_START - length * TICK_MS_DROP_PER_LENGTH, TICK_MS_FLOOR);
}

// random EMPTY cell for the next apple — builds the candidate list fresh
// each time rather than retry-on-collision random guessing, which would
// degrade badly (or infinite-loop at exactly MAX_APPLES) as the board
// fills up
export function spawnApple(snakeSet) {
  const empty = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const key = cellKey(r, c);
      if (!snakeSet.has(key)) empty.push(key);
    }
  }
  if (!empty.length) return null;
  return empty[Math.floor(Math.random() * empty.length)];
}
