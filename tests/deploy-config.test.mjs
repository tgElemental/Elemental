import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDatabase, configureBinding } from '../scripts/resolve-d1.mjs';
import { validateApiBase, configurePublicApi } from '../scripts/configure-pages.mjs';
const uuid = '123e4567-e89b-42d3-a456-426614174000';
const base = { name:'elemental-api', d1_databases:[{binding:'DB', database_name:'elemental-game', database_id:'REPLACE_WITH_D1_DATABASE_ID'}]};

test('Finds exact D1 by name and validates uuid', () => {
  assert.equal(resolveDatabase(JSON.stringify([{name:'other',uuid:'bad'}, {name:'elemental-game',uuid}])), uuid);
  assert.throws(() => resolveDatabase(JSON.stringify([{name:'elemental-game',uuid},{name:'elemental-game',uuid}])));
  assert.throws(() => resolveDatabase('[]'));
  assert.throws(() => resolveDatabase(JSON.stringify([{name:'elemental-game',uuid:'bad'}])));
});
test('Fails closed when committed D1 binding points to a different DB', () => {
  assert.equal(JSON.parse(configureBinding(JSON.stringify(base),uuid)).d1_databases[0].database_id,uuid);
  assert.throws(() => configureBinding(JSON.stringify({...base,d1_databases:[{...base.d1_databases[0], database_id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'}]}),uuid));
});
test('Requires a clean, HTTPS public Worker origin', () => {
  assert.equal(validateApiBase('https://example.workers.dev/'),'https://example.workers.dev');
  for(const url of ['', 'https://elemental-api.YOUR_SUBDOMAIN.workers.dev','http://example.workers.dev','https://example.workers.dev/p', 'https://u:p@example.workers.dev','https://localhost']) assert.throws(()=>validateApiBase(url),url);
});
test('Injects API base without altering other web configuration', () => {
  const initial=`window.ELEMENTAL_CONFIG = { apiBase: 'https://placeholder.invalid', botUsername: 'elementalgamebot' };`;
  const updated=configurePublicApi(initial,'https://elemental-api.example.workers.dev/');
  assert.match(updated,/apiBase: "https:\/\/elemental-api\.example\.workers\.dev"/);
  assert.match(updated,/botUsername: 'elementalgamebot'/);
  assert.throws(()=>configurePublicApi('window.ELEMENTAL_CONFIG = {};','https://example.workers.dev'));
});
