import test from 'node:test';
import assert from 'node:assert/strict';
import { MushroomBodyProxy, mixOdors, FRUIT_LIBRARY } from '../src/brain.js';

test('odor concentration falls with distance', () => {
  const fruit = { type:'banana', x:0, z:0, strength:1, sigma:2 };
  const near = mixOdors([fruit],0.2,0).total;
  const far = mixOdors([fruit],5,0).total;
  assert.ok(near > far);
});

test('bilateral gradient produces opposite steering signs', () => {
  const b1 = new MushroomBodyProxy({seed:1});
  const b2 = new MushroomBodyProxy({seed:1});
  const odor = FRUIT_LIBRARY.banana.odor;
  const left = b1.step({leftMixture:odor,rightMixture:{},exploration:0}).turn;
  const right = b2.step({leftMixture:{},rightMixture:odor,exploration:0}).turn;
  assert.ok(left > 0);
  assert.ok(right < 0);
});

test('positive reward changes mushroom-body memory', () => {
  const brain = new MushroomBodyProxy({seed:7});
  const odor = FRUIT_LIBRARY.banana.odor;
  const before = brain.value(brain.receptorVector(odor)).learned;
  for(let i=0;i<8;i++) brain.learn(odor,1);
  const after = brain.value(brain.receptorVector(odor)).learned;
  assert.ok(after > before + 0.05);
});

test('clearing memory restores zero learned value', () => {
  const brain = new MushroomBodyProxy();
  brain.learn(FRUIT_LIBRARY.apple.odor,1);
  brain.clearMemory();
  assert.equal(brain.memoryMagnitude(),0);
});
