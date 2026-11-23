// CVPD — the wanted system. One job: turn stars into pursuit cars, roadblocks
// and the CONDOR-2 helicopter, plus the dispatch chatter on the HUD.

import * as THREE from 'three';
import { WANTED } from './config.js';
import { makeVehicle, buildVehicleMesh } from './vehicles.js';
import { addMessage } from './state.js';

const DISPATCH_LINES = [
  'CVPD DISPATCH: units responding, suspect last seen near the bay front.',
  'CVPD DISPATCH: all units, keep the net tight. Do not let them reach the marina.',
  'CVPD DISPATCH: Air support is up. CONDOR-2 has eyes on the grid.',
  'CVPD DISPATCH: roadblock going up on Palm Row. Spike strips ready.',
  'CVPD DISPATCH: suspect vehicle is fast. Requesting additional units.',
];

let dispatchTimer = 0;

export function ensurePolice(G, scene) {
  const want = WANTED.pursuitCarsPerStar[G.wanted] || 0;
  while (G.police.length < want) {
    const i = G.police.length;
    const angle = (i / Math.max(1, want)) * Math.PI * 2 + G.time;
    const v = makeVehicle({
      kind: 'police', color: 0x11131a, name: 'CVPD Interceptor',
      x: G.player.pos.x + Math.sin(angle) * 34,
      z: G.player.pos.z + Math.cos(angle) * 34,
      topSpeed: 40 + G.wanted * 2.5, accel: 30,
    });
    buildVehicleMesh(scene, v);
    G.police.push(v);
  }
  while (G.police.length > want) {
    const v = G.police.pop();
    if (v.mesh) scene.remove(v.mesh);
  }
  // roadblocks from 3 stars
  const wantBlocks = G.wanted >= WANTED.roadblockFromStar ? Math.min(3, G.wanted - 1) : 0;
  while (G.roadblocks.length < wantBlocks) {
    const rb = makeRoadblock(scene, G, G.roadblocks.length);
    G.roadblocks.push(rb);
  }
  while (G.roadblocks.length > wantBlocks) {
    const rb = G.roadblocks.pop();
    scene.remove(rb.group);
  }
  // helicopter from 4 stars
  if (G.wanted >= WANTED.heliFromStar && !G.heli) {
    G.heli = makeHelicopter(scene);
    addMessage(G, 'CVPD DISPATCH: CONDOR-2 is airborne. Air support on station.', 'police');
  }
  if (G.wanted < WANTED.heliFromStar && G.heli) {
    scene.remove(G.heli.group);
    G.heli = null;
  }
}

function makeRoadblock(scene, G, index) {
  const group = new THREE.Group();
  const stripeMat = new THREE.MeshLambertMaterial({ color: 0xd8d2c0 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x222226 });
  for (let i = -1; i <= 1; i++) {
    const block = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.1, 1.2), i % 2 ? darkMat : stripeMat);
    block.position.set(i * 3.6, 0.55, 0);
    group.add(block);
  }
  const coneMat = new THREE.MeshLambertMaterial({ color: 0xe85d3d });
  for (const x of [-6, 6]) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 8), coneMat);
    cone.position.set(x, 0.6, 0);
    group.add(cone);
  }
  // place ahead of the player on the nearest street line, snapped onto the
  // nearest road corridor (gaps between blocks, at 52k+26) so the barrier
  // never lands inside a building
  const ahead = 46 + index * 26;
  let px = G.player.pos.x + Math.sin(G.player.angle) * ahead;
  let pz = G.player.pos.z + Math.cos(G.player.angle) * ahead;
  const snap = (v) => Math.round((v - 26) / 52) * 52 + 26;
  if (Math.abs(Math.sin(G.player.angle)) > Math.abs(Math.cos(G.player.angle))) px = snap(px);
  else pz = snap(pz);
  group.position.set(Math.max(-225, Math.min(225, px)), 0, Math.max(-225, Math.min(205, pz)));
  group.rotation.y = G.player.angle; // barrier spans across the street, perpendicular to travel
  group.userData.broken = false;
  scene.add(group);
  return { group, x: group.position.x, z: group.position.z, broken: false };
}

function makeHelicopter(scene) {
  const group = new THREE.Group();
  // light steel-blue body so CONDOR-2 reads against dark towers and the dusk sky
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x9fc2e8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 5.4), bodyMat);
  body.position.y = 0;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 4.4), bodyMat);
  tail.position.set(0, 0.3, -4.4);
  const rotorMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.12, 0.5), rotorMat);
  rotor.position.y = 1.1;
  const spot = new THREE.Mesh(
    new THREE.ConeGeometry(5, 26, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
  );
  spot.position.y = -13;
  spot.rotation.x = Math.PI;
  group.add(body, tail, rotor, spot);
  group.position.set(0, 42, 0);
  scene.add(group);
  return { group, rotor, angle: 0 };
}

export function updatePolice(G, scene, dt) {
  if (G.wanted <= 0) {
    ensurePolice(G, scene);
    return;
  }
  ensurePolice(G, scene);
  dispatchTimer -= dt;
  if (dispatchTimer <= 0) {
    dispatchTimer = 14 + Math.random() * 10;
    addMessage(G, DISPATCH_LINES[Math.floor(Math.random() * DISPATCH_LINES.length)], 'police');
  }
  // pursuit cars chase the player
  for (const v of G.police) {
    const dx = G.player.pos.x - v.pos.x;
    const dz = G.player.pos.z - v.pos.z;
    const d = Math.hypot(dx, dz);
    const wantAngle = Math.atan2(dx, dz);
    let da = wantAngle - v.angle;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    v.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, da));
    const target = d > 60 ? v.topSpeed : v.topSpeed * 0.85;
    v.speed += (target - v.speed) * Math.min(1, dt * 1.2);
    v.pos.x += Math.sin(v.angle) * v.speed * dt;
    v.pos.z += Math.cos(v.angle) * v.speed * dt;
    v.mesh.position.set(v.pos.x, 0, v.pos.z);
    v.mesh.rotation.y = v.angle;
    if (v.lightBar) {
      const on = Math.floor(G.time * 6) % 2 === 0;
      v.lightBar[0].material.color.setHex(on ? 0xff2222 : 0x550000);
      v.lightBar[1].material.color.setHex(on ? 0x000055 : 0x2244ff);
    }
    // ram: touching the player on foot at speed = busted pressure
    if (d < 2.6) {
      if (G.player.onFoot) {
        G.bustedTimer += dt;
        if (G.bustedTimer > 1.6) {
          G.screen = 'busted';
        }
      } else {
        // PIT nudge: shove the player's car
        G.player.car.speed *= 0.94;
        G.camera.shake = Math.max(G.camera.shake, 0.5);
      }
    }
  }
  // roadblocks: smash through them while driving
  for (const rb of G.roadblocks) {
    if (rb.broken) continue;
    const d = Math.hypot(G.player.pos.x - rb.x, G.player.pos.z - rb.z);
    if (d < 4.5 && !G.player.onFoot && Math.abs(G.player.speed) > 8) {
      rb.broken = true;
      rb.group.visible = false;
      G.camera.shake = 1;
      addMessage(G, 'You smashed through a CVPD roadblock!', 'good');
      if (G.mission?.def.type === 'escape') G.mission.roadblocksBroken++;
      if (G.mission?.def.type === 'roadblock') G.mission.roadblocksBroken++;
    }
  }
  // helicopter circles overhead, spotlight on the player
  if (G.heli) {
    const h = G.heli;
    h.angle += dt * 0.55;
    const r = 26;
    h.group.position.set(
      G.player.pos.x + Math.sin(h.angle) * r,
      44 + Math.sin(G.time * 0.7) * 2,
      G.player.pos.z + Math.cos(h.angle) * r,
    );
    h.group.lookAt(G.player.pos.x, 40, G.player.pos.z);
    h.rotor.rotation.y += dt * 22;
  }
  // wanted decay when unseen (Mara doubles it)
  const decay = WANTED.decayPerSecond * (G.crewActive === 'mara' ? 2 : 1);
  G.wantedHeat -= decay * dt;
  if (G.wantedHeat <= -1 && G.wanted > 0) {
    G.wanted -= 1;
    G.wantedHeat = 0;
    addMessage(G, `Heat dropping — CVPD down to ${G.wanted} star${G.wanted === 1 ? '' : 's'}.`, 'good');
  }
}

export function raiseWanted(G, stars) {
  const before = G.wanted;
  G.wanted = Math.max(G.wanted, Math.min(5, stars));
  G.wantedHeat = 0;
  if (G.wanted > before) {
    addMessage(G, `WANTED LEVEL ${G.wanted} — CVPD is on you.`, 'police');
  }
}
