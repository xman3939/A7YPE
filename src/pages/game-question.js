import { createGamePage } from './game.js';

export const DESCRIPTION = '<span class="text-red">SPOT IT</span> OR <span class="text-red">( ? )</span> IS A RACE AGAINST THE CLOCK TO SPOT THE WANTED CHARACTER. THE WANTED CHARACTER APPLIES FOR THE FOLLOWING FIVE ROUNDS. THE CLOCK RESETS EVERY FIVE ROUNDS AND DIFFICULTY INCREASES AS YOU PROGRESS.';

const STATS = [
  { label: 'Rounds', value: '∞' },
  { label: 'Score to win', value: '999' },
  { label: 'Time', value: ':VAR' },
  { label: 'Penalty', value: ':14' },
];

export default createGamePage('?', { description: DESCRIPTION, stats: STATS });
