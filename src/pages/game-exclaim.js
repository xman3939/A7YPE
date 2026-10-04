import { createGamePage } from './game.js';

export const DESCRIPTION = '<span class="text-red">ODD ONE OUT</span> OR <span class="text-red">( ! )</span> IS A RACE AGAINST THE CLOCK TO SPOT THE CHARACTER THAT’S OUT OF PLACE. KEEP YOUR EYES PEELED FOR DIFFERENCES IN COLOR, MOTION, OR SPEED. THE CLOCK IS CONSTANTLY TICKING AND ROUNDS GET HARDER AS YOU PROGRESS.';

const STATS = [
  { label: 'Rounds', value: '∞' },
  { label: 'Score to win', value: '999' },
  { label: 'Time', value: ':30' },
  { label: 'Penalty', value: ':03' },
];

export default createGamePage('!', { description: DESCRIPTION, stats: STATS });
