export default {
  title: 'About — !',
  bodyClass: 'page-about',
  render() {
    return `
      <main class="page" style="opacity:0">
        <nav class="nav">
          <button type="button" data-route="/" class="nav-link">HOME</button>
          <button type="button" data-route="/about" class="nav-link">ABOUT</button>
        </nav>
        <h1 class="hero-type">EXPERIMENT&nbsp;002</h1>
      </main>
    `;
  },
  init() {
    requestAnimationFrame(() => {
      document.querySelector('.page').style.transition = 'opacity 400ms ease';
      document.querySelector('.page').style.opacity = '1';
    });
  },
  exit() {
    return new Promise(resolve => {
      const page = document.querySelector('.page');
      if (!page) { resolve(); return; }
      page.style.transition = 'opacity 250ms ease';
      page.style.opacity = '0';
      setTimeout(resolve, 250);
    });
  }
};
