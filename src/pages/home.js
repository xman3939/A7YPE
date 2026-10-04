import { renderChrome, initChrome, roll, isDesktop } from './chrome.js';
import { fragmentElement, runReveal, WAVE_LONG, WAVE_SHORT } from '../text-reveal.js';
import logoASvg from '../assets/logos/LOGO_A.svg?raw';

const LINES_DELAY = 400;
const LINES_DURATION = 1600; // must match .topbar-rule / .footer-rule transition duration in style.css
const RISE_DELAY = LINES_DELAY + LINES_DURATION + 200;
const RISE_DURATION = 520; // must match .mark.is-rising animation duration in style.css
const NAV_DELAY = RISE_DELAY + RISE_DURATION + 200;
const INTRO_DELAY = NAV_DELAY + 180;
const CTA_DELAY = INTRO_DELAY + 480;
const FOOTER_DELAY = CTA_DELAY + 300;

export default {
  title: 'A7',
  bodyClass: 'page-home',
  render() {
    return `
      <main class="page" style="opacity:0">
        ${renderChrome(`
          <div class="intro">
            <p class="intro-text"><span class="text-red">A7YPE</span> IS A COLLECTION OF MINIGAMES DESIGNED TO CHALLENGE YOUR VISION, MEMORY, AND COORDINATION. DESIGNED WITH A MINIMAL, TYPOGRAPHIC APPROACH, EACH GAME IS BUILT AROUND GLYPHS AND SYMBOLS AS ITS COMPOSITION. EXPLORE AND ENJOY.</p>
          </div>

          <div class="cta-links">
            <button type="button" class="cta-link" data-route="/info">${roll('&rarr;Information')}</button>
            <a class="cta-link cta-link--mobile" href="https://xavierkania.com" target="_blank" rel="noopener">${roll('&rarr;Portfolio')}</a>
            <a class="cta-link cta-link--mobile" href="https://xavierkania.com/contact" target="_blank" rel="noopener">${roll('&rarr;Contact')}</a>
          </div>
          <div class="intro-rule"></div>

          <div class="mark-wrap">
            <span class="mark" role="img" aria-label="A7">${logoASvg}</span>
          </div>
        `)}
      </main>
    `;
  },
  init() {
    const persistChrome = isDesktop();
    const { revealNav, teaseLogo, drawFooterRule, revealFooter } = initChrome({ instant: persistChrome });

    const page = document.querySelector('.page');
    const mark = document.querySelector('.mark');
    const topRule = document.querySelector('.topbar-rule');
    const introRule = document.querySelector('.intro-rule');
    const introText = document.querySelector('.intro-text');
    const ctaLinks = document.querySelectorAll('.cta-link');

    if (introText) fragmentElement(introText);
    ctaLinks.forEach(link => fragmentElement(link.querySelector('.roll-line')));

    if (persistChrome) {
      // desktop: nav/footer never actually change between pages, so they
      // snap straight to their settled state instead of re-animating — only
      // the mark (the thing that's actually different) gets a fresh entrance
      page.style.opacity = '1';
      topRule?.classList.add('is-instant', 'is-drawn');
      introRule?.classList.add('is-instant', 'is-drawn');
      revealNav();
      teaseLogo();
      drawFooterRule();
      revealFooter();

      setTimeout(() => {
        mark?.classList.add('is-rising');
        // .intro/.cta-links are mobile-only (display:none on desktop), so
        // this desktop branch never used to reveal them — fine as long as
        // the window stays desktop-width, but if it's resized down to the
        // mobile breakpoint afterward without a fresh navigation, they'd
        // suddenly become visible while stuck in their initial hidden
        // state, since nothing had ever revealed them. Revealing them
        // here too is a no-op visually at an actual desktop width.
        if (introText) runReveal(introText, WAVE_LONG);
        ctaLinks.forEach(link => runReveal(link, WAVE_SHORT));
      }, 80);
      return;
    }

    requestAnimationFrame(() => {
      page.style.transition = 'opacity 400ms ease';
      page.style.opacity = '1';
    });

    setTimeout(() => {
      topRule?.classList.add('is-drawn');
      introRule?.classList.add('is-drawn');
      drawFooterRule();
    }, LINES_DELAY);

    setTimeout(() => {
      mark?.classList.add('is-rising');
    }, RISE_DELAY);

    setTimeout(() => {
      revealNav();
    }, NAV_DELAY);

    setTimeout(() => {
      teaseLogo();
    }, NAV_DELAY + 1200);

    setTimeout(() => {
      if (introText) runReveal(introText, WAVE_LONG);
    }, INTRO_DELAY);

    setTimeout(() => {
      ctaLinks.forEach(link => runReveal(link, WAVE_SHORT));
    }, CTA_DELAY);

    setTimeout(() => {
      revealFooter();
    }, FOOTER_DELAY);
  },
  exit() {
    return new Promise(resolve => {
      if (isDesktop()) {
        const mark = document.querySelector('.mark');
        const options = document.querySelector('.options-row');
        if (!mark && !options) { resolve(); return; }

        if (mark) mark.style.animation = 'mark-squish 380ms cubic-bezier(0.4, 0, 1, 1) forwards';

        setTimeout(() => {
          if (options) {
            options.style.transition = 'opacity 280ms ease';
            options.style.opacity = '0';
          }
          setTimeout(resolve, 280);
        }, 380);
        return;
      }
      const page = document.querySelector('.page');
      if (!page) { resolve(); return; }
      page.style.transition = 'opacity 250ms ease';
      page.style.opacity = '0';
      setTimeout(resolve, 250);
    });
  }
};
