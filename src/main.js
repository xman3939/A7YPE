import './style.css';
import { render } from './router.js';
import { runIntro } from './loader.js';

window.addEventListener('DOMContentLoaded', () => {
  runIntro(() => render(location.pathname));
});
