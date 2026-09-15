import test from 'node:test';
import assert from 'node:assert/strict';
import { colliderForFruit, ellipsoidQ, pointInsideFruit, resolveFruitCollision } from '../src/world.js';
import { mixOdors } from '../src/brain.js';

const apple = { type:'apple', x:0, z:0, strength:1, sigma:2, odorY:.28 };

test('odor concentration also falls with vertical distance', () => {
  const near = mixOdors([apple], 0, 0, .3).total;
  const high = mixOdors([apple], 0, 0, 4).total;
  assert.ok(near > high * 4);
});

test('ground collision pushes fly outside fruit volume', () => {
  const prev = {x:-.7,y:.2,z:0};
  const next = {x:0,y:.2,z:0};
  const hit = resolveFruitCollision(prev,next,apple,{margin:.16,groundMode:true});
  assert.equal(hit.collided,true);
  assert.equal(pointInsideFruit(hit.point,apple,.159),false);
});

test('airborne collision resolves along 3D fruit volume', () => {
  const c = colliderForFruit(apple,.16);
  const prev = {x:0,y:1,z:0};
  const next = {x:0,y:c.y,z:0};
  const hit = resolveFruitCollision(prev,next,apple,{margin:.16,groundMode:false});
  assert.equal(hit.collided,true);
  assert.ok(ellipsoidQ(hit.point,c) >= .999);
});

test('fly can physically clear fruit only when above its volume', () => {
  const c = colliderForFruit(apple,.16);
  assert.equal(pointInsideFruit({x:0,y:c.top+.05,z:0},apple,.16),false);
  assert.equal(pointInsideFruit({x:0,y:c.y,z:0},apple,.16),true);
});

test('partially eaten fruit has a smaller conservative collider', () => {
  const full = colliderForFruit({...apple,amount:1},0);
  const eaten = colliderForFruit({...apple,amount:.1},0);
  assert.ok(eaten.rx < full.rx);
  assert.ok(eaten.ry < full.ry);
});
