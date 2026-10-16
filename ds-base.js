// templates/landing/ds-base.js
(() => {
  const base = '_ds/organic-eb17218d-c2a0-45c0-ae51-01134787c9da';
  for (const p of ['styles.css']) { // list this DS's global stylesheets
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = base + '/' + p;
    document.head.appendChild(l);
  }
  // Brand rule: pages are pure white; the design system's cream is only for accents.
  var w = document.createElement('style'); w.textContent = 'html,body{background:#fff}'; document.head.appendChild(w);
})();
