// Netlify build step: copies public/index.html into dist/ and writes config.js
// from this site's environment variables. No keys are stored in Git.
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'dist');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const url = String(process.env.SUPABASE_URL || '').trim();
const key = String(process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
const missing = [];
if (!url) missing.push('SUPABASE_URL');
if (!key) missing.push('SUPABASE_PUBLISHABLE_KEY');
if (missing.length) {
  console.error(`Missing required Netlify environment variables: ${missing.join(', ')}`);
  process.exit(1);
}
fs.copyFileSync(path.join(root, 'public', 'index.html'), path.join(outDir, 'index.html'));
fs.writeFileSync(path.join(outDir, 'config.js'),
  `window.GILYON_CONFIG = Object.freeze(${JSON.stringify({ supabaseUrl: url, supabasePublishableKey: key }, null, 2)});\n`, 'utf8');
fs.writeFileSync(path.join(outDir, '_headers'),
  `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: SAMEORIGIN\n\n/config.js\n  Cache-Control: no-store, max-age=0\n`, 'utf8');
console.log('Built Gilyon Haarachah');
