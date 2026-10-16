// Shared list-view logic for missing.html and found.html. Page sets <body data-status="missing|found">.
API.ready.then(function(){
  var STATUS = document.body.dataset.status;
  var $ = function(id){ return document.getElementById(id); };
  var pets = window.PETS.filter(function(p){ return p.status === STATUS; });
  var state = { q: '', species: '', colours: [], size: [], sex: '', district: '', collar: false, chipped: false, since: '', sort: 'newest' };

  // Read initial filters from URL so filtered views are shareable / indexable
  var params = new URLSearchParams(location.search);
  ['q','species','sex','district','since','sort'].forEach(function(k){ if (params.get(k)) state[k] = params.get(k); });
  if (params.get('colour')) state.colours = params.get('colour').split(',');
  if (params.get('size')) state.size = params.get('size').split(',');

  // Build colour chips
  $('colours').innerHTML = window.COLOURS.map(function(c){
    return '<label class="swatch"><input type="checkbox" value="' + c.name + '"><i style="background:' + c.swatch + '"></i><span>' + c.name + '</span></label>';
  }).join('');
  window.AREAS.forEach(function(a){ var o = document.createElement('option'); o.value = a; o.textContent = a; $('district').appendChild(o); });

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
    if (state.q) {
      var hay = [p.name, p.breed, p.color, p.exoticType || '', p.area, p.desc].join(' ').toLowerCase();
      var ok = state.q.toLowerCase().split(/\s+/).every(function(w){ return hay.indexOf(w) > -1; });
      if (!ok) return false;
    }
    return true;
  }

  function activeChips(){
    var out = [];
    if (state.q) out.push(['q', '“' + state.q + '”']);
    if (state.species) out.push(['species', state.species]);
    if (state.species !== 'Other') state.colours.forEach(function(c){ out.push(['colour:' + c, c]); });
    state.size.forEach(function(s){ out.push(['size:' + s, s]); });
    if (state.sex) out.push(['sex', state.sex]);
    if (state.district) out.push(['district', state.district]);
    if (state.collar) out.push(['collar', 'Wearing collar']);
    if (state.chipped) out.push(['chipped', 'Microchipped']);
    if (state.since) out.push(['since', 'Last ' + state.since + ' days']);
    return out;
  }

  function clearOne(key){
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
    var qs = u.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
  }

  function fmtDate(d){ return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }

  function render(){
    var rows = pets.filter(matches).sort(function(a, b){
      if (state.sort === 'oldest') return new Date(a.date) - new Date(b.date);
      if (state.sort === 'area') return a.area.localeCompare(b.area);
      return new Date(b.date) - new Date(a.date);
    });

    $('count').textContent = rows.length + ' of ' + pets.length + ' ' + STATUS + ' pets';
    var chips = activeChips();
    $('active').innerHTML = chips.map(function(c){ return '<button type="button" class="pill" data-k="' + c[0] + '">' + c[1] + ' <span aria-hidden="true">✕</span></button>'; }).join('') +
      (chips.length ? '<button type="button" class="clear-all" id="clear-all">Clear all</button>' : '');
    $('active').querySelectorAll('.pill').forEach(function(b){ b.addEventListener('click', function(){ clearOne(b.dataset.k); }); });
    if ($('clear-all')) $('clear-all').addEventListener('click', clearAll);
    $('filter-count').textContent = chips.length ? '(' + chips.length + ')' : '';

    $('results').innerHTML = rows.length ? rows.map(function(p){
      var unnamed = p.name === 'Unnamed';
      return '<a class="row" href="listing.html?id=' + p.id + '">' +
        '<div class="ph"><img src="' + p.photo + '" alt="' + (unnamed ? p.color + ' ' + (p.exoticType || p.species).toLowerCase() : p.name) + '"></div>' +
        '<div class="body">' +
          '<div class="top"><h2 class="nm">' + (unnamed ? p.color + ' ' + (p.exoticType || p.species).toLowerCase() : p.name) + '</h2><span class="date">' + (STATUS === 'missing' ? 'Missing since ' : 'Found ') + fmtDate(p.date) + '</span></div>' +
          '<div class="traits">' +
            '<span>' + (p.species === 'Other' ? (p.exoticType || 'Exotic') : p.species) + '</span><span>' + p.breed + '</span><span>' + p.size + '</span>' + (p.sex !== 'Unknown' ? '<span>' + p.sex + '</span>' : '') +
            '<span class="cols">' + (p.colours || []).map(function(c){ var s = window.COLOURS.find(function(x){ return x.name === c; }); return '<i title="' + c + '" style="background:' + (s ? s.swatch : '#ccc') + '"></i>'; }).join('') + p.color + '</span>' +
          '</div>' +
          '<p class="desc">' + p.desc + '</p>' +
          '<div class="foot"><span class="loc">' + p.area + '</span>' +
            (p.chipped ? '<span class="tag tag-accent-2">Microchipped</span>' : '') +
            (p.collar ? '<span class="tag tag-neutral">Collar</span>' : '') +
          '</div>' +
        '</div></a>';
    }).join('') : '<div class="empty"><h3>No matches</h3><p>Try removing a filter. New listings appear here as soon as a moderator approves them.</p><a class="btn btn-primary" href="submit.html">Report a ' + STATUS + ' pet</a></div>';
  }

  function syncColourGroup(){ $('colour-group').style.display = state.species === 'Other' ? 'none' : ''; }
  function update(){ readControls(); syncColourGroup(); writeURL(); render(); }
  function clearAll(){
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
});
