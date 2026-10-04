// Round generation for "( ? )" — Find the ?.
//
// The target is always the one tile that's both the current target glyph
// AND the current target color — every other tile deliberately fails at
// least one of those two, so there is always exactly one objectively
// correct answer, guaranteed by construction (see generateItems). The
// target glyph/color aren't fixed to "?"/orange anymore — pickNewTarget()
// rolls a fresh {char, isRed} every ROUND_RESET_EVERY rounds (see
// question-play.js), so the actual thing being searched for changes
// periodically, not just the difficulty.
//
// The round number itself never plateaus or resets back to something
// easier — item count and cell size are clamped to sane values for
// practical DOM/performance reasons, but difficulty just keeps climbing.
// Score, though, now caps at WIN_SCORE like Odd One Out does, ending the
// round when it's hit. The timer separately resets every
// ROUND_RESET_EVERY rounds to a fresh START_TIME instead of accumulating
// forever (see question-play.js), so the pressure keeps resetting rather
// than letting banked time trivialize later rounds.
//
// Difficulty is a discrete phase progression, not one smooth curve — each
// phase has a fixed pool of mode+difficulty combos to randomly pick from,
// so every mode gets introduced somewhere on the way up, and the final
// phase locks everything to its hardest form only:
//
//   1-5:   grid only, single axis (color, then symbol) — the gentle opener
//   6-10:  grid (mixed, hard) or jumble (light)
//   11-15: grid (mixed, ultra hard), jumble (dense), or motion (huge/medium, few)
//   16-20: grid (mixed, ultra hard), jumble (ultra dense), or motion (any size/density)
//   21+:   every mode's hardest form only, randomized
//
// Jumble is a genuinely chaotic overlapping field — each tile drifts most
// of a full cell width/height off its grid anchor (not a fraction of one)
// and gets its own random rotation, so neighbors actually stack and
// overlap instead of just sitting in a loosely-jittered grid.
//
// Motion uses the same continuous-velocity engine as Odd One Out's
// chaos-bounce/chaos-wrap (every item moves at its own constant velocity,
// stepped by hand each frame, not tweened point-to-point) — there's no
// odd one out here, every item including the target moves the same way,
// it's just one more thing buried in the clutter. Text size (huge/medium/
// small) is the primary axis, each split into 3 density levels (few/
// medium/many) — see MOTION_TIERS. Whichever tier(s) a phase allows, each
// round also independently picks bounce (DVD-logo reflect off the play
// area's edges) or phase (teleports through the opposite edge), plus
// whether the whole distractor field goes stark white (harder — color
// alone finds the target then) or the normal mixed field, weighted
// toward mixed so it isn't always the hard version.

export const START_TIME = 60;
export const ROUND_RESET_EVERY = 5;
// phases 1-2 (round 1-10 — the opener through jumble's debut) are the
// tight spots: 30s. Phase 3+ eases back up to 50 — it's already
// objectively harder via density/motion alone, so the sweet spot is a
// little more breathing room there rather than stacking a squeeze on
// top of a squeeze.
export function getBaseTime(round) {
  return round <= 10 ? 30 : 50;
}
// a miss now costs more than a correct answer earns back (was 5 gained /
// 10 lost — still a 1:2 ratio but both nudged so mistakes actually hurt
// instead of being nearly free to shrug off) — less forgiving on purpose
export const CORRECT_BONUS = 4;
// scoring is tied to ROUND depth now, not itemCount — itemCount alone was
// far too generous (a single round late in the curve is up to 90 items,
// so one correct answer there could be worth as much as 90 points at
// POINTS_PER_ITEM=1, ballooning score to 999 in ~20 rounds regardless of
// real skill/survival). score += round * POINTS_PER_ROUND instead ties
// growth to how many rounds you've actually survived: cumulative sum
// 1+2+...+N = N(N+1)/2 hits 999 around round 44 — a real accomplishment
// given difficulty keeps escalating and the target keeps changing (every
// ROUND_RESET_EVERY rounds) the whole way there, not a lucky dense round.
export const POINTS_PER_ROUND = 1;
export const WIN_SCORE = 999;
export const MISS_PENALTY = 14;

// same core punctuation pool as Odd One Out plus digits and letters — this
// is the full pool a target glyph AND its distractor "wrong chars" are
// both drawn from now, not a fixed punctuation-only set (only '?' used to
// need excluding, since it alone was reserved as the target; now whichever
// char pickNewTarget() just rolled is excluded instead).
const FULL_CHAR_POOL = [
  '?', '!', '/', '+', '-', '&', '@', '#', '*', '=', '~',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
];

// picks a fresh {char, isRed} target, excluding the previous target's char
// so it doesn't (visibly) repeat itself — isRed is a real coin flip now,
// not always true: the target can be the orange tile or the plain-ink one,
// see question-play.js's every-ROUND_RESET_EVERY re-roll
export function pickNewTarget(excludeChar) {
  const pool = excludeChar ? FULL_CHAR_POOL.filter(c => c !== excludeChar) : FULL_CHAR_POOL;
  return {
    char: pool[Math.floor(Math.random() * pool.length)],
    isRed: Math.random() < 0.5,
  };
}

// 3 sizes x 3 densities, picked uniformly at random each round (further
// scaled by round depth on top — see getRoundConfig)
const MOTION_TIERS = [
  // huge (140px) — few was too sparse at 18, nudged up slightly; medium
  // and many scale up dramatically from there
  { base: 26, size: 140 },
  { base: 80, size: 140 },
  { base: 160, size: 140 },
  // medium (100px) — the old single "medium" setting (40) is kept as
  // this size's few; medium/many scale up dramatically from it
  { base: 40, size: 100 },
  { base: 120, size: 100 },
  { base: 220, size: 100 },
  // small (70px) — the old single "many" setting (70) is kept as this
  // size's medium baseline; few/many are new, scaled down/up from it
  { base: 45, size: 70 },
  { base: 70, size: 70 },
  { base: 150, size: 70 },
];

// the two "easy" motion tiers (huge-few, medium-few) and the three
// "hardest" ones (every size's "many" density) — used by the phase 3 and
// phase 5 mode pools below
const MOTION_TIERS_EASY = [MOTION_TIERS[0], MOTION_TIERS[3]];
const MOTION_TIERS_HARDEST = [MOTION_TIERS[2], MOTION_TIERS[5], MOTION_TIERS[8]];

// a random char that's explicitly NOT the current target's — used for
// every "wrong symbol" distractor, so a distractor can never accidentally
// duplicate the actual target by chance
function pickOther(excludeChar) {
  const pool = FULL_CHAR_POOL.filter(c => c !== excludeChar);
  return pool[Math.floor(Math.random() * pool.length)];
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function lerp(a, b, t) {
  return a + (b - a) * Math.min(Math.max(t, 0), 1);
}

// motion counts get a little extra on top of whichever tier gets picked,
// scaling with how far past round 11 (motion's earliest phase) the game
// has gone, so it keeps climbing even within a single tier — capped so it
// never runs away past what a tier's own size can sanely display
function computeMotionCount(tier, round) {
  return Math.min(tier.base + Math.min(Math.floor((round - 11) * 1.2), 80), 260);
}

function motionExtras() {
  return {
    motionPattern: Math.random() < 0.5 ? 'bounce' : 'phase',
    // weighted toward 'mixed' — 'all-white' is the harder variant,
    // shouldn't be the norm
    motionColorMode: Math.random() < 0.3 ? 'all-white' : 'mixed',
  };
}

export function getRoundConfig(round) {
  const axis = Math.random() < 0.5 ? 'color' : 'symbol';

  // phase 1 (1-5): grid only, single axis — color first, then symbol,
  // never mixed. The gentle opener.
  if (round <= 5) {
    return {
      mode: 'grid',
      desiredCount: Math.round(3 + ((round - 1) * (9 - 3)) / 4),
      minCell: 60,
      mixFraction: 0,
      axis: round <= 2 ? 'color' : 'symbol',
      jumbleCount: 0,
      ...motionExtras(),
      motionCount: 0,
      motionItemSize: 100,
    };
  }

  // phase 2 (6-10): grid (mixed, hard) or jumble (light)
  if (round <= 10) {
    const t = (round - 6) / 4;
    return {
      mode: Math.random() < 0.5 ? 'grid' : 'jumble',
      desiredCount: Math.round(lerp(15, 35, t)),
      minCell: Math.round(lerp(56, 46, t)),
      mixFraction: lerp(0.35, 0.6, t),
      axis,
      jumbleCount: Math.round(lerp(20, 50, t)),
      ...motionExtras(),
      motionCount: 0,
      motionItemSize: 100,
    };
  }

  // phase 3 (11-15): grid (ultra hard), jumble (dense), or motion
  // (huge/medium, few — motion's easiest tiers, since this is its debut)
  if (round <= 15) {
    const t = (round - 11) / 4;
    const tier = pick(MOTION_TIERS_EASY);
    return {
      mode: pick(['grid', 'jumble', 'motion']),
      desiredCount: Math.round(lerp(50, 90, t)),
      minCell: Math.round(lerp(44, 38, t)),
      mixFraction: lerp(0.65, 0.85, t),
      axis,
      jumbleCount: Math.round(lerp(80, 150, t)),
      ...motionExtras(),
      motionCount: computeMotionCount(tier, round),
      motionItemSize: tier.size,
    };
  }

  // phase 4 (16-20): grid (ultra hard, maxed out), jumble (ultra dense),
  // or motion (any of the 9 size/density combos — fully open now)
  if (round <= 20) {
    const t = (round - 16) / 4;
    const tier = pick(MOTION_TIERS);
    return {
      mode: pick(['grid', 'jumble', 'motion']),
      desiredCount: 90,
      minCell: 36,
      mixFraction: 0.85,
      axis,
      jumbleCount: Math.round(lerp(200, 350, t)),
      ...motionExtras(),
      motionCount: computeMotionCount(tier, round),
      motionItemSize: tier.size,
    };
  }

  // phase 5 (21+): every mode's hardest form only, randomized — grid
  // maxed, jumble maxed, motion restricted to each size's "many" density
  const tier = pick(MOTION_TIERS_HARDEST);
  return {
    mode: pick(['grid', 'jumble', 'motion']),
    desiredCount: 90,
    minCell: 34,
    mixFraction: 0.85,
    axis,
    jumbleCount: 400,
    ...motionExtras(),
    motionCount: computeMotionCount(tier, round),
    motionItemSize: tier.size,
  };
}

// targetChar/targetIsRed come from question-play.js's current target (see
// pickNewTarget above) — config is expected to carry them on top of
// whatever getRoundConfig() returned, merged in by the caller
function makeDistractor({ mixFraction, axis, motionColorMode, targetChar, targetIsRed }) {
  if (motionColorMode === 'all-white') {
    // color is never the tell for symbol here — every distractor is
    // forced to the WRONG color regardless of the usual mixFraction/axis
    // roll, so the target can only be found by its color standing out
    // against an otherwise uniform field
    return { char: Math.random() < 0.5 ? targetChar : pickOther(targetChar), isRed: !targetIsRed, isTarget: false };
  }

  if (mixFraction <= 0) {
    return axis === 'color'
      ? { char: targetChar, isRed: !targetIsRed, isTarget: false } // same symbol, wrong color
      : { char: pickOther(targetChar), isRed: targetIsRed, isTarget: false }; // same color, wrong symbol
  }

  const roll = Math.random();
  if (roll < mixFraction * 0.5) {
    return { char: pickOther(targetChar), isRed: targetIsRed, isTarget: false }; // right color, wrong symbol
  }
  if (roll < mixFraction) {
    return { char: targetChar, isRed: !targetIsRed, isTarget: false }; // wrong color, right symbol
  }
  return { char: pickOther(targetChar), isRed: !targetIsRed, isTarget: false }; // wrong color, wrong symbol
}

// count is the FINAL, grid-snapped item count (computed by the caller from
// real layout, since it depends on viewport width) — not the round's
// desiredCount, which is just a target before snapping to a full grid.
export function generateItems(count, config) {
  const { targetChar, targetIsRed } = config;
  const targetIndex = Math.floor(Math.random() * count);
  const items = [];
  for (let i = 0; i < count; i++) {
    items.push(i === targetIndex ? { char: targetChar, isRed: targetIsRed, isTarget: true } : makeDistractor(config));
  }
  return items;
}
