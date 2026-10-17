// Vets, shelters and rescue groups (data built from data/services.csv into services.json).
// Used by vets.html, the report confirmation and pet pages.
window.SERVICES = (function(){
  var CAT = { vet: 'Vet clinic', shelter: 'Shelter', rescue: 'Rescue group' };
  var promise = null;
  function esc(s){ return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function load(){
    return promise || (promise = fetch('/services.json', { cache: 'no-cache' }).then(function(r){ return r.ok ? r.json() : []; }).catch(function(){ return []; }));
  }
  function dist(a, b){
    var R = 6371, r = Math.PI / 180, dLa = (b.lat - a.lat) * r, dLo = (b.lng - a.lng) * r;
    var s = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
    return 2 * R * Math.asin(Math.sqrt(s));
  }
  // Closest first. opts: { cats: ['vet','shelter'], max: 5, within: km }
  function nearest(list, pt, opts){
    opts = opts || {};
    return list.filter(function(s){ return !opts.cats || opts.cats.indexOf(s.cat) > -1; })
      .map(function(s){ return { s: s, d: dist(pt, s) }; })
      .filter(function(x){ return !opts.within || x.d <= opts.within; })
      .sort(function(a, b){ return rank(a) - rank(b); })
      .slice(0, opts.max || 1e9);
  }
  // Closest first, but places we can actually call, at a known address, come before town-only / no-phone entries.
  function rank(x){ return x.d + (x.s.approx ? 1.5 : 0) + (x.s.phone ? 0 : 4); }
  function tel(p){ return 'tel:' + String(p || '').replace(/[^\d+]/g, ''); }
  function catLabel(c){ return t(CAT[c] || CAT.vet); }
  function kmText(d){ return d == null ? '' : t('{km} km away', { km: d < 10 ? d.toFixed(1) : Math.round(d) }); }
  // One place as a card. opts: { compact: true } for the short version on pet pages / after reporting.
  function card(s, d, opts){
    opts = opts || {};
    var acts = [];
    if (s.phone) acts.push('<a class="btn btn-primary svc-call" href="' + tel(s.phone) + '">' + t('Call') + ' <span class="num">' + esc(s.phone) + '</span></a>');
    if (s.email && !opts.compact) acts.push('<a class="btn btn-secondary" href="mailto:' + esc(s.email) + '">' + t('Email') + '</a>');
    if (s.website && !opts.compact) acts.push('<a class="btn btn-secondary" href="' + esc(s.website) + '" target="_blank" rel="noopener">' + t('Website') + '</a>');
    if (s.maps) acts.push('<a class="btn btn-secondary" href="' + esc(s.maps) + '" target="_blank" rel="noopener">' + t('Directions') + '</a>');
    if (!s.phone && !s.email && !s.website && !opts.compact) acts.push('<span class="svc-none">' + t('No contact details listed yet') + '</span>');
    return '<div class="svc" data-id="' + esc(s.id) + '">' +
      '<div class="svc-head"><span class="svc-dot cat-' + s.cat + '" aria-hidden="true"></span><div>' +
        '<h3>' + esc(s.name) + '</h3>' +
        '<div class="svc-meta"><span>' + catLabel(s.cat) + '</span>' + (s.open24 ? '<span class="svc-24">' + t('Open 24 hours') + '</span>' : '') + (d != null && !s.approx ? '<span>' + kmText(d) + '</span>' : '') + '</div>' +
      '</div></div>' +
      '<div class="svc-addr">' + esc(s.address) + (s.approx ? ' <span class="svc-approx">· ' + t('Approximate location') + '</span>' : '') + '</div>' +
      '<div class="svc-actions">' + acts.join('') + '</div></div>';
  }
  // "Vets and shelters near …" block for the report confirmation and pet pages.
  function nearbyBlock(el, pt, opts){
    opts = opts || {};
    if (!el || !pt || pt.lat == null) return Promise.resolve();
    return load().then(function(list){
      var vets = nearest(list, pt, { cats: ['vet'], max: opts.vets || 3 });
      var help = nearest(list, pt, { cats: ['shelter', 'rescue'], max: opts.help || 2 });
      var rows = vets.concat(help);
      if (!rows.length) return;
      var more = '/' + lp('vets.html') + '?lat=' + pt.lat.toFixed(4) + '&lng=' + pt.lng.toFixed(4) + (pt.label ? '&label=' + encodeURIComponent(pt.label) : '');
      el.innerHTML = '<h2 class="svc-block-title">' + t(opts.title || 'Call vets and shelters nearby') + '</h2>' +
        '<p class="svc-block-lede">' + t(opts.lede || 'People often take found animals straight to the nearest vet or shelter. Give them a call and leave your number.') + '</p>' +
        '<div class="svc-list">' + rows.map(function(x){ return card(x.s, x.d, { compact: true }); }).join('') + '</div>' +
        '<a class="svc-more" href="' + more + '">' + t('See all vets and shelters on the map →') + '</a>';
      el.hidden = false;
    });
  }
  return { rank: rank, load: load, nearest: nearest, card: card, catLabel: catLabel, tel: tel, dist: dist, nearbyBlock: nearbyBlock, esc: esc };
})();
