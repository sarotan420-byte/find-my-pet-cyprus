// Data layer shared by every page. Talks to Supabase when config.js has keys,
// otherwise falls back to the demo data in data.js so the site still works.
window.API = (function(){
  var cfg = window.SITE_CONFIG || {};
  var live = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
  var sb = live ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
  var DEMO_NOW = new Date('2026-10-08T12:00:00');
  var BASE = location.href.replace(/[?#].*$/, '').replace(/[^/]*$/, '');
  var PLACEHOLDER = 'assets/photo.jpg';
  var DISTRICT_CENTRES = {
    Nicosia: [35.1725, 33.365], Limassol: [34.6841, 33.0379], Larnaca: [34.9229, 33.6233],
    Paphos: [34.7754, 32.4245], Famagusta: [35.0375, 33.9833], Kyrenia: [35.3364, 33.3192]
  };

  function esc(s){
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function err(e){ return new Error((e && (e.message || e.error_description)) || 'Something went wrong. Please try again.'); }

  // Database row → the shape the pages were designed around (all text HTML-escaped).
  function fromRow(r){
    var colours = r.colours || [];
    var color = r.color || colours.map(function(c, i){ return i ? c.toLowerCase() : c; }).join(' & ');
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
    var redirect = BASE + 'account.html';
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
          c.toBlob(function(j){ j ? resolve(j) : reject(new Error('Could not read that photo.')); }, 'image/jpeg', 0.85);
        }, 'image/webp', 0.82);
      };
      img.onerror = function(){ URL.revokeObjectURL(url); reject(new Error('That file is not a photo we can read. Try a JPG or PNG.')); };
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
        sb.auth.updateUser({ email: contact.email }, { emailRedirectTo: BASE + 'account.html' }).catch(function(){});
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
  function deleteListing(id){ return live ? sb.from('listings').delete().eq('id', id).then(function(r){ if (r.error) throw err(r.error); }) : Promise.resolve(); }

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
      if (!u || u.is_anonymous) throw new Error('Sign in to save searches.');
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
    spread: spread,
    TILE_URL: TILE_URL, TILE_OPTS: TILE_OPTS,
    live: live, ready: ready, esc: esc, now: function(){ return live ? new Date() : DEMO_NOW; },
    districtCentre: function(d){ return DISTRICT_CENTRES[d]; },
    getUser: getUser, signIn: signIn, signOut: signOut, onAuth: onAuth, isModerator: isModerator,
    getListing: getListing, revealContact: revealContact, submitListing: submitListing,
    myListings: myListings, closeListing: closeListing, deleteListing: deleteListing,
    savedViews: savedViews, saveView: saveView, removeView: removeView,
    moderationQueue: moderationQueue, moderate: moderate
  };
})();
