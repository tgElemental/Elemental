#!/usr/bin/env node
// Validate the *actual* Cloudflare account's D1 database and patch Wrangler's
// public binding ID only in the CI runner checkout (no secret is committed).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const configFile = resolve(here, '../worker/wrangler.jsonc');
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function resolveDatabase(json, expectedName = 'elemental-game') {
  const parsed = typeof json === 'string' ? JSON.parse(json) : json;
  const all = Array.isArray(parsed) ? parsed : parsed?.result ?? parsed?.databases;
  if (!Array.isArray(all)) throw new Error('Unexpected Wrangler D1 list JSON');
  const matches = all.filter(db => db?.name === expectedName);
  if (matches.length !== 1) throw new Error(`Expected exactly one D1 database named ${expectedName}, found ${matches.length}`);
  const uuid = matches[0]?.uuid ?? matches[0]?.id;
  if (typeof uuid !== 'string' || !ID.test(uuid)) throw new Error('Invalid D1 UUID returned by Cloudflare');
  return uuid;
}
export function configureBinding(configText, databaseId, expectedName = 'elemental-game') {
  if (!ID.test(databaseId)) throw new Error('Invalid D1 UUID');
  const cfg = JSON.parse(configText); // current wrangler.jsonc contains pure JSON
  const dbs = cfg.d1_databases;
  if (!Array.isArray(dbs) || dbs.length !== 1 || dbs[0]?.database_name !== expectedName || dbs[0]?.binding !== 'DB') {
    throw new Error('Unexpected D1 bindings; refusing to migrate an unrecognized database');
  }
  const current = dbs[0].database_id;
  if (current !== 'REPLACE_WITH_D1_DATABASE_ID' && current !== databaseId) {
    throw new Error('Committed database_id does not match the Cloudflare account');
  }
  dbs[0].database_id = databaseId;
  return JSON.stringify(cfg, null, 2) + '\n';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const listPath = process.argv[2];
  if (!listPath) { console.error('Usage: node scripts/resolve-d1.mjs path/to/d1-list.json'); process.exitCode = 2; }
  else {
    try {
      const uuid = resolveDatabase(readFileSync(listPath, 'utf8'));
      const patched = configureBinding(readFileSync(configFile, 'utf8'), uuid);
      writeFileSync(configFile, patched);
      // The D1 UUID is not a secret but avoid duplicating infrastructure metadata in logs.
      console.log('Cloudflare D1 binding validated and configured for this run.');
    } catch (e) { console.error(`Cloudflare D1 preflight failed: ${e.message}`); process.exitCode = 1; }
  }
}
