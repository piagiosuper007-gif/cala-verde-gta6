// On-foot combat for CALA VERDE. One job: hitscan shooting, weapon slots,
// guards that shoot back, and the tracer + muzzle flash the eye reads.

import * as THREE from 'three';
import { weaponOf, addMessage } from './state.js';
import { raiseWanted } from './police.js';

export function spawnGuards(scene, G, spots) {
  clearGuards(scene, G);
  for (const [x, z] of spots) {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x3a3f4a });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.48, 1.8, 8), bodyMat);
    body.position.y = 0.9;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshLambertMaterial({ color: 0xc9a06a }));
    head.position.y = 2.05;
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.9), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    gun.position.set(0.3, 1.3, 0.5);
    group.add(body, head, gun);
    group.position.set(x, 0, z);
    scene.add(group);
    G.guards.push({ mesh: group, x, z, health: 100, alive: true, shootAt: G.time + 2 + Math.random() * 2 });
  }
}

export function clearGuards(scene, G) {
  for (const g of G.guards) scene.remove(g.mesh);
  G.guards = [];
}

export function fireWeapon(G, scene, camera) {
  const w = weaponOf(G);
  const now = G.time;
  if (now - G.player.lastShotAt < w.rate) return;
  G.player.lastShotAt = now;
  raiseWanted(G, 2);
  const pellets = w.pellets || 1;
  let hitAny = false;
  for (let p = 0; p < pellets; p++) {
    // shoot from the camera through the screen centre, with spread
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    dir.x += (Math.random() - 0.5) * w.spread * 2;
    dir.y += (Math.random() - 0.5) * w.spread * 2;
    dir.normalize();
    const origin = new THREE.Vector3(G.player.pos.x, 1.5, G.player.pos.z);
    const hit = nearestGuardHit(G, origin, dir, w.range);
    if (hit) {
      hit.guard.health -= w.damage;
      hitAny = true;
      addTracer(G, scene, origin, hit.point);
      if (hit.guard.health <= 0 && hit.guard.alive) {
        hit.guard.alive = false;
        hit.guard.mesh.visible = false;
        addMessage(G, 'Guard down.', 'good');
        if (G.mission?.def.type === 'combat') G.mission.guardsDown++;
      }
    } else {
      const end = origin.clone().addScaledVector(dir, w.range);
      end.y = Math.max(0.2, end.y);
      addTracer(G, scene, origin, end);
    }
  }
  G.camera.shake = Math.max(G.camera.shake, 0.18);
  if (G.audio) G.audio.gunshot(w.id);
  return hitAny;
}

function nearestGuardHit(G, origin, dir, range) {
  let best = null;
  let bestT = range;
  for (const guard of G.guards) {
    if (!guard.alive) continue;
    // treat the guard as a vertical cylinder: solve in XZ, check height
    const cx = guard.x - origin.x;
    const cz = guard.z - origin.z;
    const t = cx * dir.x + cz * dir.z;
    if (t < 0 || t > range) continue;
    const px = origin.x + dir.x * t;
    const pz = origin.z + dir.z * t;
    const d = Math.hypot(px - guard.x, pz - guard.z);
    if (d < 1.1 && t < bestT) {
      const y = origin.y + dir.y * t;
      if (y > 0 && y < 2.4) {
        bestT = t;
        best = { guard, point: new THREE.Vector3(px, Math.max(0.3, y), pz) };
      }
    }
  }
  return best;
}

function addTracer(G, scene, from, to) {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a0 }));
  scene.add(line);
  G.tracers.push({ line, until: G.time + 0.09 });
}

export function updateTracers(G, scene) {
  for (let i = G.tracers.length - 1; i >= 0; i--) {
    if (G.time > G.tracers[i].until) {
      scene.remove(G.tracers[i].line);
      G.tracers.splice(i, 1);
    }
  }
}

export function updateGuards(G, dt) {
  for (const guard of G.guards) {
    if (!guard.alive) continue;
    const d = Math.hypot(G.player.pos.x - guard.x, G.player.pos.z - guard.z);
    guard.mesh.lookAt(G.player.pos.x, 0, G.player.pos.z);
    if (d < 55 && G.time > guard.shootAt) {
      guard.shootAt = G.time + 1.4 + Math.random();
      // guard fires: player takes a hit if close and in the open
      if (d < 40 && Math.random() < 0.45) {
        G.player.health -= 8;
        G.camera.shake = Math.max(G.camera.shake, 0.35);
        if (G.audio) G.audio.gunshot('pistol');
        if (G.player.health <= 0) {
          G.player.health = 0;
          G.screen = 'wasted';
        }
      }
    }
    // guards patrol a small loop when the player is far
    if (d > 60) {
      guard.x += Math.sin(G.time * 0.4 + guard.z) * dt * 1.2;
      guard.mesh.position.set(guard.x, 0, guard.z);
    }
  }
}
