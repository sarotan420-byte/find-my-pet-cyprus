// "Near postcode or area" filter for the Missing / Found / Adopt pages.
window.NearFilter = function(o){
  var input = document.getElementById(o.input), sel = document.getElementById(o.radius), status = document.getElementById(o.status);
  var cur = null, seq = 0;
  function apply(q){
    q = (q || '').trim();
    var my = ++seq;
    if (!q) { cur = null; status.textContent = ''; o.onChange(); return Promise.resolve(); }
    status.textContent = 'Looking up…';
    return API.geocode(q).then(function(r){
      if (my !== seq) return;
      if (!r) { cur = null; status.textContent = 'Couldn’t find that. Try a 4-digit postcode or a town name.'; }
      else { cur = { lat: r.lat, lng: r.lng, label: r.name, q: q }; status.textContent = (r.exact ? '' : 'Approximate: ') + r.name; }
      o.onChange();
    });
  }
  input.addEventListener('keydown', function(e){ if (e.key === 'Enter') { e.preventDefault(); apply(input.value); } });
  input.addEventListener('change', function(){ if (!cur || cur.q !== input.value.trim()) apply(input.value); });
  input.addEventListener('input', function(e){
    e.stopPropagation();
    var v = input.value.trim();
    if (!v && cur) apply('');
    else if (API.isPostcode(v) && (!cur || cur.q !== v)) apply(v);
  });
  sel.addEventListener('change', function(e){ e.stopPropagation(); o.onChange(); });
  return {
    get: function(){ return cur ? { lat: cur.lat, lng: cur.lng, label: cur.label, q: cur.q, r: Number(sel.value) } : null; },
    clear: function(){ input.value = ''; return apply(''); },
    set: function(q, r){ input.value = q; if (r && API.RADII.indexOf(Number(r)) > -1) sel.value = String(r); return apply(q); }
  };
};
