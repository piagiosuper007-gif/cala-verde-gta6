// Procedural Cala Verde. One job: build the whole city from a seed — streets,
// buildings with lit windows, palms, lamps, the beach and the sea — cheap enough
// for SwiftShader to render in seconds.

import * as THREE from 'three';
import { CITY, PALETTE } from './config.js';
import { makeRng } from './random.js';

// Canvas facade texture: coloured wall + window grid, some windows lit gold.
function facadeTexture(baseColor, litRatio, rng) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = baseColor;
  g.fillRect(0, 0, 128, 256);
  // subtle vertical shading
  const grad = g.createLinearGradient(0, 0, 128, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0.18)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.06)');
  grad.addColorStop(1, 'rgba(0,0,0,0.22)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 256);
  for (let y = 12; y < 244; y += 22) {
    for (let x = 10; x < 118; x += 20) {
      const lit = rng.next() < litRatio;
      g.fillStyle = lit ? '#ffd27a' : 'rgba(20,28,44,0.85)';
      g.fillRect(x, y, 12, 14);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function hexCss(n) {
  return '#' + n.toString(16).padStart(6, '0');
}

// A low box car body used for parked cars and traffic (vehicles.js reuses it).
export function makeCarMesh(color, rng) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1a2433 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), paint);
  body.position.y = 0.55;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), glass);
  cabin.position.set(0, 1.1, -0.2);
  group.add(body, cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.36, z);
    group.add(w);
  }
  group.userData.paint = paint;
  return group;
}

export function buildWorld(scene, G) {
  const rng = makeRng(CITY.seed);
  const world = { colliders: [], spawnPoints: {}, textures: [] };

  // --- sky, sun, fog (golden hour) ---
  scene.background = new THREE.Color(PALETTE.skyHorizon);
  scene.fog = new THREE.Fog(0xe8a06a, 180, 620);
  const hemi = new THREE.HemisphereLight(0xffd9a8, 0x4a5a70, 1.35);
  const sun = new THREE.DirectionalLight(PALETTE.sun, 2.6);
  sun.position.set(-140, 90, 260); // low sun from the south-west, long shadows feel
  sun.castShadow = false; // shadows off: SwiftShader budget
  scene.add(hemi, sun);
  scene.add(new THREE.AmbientLight(0xffd9a8, 0.3));
  // sun disc + glow sprite on the horizon
  const sunSprite = new THREE.Mesh(
    new THREE.CircleGeometry(26, 24),
    new THREE.MeshBasicMaterial({ color: 0xffe9b0, fog: false }),
  );
  sunSprite.position.set(-120, 42, -420);
  sunSprite.lookAt(0, 42, 200);
  scene.add(sunSprite);

  // --- ground: asphalt base, sidewalks, beach, sea ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.halfSize * 2 + 80, CITY.halfSize * 2 + 140),
    new THREE.MeshLambertMaterial({ color: PALETTE.asphalt }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 40);
  scene.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.halfSize * 2 + 80, 70),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.05, CITY.beachZ + 30);
  scene.add(sand);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.halfSize * 2 + 80, 220),
    new THREE.MeshLambertMaterial({ color: PALETTE.sea }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.02, CITY.seaZ + 130);
  scene.add(sea);

  // street centre lines (thin pale strips) + crosswalks at the plaza
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xd8d2c0 });
  const pitch = CITY.pitch;
  for (let i = -4; i <= 4; i++) {
    const x = i * pitch;
    const stripV = new THREE.Mesh(new THREE.PlaneGeometry(0.7, CITY.halfSize * 2), lineMat);
    stripV.rotation.x = -Math.PI / 2;
    stripV.position.set(x, 0.06, 0);
    scene.add(stripV);
    const stripH = new THREE.Mesh(new THREE.PlaneGeometry(CITY.halfSize * 2, 0.7), lineMat);
    stripH.rotation.x = -Math.PI / 2;
    stripH.position.set(0, 0.06, i * pitch);
    scene.add(stripH);
  }

  // --- buildings: one block = up to 4 towers, taller toward downtown ---
  const faceMats = PALETTE.buildingFaces.map((c) => {
    const tex = facadeTexture(hexCss(c), 0.35, makeRng(CITY.seed + c));
    world.textures.push(tex);
    return new THREE.MeshLambertMaterial({ map: tex });
  });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x5a5148 });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  let buildingCount = 0;
  for (let bx = -4; bx <= 4; bx++) {
    for (let bz = -4; bz <= 4; bz++) {
      if (bz === 4) continue; // south row is the beachfront promenade
      const cx = bx * pitch;
      const cz = bz * pitch;
      const distCentre = Math.hypot(cx, cz);
      const downtown = Math.max(0, 1 - distCentre / 260);
      const n = rng.chance(0.55) ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const w = rng.range(16, 26);
        const d = rng.range(16, 26);
        const h = rng.range(9, 16) + downtown * rng.range(10, 46) + (rng.chance(0.08) ? 30 : 0);
        const ox = (k === 0 ? -w / 2 - 2 : w / 2 + 2) * (rng.chance(0.5) ? 1 : -1) * 0.4;
        const oz = (k === 0 ? -d / 2 - 2 : d / 2 + 2) * (rng.chance(0.5) ? 1 : -1) * 0.4;
        const mat = faceMats[Math.floor(rng.next() * faceMats.length)];
        const b = new THREE.Mesh(boxGeo, [mat, mat, roofMat, roofMat, mat, mat]);
        b.scale.set(w, h, d);
        b.position.set(cx + ox, h / 2, cz + oz);
        scene.add(b);
        world.colliders.push({ x: cx + ox, z: cz + oz, hw: w / 2 + 0.6, hd: d / 2 + 0.6 });
        buildingCount++;
        // rooftop prop: AC box or antenna
        if (rng.chance(0.5)) {
          const prop = new THREE.Mesh(new THREE.BoxGeometry(2, 1.2, 2), roofMat);
          prop.position.set(cx + ox + rng.range(-4, 4), h + 0.6, cz + oz + rng.range(-4, 4));
          scene.add(prop);
        }
      }
    }
  }

  // --- palms along the beachfront + plaza (instanced: cheap on SwiftShader) ---
  const palmTrunk = new THREE.CylinderGeometry(0.22, 0.34, 6, 6);
  const palmLeaf = new THREE.ConeGeometry(2.4, 3.2, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f7a3d });
  const palmSpots = [];
  for (let x = -220; x <= 220; x += 26) {
    palmSpots.push([x + rng.range(-4, 4), CITY.beachZ - 8 + rng.range(-3, 3)]);
    if (rng.chance(0.6)) palmSpots.push([x + rng.range(-6, 6), 8 + rng.range(-4, 4)]);
  }
  const trunks = new THREE.InstancedMesh(palmTrunk, trunkMat, palmSpots.length);
  const leaves = new THREE.InstancedMesh(palmLeaf, leafMat, palmSpots.length);
  const m4 = new THREE.Matrix4();
  palmSpots.forEach(([x, z], i) => {
    m4.makeTranslation(x, 3, z);
    trunks.setMatrixAt(i, m4);
    m4.makeTranslation(x, 7.2, z);
    leaves.setMatrixAt(i, m4);
  });
  scene.add(trunks, leaves);

  // --- street lamps (instanced poles + emissive heads) ---
  const lampPole = new THREE.CylinderGeometry(0.12, 0.12, 7, 5);
  const lampHead = new THREE.SphereGeometry(0.5, 8, 6);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2e });
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
  const lampSpots = [];
  for (let i = -4; i <= 4; i++) {
    for (let j = -4; j <= 3; j++) {
      lampSpots.push([i * pitch + 9, j * pitch + 9]);
    }
  }
  const poles = new THREE.InstancedMesh(lampPole, poleMat, lampSpots.length);
  const heads = new THREE.InstancedMesh(lampHead, headMat, lampSpots.length);
  lampSpots.forEach(([x, z], i) => {
    m4.makeTranslation(x, 3.5, z);
    poles.setMatrixAt(i, m4);
    m4.makeTranslation(x, 7, z);
    heads.setMatrixAt(i, m4);
  });
  scene.add(poles, heads);

  // --- marina pier + boat (the heist escape) ---
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x7a5c3e });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 46), pierMat);
  pier.position.set(200, 0.6, CITY.beachZ + 34);
  scene.add(pier);
  const boat = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(4, 1.6, 10), new THREE.MeshLambertMaterial({ color: 0xe8e8e8 }));
  hull.position.y = 0.8;
  const boatTop = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 5), new THREE.MeshLambertMaterial({ color: 0x1f6f8b }));
  boatTop.position.set(0, 2, -1);
  boat.add(hull, boatTop);
  boat.position.set(206, 0, CITY.beachZ + 52);
  scene.add(boat);
  world.spawnPoints.boat = [206, 0, CITY.beachZ + 52];

  // --- central plaza (mission 3 pickup) with a fountain ---
  const plaza = new THREE.Mesh(
    new THREE.CylinderGeometry(16, 16, 0.4, 24),
    new THREE.MeshLambertMaterial({ color: 0xb8a888 }),
  );
  plaza.position.set(20, 0.2, 20);
  scene.add(plaza);
  const fountain = new THREE.Mesh(
    new THREE.CylinderGeometry(4, 5, 1.6, 16),
    new THREE.MeshLambertMaterial({ color: 0x3f8fb5 }),
  );
  fountain.position.set(20, 0.8, 20);
  scene.add(fountain);

  // --- mission marker beacon (tall gold light pillar, moved by missions.js) ---
  const beacon = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.1, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffc21a, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  pillar.position.y = 30;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3, 0.28, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0xffc21a }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.4;
  beacon.add(pillar, ring);
  beacon.position.set(150, 0, 190);
  scene.add(beacon);
  world.beacon = beacon;

  // --- checkpoint rings for the race (hidden until used) ---
  world.raceRings = [];
  for (let i = 0; i < 5; i++) {
    const r = new THREE.Mesh(
      new THREE.TorusGeometry(4, 0.35, 8, 28),
      new THREE.MeshBasicMaterial({ color: 0x18c8a0 }),
    );
    r.position.set(0, 2.5, 0);
    r.visible = false;
    scene.add(r);
    world.raceRings.push(r);
  }

  G.world = world;
  G.buildingCount = buildingCount;
  return world;
}

// Circle-vs-box collision: push a walker/car out of building footprints.
export function collideBuildings(G, pos, radius) {
  const list = G.world?.colliders;
  if (!list) return;
  for (const b of list) {
    const dx = pos.x - b.x;
    const dz = pos.z - b.z;
    if (Math.abs(dx) < b.hw + radius && Math.abs(dz) < b.hd + radius) {
      const px = b.hw + radius - Math.abs(dx);
      const pz = b.hd + radius - Math.abs(dz);
      if (px < pz) pos.x = b.x + Math.sign(dx || 1) * (b.hw + radius);
      else pos.z = b.z + Math.sign(dz || 1) * (b.hd + radius);
    }
  }
  // keep inside the playable area
  const lim = CITY.halfSize + 30;
  pos.x = Math.max(-lim, Math.min(lim, pos.x));
  pos.z = Math.max(-lim, Math.min(CITY.seaZ + 60, pos.z));
}
