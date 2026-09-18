import './style.css';
import { render } from './router.js';

window.addEventListener('DOMContentLoaded', () => {
  render(location.pathname);
});
