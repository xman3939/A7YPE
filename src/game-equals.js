// Round generation for "( = )" — Simon Says.
//
// The computer plays back a growing sequence of flashes across the
// lights; the player repeats it by clicking the same lights in the same
// order. Each full, correct repeat appends one more step to the sequence
// and scores a point. A single wrong tap ends the run immediately —
// there's no miss tolerance to soften it, that instant tension is the
// whole genre.
//
// Three tiers, each a real jump in board size, not just a faster pace:
//   rounds 1-5    — just 2 lights (score 0-4)
//   rounds 6-13   — 2x2, 4 lights (score 5-12)
//   round 14+     — 3x3, 9 lights (score 13+), on to WIN_SCORE
// Score then climbs the same WIN_SCORE=999 ceiling every other game
// uses, which for a Simon sequence is a genuine "basically impossible"
// feat, not a real target most runs will reach — the actual win
// condition is just "beat your own high score."

export const LIGHT_COUNT_TIER1 = 2;
export const LIGHT_COUNT_TIER2 = 4; // 2x2
export const LIGHT_COUNT_TIER3 = 9; // 3x3
export const TIER1_ROUNDS = 5; // how many rounds tier 1 lasts
export const TIER2_ROUNDS = 8; // how many rounds tier 2 lasts, after tier 1
export const TIER2_START_SCORE = TIER1_ROUNDS; // 5
export const TIER3_START_SCORE = TIER1_ROUNDS + TIER2_ROUNDS; // 13
export const WIN_SCORE = 999;

export function getLightCount(score) {
  if (score < TIER2_START_SCORE) return LIGHT_COUNT_TIER1;
  if (score < TIER3_START_SCORE) return LIGHT_COUNT_TIER2;
  return LIGHT_COUNT_TIER3;
}

// how long the player has to make EACH individual tap — resets on every
// correct tap, not a single fixed budget for the whole sequence, so
// "in a timely manner" means staying responsive throughout rather than
// racing a clock that never gives any time back. Shrinks per round for
// the "gradually" harder part.
const TAP_MS_START = 3000;
const TAP_MS_FLOOR = 900;
const TAP_MS_DROP_PER_ROUND = 60;

export function getTapWindowMs(round) {
  return Math.max(TAP_MS_START - round * TAP_MS_DROP_PER_ROUND, TAP_MS_FLOOR);
}

// how fast the computer plays back the sequence — also tightens slightly
// with round, so a late-game sequence doesn't take forever to watch
const PLAYBACK_MS_START = 650;
const PLAYBACK_MS_FLOOR = 320;
const PLAYBACK_MS_DROP_PER_ROUND = 12;

export function getPlaybackStepMs(round) {
  return Math.max(PLAYBACK_MS_START - round * PLAYBACK_MS_DROP_PER_ROUND, PLAYBACK_MS_FLOOR);
}

export function randomLight(lightCount) {
  return Math.floor(Math.random() * lightCount);
}
