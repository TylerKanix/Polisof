/**
 * Build a single self-contained HTML file.
 *
 *   npm run standalone
 *
 * Script, styles, fonts and every dataset are inlined, so the result opens
 * from a file:// URL, an email attachment, or a page with a strict CSP that
 * blocks every external host. There are no portraits to carry — this build has
 * no licensed photograph of either candidate, and says so rather than
 * hotlinking one.
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { ROOT, OUT, log } from './lib/util.mjs';

const DIST = join(ROOT, 'dist');

/** Every dataset the app can ask for, keyed exactly as loadJSON() asks for it. */
async function collectData() {
  const bag = {};
  const walk = async (dir, prefix = '') => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await walk(full, rel);
      else if (extname(entry.name) === '.json') bag[rel] = JSON.parse(await readFile(full, 'utf8'));
    }
  };
  await walk(OUT);
  return bag;
}

/** Replace the CSS url(...) references to bundled fonts with data URIs. */
async function inlineFonts(css) {
  const assets = join(DIST, 'assets');
  let out = css;
  for (const match of [...css.matchAll(/url\(([^)]*?\.woff2?)\)/g)]) {
    const ref = match[1].replace(/["']/g, '');
    const file = ref.split('/').pop();
    try {
      const buf = await readFile(join(assets, file));
      const mime = ref.endsWith('.woff2') ? 'font/woff2' : 'font/woff';
      out = out.replaceAll(match[0], `url(data:${mime};base64,${buf.toString('base64')})`);
    } catch {
      log('standalone', `WARN font not found: ${file}`);
    }
  }
  return out;
}

const mb = (s) => `${(Buffer.byteLength(s) / 1048576).toFixed(2)} MB`;

export async function run() {
  const files = await readdir(join(DIST, 'assets'));
  const jsName = files.find((f) => f.endsWith('.js'));
  const cssName = files.find((f) => f.endsWith('.css'));
  if (!jsName || !cssName) throw new Error('No build in dist/ — run `npm run build` first');

  const js = await readFile(join(DIST, 'assets', jsName), 'utf8');
  const css = await inlineFonts(await readFile(join(DIST, 'assets', cssName), 'utf8'));
  const data = await collectData();
  log('standalone', `${Object.keys(data).length} datasets inlined`);

  // </script> inside embedded JSON would close the tag early.
  const safeJSON = (v) => JSON.stringify(v).replaceAll('<', '\\u003c');

  // Charset first, and within the first 1024 bytes: without it a file:// open
  // falls back to windows-1252 and every en dash and middot breaks.
  const html = `<meta charset="utf-8" />
<title>Polisof · NJ-07</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="dark" />
<style>${css}</style>
<div id="root"></div>
<script>
window.__POLISOF_DATA__ = ${safeJSON(data)};
</script>
<script type="module">${js}</script>
`;

  const dest = join(DIST, 'polisof-nj07.html');
  await writeFile(dest, html);
  log('standalone', `${dest} — ${mb(html)}`);
  return { bytes: Buffer.byteLength(html), path: dest };
}

if (import.meta.url === `file://${process.argv[1]}`) await run();
