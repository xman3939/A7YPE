import { createGamePage } from './game.js';
import { MAX_SCORE } from '../game-hashtag.js';

export const DESCRIPTION = '<span class="text-red">SNAKE</span> OR <span class="text-red">( # )</span> IS THE CLASSIC GAME REBUILT WITH HASHTAGS. GUIDE THE YELLOW SNAKE AROUND THE GRID TO CONSUME THE WHITE #. IF YOU HIT A WALL OR YOUR OWN TAIL IT IS GAME OVER. TRY TO FILL THE ENTIRE BOARD.';

const STATS = [
  { label: 'Grid', value: '15x15' },
  { label: 'Score to win', value: String(MAX_SCORE) },
  { label: 'Controls', value: 'WASD / Swipe' },
  { label: 'Penalty', value: 'None' },
];

export default createGamePage('#', { description: DESCRIPTION, stats: STATS });
