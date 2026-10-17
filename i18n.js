// Language support. Greek pages live under /el/ and have <html lang="el">.
// t('English text') returns the Greek translation on Greek pages (dictionary in i18n-el.js).
// lp('missing.html') returns the link for the current language ('el/missing.html' on Greek pages).
(function(){
  var lang = (document.documentElement.lang || 'en').slice(0, 2) === 'el' ? 'el' : 'en';
  var D = window.I18N_EL || {};
  window.LANG = lang;
  window.LOCALE = lang === 'el' ? 'el-GR' : 'en-GB';
  window.t = function(s, vars){
    var out = (lang === 'el' && D[s] != null) ? D[s] : s;
    if (lang === 'el' && D[s] == null && s && /[a-z]/i.test(s)) (window.__i18nMissing = window.__i18nMissing || {})[s] = 1;
    if (vars) out = String(out).replace(/\{(\w+)\}/g, function(m, k){ return vars[k] != null ? vars[k] : m; });
    return out;
  };
  window.lp = function(path){
    path = String(path || '').replace(/^\/+/, '');
    return lang === 'el' && !/^el\//.test(path) ? 'el/' + path : path;
  };
  // Keep the language switcher pointing at the same page (with its filters / listing id).
  function fixSwitch(){
    var a = document.querySelector('.lang-switch');
    if (!a) return;
    var p = location.pathname;
    var other = lang === 'el' ? p.replace(/^\/el(\/|$)/, '/') : '/el' + (p === '/' ? '/' : p);
    a.href = other + location.search;
    a.addEventListener('click', function(){ try { localStorage.setItem('fmp-lang', lang === 'el' ? 'en' : 'el'); } catch (e) {} });
  }
  // Phones/tablets: the header links and "Sign in" are hidden for space, so add a menu button that lists them.
  function buildMenu(){
    var nav = document.querySelector('.nav'), links = nav && nav.querySelector('.links'), actions = nav && nav.querySelector('.actions');
    if (!links || !actions || nav.querySelector('.menu-btn')) return;
    var items = [].slice.call(links.querySelectorAll('a'));
    var acct = actions.querySelector('a[href$="account.html"]:not(.btn)');
    if (acct) items.push(acct);
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'menu-btn';
    btn.setAttribute('aria-label', window.t('Menu')); btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', 'site-menu');
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
    var panel = document.createElement('div');
    panel.className = 'menu-panel'; panel.id = 'site-menu'; panel.hidden = true;
    panel.innerHTML = items.map(function(a){
      var cur = a.getAttribute('aria-current') === 'page' ? ' aria-current="page"' : '';
      return '<a href="' + a.getAttribute('href') + '"' + cur + (a === acct ? ' class="menu-acct"' : '') + '>' + a.textContent + '</a>';
    }).join('');
    actions.appendChild(btn); nav.appendChild(panel);
    function set(open){ panel.hidden = !open; btn.setAttribute('aria-expanded', String(open)); }
    btn.addEventListener('click', function(e){ e.stopPropagation(); set(panel.hidden); });
    document.addEventListener('click', function(e){ if (!panel.hidden && !panel.contains(e.target)) set(false); });
    document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && !panel.hidden) { set(false); btn.focus(); } });
    window.addEventListener('resize', function(){ if (window.innerWidth > 900) set(false); });
  }
  function ready(){ fixSwitch(); buildMenu(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
})();
