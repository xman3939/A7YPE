const routes = [
  { path: '/', page: () => import('./pages/home.js') },
  { path: '/exclaim', page: () => import('./pages/game-exclaim.js') },
  { path: '/exclaim/play', page: () => import('./pages/exclaim-play.js') },
  { path: '/question', page: () => import('./pages/game-question.js') },
  { path: '/question/play', page: () => import('./pages/question-play.js') },
  { path: '/equals', page: () => import('./pages/game-equals.js') },
  { path: '/equals/play', page: () => import('./pages/equals-play.js') },
  { path: '/hashtag', page: () => import('./pages/game-hashtag.js') },
  { path: '/hashtag/play', page: () => import('./pages/hashtag-play.js') },
  { path: '/info', page: () => import('./pages/info.js') },
];

let currentPage = null;
let currentPath = null;

// only the footer rule — the nav's own rule (topbar-rule) stays put, same
// idea as /info's own nav rule never getting an entrance/exit animation:
// the nav reads as a constant fixture across pages, not something that
// should visibly flicker away and back on every navigation.
const RULE_SELECTOR = '.footer-rule.is-drawn';
const UNDRAW_DURATION = 320; // must match .is-undrawing's transition duration in style.css

// /info is reached from every other page, and every other page has its own
// footer rule drawn — rather than teaching each page's own exit() about
// this one specific destination, retract it generically, right here,
// before that page's own exit() (its fade, etc.) runs at all.
function undrawAllRules() {
  const rules = document.querySelectorAll(RULE_SELECTOR);
  if (!rules.length) return Promise.resolve();
  rules.forEach(rule => {
    rule.classList.add('is-undrawing');
    rule.classList.remove('is-drawn');
  });
  return new Promise(resolve => setTimeout(resolve, UNDRAW_DURATION));
}

export async function render(pathname) {
  const route = routes.find(r => r.path === pathname);
  if (!route) return;

  updateNavActive(pathname);

  if (pathname === '/info' && currentPath !== null && currentPath !== '/info') {
    await undrawAllRules();
  }

  await currentPage?.exit?.();

  const { default: page } = await route.page();
  const app = document.getElementById('app');

  document.body.className = page.bodyClass ?? '';
  app.innerHTML = page.render();
  document.title = page.title ?? 'Untitled';
  window.scrollTo(0, 0);

  currentPage = page;
  currentPath = pathname;
  page.init?.();
}

export async function navigate(path) {
  history.pushState(null, '', path);
  await render(path);
}

function updateNavActive(pathname) {
  document.querySelectorAll('[data-route]').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.route === pathname);
  });
}

document.addEventListener('click', e => {
  const btn = e.target.closest('[data-route]');
  if (!btn) return;
  navigate(btn.dataset.route);
});

window.addEventListener('popstate', () => render(location.pathname));
