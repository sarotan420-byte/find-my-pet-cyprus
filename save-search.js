// "Save search" button on the Missing / Found / Adopt pages.
(function(){
  var btn = document.getElementById('save-search');
  if (!btn) return;
  var PAGE = { 'missing.html': 'Missing pets', 'found.html': 'Found pets', 'adopt.html': 'For adoption' };
  btn.addEventListener('click', function(){
    var file = location.pathname.split('/').pop() || 'missing.html';
    var params = new URLSearchParams(location.search), bits = [];
    params.forEach(function(v, k){ if (k !== 'sort' && v) bits.push(v.replace(/,/g, ', ')); });
    var label = [PAGE[file] || 'Search'].concat(bits.length ? bits : ['all of Cyprus']).join(' · ');
    API.getUser().then(function(u){
      if (API.live && (!u || u.is_anonymous)) { location.href = 'account.html'; return; }
      btn.disabled = true;
      return API.saveView(label, file + location.search).then(function(){ btn.textContent = 'Saved ✓'; })
        .catch(function(e){ alert(e.message); btn.disabled = false; });
    });
  });
})();
