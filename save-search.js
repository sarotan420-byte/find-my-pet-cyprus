// "Save search" button on the Missing / Found / Adopt pages.
(function(){
  var btn = document.getElementById('save-search');
  if (!btn) return;
  var PAGE = { 'missing.html': 'Missing pets', 'found.html': 'Found pets', 'adopt.html': 'For adoption' };
  btn.addEventListener('click', function(){
    var file = location.pathname.split('/').pop() || 'missing.html';
    var params = new URLSearchParams(location.search), bits = [];
    params.forEach(function(v, k){ if (k !== 'sort' && k !== 'r' && v) bits.push(v.split(',').map(function(x){ return t(x); }).join(', ')); });
    var label = [t(PAGE[file] || 'Search')].concat(bits.length ? bits : [t('all of Cyprus')]).join(' · ');
    API.getUser().then(function(u){
      if (API.live && (!u || u.is_anonymous)) { location.href = '/' + lp('account.html'); return; }
      btn.disabled = true;
      return API.saveView(label, file + location.search).then(function(){ btn.textContent = t('Saved ✓'); })
        .catch(function(e){ alert(e.message); btn.disabled = false; });
    });
  });
})();
