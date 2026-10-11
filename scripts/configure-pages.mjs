#!/usr/bin/env node
// Inject only a public HTTPS Worker URL into the static artifact. Never put
// a BOT_TOKEN, tgcloud token or Cloudflare API token in frontend files.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const configFile = resolve(here, '../apps/web/config.js');

export function validateApiBase(input) {
  if (typeof input !== 'string' || !input.trim()) throw new Error('Missing ELEMENTAL_API_BASE GitHub variable');
  const value = input.trim();
  let url;
  try { url = new URL(value); } catch { throw new Error('ELEMENTAL_API_BASE must be an HTTPS origin'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/' || url.port) {
    throw new Error('ELEMENTAL_API_BASE must be an HTTPS origin without path, credentials, query, port or fragment');
  }
  if (url.hostname.toUpperCase().includes('YOUR_SUBDOMAIN') || url.hostname === 'localhost' || !url.hostname.includes('.')) {
    throw new Error('ELEMENTAL_API_BASE still points to a placeholder or local address');
  }
  return url.origin;
}
export function configurePublicApi(text, base) {
  const validated = validateApiBase(base);
  const pattern = /(\bapiBase\s*:\s*)(['"])(.*?)\2/g;
  const matches = [...text.matchAll(pattern)];
  if (matches.length !== 1) throw new Error('Expected exactly one apiBase in apps/web/config.js');
  return text.replace(pattern, `$1${JSON.stringify(validated)}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const original = readFileSync(configFile, 'utf8');
    const current = original.match(/\bapiBase\s*:\s*['\"]([^'\"]+)['\"]/);
    const base = process.env.ELEMENTAL_API_BASE || current?.[1];
    writeFileSync(configFile, configurePublicApi(original, base));
    console.log('GitHub Pages uses a validated public Worker origin.');
  } catch (e) { console.error(`Pages preflight failed: ${e.message}`); process.exitCode = 1; }
}
