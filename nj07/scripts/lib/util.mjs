import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const OUT = join(ROOT, 'public', 'data');
export const CACHE = join(ROOT, 'scripts', '.cache');

export function log(scope, msg) {
  process.stdout.write(`\x1b[2m[${scope}]\x1b[0m ${msg}\n`);
}

export async function writeJSON(relPath, value, { pretty = false } = {}) {
  const path = join(OUT, relPath);
  await mkdir(dirname(path), { recursive: true });
  const body = pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value);
  await writeFile(path, body);
  log('write', `${relPath} — ${(Buffer.byteLength(body) / 1024).toFixed(0)} KB`);
  return path;
}

/** Fetch a URL to the on-disk cache, then return its text. Re-runs are offline. */
export async function fetchCached(url, cacheName, { force = false } = {}) {
  await mkdir(CACHE, { recursive: true });
  const path = join(CACHE, cacheName);
  if (!force) {
    try {
      await stat(path);
      log('cache', `hit ${cacheName}`);
      return await readFile(path, 'utf8');
    } catch {
      /* miss */
    }
  }
  log('fetch', url);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  const text = await res.text();
  await writeFile(path, text);
  return text;
}

/** RFC 4180-ish CSV parser: handles quoted fields, embedded commas and newlines. */
export function parseCSV(text, delimiter = ',') {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else if (c !== '\r') field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function csvToObjects(text, delimiter = ',') {
  const rows = parseCSV(text, delimiter).filter((r) => r.length > 1);
  const header = rows.shift().map((h) => h.trim());
  return rows.map((r) => {
    const o = {};
    header.forEach((h, i) => (o[h] = (r[i] ?? '').trim()));
    return o;
  });
}

export const num = (v) => {
  if (v === undefined || v === null) return null;
  const s = String(v).replace(/[$,%\s]/g, '');
  if (s === '' || s === 'NA' || s === 'N/A' || s === 'null' || s === '-') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

export const round = (v, p = 0) => (v === null || v === undefined ? null : Number(v.toFixed(p)));
