# !

A typography / motion graphic experiment. Same "instant page swap" single-page-app
pattern as the XK portfolio site: a tiny hand-rolled client-side router
(`src/router.js`) swaps page content via the History API with no full reloads,
and each page module exports `{ render, init, exit }` so navigation can run exit/enter
transitions (currently a simple crossfade — replace with whatever motion experiment
you're building).

## Structure

- `src/router.js` — client-side router (History API, no dependencies)
- `src/main.js` — entry point
- `src/pages/*.js` — one module per route
- `src/style.css` — global styles

## Dev

```
npm install
npm run dev
```

## Build

```
npm run build
```
