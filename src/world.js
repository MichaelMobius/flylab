// FlyLab v0.2 — lightweight browser physics helpers.
// Fruit collision volumes are conservative ellipsoids matched to the procedural meshes.

export const FRUIT_COLLIDERS = {
  apple:      { rx: 0.44, ry: 0.42, rz: 0.44, cy: 0.34 },
  orange:     { rx: 0.40, ry: 0.38, rz: 0.40, cy: 0.31 },
  banana:     { rx: 0.56, ry: 0.28, rz: 0.42, cy: 0.24 },
  grape:      { rx: 0.40, ry: 0.38, rz: 0.37, cy: 0.29 },
  strawberry: { rx: 0.35, ry: 0.39, rz: 0.35, cy: 0.30 },
};

export function colliderForFruit(fruit, margin = 0) {
  const c = FRUIT_COLLIDERS[fruit.type] || FRUIT_COLLIDERS.apple;
  const amount = fruit.amount == null ? 1 : Math.max(0, Math.min(1, fruit.amount));
  const scale = 0.20 + 0.80 * Math.sqrt(amount); // fruits visibly shrink and finally disappear
  return {
    x: fruit.x,
    y: c.cy * scale,
    z: fruit.z,
    rx: c.rx * scale + margin,
    ry: c.ry * scale + margin,
    rz: c.rz * scale + margin,
    top: (c.cy + c.ry) * scale + margin,
  };
}

export function ellipsoidQ(p, c) {
  const dx = (p.x - c.x) / c.rx;
  const dy = (p.y - c.y) / c.ry;
  const dz = (p.z - c.z) / c.rz;
  return dx * dx + dy * dy + dz * dz;
}

export function pointInsideFruit(p, fruit, margin = 0) {
  return ellipsoidQ(p, colliderForFruit(fruit, margin)) < 1;
}

// Resolve a point outside a fruit volume. Ground motion is pushed horizontally;
// airborne motion follows the ellipsoid normal. Returns collision metadata.
export function resolveFruitCollision(prev, next, fruit, { margin = 0.12, groundMode = false } = {}) {
  const c = colliderForFruit(fruit, margin);
  const q = ellipsoidQ(next, c);
  if (q >= 1) return { point: { ...next }, collided: false, normal: { x: 0, y: 0, z: 0 } };

  if (groundMode) {
    let dx = next.x - c.x;
    let dz = next.z - c.z;
    if (Math.hypot(dx, dz) < 1e-7) {
      dx = prev.x - c.x || 1;
      dz = prev.z - c.z;
    }
    const a = Math.atan2(dz / c.rz, dx / c.rx);
    const x = c.x + Math.cos(a) * c.rx * 1.002;
    const z = c.z + Math.sin(a) * c.rz * 1.002;
    const n = normalise({ x: (x - c.x) / (c.rx * c.rx), y: 0, z: (z - c.z) / (c.rz * c.rz) });
    return { point: { x, y: next.y, z }, collided: true, normal: n };
  }

  // Gradient of the ellipsoid gives a physically reasonable separating normal.
  let dx = next.x - c.x, dy = next.y - c.y, dz = next.z - c.z;
  if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) < 1e-8) {
    dx = prev.x - c.x || 1; dy = prev.y - c.y; dz = prev.z - c.z;
  }
  const scale = 1 / Math.sqrt((dx * dx) / (c.rx * c.rx) + (dy * dy) / (c.ry * c.ry) + (dz * dz) / (c.rz * c.rz));
  const x = c.x + dx * scale * 1.002;
  const y = c.y + dy * scale * 1.002;
  const z = c.z + dz * scale * 1.002;
  const n = normalise({ x: (x - c.x) / (c.rx * c.rx), y: (y - c.y) / (c.ry * c.ry), z: (z - c.z) / (c.rz * c.rz) });
  return { point: { x, y, z }, collided: true, normal: n };
}

export function fruitSurfaceDistance(p, fruit, margin = 0) {
  const c = colliderForFruit(fruit, margin);
  const q = Math.sqrt(Math.max(1e-12, ellipsoidQ(p, c)));
  // Approximate Euclidean distance from scaled-radius excess.
  const r = Math.min(c.rx, c.ry, c.rz);
  return Math.max(0, (q - 1) * r);
}

// Resolve the whole contact manifold. The previous valid pose is a safe fallback
// for an impossible placement; the editor separately prevents overlapping fruit.
export function resolveFruitCollisions(prev,next,fruits,options={}) {
  let point={...next}, collided=false, contact=null, normal={x:0,y:0,z:0};
  for(let pass=0;pass<24;pass++){
    let changed=false;
    for(const fruit of fruits){
      const result=resolveFruitCollision(prev,point,fruit,options);
      if(result.collided){point=result.point;normal=result.normal;contact=fruit;collided=changed=true;}
    }
    if(!changed)return {point,collided,contact,normal,blocked:false};
  }
  if(fruits.every(f=>!pointInsideFruit(prev,f,options.margin??.12)))point={...prev};
  return {point,collided,contact,normal,blocked:fruits.some(f=>pointInsideFruit(point,f,options.margin??.12))};
}

export function placementAllowed(candidate,fruits,half=6,margin=.16){
  // Check full-size fruit, so replenishing a partly eaten fruit stays safe.
  const c=colliderForFruit({...candidate,amount:1},margin+.03);
  if(Math.abs(c.x)+c.rx>half-.22||Math.abs(c.z)+c.rz>half-.22)return false;
  return fruits.filter(f=>f!==candidate&&f.id!==candidate.id).every(f=>{
    const other=colliderForFruit({...f,amount:1},margin+.03);
    return Math.hypot((c.x-other.x)/(c.rx+other.rx),(c.z-other.z)/(c.rz+other.rz))>=1;
  });
}

function normalise(v) {
  const m = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / m, y: v.y / m, z: v.z / m };
}
