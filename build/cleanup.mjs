// Daily privacy clean-up (runs from the GitHub job when SUPABASE_SERVICE_ROLE_KEY is set):
//  - deletes closed/rejected listings older than 12 months and empty guest accounts (database function)
//  - deletes photo files that no longer belong to any listing
import fs from 'fs';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) { console.log('No service key, skipping clean-up.'); process.exit(0); }
const now = new Date();
if (process.env.GITHUB_EVENT_NAME === 'schedule' && !(now.getUTCHours() === 2 && now.getUTCMinutes() < 30)) { console.log('Clean-up runs once a day at 02:00 UTC.'); process.exit(0); }
const url = (fs.readFileSync(new URL('../config.js', import.meta.url), 'utf8').match(/supabaseUrl:\s*'([^']+)'/) || [])[1];
const h = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
const rpc = async (fn) => { const r = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: 'POST', headers: h, body: '{}' }); if (!r.ok) throw new Error(fn + ': ' + r.status + ' ' + await r.text()); return r.json(); };
console.log('Retention:', JSON.stringify(await rpc('cleanup_old_data')));
try { console.log('Old place suggestions deleted:', await rpc('cleanup_old_suggestions')); } catch (e) { console.log('Place suggestions clean-up skipped (' + e.message.slice(0, 80) + ')'); }
const orphans = await rpc('orphan_photo_paths');
if (orphans.length) {
  const r = await fetch(`${url}/storage/v1/object/listing-photos`, { method: 'DELETE', headers: h, body: JSON.stringify({ prefixes: orphans }) });
  console.log(`Deleted ${orphans.length} unused photo(s):`, r.status);
} else console.log('No unused photos.');
