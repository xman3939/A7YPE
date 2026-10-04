// Round generation for "Odd One Out".
//
// Rounds 1-5: Phase 1 (true grid, fixed positions, no overlap, no motion) —
// item count grows 4->9 (round 1 is a plain 2x2, the smallest grid that's
// still an actual choice, so the ramp into real difficulty is felt fast
// rather than starting already-moderate), difficulty shifts from color to
// size.
// Rounds 6-10: a density stand-in — item count keeps climbing 10->20 and
// the grid's minimum cell size shrinks (52px -> 34px), packing more items
// per row and forcing more rows to appear as a result.
// Rounds 11-15: motion — the grid always renders as a complete rectangle
// (see exclaim-play.js, which snaps the item count up to fill whatever
// column count actually fits the screen, never a ragged partial last row).
// Motion itself ramps up across the phase: 11-12 is a big, easy-to-read
// uniform wave; 13-14 randomizes each item's amplitude/timing so it's not
// a clean predictable pattern; 15 shifts entire rows/columns against each
// other instead of a per-item wave. Item count keeps climbing 15->25.
//
// Every mode except 'color' also gets a random colorMode each round
// (mono-black / mono-white / mixed per-item) — 'color' is excluded since
// black-vs-white IS that mode's whole puzzle; everywhere else it's pure
// visual variance, decoupled from whatever actually marks the odd one out.
//
// Real Phase 2 overlap and Phase 4 (chaos, independent groups) still need
// real layout/collision work — rounds past 15 randomly mix every round
// type built so far (color, size, and all four motion variants, including
// a free-form "chaos-speed" one with no grid at all), and density/minCell
// keep climbing the deeper past round 15 you get (see getRoundConfig), as
// a stand-in until real Phase 2/4 layout work happens.

export const START_TIME = 30;
export const CORRECT_BONUS = 5;
// score is capped at 999 (was 10000, POINTS_PER_ITEM was 10) — same
// proportional pacing, just a 3-digit ceiling for the results screen
export const POINTS_PER_ITEM = 1;
export const MISS_PENALTY = 3;
export const WIN_SCORE = 999;

// the brand's punctuation marks plus a few geometric symbols — reads clean
// and bold at small sizes, reinforces the site's identity over generic content
const CORE_CHARS = ['!', '/', '+', '-', '?', '&', '@', '#', '*', '=', '~'];

const LATE_GAME_VARIANTS = [
  { mode: 'color' },
  { mode: 'size' },
  { mode: 'motion', motionVariant: 'wave' },
  { mode: 'motion', motionVariant: 'wave-random' },
  { mode: 'motion', motionVariant: 'grid-shift' },
  // free-form: no grid at all, items scattered and overlapping, all
  // drifting the same way except the odd one, which moves at a very
  // different speed — a preview of real Phase 4 (chaos)
  { mode: 'motion', motionVariant: 'chaos-speed' },
  // true constant motion, not point-to-point tweening like chaos-speed —
  // every item drifts in a straight line at its own constant velocity
  // forever, reflecting DVD-logo style off the play area's edges. Count,
  // color mix, and how the odd one differs are all randomized per round —
  // see the chaos-bounce/chaos-wrap branch below.
  { mode: 'motion', motionVariant: 'chaos-bounce' },
  // same constant-velocity idea, but items teleport to the opposite edge
  // instead of bouncing off it
  { mode: 'motion', motionVariant: 'chaos-wrap' },
];

// colorMode applies to every mode except 'color' — paints the whole field
// always black, always white, or a random per-item mix, independent of
// whatever actually marks the odd one out (scale for 'size', stillness for
// 'motion'/chaos-speed/chaos-bounce/chaos-wrap). oddSpeedMode is specific
// to chaos-bounce/chaos-wrap: how the odd one differs from everything
// else — dead still, a crawl, or wildly faster than the rest.
export const COLOR_MODES = ['mono-black', 'mono-white', 'mixed'];
export const CHAOS_SPEED_MODES = ['still', 'slow', 'fast'];

function pickColorMode() {
  return COLOR_MODES[Math.floor(Math.random() * COLOR_MODES.length)];
}

export function getRoundConfig(round) {
  if (round > 15) {
    const variant = LATE_GAME_VARIANTS[Math.floor(Math.random() * LATE_GAME_VARIANTS.length)];
    const config = { desiredCount: 25, minCell: 40, ...variant };

    if (variant.mode !== 'color') {
      // density (and, for 'size', cell size) keeps climbing the deeper
      // past round 15 you get, with per-round randomness layered on top so
      // it's not a flat, predictable ramp — capped so it never gets so
      // dense it tanks frame rate or turns into unreadable noise
      const depth = round - 15;
      const isChaosConstant = variant.motionVariant === 'chaos-bounce' || variant.motionVariant === 'chaos-wrap';

      if (isChaosConstant) {
        // this ceiling roughly matches the dev panel's "ultra dense" tier,
        // so a long real session can actually reach that territory, not
        // just the dev shortcut
        config.desiredCount = 30 + Math.min(depth * 5, 180) + Math.floor(Math.random() * 15);
        config.oddSpeedMode = CHAOS_SPEED_MODES[Math.floor(Math.random() * CHAOS_SPEED_MODES.length)];
      } else if (variant.motionVariant === 'chaos-speed') {
        config.desiredCount = 20 + Math.min(depth * 2, 30) + Math.floor(Math.random() * 8);
      } else if (variant.mode === 'size') {
        config.desiredCount = 20 + Math.min(depth * 2, 30) + Math.floor(Math.random() * 8);
        config.minCell = Math.max(50 - Math.min(depth * 1.2, 20), 28);
      } else if (variant.mode === 'motion') {
        // plain-grid motion (wave/wave-random/grid-shift)
        config.desiredCount = 20 + Math.min(depth * 2, 30) + Math.floor(Math.random() * 8);
      }

      config.colorMode = pickColorMode();
    }

    return config;
  }

  const r = round;

  if (r <= 5) {
    // 4 items (a plain 2x2) at the very least — 2 gave the player no real
    // choice to make, it wasn't "easy", it was pointless
    const desiredCount = Math.round(4 + ((r - 1) * (9 - 4)) / 4);
    // color first (rounds 1-2), then size once color's been used a couple times
    const mode = r <= 2 ? 'color' : 'size';
    const config = { desiredCount, mode, minCell: 56 };
    if (mode !== 'color') config.colorMode = pickColorMode();
    return config;
  }

  if (r <= 10) {
    const desiredCount = Math.round(10 + ((r - 6) * (20 - 10)) / 4); // rounds 6-10 -> 10..20 items
    const minCell = Math.round(52 - ((r - 6) * (52 - 34)) / 4); // rounds 6-10 -> 52..34px
    return { desiredCount, mode: 'size', minCell, colorMode: pickColorMode() };
  }

  const desiredCount = Math.round(15 + ((r - 11) * (25 - 15)) / 4); // rounds 11-15 -> 15..25 items
  let motionVariant = 'wave';
  if (r >= 13 && r <= 14) motionVariant = 'wave-random';
  if (r >= 15) motionVariant = 'grid-shift';
  return { desiredCount, mode: 'motion', minCell: 40, motionVariant, colorMode: pickColorMode() };
}

function pickChar() {
  return CORE_CHARS[Math.floor(Math.random() * CORE_CHARS.length)];
}

// count is the FINAL, grid-snapped item count (computed by the caller from
// real layout, since it depends on viewport width) — not the round's
// desiredCount, which is just a target before snapping to a full grid.
export function generateItems(count) {
  const char = pickChar();
  const oddIndex = Math.floor(Math.random() * count);
  const sizeUp = Math.random() < 0.5;

  const items = Array.from({ length: count }, (_, i) => ({
    char,
    isOdd: i === oddIndex,
  }));

  return { items, sizeUp };
}

// chaos-bounce/chaos-wrap only — every item gets its own independently
// random character instead of sharing one like every other round type
// does, for a deliberately noisier field. The odd one is still identified
// purely by motion (standing still), never by which symbol it shows.
export function generateChaosItems(count) {
  const oddIndex = Math.floor(Math.random() * count);
  return Array.from({ length: count }, (_, i) => ({
    char: pickChar(),
    isOdd: i === oddIndex,
  }));
}
