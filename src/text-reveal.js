// 1-2 char runs within a single word — never crosses a space, so a chunk
// never spans two words.
function chunkWord(word) {
  const parts = [];
  let i = 0;
  while (i < word.length) {
    const remaining = word.length - i;
    const size = Math.min(remaining, Math.random() < 0.55 ? 1 : 2);
    parts.push(word.slice(i, i + size));
    i += size;
  }
  return parts;
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function fragmentText(text, { bold = false, red = false, white = false } = {}) {
  const extra = `${bold ? ' reveal-chunk--bold' : ''}${red ? ' reveal-chunk--red' : ''}${white ? ' reveal-chunk--white' : ''}`;
  return text
    .split(' ')
    .map(word => {
      if (!word) return '';
      const chunks = chunkWord(word)
        .map(c => `<span class="reveal-chunk${extra}">${esc(c)}</span>`)
        .join('');
      return `<span class="reveal-word">${chunks}</span>`;
    })
    .join(' ');
}

// Each reveal-chunk is display:inline-block so it can animate independently,
// but adjacent inline-block boxes are still valid line-break points even
// with no whitespace between them — so a word's chunks get wrapped in one
// no-wrap span to keep the word atomic, and the actual spaces between words
// are left as plain text so the browser can collapse them normally at a
// wrapped line's start (a space trapped inside a reveal-chunk box can't).
//
// Reads el's existing child nodes (not just textContent) so any <strong>/<b>
// (bold), <span class="text-red"> (red), or <span class="text-white">
// (white) segments already in the markup carry through into the generated
// chunks instead of being flattened to plain text.
export function fragmentElement(el) {
  const html = [...el.childNodes].map(node => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const bold = node.tagName === 'STRONG' || node.tagName === 'B';
      const red = node.classList?.contains('text-red') ?? false;
      const white = node.classList?.contains('text-white') ?? false;
      return fragmentText(node.textContent ?? '', { bold, red, white });
    }
    return fragmentText(node.textContent ?? '', {});
  }).join('');

  el.innerHTML = html;
}

function buildBurstPlan(nodes, burstCount) {
  const shuffled = [...nodes].sort(() => Math.random() - 0.5);
  const bursts = Array.from({ length: burstCount }, () => []);
  shuffled.forEach((node, i) => bursts[i % burstCount].push(node));
  return bursts.map(b => b.sort(() => Math.random() - 0.5));
}

// shared reveal pacing — small gaps between stage starts (rather than waiting
// for each stage to finish) so a cascade reads as one continuous wave
// instead of distinct reveal/pause/reveal blocks
export const WAVE = { burstCount: 8, burstGap: 45, chunkGap: 16 };
export const WAVE_LONG = { burstCount: 18, burstGap: 32, chunkGap: 11 };
export const WAVE_SHORT = { burstCount: 3, burstGap: 45, chunkGap: 15 };

export function runReveal(scope, { burstCount = 6, burstGap = 82, chunkGap = 24 } = {}) {
  const root = typeof scope === 'string'
    ? document.querySelector(scope)
    : (scope ?? document.body);
  const chunks = [...(root?.querySelectorAll('.reveal-chunk') ?? [])];
  if (!chunks.length) return;

  const bursts = buildBurstPlan(chunks, Math.min(burstCount, chunks.length));
  bursts.forEach((burst, bi) => {
    setTimeout(() => {
      burst.forEach((chunk, ci) => {
        setTimeout(() => chunk.classList.add('is-visible'), ci * chunkGap);
      });
    }, bi * burstGap);
  });
}

// the exact inverse of runReveal — same random-burst stagger, but removing
// is-visible instead of adding it, so already-revealed text fades back out
// chunk by chunk instead of vanishing all at once. onDone fires once the
// last chunk's own fade transition has actually finished, not just once
// every stagger delay has been scheduled.
export function runUnreveal(scope, { burstCount = 6, burstGap = 82, chunkGap = 24 } = {}, onDone) {
  const root = typeof scope === 'string'
    ? document.querySelector(scope)
    : (scope ?? document.body);
  const chunks = [...(root?.querySelectorAll('.reveal-chunk.is-visible') ?? [])];
  if (!chunks.length) {
    onDone?.();
    return;
  }

  const FADE_MS = 110; // matches .reveal-chunk's own opacity transition
  const bursts = buildBurstPlan(chunks, Math.min(burstCount, chunks.length));
  let maxDelay = 0;
  bursts.forEach((burst, bi) => {
    burst.forEach((chunk, ci) => {
      const delay = bi * burstGap + ci * chunkGap;
      maxDelay = Math.max(maxDelay, delay);
      setTimeout(() => chunk.classList.remove('is-visible'), delay);
    });
  });
  setTimeout(() => onDone?.(), maxDelay + FADE_MS);
}
