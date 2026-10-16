// Shared list-view logic for missing.html and found.html. Page sets <body data-status="missing|found">.
API.ready.then(function(){
  var STATUS = document.body.dataset.status;
  var $ = function(id){ return document.getElementById(id); };
  var pets = window.PETS.filter(function(p){ return p.status === STATUS; });
  var state = { q: '', species: '', colours: [], size: [], sex: '', district: '', collar: false, chipped: false, since: '', sort: 'newest' };

  var NEAR = NearFilter({ input: 'near', radius: 'near-r', status: 'near-status', onChange: function(){ var n = NEAR.get(); if (n && !nearUsed) { nearUsed = true; $('sort').value = 'near'; } update(); } });
  var nearUsed = false;

  // Read initial filters from URL so filtered views are shareable / indexable
  var params = new URLSearchParams(location.search);
  ['q','species','sex','district','since','sort'].forEach(function(k){ if (params.get(k)) state[k] = params.get(k); });
  if (params.get('colour')) state.colours = params.get('colour').split(',');
  if (params.get('size')) state.size = params.get('size').split(',');

  // Build colour chips
  $('colours').innerHTML = window.COLOURS.map(function(c){
    return '<label class="swatch"><input type="checkbox" value="' + c.name + '"><i style="background:' + c.swatch + '"></i><span>' + t(c.name) + '</span></label>';
  }).join('');
  window.AREAS.forEach(function(a){ var o = document.createElement('option'); o.value = a; o.textContent = t(a); $('district').appendChild(o); });

  // Sync controls from state
  $('q').value = state.q; $('species').value = state.species; $('sex').value = state.sex;
  $('district').value = state.district; $('since').value = state.since; $('sort').value = state.sort;
  document.querySelectorAll('#colours input').forEach(function(i){ i.checked = state.colours.indexOf(i.value) > -1; });
  document.querySelectorAll('#sizes input').forEach(function(i){ i.checked = state.size.indexOf(i.value) > -1; });

  function readControls(){
    state.q = $('q').value.trim();
    state.species = $('species').value;
    state.sex = $('sex').value;
    state.district = $('district').value;
    state.since = $('since').value;
    state.sort = $('sort').value;
    state.collar = $('collar').checked;
    state.chipped = $('chipped').checked;
    state.colours = Array.prototype.map.call(document.querySelectorAll('#colours input:checked'), function(i){ return i.value; });
    state.size = Array.prototype.map.call(document.querySelectorAll('#sizes input:checked'), function(i){ return i.value; });
  }

  function matches(p){
    if (state.species && p.species !== state.species) return false;
    if (state.sex && p.sex !== state.sex) return false;
    if (state.district && p.district !== state.district) return false;
    if (state.size.length && state.size.indexOf(p.size) === -1) return false;
    if (state.collar && !p.collar) return false;
    if (state.chipped && !p.chipped) return false;
    if (state.colours.length && state.species !== 'Other') {
      // pet must have every selected colour (e.g. White + Grey)
      if (p.species === 'Other') return false;
      var all = state.colours.every(function(c){ return p.colours.indexOf(c) > -1; });
      if (!all) return false;
    }
    if (state.since) {
      var days = Number(state.since);
      if ((API.now() - new Date(p.date)) / 864e5 > days) return false;
    }
    var near = NEAR.get();
    if (near && API.km(near, p) > near.r) return false;
    if (state.q) {
      var hay = [p.name, p.breed, p.color, p.exoticType || '', p.area, p.postcode || '', p.desc].join(' ').toLowerCase();
      var ok = state.q.toLowerCase().split(/\s+/).every(function(w){ return hay.indexOf(w) > -1; });
      if (!ok) return false;
    }
    return true;
  }

  function activeChips(){
    var out = [];
    if (state.q) out.push(['q', '“' + state.q + '”']);
    var n = NEAR.get(); if (n) out.push(['near', t('Within {r} km of {place}', { r: n.r, place: n.label })]);
    if (state.species) out.push(['species', t(state.species === 'Other' ? 'Other / exotic' : state.species)]);
    if (state.species !== 'Other') state.colours.forEach(function(c){ out.push(['colour:' + c, t(c)]); });
    state.size.forEach(function(s){ out.push(['size:' + s, t(s)]); });
    if (state.sex) out.push(['sex', t(state.sex)]);
    if (state.district) out.push(['district', t(state.district)]);
    if (state.collar) out.push(['collar', t('Wearing collar')]);
    if (state.chipped) out.push(['chipped', t('Microchipped')]);
    if (state.since) out.push(['since', t('Last {n} days', { n: state.since })]);
    return out;
  }

  function clearOne(key){
    if (key === 'near') { NEAR.clear(); return; }
    if (key.indexOf('colour:') === 0) { var c = key.slice(7); document.querySelectorAll('#colours input').forEach(function(i){ if (i.value === c) i.checked = false; }); }
    else if (key.indexOf('size:') === 0) { var s = key.slice(5); document.querySelectorAll('#sizes input').forEach(function(i){ if (i.value === s) i.checked = false; }); }
    else if (key === 'collar' || key === 'chipped') $(key).checked = false;
    else $(key).value = '';
    update();
  }

  function writeURL(){
    var u = new URLSearchParams();
    ['q','species','sex','district','since'].forEach(function(k){ if (state[k]) u.set(k, state[k]); });
    if (state.sort !== 'newest') u.set('sort', state.sort);
    if (state.colours.length) u.set('colour', state.colours.join(','));
    if (state.size.length) u.set('size', state.size.join(','));
    var n = NEAR.get(); if (n) { u.set('near', n.q); u.set('r', n.r); }
    var qs = u.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
  }

  function fmtDate(d){ return API.fmtDate(d); }

  function render(){
    var rows = pets.filter(matches).sort(function(a, b){
      if (state.sort === 'oldest') return new Date(a.date) - new Date(b.date);
      if (state.sort === 'area') return a.area.localeCompare(b.area);
      var nr = NEAR.get(); if (state.sort === 'near' && nr) return API.km(nr, a) - API.km(nr, b);
      return new Date(b.date) - new Date(a.date);
    });

    $('count').textContent = t(STATUS === 'missing' ? '{n} of {total} missing pets' : '{n} of {total} found pets', { n: rows.length, total: pets.length });
    var chips = activeChips();
    $('active').innerHTML = chips.map(function(c){ return '<button type="button" class="pill" data-k="' + c[0] + '">' + c[1] + ' <span aria-hidden="true">✕</span></button>'; }).join('') +
      (chips.length ? '<button type="button" class="clear-all" id="clear-all">' + t('Clear all') + '</button>' : '');
    $('active').querySelectorAll('.pill').forEach(function(b){ b.addEventListener('click', function(){ clearOne(b.dataset.k); }); });
    if ($('clear-all')) $('clear-all').addEventListener('click', clearAll);
    $('filter-count').textContent = chips.length ? '(' + chips.length + ')' : '';

    $('results').innerHTML = rows.length ? rows.map(function(p){
      var title = API.petTitle(p);
      return '<a class="row" href="' + lp(API.petPath(p)) + '">' +
        '<div class="ph"><img src="' + p.photo + '" alt="' + title + ' — ' + API.statusLabel(p.status) + ', ' + API.areaText(p) + '" loading="lazy"></div>' +
        '<div class="body">' +
          '<div class="top"><h2 class="nm">' + title + '</h2><span class="date">' + t(STATUS === 'missing' ? 'Missing since {date}' : 'Found {date}', { date: fmtDate(p.date) }) + '</span></div>' +
          '<div class="traits">' +
            '<span>' + API.kind(p) + '</span><span>' + t(p.breed) + '</span><span>' + t(p.size) + '</span>' + (p.sex !== 'Unknown' ? '<span>' + t(p.sex) + '</span>' : '') +
            '<span class="cols">' + (p.colours || []).map(function(c){ var s = window.COLOURS.find(function(x){ return x.name === c; }); return '<i title="' + t(c) + '" style="background:' + (s ? s.swatch : '#ccc') + '"></i>'; }).join('') + p.color + '</span>' +
          '</div>' +
          '<p class="desc">' + p.desc + '</p>' +
          '<div class="foot"><span class="loc">' + API.areaText(p) + (NEAR.get() ? ' · ' + t('{km} km away', { km: API.km(NEAR.get(), p).toFixed(1) }) : '') + '</span>' +
            (p.chipped ? '<span class="tag tag-accent-2">' + t('Microchipped') + '</span>' : '') +
            (p.collar ? '<span class="tag tag-neutral">' + t('Collar') + '</span>' : '') +
          '</div>' +
        '</div></a>';
    }).join('') : '<div class="empty"><h3>' + t('No matches') + '</h3><p>' + t('Try removing a filter. New listings appear here as soon as a moderator approves them.') + '</p><a class="btn btn-primary" href="' + lp('submit.html?type=' + STATUS) + '">' + t(STATUS === 'missing' ? 'Report a missing pet' : 'Report a found pet') + '</a></div>';
  }

  function syncColourGroup(){ $('colour-group').style.display = state.species === 'Other' ? 'none' : ''; }
  function update(){ readControls(); syncColourGroup(); writeURL(); render(); }
  function clearAll(){
    $('near').value = ''; NEAR.clear();
    $('q').value = ''; ['species','sex','district','since'].forEach(function(k){ $(k).value = ''; });
    $('collar').checked = false; $('chipped').checked = false;
    document.querySelectorAll('#colours input, #sizes input').forEach(function(i){ i.checked = false; });
    update();
  }

  $('filters').addEventListener('input', update);
  $('filters').addEventListener('change', update);
  $('filters').addEventListener('submit', function(e){ e.preventDefault(); update(); });
  $('sort').addEventListener('change', update);
  $('toggle-filters').addEventListener('click', function(){ document.body.classList.toggle('filters-open'); });
  $('close-filters').addEventListener('click', function(){ document.body.classList.remove('filters-open'); });

  syncColourGroup();
  render();
  if (params.get('near')) NEAR.set(params.get('near'), params.get('r'));
});
