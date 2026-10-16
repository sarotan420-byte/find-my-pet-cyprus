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
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fixSwitch); else fixSwitch();
})();
