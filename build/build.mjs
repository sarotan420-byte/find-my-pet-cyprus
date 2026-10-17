// Builds the deployable site into _site/:
//  - English pages (with SEO tags) and Greek copies under /el/
//  - one static page per approved pet (/pet/ and /el/pet/), so Google, Facebook and WhatsApp can read them
//  - district pages (/area/ and /el/area/), sitemap.xml, robots.txt, web manifest
// Run: node build/build.mjs            (fetches live listings from Supabase)
//      DATA_FILE=x.json node build/...  (use listings from a file, for testing)
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { parse } from 'node-html-parser';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, '_site');
const SITE = 'https://www.findmypetcy.com';
const TODAY = new Date().toISOString().slice(0, 10);
const SKIP = new Set(['.git', '.github', 'node_modules', '_site', 'build', 'supabase', 'package.json', 'package-lock.json', 'BUILD.md', 'DESIGN-NOTES.md', 'README.md', '.gitignore']);

// ---------- dictionary ----------
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'i18n-el.js'), 'utf8'), sandbox);
const EL = sandbox.window.I18N_EL;
const missing = new Set();
const tr = (s) => { if (EL[s] != null) return EL[s]; missing.add(s); return s; };
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? v[k] : m));
const T = (lang, s, v) => fill(lang === 'el' ? tr(s) : s, v || {});

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const DISTRICTS = ['Nicosia', 'Limassol', 'Larnaca', 'Paphos', 'Famagusta', 'Kyrenia'];
const IN_EL = { Nicosia: 'στη Λευκωσία', Limassol: 'στη Λεμεσό', Larnaca: 'στη Λάρνακα', Paphos: 'στην Πάφο', Famagusta: 'στην Αμμόχωστο', Kyrenia: 'στην Κερύνεια' };

// ---------- page SEO ----------
const PAGES = {
  'index.html': { en: ['Lost & Found Pets in Cyprus – Live Map | Find My Pet Cyprus', 'Lost a dog or cat in Cyprus? Search the live map of missing and found pets in Nicosia, Limassol, Larnaca, Paphos and Famagusta, or report a pet for free in minutes.'],
                  el: ['Χαμένα & Ευρεθέντα Κατοικίδια στην Κύπρο – Χάρτης | Find My Pet Cyprus', 'Χάθηκε ο σκύλος ή η γάτα σας; Δείτε τον ζωντανό χάρτη με χαμένα και ευρεθέντα κατοικίδια σε Λευκωσία, Λεμεσό, Λάρνακα, Πάφο και Αμμόχωστο ή δηλώστε δωρεάν ένα ζώο.'], home: true },
  'missing.html': { en: ['Missing Pets in Cyprus – Lost Dogs & Cats | Find My Pet Cyprus', 'Browse lost dogs, cats and other pets reported missing across Cyprus. Filter by area, postcode, breed and colour, and contact the owner if you have seen one.'],
                    el: ['Χαμένα Κατοικίδια στην Κύπρο – Χαμένοι Σκύλοι & Γάτες | Find My Pet Cyprus', 'Δείτε χαμένους σκύλους, γάτες και άλλα κατοικίδια σε όλη την Κύπρο. Φιλτράρετε ανά περιοχή, ταχυδρομικό κώδικα, ράτσα και χρώμα και επικοινωνήστε με τον ιδιοκτήτη.'] },
  'found.html': { en: ['Found Pets in Cyprus – Found Dogs & Cats | Find My Pet Cyprus', 'Found a dog or cat in Cyprus, or looking for your lost pet? Browse pets found across Cyprus by area, postcode, breed and colour.'],
                  el: ['Ευρεθέντα Κατοικίδια στην Κύπρο – Βρέθηκε Σκύλος ή Γάτα | Find My Pet Cyprus', 'Βρήκατε σκύλο ή γάτα στην Κύπρο ή ψάχνετε το χαμένο σας κατοικίδιο; Δείτε ζώα που βρέθηκαν ανά περιοχή, ταχυδρομικό κώδικα, ράτσα και χρώμα.'] },
  'adopt.html': { en: ['Adopt a Dog or Cat in Cyprus – Pets for Adoption | Find My Pet Cyprus', 'Adopt a dog, cat or other pet in Cyprus from shelters, rescue groups, foster homes and owners. Filter by age, size, district and who they get on with.'],
                  el: ['Υιοθεσία Σκύλου ή Γάτας στην Κύπρο | Find My Pet Cyprus', 'Υιοθετήστε σκύλο, γάτα ή άλλο κατοικίδιο στην Κύπρο από καταφύγια, φιλοζωικές ομάδες, οικογένειες φιλοξενίας και ιδιοκτήτες. Φιλτράρετε ανά ηλικία, μέγεθος και επαρχία.'] },
  'submit.html': { en: ['Report a Lost or Found Pet in Cyprus (Free) | Find My Pet Cyprus', 'Report a missing or found dog, cat or other pet anywhere in Cyprus in a few minutes. Add photos and the area, then share a poster. Free and checked by a moderator.'],
                   el: ['Δήλωση Χαμένου ή Ευρεθέντος Κατοικιδίου (Δωρεάν) | Find My Pet Cyprus', 'Δηλώστε σε λίγα λεπτά έναν χαμένο ή ευρεθέντα σκύλο, γάτα ή άλλο κατοικίδιο σε όλη την Κύπρο. Προσθέστε φωτογραφίες και περιοχή και μοιραστείτε αφίσα. Δωρεάν.'] },
  'lost-pet-guide.html': { en: ['Lost Your Pet in Cyprus? What to Do – Step-by-Step Guide | Find My Pet Cyprus', 'Lost a dog or cat in Cyprus? Follow these steps: search nearby, report on the map, call local vet clinics, check the microchip, make posters and watch for scams.'],
                            el: ['Χάθηκε το Κατοικίδιό σας; Τι να Κάνετε – Οδηγός | Find My Pet Cyprus', 'Χάθηκε ο σκύλος ή η γάτα σας στην Κύπρο; Ψάξτε κοντά, δηλώστε το στον χάρτη, τηλεφωνήστε στις κτηνιατρικές κλινικές, ελέγξτε το microchip, φτιάξτε αφίσες και προσοχή στις απάτες.'], guide: true },
  'found-pet-guide.html': { en: ['Found a Lost Dog or Cat in Cyprus? What to Do | Find My Pet Cyprus', 'Found a pet in Cyprus? Check for a tag, get the microchip scanned at a vet, report it on the map, tell local clinics and check the person is the real owner before handing it over.'],
                             el: ['Βρήκατε Χαμένο Σκύλο ή Γάτα στην Κύπρο; Τι να Κάνετε | Find My Pet Cyprus', 'Βρήκατε κατοικίδιο στην Κύπρο; Ελέγξτε για ταυτότητα, σκανάρετε το microchip σε κτηνίατρο, δηλώστε το στον χάρτη, ενημερώστε τις κλινικές και βεβαιωθείτε για τον ιδιοκτήτη.'] },
  'privacy.html': { en: ['Privacy Policy | Find My Pet Cyprus', 'How Find My Pet Cyprus collects, uses and protects personal data, and how to download or delete your data.'],
                    el: ['Πολιτική Απορρήτου | Find My Pet Cyprus', 'Πώς το Find My Pet Cyprus συλλέγει, χρησιμοποιεί και προστατεύει προσωπικά δεδομένα και πώς μπορείτε να τα κατεβάσετε ή να τα διαγράψετε.'] },
  'terms.html': { en: ['Terms of Use | Find My Pet Cyprus', 'Rules for posting lost, found and adoption listings on Find My Pet Cyprus, and tips for staying safe.'],
                  el: ['Όροι Χρήσης | Find My Pet Cyprus', 'Κανόνες για τις αγγελίες χαμένων, ευρεθέντων και προς υιοθεσία κατοικιδίων στο Find My Pet Cyprus και συμβουλές ασφαλείας.'] },
  'listing.html': { en: ['Pet listing | Find My Pet Cyprus', 'A missing, found or adoptable pet in Cyprus.'], el: ['Αγγελία κατοικιδίου | Find My Pet Cyprus', 'Χαμένο, ευρεθέν ή προς υιοθεσία κατοικίδιο στην Κύπρο.'], noindex: true },
  'account.html': { en: ['Your account | Find My Pet Cyprus', 'Manage your listings and saved searches.'], el: ['Ο λογαριασμός σας | Find My Pet Cyprus', 'Διαχειριστείτε τις αγγελίες και τις αποθηκευμένες αναζητήσεις σας.'], noindex: true },
  'poster.html': { en: ['Make a poster | Find My Pet Cyprus', 'Make a printable or shareable poster for a pet.'], el: ['Δημιουργία αφίσας | Find My Pet Cyprus', 'Φτιάξτε αφίσα για εκτύπωση ή κοινοποίηση.'], noindex: true },
  'moderation.html': { en: ['Moderation queue | Find My Pet Cyprus', 'Moderators only.'], noindex: true, enOnly: true },
};

const ORG = { '@type': 'Organization', '@id': SITE + '/#org', name: 'Find My Pet Cyprus', url: SITE + '/', logo: SITE + '/assets/icons/icon-512.png', email: 'hello@findmypetcy.com', areaServed: 'CY' };

function headTags({ lang, title, desc, enPath, elPath, image, noindex, jsonld, type }) {
  const url = SITE + '/' + (lang === 'el' ? elPath : enPath);
  const img = image || SITE + (lang === 'el' ? '/assets/og-image-el.png' : '/assets/og-image.png');
  const t = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(desc)}" />`,
    noindex ? '<meta name="robots" content="noindex, follow" />' : '',
    `<link rel="canonical" href="${url}" />`,
    elPath ? `<link rel="alternate" hreflang="en" href="${SITE}/${enPath}" />` : '',
    elPath ? `<link rel="alternate" hreflang="el" href="${SITE}/${elPath}" />` : '',
    elPath ? `<link rel="alternate" hreflang="x-default" href="${SITE}/${enPath}" />` : '',
    `<meta property="og:site_name" content="Find My Pet Cyprus" />`,
    `<meta property="og:type" content="${type || 'website'}" />`,
    `<meta property="og:title" content="${esc(title.replace(/ \| Find My Pet Cyprus$/, ''))}" />`,
    `<meta property="og:description" content="${esc(desc)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${esc(img)}" />`,
    `<meta property="og:locale" content="${lang === 'el' ? 'el_GR' : 'en_GB'}" />`,
    `<meta property="og:locale:alternate" content="${lang === 'el' ? 'en_GB' : 'el_GR'}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    '<meta name="theme-color" content="#c67139" />',
    '<link rel="icon" href="/assets/icons/icon.svg" type="image/svg+xml" />',
    '<link rel="icon" href="/assets/icons/favicon-32.png" sizes="32x32" type="image/png" />',
    '<link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon.png" />',
    '<link rel="manifest" href="/site.webmanifest" />',
    jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>` : '',
  ];
  return t.filter(Boolean).join('\n');
}

// ---------- HTML transforms ----------
const PAGE_RE = /^(index|missing|found|adopt|submit|listing|account|poster|privacy|terms|search|lost-pet-guide|found-pet-guide)\.html([?#].*)?$/;
function localizeHref(href) {
  if (!href) return href;
  if (PAGE_RE.test(href) || /^(area|pet)\//.test(href)) return 'el/' + href;
  if (/^\/(?!el\/)/.test(href) && (PAGE_RE.test(href.slice(1)) || /^\/(area|pet)\//.test(href) || href === '/')) return '/el' + href;
  return href;
}

function setHead(root, tags, { lang, extraHead = '' }) {
  const head = root.querySelector('head');
  head.querySelectorAll('title, meta[name="description"], meta[name="robots"], link[rel="canonical"], link[rel="alternate"], meta[property^="og:"], meta[name^="twitter:"]').forEach((n) => n.remove());
  const charset = head.querySelector('meta[charset]');
  const html = tags + (extraHead ? '\n' + extraHead : '');
  if (charset) charset.insertAdjacentHTML('afterend', '\n' + html); else head.insertAdjacentHTML('afterbegin', html);
  root.querySelector('html').setAttribute('lang', lang);
}

function translateTree(node) {
  if (node.nodeType === 3) {
    const raw = node.rawText; const txt = raw.trim();
    if (txt && /[A-Za-z]/.test(txt) && !/^[\s\d·—–\-|/()&;#.,:]+$/.test(txt)) {
      const decoded = parse('<x>' + txt + '</x>').querySelector('x').text; // decode entities for lookup
      const out = EL[decoded] != null ? EL[decoded] : EL[txt];
      if (out != null) node.rawText = raw.replace(txt, esc(out).replace(/&quot;/g, '"'));
      else if (!/^Find My Pet Cyprus$|^[A-Z0-9#.:/\-]+$/.test(decoded)) missing.add(decoded);
    }
    return;
  }
  if (node.tagName && /^(SCRIPT|STYLE|SVG|svg)$/.test(node.tagName)) return;
  if (node.attributes) {
    for (const a of ['placeholder', 'aria-label', 'title', 'alt']) {
      const v = node.getAttribute && node.getAttribute(a);
      if (v && /[a-z]/.test(v)) {
        if (EL[v] != null) node.setAttribute(a, EL[v]); else if (!/^e\.g\. \d|^you@|^Find My Pet Cyprus$|^Ελληνικά$/.test(v)) missing.add(v);
      }
    }
    if (node.tagName === 'A' || node.tagName === 'FORM') {
      const k = node.tagName === 'A' ? 'href' : 'action';
      const h = node.getAttribute(k);
      if (h && !node.classList.contains('lang-switch')) node.setAttribute(k, localizeHref(h));
    }
  }
  (node.childNodes || []).forEach(translateTree);
}

function langSwitch(root, lang, enPath, elPath) {
  const a = root.querySelector('.lang-switch');
  if (!a) return;
  if (lang === 'el') { a.setAttribute('href', '/' + (enPath === 'index.html' ? '' : enPath)); a.setAttribute('lang', 'en'); a.setAttribute('hreflang', 'en'); a.setAttribute('title', 'English'); a.set_content('EN'); }
  else { a.setAttribute('href', elPath ? '/' + elPath.replace(/index\.html$/, '') : '/el/'); }
}

function render(file, { lang, enPath, elPath, seo, extraHead, mutate }) {
  const root = parse(fs.readFileSync(path.join(ROOT, file), 'utf8'), { comment: false, blockTextElements: { script: true, style: true, noscript: true, pre: true } });
  setHead(root, headTags({ lang, enPath, elPath, ...seo }), { lang, extraHead });
  const head = root.querySelector('head');
  const needsBase = lang === 'el' || /\//.test(enPath);
  if (needsBase) head.insertAdjacentHTML('afterbegin', '<base href="/" />');
  if (lang === 'el') {
    const i18n = head.querySelector('script[src^="i18n.js"]');
    if (i18n) i18n.insertAdjacentHTML('beforebegin', '<script src="i18n-el.js?v=' + BUILD_V + '"></script>\n');
    translateTree(root.querySelector('body'));
  }
  langSwitch(root, lang, enPath, elPath);
  if (mutate) mutate(root, lang);
  return '<!doctype html>\n' + root.toString().replace(/^<!doctype html>\s*/i, '');
}

function write(rel, html) {
  const p = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, html);
}

function copyTree(src, dst) {
  for (const name of fs.readdirSync(src)) {
    if (SKIP.has(name) && src === ROOT) continue;
    const s = path.join(src, name), d = path.join(dst, name);
    if (fs.statSync(s).isDirectory()) { fs.mkdirSync(d, { recursive: true }); copyTree(s, d); }
    else fs.copyFileSync(s, d);
  }
}

// ---------- data ----------
async function loadListings() {
  if (process.env.DATA_FILE) return JSON.parse(fs.readFileSync(process.env.DATA_FILE, 'utf8'));
  const cfg = fs.readFileSync(path.join(ROOT, 'config.js'), 'utf8');
  const url = (cfg.match(/supabaseUrl:\s*'([^']+)'/) || [])[1];
  const key = (cfg.match(/supabaseAnonKey:\s*'([^']+)'/) || [])[1];
  if (!url || !key) { console.warn('No Supabase config — building without pet pages.'); return []; }
  const q = 'select=id,status,species,exotic_type,name,breed,size,sex,colours,color,markings,collar,chipped,district,area,lat,lng,event_date,description,photos,age_band,age_text,neutered,vaccinated,good_with,lister,created_at'
          + '&moderation_status=eq.approved&closed=eq.false&order=created_at.desc&limit=5000';
  const r = await fetch(`${url}/rest/v1/listings?${q}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!r.ok) throw new Error('Could not load listings: ' + r.status + ' ' + (await r.text()));
  return r.json();
}

const slugify = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
function petPath(p) {
  const slug = slugify([p.name || '', p.status === 'adoption' ? 'adopt' : p.status, p.exotic_type || p.species, p.district].join('-'));
  return `pet/${p.id}-${slug}.html`;
}
function kind(p, lang) { return T(lang, p.exotic_type || p.species || 'Pet'); }
function colourText(p, lang) {
  if (p.color) return p.color;
  return (p.colours || []).map((c, i) => { const x = T(lang, c); return i ? x.toLowerCase() : x; }).join(T(lang, ' & '));
}
function petTitle(p, lang) {
  if (p.name) return p.name;
  const c = colourText(p, lang), k = kind(p, lang);
  return lang === 'el' ? k + (c ? ' (' + c.toLowerCase() + ')' : '') : (c ? c + ' ' : '') + k.toLowerCase();
}
const statusWord = (s, lang) => T(lang, { missing: 'Missing', found: 'Found', adoption: 'For adoption' }[s]);
const fmtDate = (d, lang) => new Date(d).toLocaleDateString(lang === 'el' ? 'el-GR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const listPage = (s) => (s === 'adoption' ? 'adopt.html' : s + '.html');

function petSeo(p, lang) {
  const title = petTitle(p, lang), k = kind(p, lang).toLowerCase();
  const where = (p.area && p.area !== p.district ? p.area + ', ' : '') + T(lang, p.district);
  const head = p.status === 'missing' ? T(lang, 'Missing {kind}', { kind: k }) : p.status === 'found' ? T(lang, 'Found {kind}', { kind: k }) : T(lang, '{kind} for adoption', { kind: k });
  const when = T(lang, p.status === 'missing' ? 'Missing since {date}' : p.status === 'found' ? 'Found {date}' : 'Available from {date}', { date: fmtDate(p.event_date, lang) });
  const desc = (when + '. ' + where + '. ' + String(p.description || '')).replace(/\s+/g, ' ').slice(0, 158);
  const docTitle = (p.name ? title + ' – ' : '') + head.charAt(0).toUpperCase() + head.slice(1) + ', ' + where + ' | Find My Pet Cyprus';
  return { title: docTitle, desc, k, where, when, head };
}

function petSSR(p, lang) {
  const s = petSeo(p, lang), title = esc(petTitle(p, lang)), photo = (p.photos && p.photos[0]) || '/assets/photo.jpg';
  const facts = [[T(lang, 'Breed'), p.breed || T(lang, 'Unknown')], [T(lang, 'Colour'), colourText(p, lang) || '—'], [T(lang, 'Size · sex'), [T(lang, p.size || 'Size unknown'), p.sex && p.sex !== 'Unknown' ? T(lang, p.sex) : T(lang, 'sex unknown')].join(' · ')]];
  return `<div id="ssr"><div class="layout"><div>
<div class="photo-main" style="cursor:default"><img src="${esc(photo)}" alt="${title} — ${esc(s.head)}, ${esc(s.where)}" /></div>
<div class="head-row"><h1 class="pet-name">${title}</h1><span class="tag ${p.status === 'missing' ? 'tag-accent' : 'tag-accent-2'}">${esc(statusWord(p.status, lang))}</span></div>
<p class="meta-line">${esc(kind(p, lang))} · ${esc(s.where)} · ${esc(s.when)}</p>
<p class="desc">${esc(p.description)}</p>
<div class="facts">${facts.map(([k, v]) => `<div class="fact"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`).join('')}</div>
</div><div><div class="side-card"><h2 class="side-title">${esc(T(lang, p.status === 'missing' ? 'Seen this pet?' : p.status === 'found' ? 'Is this your pet?' : 'Interested in {name}?', { name: petTitle(p, lang) }))}</h2>
<p>${esc(T(lang, 'Contact details are shared only after you tap the button, which keeps them out of search engines and spam.'))}</p></div></div></div></div>`;
}

function petJsonLd(p, lang, url) {
  const s = petSeo(p, lang);
  return [{ '@context': 'https://schema.org', '@type': 'WebPage', name: s.title.replace(/ \| Find My Pet Cyprus$/, ''), description: s.desc, url, inLanguage: lang, datePublished: p.created_at,
            primaryImageOfPage: (p.photos && p.photos[0]) || undefined, isPartOf: { '@type': 'WebSite', name: 'Find My Pet Cyprus', url: SITE + '/' }, publisher: { '@id': SITE + '/#org' } },
          { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Find My Pet Cyprus', item: SITE + (lang === 'el' ? '/el/' : '/') },
            { '@type': 'ListItem', position: 2, name: T(lang, { missing: 'Missing pets', found: 'Found pets', adoption: 'Pets for adoption' }[p.status]), item: SITE + '/' + (lang === 'el' ? 'el/' : '') + listPage(p.status) },
            { '@type': 'ListItem', position: 3, name: petTitle(p, lang), item: url }] }];
}

// ---------- area pages ----------
function card(p, lang) {
  const href = '/' + (lang === 'el' ? 'el/' : '') + petPath(p);
  const photo = (p.photos && p.photos[0]) || '/assets/photo.jpg';
  const when = T(lang, p.status === 'missing' ? 'Missing since {date}' : p.status === 'found' ? 'Found {date}' : 'Available from {date}', { date: fmtDate(p.event_date, lang) });
  return `<a class="pcard" href="${href}"><img src="${esc(photo)}" alt="${esc(petTitle(p, lang))}" loading="lazy" /><span class="pc-b"><span class="pc-n">${esc(petTitle(p, lang))}</span><span class="pc-m">${esc(kind(p, lang))} · ${esc(p.area || '')}</span><span class="pc-m">${esc(when)}</span></span></a>`;
}

function areaPage(d, pets, lang) {
  const slug = d.toLowerCase();
  const enPath = `area/${slug}.html`, elPath = `el/area/${slug}.html`;
  const dn = T(lang, d), inD = lang === 'el' ? IN_EL[d] : 'in ' + d;
  const groups = ['missing', 'found', 'adoption'].map((st) => [st, pets.filter((p) => p.district === d && p.status === st)]);
  const h1 = lang === 'el' ? `Χαμένα και ευρεθέντα κατοικίδια ${inD}` : `Lost and found pets in ${d}`;
  const title = lang === 'el' ? `Χαμένα & Ευρεθέντα Κατοικίδια ${inD} | Find My Pet Cyprus` : `Lost & Found Pets in ${d}, Cyprus | Find My Pet Cyprus`;
  const n = (st) => groups.find((g) => g[0] === st)[1].length;
  const desc = lang === 'el'
    ? `Χαμένοι και ευρεθέντες σκύλοι, γάτες και άλλα κατοικίδια ${inD}. ${n('missing')} χαμένα, ${n('found')} ευρεθέντα και ${n('adoption')} προς υιοθεσία αυτή τη στιγμή. Δηλώστε δωρεάν.`
    : `Lost and found dogs, cats and other pets in ${d}, Cyprus. ${n('missing')} missing, ${n('found')} found and ${n('adoption')} for adoption right now. Report a pet for free.`;
  const sec = groups.map(([st, list]) => {
    const h = lang === 'el' ? { missing: `Χαμένα κατοικίδια ${inD}`, found: `Ευρεθέντα κατοικίδια ${inD}`, adoption: `Προς υιοθεσία ${inD}` }[st] : { missing: `Missing pets in ${d}`, found: `Found pets in ${d}`, adoption: `Pets for adoption in ${d}` }[st];
    const empty = lang === 'el' ? 'Δεν υπάρχουν αγγελίες αυτή τη στιγμή.' : 'No listings right now.';
    return `<section><h2>${esc(h)} <span class="cnt">${list.length}</span></h2>${list.length ? `<div class="pgrid">${list.map((p) => card(p, lang)).join('')}</div>` : `<p class="muted">${empty}</p>`}
<p><a href="/${lang === 'el' ? 'el/' : ''}${listPage(st)}?district=${d}">${esc(lang === 'el' ? 'Δείτε όλες με φίλτρα' : 'See all with filters')} →</a></p></section>`;
  }).join('\n');
  const intro = lang === 'el'
    ? `<p class="lede">Χάθηκε ή βρήκατε σκύλο, γάτα ή άλλο κατοικίδιο ${inD}; Εδώ βρίσκονται όλες οι εγκεκριμένες αγγελίες για την επαρχία, μαζί με χάρτη και αναζήτηση ανά ταχυδρομικό κώδικα.</p>`
    : `<p class="lede">Lost or found a dog, cat or other pet in ${d}? Here are all the approved listings for the district, with a map and postcode search to narrow it down.</p>`;
  const tips = lang === 'el'
    ? `<section class="tips"><h2>Τι να κάνετε αν χάθηκε το κατοικίδιό σας</h2><ul><li>Δηλώστε το εδώ με πρόσφατη φωτογραφία και την περιοχή όπου χάθηκε.</li><li>Ενημερώστε τον δήμο, τις κτηνιατρικές κλινικές και την αστυνομία της περιοχής.</li><li>Φτιάξτε αφίσα από την αγγελία και τοποθετήστε τη κοντά στο σημείο.</li><li>Αν βρείτε ζώο, ζητήστε από κτηνίατρο να ελέγξει για μικροτσίπ.</li></ul></section>`
    : `<section class="tips"><h2>What to do if your pet is missing</h2><ul><li>Report it here with a recent photo and the area where it went missing.</li><li>Tell your municipality, local vets and the police.</li><li>Make a poster from your listing and put it up nearby.</li><li>If you find a pet, ask a vet to scan it for a microchip.</li></ul></section>`;
  const others = DISTRICTS.filter((x) => x !== d).map((x) => `<a href="/${lang === 'el' ? 'el/' : ''}area/${x.toLowerCase()}.html">${esc(T(lang, x))}</a>`).join(' · ');
  const url = SITE + '/' + (lang === 'el' ? elPath : enPath);
  const jsonld = [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: h1, description: desc, url, inLanguage: lang, about: { '@type': 'Place', name: dn + ', Cyprus' } },
                  { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Find My Pet Cyprus', item: SITE + (lang === 'el' ? '/el/' : '/') }, { '@type': 'ListItem', position: 2, name: h1, item: url }] }];
  const body = `<p class="crumbs"><a href="/${lang === 'el' ? 'el/' : ''}">${esc(T(lang, 'Map'))}</a> › ${esc(dn)}</p>
<h1>${esc(h1)}</h1>${intro}
<p class="cta"><a class="btn btn-primary" href="/${lang === 'el' ? 'el/' : ''}submit.html">${esc(T(lang, 'Report a missing or found pet'))}</a> <a class="btn btn-secondary" href="/${lang === 'el' ? 'el/' : ''}index.html?near=${encodeURIComponent(d)}&amp;r=10">${esc(lang === 'el' ? `Χάρτης ${inD}` : `Map of ${d}`)}</a></p>
${sec}
${tips}
<p class="others">${esc(lang === 'el' ? 'Άλλες επαρχίες:' : 'Other districts:')} ${others}</p>`;
  return { rel: lang === 'el' ? elPath : enPath, html: render('privacy.html', { lang, enPath, elPath, seo: { title, desc, jsonld },
    extraHead: `<style>.doc{max-width:1100px}.lede{font-size:17px}.crumbs{font-size:13px;margin:0 0 6px}.cta{display:flex;gap:10px;flex-wrap:wrap;margin:16px 0 8px}.cta .btn{text-decoration:none;color:inherit}.cta .btn-primary{color:#fff}
.doc h2 .cnt{font-family:var(--font-body);font-size:13px;background:var(--color-neutral-100);border-radius:999px;padding:2px 9px;vertical-align:middle}
.pgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px}.pcard{display:flex;flex-direction:column;border:1px solid var(--color-neutral-200);border-radius:20px;overflow:hidden;text-decoration:none;color:inherit;background:#fff}
.pcard:hover{box-shadow:var(--shadow-md)}.pcard img{width:100%;aspect-ratio:4/3;object-fit:cover;background:var(--color-neutral-100)}.pc-b{display:flex;flex-direction:column;gap:2px;padding:10px 12px 12px}
.pc-n{font-family:var(--font-heading);font-size:18px}.pc-m{font-size:13px;color:color-mix(in srgb,var(--color-text) 65%,transparent)}.muted{color:color-mix(in srgb,var(--color-text) 60%,transparent)}
.tips{background:var(--color-accent-2-100);border-radius:28px;padding:6px 22px 14px;margin-top:28px}.others{margin-top:24px}</style>`,
    mutate: (root) => { const main = root.querySelector('main.doc'); main.set_content(body); } }) };
}

// ---------- main ----------
const BUILD_V = Date.now().toString(36);
const listings = await loadListings();
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
copyTree(ROOT, OUT);

const sitemap = [];
const addUrl = (en, el, lastmod, prio) => sitemap.push({ en, el, lastmod: lastmod || TODAY, prio });

for (const [file, cfg] of Object.entries(PAGES)) {
  const elPath = cfg.enOnly ? null : 'el/' + file;
  const jsonld = cfg.home ? [{ '@context': 'https://schema.org', ...ORG }, { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Find My Pet Cyprus', alternateName: 'Χαμένα Κατοικίδια Κύπρος', url: SITE + '/', inLanguage: ['en', 'el'], publisher: { '@id': SITE + '/#org' } }] : null;
  const enPathPublic = file === 'index.html' ? '' : file;
  const elPathPublic = file === 'index.html' ? 'el/' : elPath;
  write(file, render(file, { lang: 'en', enPath: enPathPublic, elPath: elPathPublic, seo: { title: cfg.en[0], desc: cfg.en[1], noindex: cfg.noindex, jsonld } }));
  if (elPath) write(elPath, render(file, { lang: 'el', enPath: enPathPublic, elPath: elPathPublic, seo: { title: cfg.el[0], desc: cfg.el[1], noindex: cfg.noindex, jsonld } }));
  if (!cfg.noindex) addUrl(enPathPublic, elPath ? elPathPublic : null, null, file === 'index.html' ? '1.0' : '0.8');
}
write('el/search.html', fs.readFileSync(path.join(ROOT, 'search.html'), 'utf8').replace('<html lang="en">', '<html lang="el">'));

// pet pages
for (const p of listings) {
  const enPath = petPath(p), elPath = 'el/' + enPath;
  for (const lang of ['en', 'el']) {
    const s = petSeo(p, lang), url = SITE + '/' + (lang === 'el' ? elPath : enPath);
    write(lang === 'el' ? elPath : enPath, render('listing.html', { lang, enPath, elPath,
      seo: { title: s.title, desc: s.desc, image: p.photos && p.photos[0], type: 'article', jsonld: petJsonLd(p, lang, url) },
      extraHead: `<script>window.LISTING_ID = ${Number(p.id)};</script>`,
      mutate: (root) => { root.querySelector('#back').insertAdjacentHTML('afterend', petSSR(p, lang)); root.querySelector('#back').setAttribute('href', '/' + (lang === 'el' ? 'el/' : '') + listPage(p.status)); } }));
  }
  addUrl(enPath, elPath, String(p.created_at || TODAY).slice(0, 10), '0.7');
}

// district pages
for (const d of DISTRICTS) {
  for (const lang of ['en', 'el']) { const a = areaPage(d, listings, lang); write(a.rel, a.html); }
  addUrl(`area/${d.toLowerCase()}.html`, `el/area/${d.toLowerCase()}.html`, null, '0.8');
}

// sitemap, robots, manifest
const xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'];
for (const u of sitemap) {
  for (const which of u.el ? ['en', 'el'] : ['en']) {
    xml.push('  <url>', `    <loc>${SITE}/${which === 'el' ? u.el : u.en}</loc>`, `    <lastmod>${u.lastmod}</lastmod>`, `    <priority>${u.prio}</priority>`);
    if (u.el) xml.push(`    <xhtml:link rel="alternate" hreflang="en" href="${SITE}/${u.en}"/>`, `    <xhtml:link rel="alternate" hreflang="el" href="${SITE}/${u.el}"/>`, `    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}/${u.en}"/>`);
    xml.push('  </url>');
  }
}
xml.push('</urlset>');
write('sitemap.xml', xml.join('\n'));
write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
write('site.webmanifest', JSON.stringify({ name: 'Find My Pet Cyprus', short_name: 'Find My Pet', description: 'Lost and found pets across Cyprus', start_url: '/', display: 'standalone', background_color: '#ffffff', theme_color: '#c67139',
  icons: [{ src: '/assets/icons/icon-512.png', sizes: '512x512', type: 'image/png' }, { src: '/assets/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }] }, null, 2));

// 404 page: forward old and not-yet-built links
console.log(`Built ${Object.keys(PAGES).length} pages ×2 languages, ${listings.length} pets, ${DISTRICTS.length} districts, ${sitemap.length} sitemap entries.`);
if (missing.size) {
  console.log(`\nUntranslated text (${missing.size}):`);
  [...missing].sort().forEach((s) => console.log('  - ' + JSON.stringify(s)));
  if (process.env.STRICT_I18N) process.exit(1);
}
