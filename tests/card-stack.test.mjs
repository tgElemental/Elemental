import {test} from 'node:test';
import assert from 'node:assert/strict';
import {stackLayers,isArenaDrop} from '../apps/web/src/card-stack.js';
test('visible inventory is rendered as one physical card per owned card',()=>{
  for(const n of [0,1,2,3,5,10,35,75]){
    assert.equal(stackLayers(n).length+Number(n>0),n);
  }
  assert.equal(stackLayers(3).length,2);
});
test('deep decks compress to fit in mobile without hiding owned cards',()=>{
  for(const n of [5,20,100]){
    const layers=stackLayers(n);
    assert.ok(layers.every(l=>l.shift<=40));
  }
});
test('invalid inventory rejected',()=>{
  for(const n of [-1,2.5,NaN,Infinity])assert.throws(()=>stackLayers(n),RangeError);
});
test('throw target requires central arena drop',()=>{
  const rect={left:20,top:20,width:300,height:400};
  assert.equal(isArenaDrop(170,200,rect),true);
  assert.equal(isArenaDrop(25,25,rect),false);
  assert.equal(isArenaDrop(400,200,rect),false);
});

