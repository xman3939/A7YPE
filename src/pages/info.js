import { renderChrome, initChrome, roll, isDesktop } from './chrome.js';
import { fragmentElement, runReveal, runUnreveal, WAVE, WAVE_LONG } from '../text-reveal.js';
import logoASvg from '../assets/logos/LOGO_A.svg?raw';
import logoBSvg from '../assets/logos/LOGO_B.svg?raw';
import logoWSvg from '../assets/logos/LOGO_W.svg?raw';
import { DESCRIPTION as EXCLAIM_DESC } from './game-exclaim.js';
import { DESCRIPTION as QUESTION_DESC } from './game-question.js';
import { DESCRIPTION as EQUALS_DESC } from './game-equals.js';
import { DESCRIPTION as HASHTAG_DESC } from './game-hashtag.js';

// each of these three includes its own "A7YPE" red-badge lead-in
// directly (not auto-prepended by darkTextRow — two of these three
// already start with "A7YPE" in the source copy itself, including one
// as a direct possessive, so a single shared prefix+space template
// couldn't handle all three correctly at once)
const LONG_INFO = '<span class="text-red">A7YPE</span> IS A COLLECTION OF MINIGAMES DESIGNED TO CHALLENGE YOUR VISION, MEMORY, AND COORDINATION. DESIGNED WITH A MINIMAL, TYPOGRAPHIC APPROACH, EACH GAME IS BUILT AROUND GLYPHS AND SYMBOLS AS ITS CORE COMPOSITION. ALTHOUGH THE MINIGAMES ARE DESIGNED TO BE SIMPLE AND ADDICTIVE, THE PRIMARY PURPOSE OF THE SITE IS ANSWER THE QUESTION: CAN YOU CREATE A WEB EXPERIENCE WITHOUT IMAGES THAT FEELS COMPLETE? THIS EXPERIMENT DEMONSTRATES HOW INTENTIONAL WEBSITE DESIGN CAN CREATE AN EXPERIENCE THAT FEELS CURATED, DETAILED, AND ENTERTAINING. DESIGNED THOUGHTFULLY FOR MOBILE AND DESKTOP, THERE IS NO INTENDED WAY TO PLAY. A7YPE (PRONOUNCED “A-TYPE”) WHICH IS A SHORTENING OF THE TERM “ATYPOGRAPHY” WHICH MEANS MAKING TYPOGRAPHY THAT IS ABSTRACT AND CONCEALED BUT ALSO LEGIBLE. IN A FEW OF THE MINIGAMES DESIGNED IN THIS EXPERIENCE IT CREATES CLUTTERED, DENSE, AND OFTEN BORDERLINE ILLEGIBLE TYPOGRAPHIC COMPOSITIONS. IT IS AN EXPERIENCE THAT IS MEANT TO BE EXPLORED AT YOUR OWN PACE.';

const PROCESS_INFO = 'DESIGNING THIS WEBSITE CONSISTED OF SEVERAL CREATIVE PHASES THAT ALL PLAYED ESSENTIAL ROLES INTO THE FINAL PRODUCT. THE FIRST PHASE WAS AN EXTENSIVE IDEATION PHASE TAKING IN INSPIRATION FROM A LARGE VARIETY OF DESIGN WORLDS. IDEATING DIFFERENT VISUAL LANGUAGES, GAMEPLAY IDEAS, AND USER INTERFACE CONCEPTS. THE NEXT PHASE WAS DESIGNING A VISUAL IDENTITY FOR THE SITE WHICH CONSISTED OF WORKING IN THE ADOBE CREATIVE SUITE AND FIGMA WHICH EVENTUALLY LED TO THE CYBER-TERMINAL THEME THAT THE SITE HAS NOW. THE NEXT STEP WAS CONCEPTUALIZING THE GAMES THEMSELVES. INSPIRATION CAME FROM GAMES LIKE WARIOWARE, WII PARTY, AND OTHER CLASSIC PARTY GAMES FROM THE EARLY 2000S. AFTER THE CONCEPT WAS FORMED A PROTOTYPE OF THE INTERFACE WAS CREATED. THIS PROTOTYPE WAS USED TO VISUALIZE WHAT WOULD EVENTUALLY BE CREATED IN CODE. THIS PROTOTYPING INCLUDED SCROLL REVEALS, CUSTOM ANIMATIONS, AND PAGE TRANSITIONS. THESE PROTOTYPES ALSO ASSISTED THE DEVELOPMENT PROCESS AND EVOLVED CONSTANTLY. AFTER SEVERAL WAVES OF USER TESTING THE FINAL RESULT WAS MADE.';

const VISUAL_IDENTITY_INFO = '<span class="text-red">A7YPE’S</span> VISUAL IDENTITY IS ESTABLISHED PRIMARILY THROUGH GRAPHICS, COLOR, TYPOGRAPHY, AND ANIMATION. THE LOGOMARK (DEPICTING THE “A”) IS THE CORE GRAPHIC COMPONENT THAT SETS THE TONE FROM THE START. WITH ITS BOLD SILHOUETTE AND MODERN, ANGULAR FORM IT ESTABLISHES THE PRECISION THAT IS CORE TO THE SITE’S DESIGN AND THAT IS REQUIRED OF ITS USERS IN THE MINIGAMES. DESPITE ITS POWERFUL PRESENCE IT IS THE ONLY TRADITIONAL GRAPHIC ELEMENT MOVING THE IDENTITY FORWARD. THE LACK OF ICONOGRAPHY AND IMAGE BECAME THE LARGEST ASPECT OF THE SITE’S IDENTITY. THIS CAN BE SEEN IN THE MINIGAME NAMING CONVENTION, WHERE YOU WOULD NORMALLY SEE AN ICON OR TITLE YOU SEE IT REPLACED BY A SYMBOL EMBEDDED WITHIN PARENTHESIS. IT ESTABLISHES A SENSE OF MYSTERY ON FIRST VISIT THAT EMPHASIZES THE GOAL OF EXPLORATION. THE COLOR PALETTE IS A SAMPLING OF GRAYS THAT EACH HAVE A VERY SPECIFIC ROLE IN THE INTERFACE AND THE ICONIC BURST OF ACID YELLOW PLACES EMPHASIS WHEREVER NEEDED. ALL OF THIS IS ELEGANTLY COMPLIMENTED BY THE TYPEFACE SPACE MONO WHICH SETS THE BRUTALIST TECH TONE.';

// title = the game's own symbol, text = that game's own description —
// "same as game desc" per spec, not separate copy to keep in sync by hand
const PROCESS_ITEMS = [
  { title: '( ! )', text: EXCLAIM_DESC },
  { title: '( ? )', text: QUESTION_DESC },
  { title: '( = )', text: EQUALS_DESC },
  { title: '( # )', text: HASHTAG_DESC },
];

// the site's real palette (--orange/--black/--gray/--white) plus two
// computed in-between grays to fill out a smooth 5-step black-to-white
// ramp alongside the one accent color — not arbitrary swatches, every
// hex here is either an actual CSS variable or an evenly interpolated
// step between two of them. logo: which mark variant (b/w) actually
// reads against that swatch's own background.
const SWATCHES = [
  { name: 'Acid Yellow', hex: '#FAFF62', pantone: 'Yellow 012 C', logo: 'b' },
  { name: 'Ink', hex: '#272727', pantone: 'Black 6 C', logo: 'w' },
  { name: 'Deepslate', hex: '#5B5B5B', pantone: 'Cool Gray 11 C', logo: 'w' },
  { name: 'Stone', hex: '#8F8F8F', pantone: 'Cool Gray 8 C', logo: 'b' },
  { name: 'Diorite', hex: '#CACACA', pantone: 'Cool Gray 3 C', logo: 'b' },
  { name: 'Quartz', hex: '#F8F8F8', pantone: 'White', logo: 'b' },
];

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToCmyk([r, g, b]) {
  const rf = r / 255, gf = g / 255, bf = b / 255;
  const k = 1 - Math.max(rf, gf, bf);
  if (k >= 1) return [0, 0, 0, 100];
  const c = (1 - rf - k) / (1 - k);
  const m = (1 - gf - k) / (1 - k);
  const y = (1 - bf - k) / (1 - k);
  return [c, m, y, k].map(v => Math.round(v * 100));
}

function pad3(n) {
  return String(n).padStart(3, '0');
}

function swatchValue(label, value) {
  return `<div class="info-color-value"><span>${label}</span><span>${value}</span></div>`;
}

function colorSwatch(swatch, i) {
  const rgb = hexToRgb(swatch.hex);
  const cmyk = rgbToCmyk(rgb);
  const textColor = swatch.logo === 'w' ? 'var(--white)' : 'var(--black)';
  const mark = swatch.logo === 'w' ? logoWSvg : logoBSvg;
  return `
    <div class="info-color-swatch" data-reveal style="background:${swatch.hex};color:${textColor}" data-swatch-index="${i}">
      <div class="info-color-swatch-top">
        <span class="info-color-swatch-name">${swatch.name.toUpperCase()}</span>
        <div class="info-color-swatch-values">
          ${swatchValue('HEX', swatch.hex.toUpperCase())}
          ${swatchValue('RGB', rgb.map(pad3).join('.'))}
          ${swatchValue('CMYK', cmyk.map(pad3).join('.'))}
        </div>
      </div>
      <div class="info-color-swatch-bottom">
        <span class="info-color-swatch-mark" aria-hidden="true">${mark}</span>
        <div class="info-color-swatch-values">
          ${swatchValue('PANTONE', swatch.pantone)}
        </div>
      </div>
    </div>
  `;
}

// one "A7YPE" row: title and paragraph laid out via CSS grid areas (see
// .info-dark-row--text in style.css) rather than a nested flex row — on
// desktop the title sits beside the paragraph, between the two rules,
// same as before; on mobile the grid areas rearrange so the title moves
// above the top rule instead of being nested inside the rule pair. Its
// own top AND bottom rule, not shared with its neighbors.
function darkTextRow(label, text) {
  return `
    <div class="info-dark-row info-dark-row--text" data-reveal>
      <span class="info-row-label row-label">${label}</span>
      <div class="row-rule"></div>
      <p class="info-row-text">${text}</p>
      <div class="row-rule"></div>
    </div>
  `;
}

// no heading/description anymore — straight from .info-dark's last rule
// into the swatches themselves, no separate "COLOR" intro section
function buildColorSection() {
  return `
    <section class="info-color">
      <div class="info-color-swatches">
        ${SWATCHES.map((s, i) => colorSwatch(s, i)).join('')}
      </div>
    </section>
  `;
}

const THANKS = Array(8).fill('Lorem ipsum');
// placeholder hrefs — real destinations (issue tracker, portfolio work
// page, about page, LinkedIn profile) to be filled in later
const LINKS = [
  { label: 'Support', href: 'mailto:xavierkania1222@gmail.com' },
  { label: 'Other work', href: '#' },
  { label: 'About', href: '#' },
  { label: 'LinkedIn', href: '#' },
];

function accordionRow(title, text) {
  return `
    <li class="info-accordion-row" data-reveal>
      <div class="row-rule"></div>
      <button type="button" class="info-accordion-toggle" data-accordion-toggle aria-expanded="false">
        <span class="row-label">${title}</span>
        <span class="info-accordion-icon">+</span>
      </button>
      <div class="info-accordion-body">
        <p class="info-accordion-text">${text}</p>
      </div>
    </li>
  `;
}

function footerListItem(text) {
  return `<li class="info-footer-item"><span class="info-footer-item-text">${text}</span></li>`;
}

function footerLinkItem(label, href) {
  // target="_blank" makes sense for an external page, but for a mailto:
  // link it just leaves a stray empty tab behind after handing off to
  // the OS mail client — skip it there
  const attrs = href.startsWith('mailto:') ? '' : ' target="_blank" rel="noopener"';
  return `<li class="info-footer-item"><a class="info-footer-item-text" href="${href}"${attrs}>${roll(`&rarr;${label}`)}</a></li>`;
}

// two bars, both split into two per-column segments (symmetric, not one
// continuous line): a top bar under the two headings, and a bottom bar
// closing off both columns at the same height — that bottom bar is
// pushed to the bottom of each column with margin-top:auto, so Special
// Thanks' shorter list and the Links column's list+mark both end at the
// exact same line regardless of which has more content.
function buildDesktopFooter() {
  return `
    <footer class="info-footer">
      <div class="info-footer-columns">
        <div class="info-footer-divider" aria-hidden="true"></div>
        <div class="info-footer-col info-footer-col--thanks">
          <span class="info-footer-heading">Special Thanks</span>
          <div class="row-rule"></div>
          <ul class="info-footer-list">
            ${THANKS.map(t => footerListItem(t)).join('')}
          </ul>
          <div class="row-rule info-footer-rule--bottom"></div>
        </div>
        <div class="info-footer-col info-footer-col--links">
          <span class="info-footer-heading">Links</span>
          <div class="row-rule"></div>
          <ul class="info-footer-list">
            ${LINKS.map(l => footerLinkItem(l.label, l.href)).join('')}
          </ul>
          <div class="row-rule"></div>
          <div class="info-footer-mark" aria-hidden="true">${logoBSvg}</div>
          <div class="row-rule info-footer-rule--bottom"></div>
        </div>
      </div>
      <div class="info-footer-bottom">
        <p class="info-footer-build filler">Build by Xavier Kania, 2026</p>
        <div class="info-footer-links">
          <a href="https://xavierkania.com/contact" target="_blank" rel="noopener">${roll('&rarr;Contact')}</a>
          <a href="https://xavierkania.com" target="_blank" rel="noopener">${roll('&rarr;Portfolio')}</a>
        </div>
      </div>
    </footer>
  `;
}

// mobile is a plain linear stack, not the 2-column grid — Links, then
// Special Thanks, then the mark full-width at the bottom, then just
// "Build by" alone (no separate Contact/Portfolio buttons; those live as
// ordinary entries in the Links list instead)
function buildMobileFooter() {
  return `
    <footer class="info-footer">
      <div class="info-footer-col info-footer-col--links">
        <span class="info-footer-heading">Links</span>
        <div class="row-rule"></div>
        <ul class="info-footer-list">
          ${LINKS.map(l => footerLinkItem(l.label, l.href)).join('')}
        </ul>
      </div>
      <div class="row-rule"></div>
      <div class="info-footer-col info-footer-col--thanks">
        <span class="info-footer-heading">Special Thanks</span>
        <div class="row-rule"></div>
        <ul class="info-footer-list">
          ${THANKS.map(t => footerListItem(t)).join('')}
        </ul>
      </div>
      <div class="row-rule"></div>
      <div class="info-footer-mark info-footer-mark--mobile" aria-hidden="true">${logoBSvg}</div>
      <div class="row-rule"></div>
      <div class="info-footer-bottom">
        <p class="info-footer-build filler">Build by Xavier Kania, 2026</p>
      </div>
    </footer>
  `;
}

function renderFooter() {
  return isDesktop() ? buildDesktopFooter() : buildMobileFooter();
}

// tracked at module scope so a later resize (setupFooter rebuilding the
// footer on a breakpoint change) and exit() (cleaning up the resize
// listener itself) can both reach the current instances without threading
// them through every function in init()
let footerObserver = null;
let markObserver = null;
let resizeHandler = null;

export default {
  title: 'Info',
  bodyClass: 'page-info',
  render() {
    return `
      <main class="page" style="opacity:0">
        ${renderChrome(`
          <section class="info-dark">
            ${darkTextRow('A7YPE', LONG_INFO)}
            ${darkTextRow('PROCESS', PROCESS_INFO)}

            <div class="info-dark-row info-dark-row--grid" data-reveal>
              <ul class="info-accordion">
                ${PROCESS_ITEMS.map(item => accordionRow(item.title, item.text)).join('')}
              </ul>
              <div class="row-rule"></div>
            </div>

            ${darkTextRow('VISUAL IDENTITY', VISUAL_IDENTITY_INFO)}

            <div class="info-dark-row info-dark-row--logomark" data-reveal>
              <div class="row-rule"></div>
              <div class="info-dark-logomark-wrap">
                <div class="info-dark-logomark-inner">
                  <span class="row-label info-dark-label">Logomark</span>
                  <div class="info-dark-logomark" aria-hidden="true">${logoASvg}</div>
                </div>
              </div>
              <div class="row-rule"></div>
            </div>
          </section>
          ${buildColorSection()}
        `, renderFooter())}
      </main>
    `;
  },
  init() {
    // desktop's nav persists across navigation rather than re-animating
    // every time (see chrome.js and every other page's own persistChrome
    // branch) — only the nav itself; page CONTENT below it is handled
    // uniformly by the scroll-triggered reveal system further down,
    // regardless of breakpoint.
    const persistChrome = isDesktop();
    const { revealNav, teaseLogo } = initChrome({ instant: persistChrome });

    const page = document.querySelector('.page');
    const topbarSticky = document.querySelector('.topbar-sticky');
    const topRule = document.querySelector('.topbar-rule');
    const colorSection = document.querySelector('.info-color');

    // the rule under the nav loads already drawn — it's there from the
    // first frame same as every other page's, so there's nothing to
    // animate in on arrival (an entrance would have nothing to transition
    // from). But it behaves exactly like every other rule on this page
    // once you're scrolling: drawn while its section is in view, undrawn
    // once you've scrolled past it — same mechanism, just driven by
    // scroll position instead of IntersectionObserver, since it's
    // sticky-pinned to the top and can never actually leave the viewport
    // the way a normal rule would.
    topRule?.classList.add('is-instant', 'is-drawn');
    requestAnimationFrame(() => topRule?.classList.remove('is-instant'));

    function updateTopRule() {
      if (!topRule || !page) return;
      topRule.classList.add('is-undrawing');
      topRule.classList.toggle('is-drawn', page.scrollTop <= 4);
    }
    page?.addEventListener('scroll', updateTopRule, { passive: true });

    if (persistChrome) {
      page.style.opacity = '1';
      revealNav();
      teaseLogo();
    } else {
      requestAnimationFrame(() => {
        page.style.transition = 'opacity 400ms ease';
        page.style.opacity = '1';
      });
      setTimeout(() => revealNav(), 200);
      setTimeout(() => teaseLogo(), 1600);
    }

    // the nav's own default ink is white now — .info-dark (black bg) is the
    // first thing under it. It darkens to black once scrolled over either
    // the gray COLOR section or the yellow footer, both of which need dark
    // ink instead — checked against .page's own scroll, since .page is
    // what actually scrolls on this page, not the window. The footer gets
    // re-queried fresh each call rather than cached, since a breakpoint
    // resize replaces its whole DOM node (see setupFooter/handleResize).
    function updateNavContrast() {
      if (!topbarSticky) return;
      const navRect = topbarSticky.getBoundingClientRect();
      const footerEl = document.querySelector('.info-footer');
      const isOverLightSection = [colorSection, footerEl].filter(Boolean).some(el => {
        const rect = el.getBoundingClientRect();
        return rect.top <= navRect.bottom && rect.bottom > navRect.top;
      });
      topbarSticky.classList.toggle('is-over-light-section', isOverLightSection);
    }

    page?.addEventListener('scroll', updateNavContrast, { passive: true });
    updateNavContrast();

    // fragment every piece of revealable text ONCE up front — the
    // scroll-reveal system below only ever toggles .is-visible on the
    // chunks fragmentElement() produces (via runReveal/runUnreveal), it
    // never re-fragments, so this only needs to happen a single time.
    // Footer text is handled separately, in setupFooter() below — its
    // markup can get rebuilt from scratch on a breakpoint-crossing
    // resize, so fragmenting it has to be repeatable, not a one-shot.
    document.querySelectorAll(
      '.info-row-label, .info-row-text, .info-accordion-toggle .row-label, ' +
      '.info-color-swatch-name, .info-dark-label, .info-accordion-text'
    ).forEach(el => fragmentElement(el));
    // .info-color-value wraps a label span + a value span side by side —
    // fragmenting the wrapper itself would flatten both into one run of
    // chunks and destroy that layout, so each span is fragmented on its
    // own instead, independently
    document.querySelectorAll('.info-color-value span').forEach(el => fragmentElement(el));

    // accordion: each row toggles independently — any number can be open
    // at once, not just one. Independent of the scroll-reveal system
    // below — opening/closing a row isn't reset just because it
    // scrolled out of view.
    const accordionRows = document.querySelectorAll('.info-accordion-row');
    function setRowOpen(row, open) {
      row.classList.toggle('is-open', open);
      row.querySelector('[data-accordion-toggle]')?.setAttribute('aria-expanded', String(open));
      const icon = row.querySelector('.info-accordion-icon');
      if (icon) icon.textContent = open ? '−' : '+';
      // measured, not a flat guess — a fixed cap either clips longer text
      // (narrow widths wrap to more lines) or leaves a big empty gap
      // under shorter text, neither of which happens if this just fits
      // the row's own actual content height
      const body = row.querySelector('.info-accordion-body');
      if (body) body.style.maxHeight = open ? `${body.scrollHeight}px` : '0px';
      // same stagger-type reveal as everything else on the page, not just
      // an opacity-free reveal riding along with the max-height expand —
      // and the same re-animate-every-time rule: closing and reopening a
      // row plays it again from scratch rather than leaving it revealed
      const text = row.querySelector('.info-accordion-text');
      if (text) {
        if (open) runReveal(text, WAVE);
        else runUnreveal(text, WAVE);
      }
    }
    accordionRows.forEach(row => {
      const toggle = row.querySelector('[data-accordion-toggle]');
      toggle?.addEventListener('click', () => {
        setRowOpen(row, !row.classList.contains('is-open'));
      });
    });

    // --- scroll-triggered reveals ---
    // every [data-reveal] element draws its own rule(s) and wave-reveals
    // its own text the moment it scrolls into view, and UNDOES both the
    // instant it scrolls back out — either direction, not just downward
    // past it — so scrolling back up to something re-plays the same
    // entrance exactly as if you'd never seen it, instead of the
    // one-shot-on-load timer this used to run on.
    const REVEAL_TEXT_SELECTOR = '.info-row-label, .info-row-text, .row-label, .info-color-swatch-name, .info-color-value';
    const isBigReveal = t => t.classList.contains('info-row-text');

    function revealUnit(el) {
      el.querySelectorAll(':scope > .row-rule, :scope .row-rule').forEach(r => r.classList.add('is-drawn'));
      el.querySelectorAll(REVEAL_TEXT_SELECTOR).forEach(t => {
        runReveal(t, isBigReveal(t) ? WAVE_LONG : WAVE);
      });
      if (el.matches(REVEAL_TEXT_SELECTOR)) {
        runReveal(el, isBigReveal(el) ? WAVE_LONG : WAVE);
      }
      el.classList.add('is-visible');
    }

    function hideUnit(el) {
      el.querySelectorAll(':scope > .row-rule, :scope .row-rule').forEach(r => r.classList.remove('is-drawn'));
      el.querySelectorAll(REVEAL_TEXT_SELECTOR).forEach(t => runUnreveal(t, WAVE));
      if (el.matches(REVEAL_TEXT_SELECTOR)) runUnreveal(el, WAVE);
      el.classList.remove('is-visible');
    }

    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) revealUnit(entry.target);
        else hideUnit(entry.target);
      });
    }, { root: page, threshold: 0.2, rootMargin: '0px 0px -8% 0px' });

    document.querySelectorAll('[data-reveal]').forEach(el => revealObserver.observe(el));

    // --- footer: text translates up + fades in, same re-animate-every-
    // time rule as everything else above, plus the logomark's progressive
    // grow/shrink tied to scroll. Pulled into its own function since the
    // desktop/mobile footer is a genuinely different DOM structure (see
    // buildDesktopFooter/buildMobileFooter) — resizing across the
    // breakpoint rebuilds that markup from scratch, which means re-
    // fragmenting its text and re-observing fresh nodes, not just
    // re-running a measurement.
    function setupFooter() {
      footerObserver?.disconnect();
      markObserver?.disconnect();

      const footer = document.querySelector('.info-footer');
      if (!footer) return;

      // .info-footer-item-text covers both the plain Special Thanks spans
      // and the now roll()-wrapped Links anchors — fragment whichever
      // actually exists on each, same fallback the Contact/Portfolio
      // links below already use
      footer.querySelectorAll('.info-footer-heading, .info-footer-item-text').forEach(el => {
        fragmentElement(el.querySelector('.roll-line') ?? el);
      });
      const footerBuild = footer.querySelector('.info-footer-build');
      if (footerBuild) fragmentElement(footerBuild);
      footer.querySelectorAll('.info-footer-bottom a').forEach(link => {
        fragmentElement(link.querySelector('.roll-line') ?? link);
      });

      const footerTextEls = footer.querySelectorAll(
        '.info-footer-heading, .info-footer-item, .info-footer-build, .info-footer-bottom a'
      );

      footerObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          footer.querySelectorAll('.row-rule').forEach(r => {
            r.classList.toggle('is-drawn', entry.isIntersecting);
          });
          footerTextEls.forEach((el, i) => {
            if (entry.isIntersecting) {
              setTimeout(() => {
                el.classList.add('is-visible');
                runReveal(el, WAVE);
              }, i * 30);
            } else {
              el.classList.remove('is-visible');
              runUnreveal(el, WAVE);
            }
          });
        });
      }, { root: page, threshold: 0.1 });
      footerObserver.observe(footer);

      const footerMark = footer.querySelector('.info-footer-mark');
      if (footerMark) {
        const steps = Array.from({ length: 21 }, (_, i) => i / 20);
        markObserver = new IntersectionObserver(entries => {
          entries.forEach(entry => {
            const scale = 0.75 + entry.intersectionRatio * 0.25;
            footerMark.style.transform = `scale(${scale})`;
          });
        }, { root: page, threshold: steps });
        markObserver.observe(footerMark);
      }
    }

    setupFooter();

    // TEMP DEBUG — remove once the fast-scroll black-bar cause is found.
    // Logs whenever the footer's own box actually changes size/position
    // after load, and whenever a 'resize' event fires, with timestamps,
    // so we can see what's really happening instead of guessing.
    (() => {
      const footerEl = document.querySelector('.info-footer');
      if (!footerEl) return;
      const t0 = performance.now();
      let last = null;
      const ro = new ResizeObserver(entries => {
        for (const entry of entries) {
          const h = entry.contentRect.height;
          const rect = footerEl.getBoundingClientRect();
          if (last !== null && Math.abs(h - last) < 0.5) continue;
          last = h;
          console.log(`[footer-debug] t=${(performance.now() - t0).toFixed(0)}ms height=${h.toFixed(1)} top=${rect.top.toFixed(1)}`);
        }
      });
      ro.observe(footerEl);
      window.addEventListener('resize', () => {
        console.log(`[footer-debug] t=${(performance.now() - t0).toFixed(0)}ms window resize event fired, innerWidth=${window.innerWidth} innerHeight=${window.innerHeight}`);
      });
      document.fonts?.ready?.then(() => {
        console.log(`[footer-debug] t=${(performance.now() - t0).toFixed(0)}ms document.fonts.ready resolved`);
      });
    })();

    // the footer's own HTML structure (desktop's 2-column grid vs.
    // mobile's linear stack) was only ever picked once, at render() time
    // — resizing across the breakpoint without a fresh navigation left it
    // stuck in whichever version first loaded. Swap the markup and rewire
    // it from scratch the moment a resize actually crosses the breakpoint.
    let lastIsDesktop = isDesktop();
    function handleResize() {
      const nowDesktop = isDesktop();
      if (nowDesktop === lastIsDesktop) return;
      lastIsDesktop = nowDesktop;
      const footer = document.querySelector('.info-footer');
      if (!footer) return;
      footer.outerHTML = renderFooter();
      setupFooter();
    }
    window.addEventListener('resize', handleResize);
    resizeHandler = handleResize;
  },
  // undraws every rule that's unique to /info's own content (the A7YPE
  // rows, the grid, the logomark, the color swatches — none of which
  // exist on wherever you're navigating to) before the page fades. The
  // nav rule is never touched here (same as every other page, it's a
  // constant fixture) and neither is the footer's — every destination
  // page has its own footer rule too, so undrawing-then-redrawing the
  // "same" rule on every navigation would just be visual noise. If the
  // footer rule hasn't drawn yet (the user never scrolled down far
  // enough to trigger it), it's snapped straight to drawn with no
  // transition instead — it should never be caught mid-reveal, let alone
  // undrawn, right as you're leaving.
  exit() {
    return new Promise(resolve => {
      // the resize listener is on window, which outlives this page —
      // without this it'd keep firing (and stack a fresh duplicate on
      // every subsequent /info visit) against DOM nodes this page no
      // longer owns
      if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
        resizeHandler = null;
      }
      footerObserver?.disconnect();
      markObserver?.disconnect();

      const page = document.querySelector('.page');
      if (!page) { resolve(); return; }

      // same deal as the footer rule below — the nav rule undraws as you
      // scroll down (see updateTopRule in init()), but every other page
      // always has its own nav rule drawn. Force it back before leaving,
      // instantly, regardless of current scroll position.
      const topRule = document.querySelector('.topbar-rule');
      topRule?.classList.add('is-instant', 'is-drawn');

      document.querySelectorAll('.info-footer .row-rule').forEach(r => {
        r.classList.add('is-instant', 'is-drawn');
      });

      document.querySelectorAll('.row-rule.is-drawn').forEach(r => {
        if (r.closest('.info-footer')) return; // just forced drawn above, leave it
        r.classList.add('is-undrawing');
        r.classList.remove('is-drawn');
      });

      // desktop: chrome (nav + footer) never fades, same as every other
      // page's own desktop exit() — it just sits there untouched until
      // the instant DOM swap on navigation, so there's nothing to
      // visibly "disappear" in the first place. Fading page's opacity
      // here (the old behavior) faded the footer rule right along with
      // everything else despite just forcing it drawn above, which is
      // exactly the disappearing-then-reappearing flicker this was
      // supposed to prevent. Only /info's own unique content — never
      // present on whatever page you're navigating to — fades out.
      if (isDesktop()) {
        const content = [document.querySelector('.info-dark'), document.querySelector('.info-color')];
        setTimeout(() => {
          content.forEach(el => {
            if (!el) return;
            el.style.transition = 'opacity 250ms ease';
            el.style.opacity = '0';
          });
        }, 150);
        setTimeout(resolve, 400);
        return;
      }

      setTimeout(() => {
        page.style.transition = 'opacity 300ms ease';
        page.style.opacity = '0';
      }, 150);

      setTimeout(resolve, 450);
    });
  }
};
