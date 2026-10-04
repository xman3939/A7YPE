// Piecewise-linear approximation of the bespoke GSAP CustomEase curve used by
// bychristinakosik.com's own loader (extracted from their shipped JS): a fast
// start, a hesitation through the middle, then a fast finish.
const EASE_POINTS = [
  [0, 0],
  [0.238, 0.442],
  [0.396, 0.54],
  [0.522, 0.584],
  [0.714, 0.826],
  [1, 1],
];

export function customEase(t) {
  for (let i = 1; i < EASE_POINTS.length; i++) {
    const [x0, y0] = EASE_POINTS[i - 1];
    const [x1, y1] = EASE_POINTS[i];
    if (t <= x1) {
      const localT = (t - x0) / (x1 - x0);
      return y0 + (y1 - y0) * localT;
    }
  }
  return 1;
}
