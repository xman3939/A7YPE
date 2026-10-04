import { createGamePage } from './game.js';

export const DESCRIPTION = '<span class="text-red">SIMON SAYS</span> OR <span class="text-red">( = )</span> IS THE CLASSIC MEMORIZATION GAME WITH A TWIST. YOU WATCH THE PLUS SIGNS FLASH YELLOW AND COPY THE PATTERN SHOWN. YOU START WITH JUST TWO SIGNS, THEN MORE GET ADDED THE FURTHER YOU GET, RAISING THE DIFFICULTY EACH TIME. AIM FOR THE HIGHEST SCORE POSSIBLE.';

const STATS = [
  { label: 'Rounds', value: '∞' },
  { label: 'Score to win', value: '999' },
  { label: 'Time', value: ':03' },
  { label: 'Penalty', value: 'None' },
];

export default createGamePage('=', { description: DESCRIPTION, stats: STATS });
