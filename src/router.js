const routes = [
  { path: '/',      page: () => import('./pages/home.js') },
  { path: '/about', page: () => import('./pages/about.js') },
];

let currentPage = null;

export async function render(pathname) {
  const route = routes.find(r => r.path === pathname);
  if (!route) return;

  updateNavActive(pathname);
  await currentPage?.exit?.();

  const { default: page } = await route.page();
  const app = document.getElementById('app');

  document.body.className = page.bodyClass ?? '';
  app.innerHTML = page.render();
  document.title = page.title ?? 'Untitled';
  window.scrollTo(0, 0);

  currentPage = page;
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
