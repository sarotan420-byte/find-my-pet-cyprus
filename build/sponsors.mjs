// Turns data/sponsors.csv into sponsors.json and the ready-made sponsor sections of supporters.html.
// Rows outside their start/end dates are left out, so a lapsed sponsor disappears on the next build.
// Warns about missing logos, missing Greek text and two active sponsors in one category or district.
import fs from 'node:fs';
import path from 'node:path';
import { parseCsv } from './services.mjs';

export const CATEGORIES = ['retail', 'insurance', 'food', 'relocation'];
const CAT_LABEL = { retail: 'Pet retailer', insurance: 'Pet insurance', food: 'Pet food', relocation: 'Pet relocation', wellbeing: 'Health & wellbeing', other: 'Partner' };
export const DISTRICTS = ['nicosia', 'limassol', 'larnaca', 'paphos', 'famagusta', 'kyrenia'];
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function loadSponsors({ root, file, today = new Date().toISOString().slice(0, 10), warn = console.warn }) {
  const csv = file || path.join(root, 'data', 'sponsors.csv');
  const out = { founding: [], district: [], supporters: [] };
  if (!fs.existsSync(csv)) return out;
  const rows = parseCsv(fs.readFileSync(csv, 'utf8'));
  const seen = {};
  for (const [i, raw] of rows.entries()) {
    const r = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k.trim().toLowerCase(), (v || '').trim()]));
    const line = `sponsors.csv row ${i + 2} (${r.name || 'no name'})`;
    if (!r.name) continue;
    const tier = r.tier.toLowerCase();
    if (!['founding', 'district', 'supporter'].includes(tier)) { warn(`  ! ${line}: tier must be founding, district or supporter`); continue; }
    if ((r.start && r.start > today) || (r.end && r.end < today)) continue; // not active today
    let url = r.url || '';
    if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
    if (url && !/^https?:\/\/[^\s"<>]+\.[^\s"<>]+$/i.test(url)) { warn(`  ! ${line}: website "${r.url}" doesn't look like a web address; left out`); url = ''; }
    const s = {
      tier, name: r.name, name_el: r.name_el || '', url,
      blurb_en: r.blurb_en || '', blurb_el: r.blurb_el || '', offer_en: r.offer_en || '', offer_el: r.offer_el || '',
      note_en: r.note_en || '', note_el: r.note_el || '', start: r.start || '', end: r.end || ''
    };
    if (tier !== 'supporter') {
      const logo = path.basename(r.logo || '');
      if (!logo) warn(`  ! ${line}: no logo file given`);
      else if (!/\.(svg|png|webp|jpe?g)$/i.test(logo)) warn(`  ! ${line}: logo should be an SVG or PNG file`);
      else if (!fs.existsSync(path.join(root, 'assets', 'sponsors', logo))) warn(`  ! ${line}: logo file assets/sponsors/${logo} is missing`);
      else s.logo = logo;
      if (s.blurb_en && !s.blurb_el) warn(`  ! ${line}: Greek description (blurb_el) is missing`);
      if (s.offer_en && !s.offer_el) warn(`  ! ${line}: Greek offer (offer_el) is missing`);
    }
    if (s.note_en && !s.note_el) warn(`  ! ${line}: Greek note (note_el) is missing`);
    if (tier === 'founding') {
      s.category = (r.category || 'other').toLowerCase();
      if (!CAT_LABEL[s.category]) { warn(`  ! ${line}: unknown category "${r.category}", shown as "other"`); s.category = 'other'; }
      const k = 'cat:' + s.category;
      if (CATEGORIES.includes(s.category) && seen[k]) { warn(`  ! ${line}: two active Founding Partners in "${s.category}" (also ${seen[k]}); only the first is shown`); continue; }
      seen[k] = r.name; out.founding.push(s);
    } else if (tier === 'district') {
      s.district = (r.district || '').toLowerCase();
      if (!DISTRICTS.includes(s.district)) { warn(`  ! ${line}: district must be one of ${DISTRICTS.join(', ')}`); continue; }
      const k = 'dist:' + s.district;
      if (seen[k]) { warn(`  ! ${line}: two active District Partners in ${cap(s.district)} (also ${seen[k]}); only the first is shown`); continue; }
      seen[k] = r.name; out.district.push(s);
    } else out.supporters.push(s);
  }
  return out;
}

// ---------- HTML for supporters.html (T = translate for the page language) ----------
const nm = (s, lang) => esc(lang === 'el' && s.name_el ? s.name_el : s.name);
const tx = (s, f, lang) => esc(lang === 'el' ? (s[f + '_el'] || s[f + '_en']) : s[f + '_en']);
const visit = (s, T, cls) => s.url ? `<a class="btn ${cls || 'btn-secondary'} sp-visit" href="${esc(s.url)}" target="_blank" rel="sponsored noopener">${T('Visit website')} <span aria-hidden="true">↗</span></a>` : '';
const logo = (s, lang) => s.logo ? `<img src="/assets/sponsors/${encodeURIComponent(s.logo)}" alt="${nm(s, lang)}" loading="lazy" />` : `<span class="sp-noimg">${nm(s, lang)}</span>`;

export function foundingHtml(data, lang, T) {
  const byCat = Object.fromEntries(data.founding.filter((s) => CATEGORIES.includes(s.category)).map((s) => [s.category, s]));
  // active partners first (pet categories in order, then others), open pet categories after
  const cards = CATEGORIES.filter((c) => byCat[c]).map((c) => card(byCat[c]))
    .concat(data.founding.filter((s) => !CATEGORIES.includes(s.category)).map(card))
    .concat(CATEGORIES.filter((c) => !byCat[c]).map(wanted));
  return cards.join('\n');
  function card(s) {
    return `<article class="sp-card sp-founding">
  <div class="sp-logo">${logo(s, lang)}</div>
  <div class="sp-body">
    <div class="sp-top"><span class="sp-cat">${T(CAT_LABEL[s.category])}</span><span class="sp-label">${T('Sponsor')}</span></div>
    <h3>${nm(s, lang)}</h3>
    ${s.blurb_en ? `<p class="sp-blurb">${tx(s, 'blurb', lang)}</p>` : ''}
    ${s.offer_en ? `<p class="sp-offer">${tx(s, 'offer', lang)}</p>` : ''}
    ${visit(s, T)}
  </div>
</article>`;
  }
  function wanted(c) {
    return `<a class="sp-card sp-wanted" href="#become" data-interest="founding">
  <span class="sp-cat">${T(CAT_LABEL[c])}</span>
  <h3>${T('Partner wanted: {category}', { category: T(CAT_LABEL[c]).toLowerCase() })}</h3>
  <p>${T('This Founding Partner spot is open. Get in touch if your business is a good fit.')}</p>
  <span class="read">${T('Become a Founding Partner →')}</span>
</a>`;
  }
}

export function districtHtml(data, lang, T) {
  const by = Object.fromEntries(data.district.map((s) => [s.district, s]));
  return DISTRICTS.map((d) => {
    const s = by[d], label = T(cap(d));
    if (!s) return `<div class="sp-card sp-district sp-open">
  <h3>${label}</h3>
  <p class="sp-avail">${T('Available')}</p>
  <a class="sp-link" href="#become" data-interest="district" data-district="${cap(d)}">${T('Become a District Partner →')}</a>
</div>`;
    return `<article class="sp-card sp-district">
  <div class="sp-top"><h3>${label}</h3><span class="sp-label">${T('Sponsor')}</span></div>
  <div class="sp-logo sp-logo-sm">${logo(s, lang)}</div>
  <p class="sp-name">${nm(s, lang)}</p>
  ${s.offer_en ? `<p class="sp-offer">${tx(s, 'offer', lang)}</p>` : ''}
  ${s.url ? `<a class="sp-link" href="${esc(s.url)}" target="_blank" rel="sponsored noopener">${T('Visit website')} <span aria-hidden="true">↗</span></a>` : ''}
</article>`;
  }).join('\n');
}

export function supportersHtml(data, lang, T) {
  if (!data.supporters.length) return '';
  const list = data.supporters.slice().sort((a, b) => (lang === 'el' && a.name_el ? a.name_el : a.name).localeCompare(lang === 'el' && b.name_el ? b.name_el : b.name, lang === 'el' ? 'el' : 'en', { sensitivity: 'base' }));
  return list.map((s) => `<li><span class="sp-who">${nm(s, lang)}</span>${s.note_en ? ` <span class="sp-note">${tx(s, 'note', lang)}</span>` : ''}</li>`).join('\n');
}

// Public data file (no dates) for later features such as a homepage logo strip.
export function publicJson(data) {
  const strip = (s) => { const { start, end, ...rest } = s; return rest; };
  return JSON.stringify({ founding: data.founding.map(strip), district: data.district.map(strip), supporters: data.supporters.map(strip) });
}
