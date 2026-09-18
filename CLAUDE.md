# Project context

"!" (npm/package name `type-motion-lab`, GitHub repo `xman3939/typetest`) is
Xavier Kania's typography / motion graphic experiment site. It's a sibling
project to `E:\DESIGN\PROJECTS\XK\portfolio\portfolio-site` (his main
portfolio, xavierkania.com) — separate identity, separate repo, not meant to
share content or branding with it.

## Why it's built this way

The portfolio site uses a hand-rolled "instant page swap" SPA pattern instead
of a framework: a tiny client-side router (History API, no dependencies) plus
per-page modules exporting `{ render, init, exit }`, so route changes can run
exit/enter transitions rather than hard-reloading. This project intentionally
reuses that same pattern (see `src/router.js`, `src/main.js`,
`src/pages/*.js`) as the foundation for typography/motion experiments, since
it's already a proven, lightweight way to get seamless transitions between
pages without React/Vue/a router library.

If you want richer reference points for this pattern — a real text-reveal
animation engine, FLIP-style shared-element transitions between routes, a
loader sequence, etc. — the portfolio-site repo has fuller (if
portfolio-specific) implementations worth reading for inspiration, not for
copying content/branding.

## Current state

Bare two-route scaffold (`/` and `/about`), each just a centered heading with
a crossfade transition placeholder — nothing built yet beyond proving the
routing/transition mechanism works. `package.json`'s `name` is
`type-motion-lab` because npm package names can't contain `!`; same reason
the GitHub repo is named `typetest` rather than `!`.

## Notes

- Vite + vanilla JS, no framework, no UI library.
- `npm install && npm run dev` to run locally.
- Pushed to `https://github.com/xman3939/typetest.git`, branch `main`.
