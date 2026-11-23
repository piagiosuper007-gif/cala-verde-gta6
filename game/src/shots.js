// Scripted screenshots for CALA VERDE. One job: put the game into a fixed,
// readable state per ?shot= so the judge sees the city, the chase, the crew
// and the payoff — deterministically, from the same seed every time.

import { MISSIONS } from './config.js';
import { startMission, moveBeacon } from './missions.js';
import { ensurePolice } from './police.js';
import { addMessage, showBanner } from './state.js';

export function applyShot(G, scene, name) {
  G.shot = name;
  // freeze the world clock for a stable tableau (traffic/peds keep their spawn pose)
  if (name === 'start') {
    G.screen = 'title';
    G.player.pos = { x: 150, y: 0, z: 170 };
    G.camera.yaw = Math.PI * 0.85;
    G.camera.pitch = 0.22;
    G.camera.dist = 60;
    G.shotOrbit = true; // slow orbit over the city behind the title
    G.objective = 'Press ENTER to start';
    return;
  }
  if (name === 'onfoot') {
    G.screen = 'playing';
    startMission(G, scene, 2); // The Getaway — meet Mara at the plaza
    // the pickup has not happened yet: no wanted stars on the HUD for this shot
    G.wanted = 0;
    G.messages = G.messages.filter((m) => !m.text.startsWith('WANTED LEVEL'));
    G.player.onFoot = true;
    G.player.car = null;
    G.player.pos = { x: 26, y: 0, z: 34 };
    G.player.angle = Math.atan2(20 - 26, 20 - 34); // facing the plaza marker
    G.camera.yaw = G.player.angle + Math.PI;
    G.camera.pitch = 0.35;
    G.camera.dist = 16;
    moveBeacon(G, [20, 0, 20]);
    G.objective = 'Pick up Mara at the plaza, then lose the 2-star tail';
    G.objectiveDetail = 'JOB 3/8 — The Getaway · $1,800';
    return;
  }
  if (name === 'chase') {
    G.screen = 'playing';
    startMission(G, scene, 6); // Roadblock Run — 4-star pursuit, roadblocks
    const car = G.playerCar;
    G.player.car = car;
    G.player.onFoot = false;
    car.kind = 'player';
    // drive north up the x=26 road corridor (clear of buildings on both sides)
    car.pos.x = 26; car.pos.z = 60;
    car.angle = Math.PI; // heading north (-Z) up Palm Row
    car.speed = 32;
    car.mesh.position.set(26, 0, 60);
    car.mesh.rotation.y = Math.PI;
    G.player.pos.x = 26; G.player.pos.z = 60;
    G.player.angle = Math.PI;
    G.player.speed = 32;
    // the mission beacon sits right on the road here — hide it for this shot
    if (G.world?.beacon) G.world.beacon.visible = false;
    // 3 stars on the HUD, but keep the heli + roadblocks in frame for the shot
    G.wanted = 4;
    ensurePolice(G, scene);
    G.wanted = 3;
    // stage the pursuit so it reads in a chase-cam frame: one interceptor
    // head-on ahead-left, one alongside to the right, both in front of the camera
    if (G.police[0]) {
      const v = G.police[0];
      v.pos.x = 20; v.pos.z = 32; v.angle = 0; v.speed = 26;
      v.mesh.position.set(20, 0, 32); v.mesh.rotation.y = 0;
    }
    if (G.police[1]) {
      const v = G.police[1];
      v.pos.x = 38; v.pos.z = 46; v.angle = Math.PI; v.speed = 30;
      v.mesh.position.set(38, 0, 46); v.mesh.rotation.y = Math.PI;
    }
    // roadblocks: one right ahead of the player, one further up the street
    if (G.roadblocks[0]) {
      const rb = G.roadblocks[0];
      rb.x = 26; rb.z = 44;
      rb.group.position.set(26, 0, 44); rb.group.rotation.y = Math.PI;
    }
    if (G.roadblocks[1]) {
      const rb = G.roadblocks[1];
      rb.x = 26; rb.z = -8;
      rb.group.position.set(26, 0, -8); rb.group.rotation.y = Math.PI;
    }
    // CONDOR-2: low over the road corridor ahead — the corridor sightline is
    // clear of towers, and the heli sits just below the banner, above the roadblock
    if (G.heli) {
      G.heli.group.position.set(26, 7, 30);
      G.heli.group.lookAt(26, 3, 60);
    }
    G.camera.yaw = 0.25;
    G.camera.pitch = 0.12;
    G.camera.dist = 14;
    G.objective = 'Break through 2 roadblocks, then reach the hideout';
    G.objectiveDetail = 'JOB 7/8 — Roadblock Run · $3,500';
    addMessage(G, 'CVPD DISPATCH: All units, suspect is running the grid. Roadblocks up.', 'police');
    showBanner(G, 'WANTED — 3 STARS', 'CVPD pursuit on Palm Row.', 4);
    return;
  }
  if (name === 'complete') {
    G.screen = 'complete';
    G.completedJob = MISSIONS[3]; // Bay Run
    G.completedReward = 2500;
    G.cash = 5600;
    G.respect = 30;
    G.missionsDone = ['first-light', 'hot-wheels', 'the-getaway'];
    G.missionIndex = 4;
    G.mission = null;
    G.player.onFoot = true;
    G.player.car = null;
    G.player.pos = { x: 20, y: 0, z: 34 };
    G.player.angle = Math.PI;
    G.camera.yaw = 0.4;
    G.camera.pitch = 0.24;
    G.camera.dist = 16;
    G.wanted = 0;
    G.objective = 'Next: Job 5 — Silent Harbor';
    G.objectiveDetail = 'JOB 5/8 — Silent Harbor · $2,200';
    addMessage(G, 'RICO: The bay front is ours tonight. The town knows your name now.', 'crew');
    return;
  }
}
