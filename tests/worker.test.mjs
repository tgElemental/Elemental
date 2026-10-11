import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/src/index.js';
test('health is accessible without authentication or DB',async()=>{
  const response=await worker.fetch(new Request('https://elemental-api.example/health'),{});
  assert.equal(response.status,200);assert.equal((await response.json()).ok,true);
});
test('writes fail closed without configuration',async()=>{
  const response=await worker.fetch(new Request('https://elemental-api.example/api/play',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}),{});
  assert.equal(response.status,503);
});
test('browser origins not on allowlist are rejected',async()=>{
  const response=await worker.fetch(new Request('https://elemental-api.example/api/leaderboard',{headers:{Origin:'https://evil.example'}}),{ALLOWED_ORIGIN:'https://tgelemental.github.io'});
  assert.equal(response.status,403);
});
