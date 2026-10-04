// Generates SVG outlines for the game marks ("( ! )", "( ? )", "( = )",
// "( # )") directly from the actual font file, instead of rendering them
// as live text. Font rendering engines don't all agree on a font's
// ascent/descent metrics (that's what was causing "( ! )" to sit off-
// center differently on iOS Chrome vs desktop Chrome, despite identical
// CSS) — an SVG's bounding box is exact and fixed at generation time, so
// there's nothing left for a renderer to disagree about.
//
// Run with: node scripts/generate-symbol-svgs.mjs
// Re-run whenever the font file or the mark set changes.

import opentype from 'opentype.js';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONT_PATH = join(__dirname, '../src/assets/fonts/SpaceMono-Bold.ttf');
const DIGIT_FONT_PATH = join(__dirname, '../src/assets/fonts/SpaceMono-Regular.ttf');
const OUT_DIR = join(__dirname, '../src/assets/symbols');
const DIGIT_OUT_DIR = join(__dirname, '../src/assets/digits');

// site font is Space Mono now (was Space Grotesk) — bold weight for the
// marks, since Space Mono only ships 400/700 (no 500) and bold reads
// closer to the old medium-weight marks than regular would. Regular for
// the results-screen digits (below) — bold read too heavy at the size
// those get displayed at.
//
// The home mark is NOT generated here — it's LOGO_A.svg, a hand-designed
// vector logo (src/assets/logos/), unrelated to this font-extraction
// pipeline. Only the 4 game symbols are real font glyphs.
const MARKS = {
  exclaim: '( ! )',
  question: '( ? )',
  equals: '( = )',
  hashtag: '( # )',
};

const REF_SIZE = 1000; // arbitrary large reference size for precision; the SVG scales freely afterward

function loadFont(path) {
  const buf = readFileSync(path);
  const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return opentype.parse(arrayBuffer);
}

const font = loadFont(FONT_PATH);
const digitFont = loadFont(DIGIT_FONT_PATH);

// font.getPath() runs text through opentype.js's full shaping pipeline
// (stringToGlyphs -> Bidi/GSUB processing) to handle scripts that need
// ligatures/contextual substitution — Space Mono's GSUB table uses a
// lookup type/format that pipeline doesn't support and throws on. None of
// these marks need that (plain ASCII, no ligatures), so this bypasses it
// entirely: look up each glyph directly by character and lay it out by
// hand using its own advance width, the same layout math getPath() does
// internally minus the shaping step that was crashing.
function buildPath(sourceFont, text, fontSize, offsetX = 0, offsetY = 0) {
  const fontScale = fontSize / sourceFont.unitsPerEm;
  const fullPath = new opentype.Path();
  let x = offsetX;
  for (const char of text) {
    const glyph = sourceFont.charToGlyph(char);
    fullPath.extend(glyph.getPath(x, offsetY, fontSize));
    x += glyph.advanceWidth * fontScale;
  }
  return fullPath;
}

for (const [name, text] of Object.entries(MARKS)) {
  const path = buildPath(font, text, REF_SIZE);
  const box = path.getBoundingBox();
  const width = box.x2 - box.x1;
  const height = box.y2 - box.y1;

  // re-derive the path data shifted so the bounding box starts at (0,0) —
  // fill="currentColor" so it inherits whatever color CSS would have set
  // on the text it's replacing, same as before
  const shifted = buildPath(font, text, REF_SIZE, -box.x1, -box.y1);
  const d = shifted.toPathData(2);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width.toFixed(2)} ${height.toFixed(2)}" fill="currentColor"><path d="${d}"/></svg>\n`;

  writeFileSync(join(OUT_DIR, `${name}.svg`), svg);
  console.log(`${name}.svg — ${width.toFixed(1)}x${height.toFixed(1)}`);
}

// Digits 0-9 for the results screen's score/attempt numbers
// (src/results-screen.js) — same reasoning as the marks above, but with
// one more problem live text has that the marks never did: those values
// change every game (any 3-digit combo), so there's no fixed string to
// pre-render — results-screen.js composes 3 of these at runtime instead.
// Live text's real issue here wasn't ascent/descent (the marks' bug) so
// much as each glyph's built-in side-bearing — the invisible padding a
// font reserves around ink within its advance width, there so normal body
// text doesn't look cramped. That bearing was eating into "make the digits
// span edge-to-edge", and no amount of measuring/scaling a live text run
// removes it, since it's baked into what gets measured. An SVG path's
// bounding box has none of that — it's the ink and nothing else.
//
// Each digit gets its own tight horizontal bounds (Space Mono's digits
// are similar-but-not-identical widths) but a SHARED vertical bound
// across all 10, computed together — so "1" and "0" don't sit at
// slightly different heights/baselines when results-screen.js lines
// them up next to each other.
const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const digitBoxes = DIGITS.map(d => buildPath(digitFont, d, REF_SIZE).getBoundingBox());
const sharedY1 = Math.min(...digitBoxes.map(b => b.y1));
const sharedY2 = Math.max(...digitBoxes.map(b => b.y2));
const sharedHeight = sharedY2 - sharedY1;

mkdirSync(DIGIT_OUT_DIR, { recursive: true });

DIGITS.forEach((digit, i) => {
  const box = digitBoxes[i];
  const width = box.x2 - box.x1;

  const shifted = buildPath(digitFont, digit, REF_SIZE, -box.x1, -sharedY1);
  const d = shifted.toPathData(2);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width.toFixed(2)} ${sharedHeight.toFixed(2)}" fill="currentColor"><path d="${d}"/></svg>\n`;

  writeFileSync(join(DIGIT_OUT_DIR, `digit-${digit}.svg`), svg);
  console.log(`digit-${digit}.svg — ${width.toFixed(1)}x${sharedHeight.toFixed(1)}`);
});
