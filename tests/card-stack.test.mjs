import test from 'node:test';
import assert from 'node:assert/strict';
import {stackBackCount,stackSpacing} from '../apps/web/src/card-stack.js';
test('physical stack has precisely one visible card per item',()=>{
  for (const count of [0,1,2,3,4,5,8,20,100])
    assert.equal(stackBackCount(count)+(count>0?1:0),count);
  assert.equal(stackBackCount(3),2);
  assert.equal(stackBackCount(0),0);
});
test('large piles compress their spacing but are not truncated',()=>{
  assert.ok(stackSpacing(1)>stackSpacing(50));
  assert.equal(stackBackCount(100),99);
});
