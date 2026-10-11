import test from 'node:test';
import assert from 'node:assert/strict';
import {ELEMENTS, BEATS, resolveRound, worldForDay, weekForDay} from '../apps/web/engine.js';
const calm={key:'eclipse',element:null};
test('the four forces each win once, draw once, lose twice',()=>{
  for(const pick of ELEMENTS){
    assert.equal(resolveRound(pick,pick,calm).outcome,'draw');
    assert.equal(resolveRound(pick,BEATS[pick],calm).outcome,'win');
    assert.equal(resolveRound(pick,BEATS[pick],calm).basePoints,3);
  }
});
test('synthesis is symmetric even on a loss',()=>{
  assert.equal(resolveRound('earth','water',calm).tree,1);
  assert.equal(resolveRound('water','earth',calm).tree,1);
  assert.equal(resolveRound('wind','fire',calm).light,1);
  assert.equal(resolveRound('fire','wind',calm).light,1);
});
test('matching weather adds one point only to a winning move',()=>{
  const w={key:'spring',element:'water'};
  assert.equal(resolveRound('water','fire',w).basePoints,4);
  assert.equal(resolveRound('water','water',w).basePoints,1);
  assert.equal(resolveRound('fire','earth',w).basePoints,3);
});
test('daily weather is stable and rotates',()=>{
  assert.deepEqual(worldForDay('2026-10-11'),worldForDay('2026-10-11'));
  assert.notEqual(worldForDay('2026-10-11').key,worldForDay('2026-10-12').key);
});
test('season starts Monday UTC',()=>{
  assert.equal(weekForDay('2026-10-11'),'2026-10-05');
  assert.equal(weekForDay('2026-10-12'),'2026-10-12');
});
test('bad inputs rejected',()=>{
  assert.throws(()=>resolveRound('light','fire',calm));
  assert.throws(()=>worldForDay('abc'));
});
