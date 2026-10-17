// Turns data/services.csv (vets, shelters, rescue groups) into services.json for the map.
// Positions: exact street address (looked up once via OpenStreetMap and cached), otherwise
// the town/area centre from places.js, otherwise the district centre. Town/district positions
// are marked "approx" so the page can say so.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const DISTRICT_CENTRES = {
  Nicosia: [35.1725, 33.365], Limassol: [34.6841, 33.0379], Larnaca: [34.9229, 33.6233],
  Paphos: [34.7754, 32.4245], Famagusta: [35.0375, 33.9833], Kyrenia: [35.3364, 33.3192]
};
const CATS = { 'vet clinic': 'vet', 'shelter / sanctuary': 'shelter', 'rescue group / charity': 'rescue', 'cat rescue / charity': 'rescue' };

export function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); if (row.some((x) => x.trim())) rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  row.push(cell); if (row.some((x) => x.trim())) rows.push(row);
  const head = rows.shift().map((h) => h.trim());
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])));
}

const norm = (x) => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const slug = (x) => norm(x).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const km = (a, b) => { const R = 6371, r = Math.PI / 180, dLa = (b[0] - a[0]) * r, dLo = (b[1] - a[1]) * r;
  const s = Math.sin(dLa / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(s)); };

function website(raw, name) {
  let w = String(raw || '').replace(/\(contact form\)/i, '').trim();
  if (!w) return null;
  if (/^facebook$/i.test(w)) return 'https://www.facebook.com/search/top?q=' + encodeURIComponent(name);
  const fb = w.match(/^facebook\.com\/(.+)$/i);
  if (fb && /\s/.test(fb[1])) return 'https://www.facebook.com/search/top?q=' + encodeURIComponent(fb[1]);
  if (!/\./.test(w)) return null;
  return /^https?:\/\//.test(w) ? w : 'https://' + w.replace(/\s+/g, '');
}

function loadPlaces(root) {
  const sb = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'places.js'), 'utf8'), sb);
  const list = [];
  for (const p of sb.window.FMP_PLACES || []) for (const n of [p.name, ...(p.aka || [])]) list.push({ key: norm(n), place: p });
  return list.sort((a, b) => b.key.length - a.key.length); // longest name first ("Kato Paphos" before "Paphos")
}

async function nominatim(q) {
  const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=cy&limit=1&q=' + encodeURIComponent(q);
  const r = await fetch(url, { headers: { 'User-Agent': 'FindMyPetCyprus-build/1.0 (hello@findmypetcy.com)', 'Accept-Language': 'en' }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  return j && j[0] ? [+j[0].lat, +j[0].lon] : null;
}

export async function buildServices({ root, cacheFile, lookup = true, log = console.log }) {
  const csvPath = path.join(root, 'data', 'services.csv');
  if (!fs.existsSync(csvPath)) return [];
  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  const places = loadPlaces(root);
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8')); } catch {}
  let looked = 0, failedNet = false;
  const out = [], ids = new Set();

  for (const r of rows) {
    const name = r['Name']; if (!name) continue;
    const district = r['District'] || '';
    const address = r['Address'] || '';
    const cat = CATS[norm(r['Category'])] || 'vet';
    let id = slug(name + '-' + district); while (ids.has(id)) id += '-2'; ids.add(id);

    // Town / area from the address (ignore the trailing "District, Cyprus")
    const addrN = norm(address);
    const hit = places.find((p) => new RegExp('(^|[^a-z])' + p.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z]|$)').test(addrN) && norm(p.place.name) !== norm(district)
      && km([p.place.lat, p.place.lng], DISTRICT_CENTRES[district] || DISTRICT_CENTRES.Nicosia) < 45);
    const base = hit ? [hit.place.lat, hit.place.lng] : (DISTRICT_CENTRES[district] || DISTRICT_CENTRES.Nicosia);
    const streetLevel = !/not published/i.test(r['Postcode status'] || '') && /\d/.test(address.replace(/\b\d{4}\b/g, '')) ;

    let pos = null, approx = true;
    if (streetLevel) {
      const key = norm(address);
      if (cache[key] !== undefined && (cache[key] || (Date.now() - (cache[key + '#t'] || 0)) < 30 * 864e5)) pos = cache[key];
      else if (lookup && !failedNet) {
        try {
          if (looked++) await new Promise((res) => setTimeout(res, 1100)); // OpenStreetMap usage policy: max 1 request per second
          pos = await nominatim(address);
          cache[key] = pos; cache[key + '#t'] = Date.now();
        } catch (e) { failedNet = true; log('  address look-up unavailable (' + e.message + '); using town positions'); }
      }
      // Reject results that are far from the expected town/district (wrong match)
      if (pos && km(pos, base) > (hit ? 8 : 25)) pos = null;
      if (pos) approx = false;
    }
    if (!pos) pos = base;

    const emails = (r['Email'] || '').split(/[;,]\s*/).filter((e) => /@/.test(e));
    out.push({
      id, name, cat, district, address: address.replace(/,\s*Cyprus$/, ''), postcode: r['Postcode'] || '',
      phone: r['Phone'] || '', email: emails[0] || '', website: website(r['Website'], name), maps: r['Google Maps'] || '',
      open24: /\b24 ?h/i.test(name), lat: +pos[0].toFixed(5), lng: +pos[1].toFixed(5), approx
    });
  }
  try { fs.mkdirSync(path.dirname(cacheFile), { recursive: true }); fs.writeFileSync(cacheFile, JSON.stringify(cache)); } catch {}
  const exact = out.filter((s) => !s.approx).length;
  log(`Services: ${out.length} places (${exact} at street address, ${out.length - exact} approximate)` + (looked ? `, ${looked} new look-ups` : ''));
  return out;
}
