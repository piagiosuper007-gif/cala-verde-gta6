// Vehicles for CALA VERDE. One job: arcade car physics, entering/exiting cars,
// traffic that follows the street grid, and pedestrians on the sidewalks.

import * as THREE from 'three';
import { CITY, DRIVING, GARAGE_CARS, PALETTE } from './config.js';
import { makeRng } from './random.js';
import { makeCarMesh, collideBuildings } from './world.js';

export function makeVehicle(opts) {
  const v = {
    kind: opts.kind || 'traffic', // traffic | parked | player | police | mission
    id: opts.id || ('car-' + Math.random().toString(36).slice(2, 8)),
    color: opts.color ?? 0xc23b2e,
    pos: { x: opts.x ?? 0, y: 0, z: opts.z ?? 0 },
    angle: opts.angle ?? 0,
    speed: 0,
    topSpeed: opts.topSpeed ?? DRIVING.maxSpeed,
    accel: opts.accel ?? DRIVING.accel,
    mesh: null,
    route: null, // {axis:'x'|'z', dir:1|-1, lane:0} for traffic
    targetSpeed: 0,
    siren: false,
    stolen: false,
    name: opts.name || 'Sedan',
  };
  return v;
}

export function buildVehicleMesh(scene, v) {
  const mesh = makeCarMesh(v.color);
  mesh.position.set(v.pos.x, 0, v.pos.z);
  mesh.rotation.y = v.angle;
  scene.add(mesh);
  v.mesh = mesh;
  if (v.kind === 'police') {
    // light bar: two small emissive boxes on the roof
    const barMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
    const barMat2 = new THREE.MeshBasicMaterial({ color: 0x2244ff });
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3), barMat);
    b1.position.set(-0.4, 1.5, -0.2);
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3), barMat2);
    b2.position.set(0.4, 1.5, -0.2);
    mesh.add(b1, b2);
    v.lightBar = [b1, b2];
  }
  return mesh;
}

export function spawnTraffic(scene, G, count = 10) {
  const rng = makeRng(CITY.seed + 77);
  const pitch = CITY.pitch;
  for (let i = 0; i < count; i++) {
    const axis = rng.chance(0.5) ? 'x' : 'z';
    // traffic runs on the road corridors between blocks (52k+26), never through buildings
    const line = rng.int(-4, 4) * pitch + pitch / 2;
    const along = rng.range(-220, 220);
    const dir = rng.chance(0.5) ? 1 : -1;
    const v = makeVehicle({
      kind: 'traffic',
      color: rng.pick(PALETTE.carColors),
      x: axis === 'x' ? along : line + (dir > 0 ? 3.5 : -3.5),
      z: axis === 'z' ? along : line + (dir > 0 ? 3.5 : -3.5),
      angle: axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
      topSpeed: rng.range(12, 18),
    });
    v.route = { axis, dir, line };
    v.targetSpeed = v.topSpeed;
    buildVehicleMesh(scene, v);
    G.cars.push(v);
  }
}

export function spawnParkedCars(scene, G, count = 8) {
  const rng = makeRng(CITY.seed + 31);
  const pitch = CITY.pitch;
  for (let i = 0; i < count; i++) {
    // parked along the road corridors (52k+26), facing along the road
    const line = rng.int(-4, 3) * pitch + pitch / 2;
    const along = rng.range(-200, 200);
    const side = rng.chance(0.5) ? 1 : -1;
    const v = makeVehicle({
      kind: 'parked',
      color: rng.pick(PALETTE.carColors),
      x: line + side * 9,
      z: along,
      angle: side > 0 ? 0 : Math.PI,
      topSpeed: 40,
    });
    buildVehicleMesh(scene, v);
    G.cars.push(v);
  }
  // the player's starter car, parked on the beachfront road corridor by the marina
  const owned = GARAGE_CARS.find((c) => c.id === G.activeCarId) || GARAGE_CARS[0];
  const starter = makeVehicle({
    kind: 'player', id: 'player-car', color: owned.color, name: owned.name,
    x: 182, z: 176, angle: Math.PI, topSpeed: owned.topSpeed, accel: owned.accel,
  });
  buildVehicleMesh(scene, starter);
  G.cars.push(starter);
  G.playerCar = starter;
}

export function spawnPedestrians(scene, G, count = 16) {
  const rng = makeRng(CITY.seed + 55);
  const mat = new THREE.MeshLambertMaterial({ color: 0xdddddd });
  const geo = new THREE.CylinderGeometry(0.35, 0.42, 1.7, 8);
  const headGeo = new THREE.SphereGeometry(0.28, 8, 6);
  const shirtColors = [0xe85d3d, 0x3d7ae8, 0x54b95e, 0xe8c53d, 0x9b59b6, 0xecf0f1];
  for (let i = 0; i < count; i++) {
    const shirt = new THREE.MeshLambertMaterial({ color: rng.pick(shirtColors) });
    const g = new THREE.Group();
    const body = new THREE.Mesh(geo, shirt);
    body.position.y = 0.85;
    const head = new THREE.Mesh(headGeo, mat);
    head.position.y = 1.95;
    g.add(body, head);
    const x = rng.range(-220, 220);
    const z = rng.range(-220, 200);
    g.position.set(x, 0, z);
    scene.add(g);
    G.peds.push({
      mesh: g, x, z, angle: rng.range(0, Math.PI * 2),
      speed: rng.range(1.2, 2.4), tx: x, tz: z, wait: rng.range(0, 4),
    });
  }
}

export function updatePedestrians(G, dt) {
  for (const p of G.peds) {
    if (p.wait > 0) { p.wait -= dt; continue; }
    const dx = p.tx - p.x;
    const dz = p.tz - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 1) {
      p.tx = p.x + (Math.random() - 0.5) * 120;
      p.tz = p.z + (Math.random() - 0.5) * 120;
      p.tx = Math.max(-225, Math.min(225, p.tx));
      p.tz = Math.max(-225, Math.min(205, p.tz));
      p.wait = Math.random() * 3;
      continue;
    }
    p.angle = Math.atan2(dx, dz);
    p.x += (dx / d) * p.speed * dt;
    p.z += (dz / d) * p.speed * dt;
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.angle;
    // simple walk bob
    p.mesh.position.y = Math.abs(Math.sin(G.time * 6 + p.x)) * 0.06;
  }
}

export function updateTraffic(G, dt) {
  for (const v of G.cars) {
    if (v.kind !== 'traffic') continue;
    // cruise along its street; slow near the player to avoid pile-ups
    let target = v.targetSpeed;
    const dp = Math.hypot(G.player.pos.x - v.pos.x, G.player.pos.z - v.pos.z);
    if (dp < 14) target = Math.min(target, 4);
    v.speed += (target - v.speed) * Math.min(1, dt * 1.5);
    const step = v.speed * dt * v.route.dir;
    if (v.route.axis === 'x') {
      v.pos.x += step;
      if (v.pos.x > 232) v.pos.x = -232;
      if (v.pos.x < -232) v.pos.x = 232;
    } else {
      v.pos.z += step;
      if (v.pos.z > 205) v.pos.z = -232;
      if (v.pos.z < -232) v.pos.z = 205;
    }
    v.mesh.position.set(v.pos.x, 0, v.pos.z);
    v.mesh.rotation.y = v.angle;
  }
}

// Arcade driving: accelerate / brake / steer with speed-scaled steering.
export function driveCar(G, v, input, dt) {
  const axis = input.axis();
  const handbrake = input.isDown(' ');
  const surge = G.surgeUntil && G.time < G.surgeUntil ? 1.3 : 1;
  const top = v.topSpeed * (G.crewActive === 'rico' ? 1.15 : 1) * surge;
  if (axis.f > 0) v.speed += v.accel * dt * (v.speed < 0 ? 2.2 : 1);
  else if (axis.f < 0) {
    if (v.speed > 0.5) v.speed -= DRIVING.brake * dt;
    else v.speed -= DRIVING.reverseAccel * dt;
  } else {
    v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 9 * dt);
  }
  if (handbrake) v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 26 * dt);
  v.speed = Math.max(-DRIVING.maxReverse, Math.min(top, v.speed));
  const steerAmount = axis.r * DRIVING.steer * dt * Math.min(1, Math.abs(v.speed) / 9) * Math.sign(v.speed || 1);
  v.angle += steerAmount * (handbrake ? 1.6 : 1);
  v.pos.x += Math.sin(v.angle) * v.speed * dt;
  v.pos.z += Math.cos(v.angle) * v.speed * dt;
  collideBuildings(G, v.pos, 1.6);
  v.mesh.position.set(v.pos.x, 0, v.pos.z);
  v.mesh.rotation.y = v.angle;
  // body lean into corners, tiny but readable
  v.mesh.rotation.z = -axis.r * Math.min(0.06, Math.abs(v.speed) * 0.002);
  G.player.speed = v.speed;
  G.player.pos.x = v.pos.x;
  G.player.pos.z = v.pos.z;
  G.player.angle = v.angle;
}

export function nearestCar(G, maxDist = 5) {
  let best = null;
  let bestD = maxDist;
  for (const v of G.cars) {
    if (v === G.player.car) continue;
    const d = Math.hypot(v.pos.x - G.player.pos.x, v.pos.z - G.player.pos.z);
    if (d < bestD) { bestD = d; best = v; }
  }
  return best;
}

export function enterCar(G, v) {
  G.player.car = v;
  G.player.onFoot = false;
  v.kind = v.kind === 'parked' || v.kind === 'traffic' ? 'player' : v.kind;
  if (v.kind === 'player' && v.id !== 'player-car') {
    // stealing a car is a crime — unless it is the mission target or our own
    if (!v.stolen && v.id !== 'player-car') {
      v.stolen = true;
      if (G.mission?.def.type !== 'steal' || v.id !== 'mission-target') {
        setWanted(G, Math.max(G.wanted, 1));
      }
    }
  }
  G.player.pos.x = v.pos.x;
  G.player.pos.z = v.pos.z;
}

export function exitCar(G) {
  const v = G.player.car;
  if (!v) return;
  v.speed = 0;
  G.player.car = null;
  G.player.onFoot = true;
  G.player.speed = 0;
  // step out to the side
  G.player.pos.x = v.pos.x + Math.cos(v.angle) * 2.4;
  G.player.pos.z = v.pos.z - Math.sin(v.angle) * 2.4;
}

export function setWanted(G, stars) {
  G.wanted = Math.max(0, Math.min(5, Math.round(stars)));
}
