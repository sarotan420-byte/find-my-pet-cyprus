// Data layer shared by every page. Talks to Supabase when config.js has keys,
// otherwise falls back to the demo data in data.js so the site still works.
window.API = (function(){
  var cfg = window.SITE_CONFIG || {};
  var live = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
  var sb = live ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
  var DEMO_NOW = new Date('2026-10-08T12:00:00');
  var BASE = location.origin + '/';
  var PLACEHOLDER = 'assets/photo.jpg';
  var DISTRICT_CENTRES = {
    Nicosia: [35.1725, 33.365], Limassol: [34.6841, 33.0379], Larnaca: [34.9229, 33.6233],
    Paphos: [34.7754, 32.4245], Famagusta: [35.0375, 33.9833], Kyrenia: [35.3364, 33.3192]
  };

  function esc(s){
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function err(e){ var m = e && (e.message || e.error_description); return new Error(m ? t(m) : t('Something went wrong. Please try again.')); }

  // Database row → the shape the pages were designed around (all text HTML-escaped).
  function fromRow(r){
    var colours = r.colours || [];
    var color = r.color || colours.map(function(c, i){ var x = t(c); return i ? x.toLowerCase() : x; }).join(t(' & '));
    return {
      id: r.id, status: r.status, species: r.species, exoticType: esc(r.exotic_type),
      name: r.name ? esc(r.name) : 'Unnamed', breed: esc(r.breed) || 'Unknown',
      size: r.size || 'Size unknown', sex: r.sex || 'Unknown', colours: colours.map(esc), color: esc(color) || '—',
      markings: esc(r.markings), collar: r.collar, chipped: r.chipped,
      area: esc(r.district + ' — ' + r.area), areaOnly: esc(r.area), district: r.district, postcode: esc(r.postcode),
      lat: r.lat, lng: r.lng, date: r.event_date, time: r.event_time,
      desc: esc(r.description), photos: (r.photos || []).map(esc), photo: r.photos && r.photos[0] ? esc(r.photos[0]) : PLACEHOLDER,
      age: r.age_band, ageText: esc(r.age_text) || '', neutered: r.neutered, vaccinated: r.vaccinated,
      goodWith: r.good_with || [], lister: r.lister, contactName: '',
      moderationStatus: r.moderation_status, moderatorNote: esc(r.moderator_note), rejectReason: esc(r.reject_reason),
      closed: r.closed, createdAt: r.created_at, ownerId: r.owner_id
    };
  }

  // Display helpers (language-aware)
  function kind(p){ return t(p.exoticType || p.species || 'Pet'); }
  function petTitle(p){
    if (p.name && p.name !== 'Unnamed') return p.name;
    var c = (p.color && p.color !== '—') ? p.color : '';
    if (window.LANG === 'el') return kind(p) + (c ? ' (' + c.toLowerCase() + ')' : '');
    return (c ? c + ' ' : '') + kind(p).toLowerCase();
  }
  function statusLabel(s){ return t({ missing: 'Missing', found: 'Found', adoption: 'For adoption' }[s] || s); }
  function fmtDate(d, long){ return new Date(d).toLocaleDateString(window.LOCALE || 'en-GB', long ? { day: 'numeric', month: 'long', year: 'numeric' } : { day: 'numeric', month: 'short' }); }
  function areaText(p){ var a = p.areaOnly || (p.area && p.area.split(' — ')[1]) || p.area || ''; return t(p.district) + (a && a !== p.district ? ' — ' + a : ''); }
  function petPath(p){
    var slug = [p.name && p.name !== 'Unnamed' ? p.name : '', p.status === 'adoption' ? 'adopt' : p.status, p.exoticType || p.species, p.district]
      .join('-').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return 'pet/' + p.id + '-' + slug + '.html';
  }

  var ready = (function(){
    if (!live) return Promise.resolve();
    return sb.from('listings').select('*')
      .eq('moderation_status', 'approved').eq('closed', false)
      .order('created_at', { ascending: false }).limit(2000)
      .then(function(res){
        if (res.error) throw res.error;
        var all = res.data.map(fromRow);
        window.PETS = all.filter(function(p){ return p.status !== 'adoption'; });
        window.ADOPT = all.filter(function(p){ return p.status === 'adoption'; });
      })
      .catch(function(e){
        console.error('Could not load listings', e);
        window.PETS = []; window.ADOPT = [];
      });
  })();

  // ---------- auth ----------
  function getUser(){
    if (!live) return Promise.resolve(null);
    return sb.auth.getSession().then(function(r){ return r.data.session ? r.data.session.user : null; });
  }
  function ensureUser(){
    return getUser().then(function(u){
      if (u) return u;
      return sb.auth.signInAnonymously().then(function(r){ if (r.error) throw err(r.error); return r.data.user; });
    });
  }
  function signIn(email){
    if (!live) return Promise.resolve({ demo: true });
    var redirect = BASE + lp('account.html');
    return getUser().then(function(u){
      if (u && u.is_anonymous) {
        // Attach the email to the guest account so its listings are kept.
        return sb.auth.updateUser({ email: email }, { emailRedirectTo: redirect }).then(function(r){
          if (!r.error) return { linked: true };
          return sb.auth.signInWithOtp({ email: email, options: { emailRedirectTo: redirect } });
        });
      }
      return sb.auth.signInWithOtp({ email: email, options: { emailRedirectTo: redirect } });
    }).then(function(r){ if (r && r.error) throw err(r.error); return r || {}; });
  }
  function signOut(){ return live ? sb.auth.signOut() : Promise.resolve(); }
  function onAuth(fn){ if (live) sb.auth.onAuthStateChange(function(ev, session){ fn(session ? session.user : null, ev); }); }
  function isModerator(){
    if (!live) return Promise.resolve(true);
    return sb.rpc('is_moderator').then(function(r){ return !r.error && r.data === true; });
  }

  // ---------- listings ----------
  function getListing(id){
    if (!live) {
      var all = (window.PETS || []).concat(window.ADOPT || []);
      return Promise.resolve(all.find(function(x){ return x.id === id; }) || null);
    }
    return sb.from('listings').select('*').eq('id', id).maybeSingle().then(function(r){
      if (r.error) throw err(r.error);
      return r.data ? fromRow(r.data) : null;
    });
  }
  function revealContact(id, p){
    if (!live) return Promise.resolve({ name: p ? p.contactName : 'Owner', phone: '99 123 456' });
    return sb.rpc('reveal_contact', { p_id: id }).then(function(r){
      if (r.error) throw err(r.error);
      var c = r.data && r.data[0];
      return c ? { name: esc(c.name), phone: esc(c.phone) } : null;
    });
  }

  // Resize to max 1600px and convert to WebP (falls back to JPEG) before upload.
  function shrink(file){
    return new Promise(function(resolve, reject){
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function(){
        var max = 1600, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
        var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function(b){
          if (b && b.type === 'image/webp') return resolve(b);
          c.toBlob(function(j){ j ? resolve(j) : reject(new Error(t('Could not read that photo.'))); }, 'image/jpeg', 0.85);
        }, 'image/webp', 0.82);
      };
      img.onerror = function(){ URL.revokeObjectURL(url); reject(new Error(t('That file is not a photo we can read. Try a JPG or PNG.'))); };
      img.src = url;
    });
  }
  function uid(){ return (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2)); }
  function uploadPhoto(file, userId){
    return shrink(file).then(function(blob){
      var ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
      var path = userId + '/' + uid() + '.' + ext;
      return sb.storage.from('listing-photos').upload(path, blob, { contentType: blob.type, cacheControl: '31536000' }).then(function(r){
        if (r.error) throw err(r.error);
        return sb.storage.from('listing-photos').getPublicUrl(path).data.publicUrl;
      });
    });
  }

  // listing: snake_case fields matching submit_listing(); files: File[]; contact: {name, phone, email}
  function submitListing(listing, files, contact){
    if (!live) return new Promise(function(r){ setTimeout(function(){ r({ demo: true }); }, 400); });
    var user;
    return ensureUser().then(function(u){
      user = u;
      return Promise.all(files.map(function(f){ return uploadPhoto(f, u.id); }));
    }).then(function(urls){
      listing.photos = urls;
      return sb.rpc('submit_listing', { p: listing, c: contact });
    }).then(function(r){
      if (r.error) throw err(r.error);
      // If they gave an email and are a guest, link it so they can manage the listing later.
      if (contact.email && user.is_anonymous) {
        sb.auth.updateUser({ email: contact.email }, { emailRedirectTo: BASE + lp('account.html') }).catch(function(){});
      }
      return { id: r.data };
    });
  }

  function myListings(){
    if (!live) return Promise.resolve((window.PETS || []).slice(0, 2).map(function(p, i){ return Object.assign({}, p, { moderationStatus: i ? 'pending' : 'approved' }); }));
    return getUser().then(function(u){
      if (!u) return [];
      return sb.from('listings').select('*').eq('owner_id', u.id).order('created_at', { ascending: false }).then(function(r){
        if (r.error) throw err(r.error);
        return r.data.map(fromRow);
      });
    });
  }
  function closeListing(id){ return live ? sb.rpc('close_listing', { p_id: id }).then(function(r){ if (r.error) throw err(r.error); }) : Promise.resolve(); }
  var PHOTO_PREFIX = '/storage/v1/object/public/listing-photos/';
  function photoPaths(urls){
    return (urls || []).map(function(u){ var i = String(u).indexOf(PHOTO_PREFIX); return i > -1 ? decodeURIComponent(String(u).slice(i + PHOTO_PREFIX.length)) : null; }).filter(Boolean);
  }
  // Deletes the listing and its photos (GDPR: nothing left behind).
  function deleteListing(id){
    if (!live) return Promise.resolve();
    return sb.from('listings').select('photos').eq('id', id).maybeSingle().then(function(r){
      var paths = photoPaths(r.data && r.data.photos);
      return (paths.length ? sb.storage.from('listing-photos').remove(paths) : Promise.resolve()).then(function(){
        return sb.from('listings').delete().eq('id', id);
      });
    }).then(function(r){ if (r && r.error) throw err(r.error); });
  }
  // GDPR: a copy of everything held about the signed-in person.
  function exportMyData(){
    if (!live) return Promise.resolve({ demo: true });
    return getUser().then(function(u){
      if (!u) throw new Error(t('Please sign in first.'));
      return Promise.all([
        sb.from('listings').select('*, listing_contacts(name, phone, email)').eq('owner_id', u.id),
        sb.from('saved_views').select('label, url, created_at').eq('user_id', u.id),
        sb.from('service_suggestions').select('*').eq('user_id', u.id)
      ]).then(function(res){
        if (res[0].error) throw err(res[0].error);
        return { exported_at: new Date().toISOString(), account: { id: u.id, email: u.email || null, created_at: u.created_at, guest: !!u.is_anonymous },
                 listings: res[0].data, saved_searches: (res[1].data || []), place_suggestions: (res[2] && res[2].data) || [] };
      });
    });
  }
  // 'Suggest a place' on the vets page: goes to the moderators.
  function suggestService(s){
    if (!live) return new Promise(function(r){ setTimeout(function(){ r({ demo: true }); }, 400); });
    return ensureUser().then(function(){
      return sb.from('service_suggestions').insert(s).then(function(r){ if (r.error) throw err(r.error); return true; });
    });
  }
  function serviceSuggestions(status){
    return sb.from('service_suggestions').select('*').eq('status', status || 'open').order('created_at', { ascending: false }).limit(200)
      .then(function(r){ if (r.error) throw err(r.error); return r.data; });
  }
  function setSuggestionStatus(id, status){
    return sb.from('service_suggestions').update({ status: status }).eq('id', id).then(function(r){ if (r.error) throw err(r.error); });
  }
  // GDPR: remove photos, then the account (listings, contacts and saved searches go with it).
  function deleteMyAccount(){
    if (!live) return Promise.resolve();
    return getUser().then(function(u){
      if (!u) throw new Error(t('Please sign in first.'));
      return sb.storage.from('listing-photos').list(u.id, { limit: 1000 }).then(function(r){
        var paths = (r.data || []).map(function(f){ return u.id + '/' + f.name; });
        return paths.length ? sb.storage.from('listing-photos').remove(paths) : null;
      }).then(function(){ return sb.rpc('delete_my_account'); })
        .then(function(r){ if (r.error) throw err(r.error); return sb.auth.signOut(); });
    });
  }

  // ---------- saved searches ----------
  var demoViews = [
    { id: 1, label: 'Missing dogs · Limassol', url: 'missing.html?species=Dog&district=Limassol', created_at: new Date(Date.now() - 2 * 864e5).toISOString() },
    { id: 2, label: 'Found cats · all of Cyprus', url: 'found.html?species=Cat', created_at: new Date(Date.now() - 7 * 864e5).toISOString() }
  ];
  function savedViews(){
    if (!live) return Promise.resolve(demoViews.slice());
    return sb.from('saved_views').select('*').order('created_at', { ascending: false }).then(function(r){
      if (r.error) throw err(r.error);
      return r.data.map(function(v){ return { id: v.id, label: esc(v.label), url: esc(v.url), created_at: v.created_at }; });
    });
  }
  function saveView(label, url){
    if (!live) { demoViews.unshift({ id: Date.now(), label: label, url: url, created_at: new Date().toISOString() }); return Promise.resolve(); }
    return getUser().then(function(u){
      if (!u || u.is_anonymous) throw new Error(t('Sign in to save searches.'));
      return sb.from('saved_views').insert({ label: label, url: url }).then(function(r){ if (r.error) throw err(r.error); });
    });
  }
  function removeView(id){
    if (!live) { demoViews = demoViews.filter(function(v){ return v.id !== id; }); return Promise.resolve(); }
    return sb.from('saved_views').delete().eq('id', id).then(function(r){ if (r.error) throw err(r.error); });
  }

  // ---------- moderation ----------
  function moderationQueue(){
    return sb.rpc('moderation_queue').then(function(r){
      if (r.error) throw err(r.error);
      return r.data.map(function(row){
        var p = fromRow(row);
        p.contact = esc(row.contact_name) + ' · ' + esc(row.contact_phone) + (row.contact_email ? ' · ' + esc(row.contact_email) : '');
        p.ownerCreatedAt = row.owner_created_at; p.ownerAnonymous = row.owner_is_anonymous;
        p.ownerRecent = Number(row.owner_recent_count) || 0;
        p.rawDesc = row.description;
        return p;
      });
    });
  }
  function moderate(id, status, note, reason){
    return sb.rpc('moderate_listing', { p_id: id, p_status: status, p_note: note || null, p_reason: reason || null })
      .then(function(r){ if (r.error) throw err(r.error); });
  }

  // Map tiles. OpenStreetMap's free tiles; for heavy traffic switch to a keyed provider (e.g. MapTiler) here.
  var TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  var TILE_OPTS = { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' };

  // ---------- postcode / place lookup (OpenStreetMap Nominatim, Cyprus only) ----------
  var DISTRICTS = ['Nicosia', 'Limassol', 'Larnaca', 'Paphos', 'Famagusta', 'Kyrenia'];
  var PC_DISTRICT = { '1': 'Nicosia', '2': 'Nicosia', '3': 'Limassol', '4': 'Limassol', '5': 'Famagusta', '6': 'Larnaca', '7': 'Larnaca', '8': 'Paphos', '9': 'Kyrenia' };
  var geoMem = {};
  function isPostcode(q){ return /^\d{4}$/.test(String(q || '').trim()); }
  function geocode(q){
    q = String(q || '').trim();
    if (!q) return Promise.resolve(null);
    var key = (window.LANG || 'en') + ':' + q.toLowerCase(), pc = isPostcode(q);
    if (geoMem[key]) return Promise.resolve(geoMem[key]);
    try { var hit = JSON.parse(localStorage.getItem('fmp-geo:' + key) || 'null'); if (hit) return Promise.resolve(geoMem[key] = hit); } catch (e) {}
    var url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=cy&addressdetails=1&accept-language=en&limit=1&' +
      (pc ? 'postalcode=' + q : 'q=' + encodeURIComponent(q));
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function(){ if (ctl) ctl.abort(); }, 7000);
    return fetch(url, ctl ? { signal: ctl.signal } : {}).then(function(r){ return r.ok ? r.json() : []; }).catch(function(){ return []; }).then(function(j){
      clearTimeout(timer);
      var r = j && j[0], res = null;
      if (r) {
        var a = r.address || {};
        var where = [a.state_district, a.county, a.state, a.city, a.town, a.municipality].join(' ');
        var district = DISTRICTS.find(function(d){ return where.indexOf(d) > -1; }) || (pc ? PC_DISTRICT[q[0]] : null);
        var place = a.suburb || a.neighbourhood || a.quarter || a.village || a.town || a.city || a.municipality || '';
        res = { name: pc ? t('Postcode') + ' ' + q + (place ? ' · ' + place : '') : (r.name || q) + (district && r.name !== district ? ' · ' + t(district) : ''),
                kind: pc ? 'Postcode' : 'Place', lat: +r.lat, lng: +r.lon, district: district || null, exact: true };
      } else if (pc && PC_DISTRICT[q[0]]) {
        var c = DISTRICT_CENTRES[PC_DISTRICT[q[0]]];
        res = { name: t('Postcode') + ' ' + q + ' · ' + t('{d} district', { d: t(PC_DISTRICT[q[0]]) }), kind: 'Postcode', lat: c[0], lng: c[1], district: PC_DISTRICT[q[0]], exact: false };
      }
      if (res) { geoMem[key] = res; if (res.exact) try { localStorage.setItem('fmp-geo:' + key, JSON.stringify(res)); } catch (e) {} }
      return res;
    });
  }
  function km(a, b){
    var R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLng = (b.lng - a.lng) * Math.PI / 180;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  // Listings at the exact same spot would hide each other; fan them out in a small ring (pixels).
  function spread(list){
    var groups = {}, out = {};
    list.forEach(function(p){ var k = (+p.lat).toFixed(4) + ',' + (+p.lng).toFixed(4); (groups[k] = groups[k] || []).push(p); });
    Object.keys(groups).forEach(function(k){
      var g = groups[k];
      g.forEach(function(p, i){
        if (g.length === 1) { out[p.id] = [0, 0]; return; }
        var r = g.length <= 6 ? 14 : 20, a = (2 * Math.PI * i) / g.length - Math.PI / 2;
        out[p.id] = [Math.round(r * Math.cos(a)), Math.round(r * Math.sin(a))];
      });
    });
    return out;
  }

  return {
    kind: kind, petTitle: petTitle, statusLabel: statusLabel, fmtDate: fmtDate, areaText: areaText, petPath: petPath,
    geocode: geocode, isPostcode: isPostcode, km: km, RADII: [1, 3, 5, 10, 25],
    spread: spread,
    TILE_URL: TILE_URL, TILE_OPTS: TILE_OPTS,
    live: live, ready: ready, esc: esc, now: function(){ return live ? new Date() : DEMO_NOW; },
    districtCentre: function(d){ return DISTRICT_CENTRES[d]; },
    getUser: getUser, signIn: signIn, signOut: signOut, onAuth: onAuth, isModerator: isModerator,
    getListing: getListing, revealContact: revealContact, submitListing: submitListing,
    myListings: myListings, closeListing: closeListing, deleteListing: deleteListing, exportMyData: exportMyData, deleteMyAccount: deleteMyAccount,
    savedViews: savedViews, saveView: saveView, removeView: removeView,
    moderationQueue: moderationQueue, moderate: moderate,
    suggestService: suggestService, serviceSuggestions: serviceSuggestions, setSuggestionStatus: setSuggestionStatus
  };
})();
