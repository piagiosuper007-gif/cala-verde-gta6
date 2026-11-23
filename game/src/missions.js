// Story jobs for CALA VERDE. One job: run the 8-mission chain — objectives,
// markers, timers, rewards — and hand the player the next job when one lands.

import { MISSIONS, GARAGE_CARS } from './config.js';
import { currentMissionDef, addMessage, showBanner, saveGame } from './state.js';
import { raiseWanted, ensurePolice } from './police.js';
import { makeVehicle, buildVehicleMesh } from './vehicles.js';
import { spawnGuards, clearGuards } from './combat.js';

export function startMission(G, scene, index) {
  const def = MISSIONS[index];
  if (!def) {
    G.mission = null;
    G.objective = 'Cala Verde is yours. Free roam — the city never sleeps.';
    return;
  }
  G.missionIndex = index;
  const m = {
    def, stage: 'start', checkpointIndex: 0, guardsDown: 0,
    roadblocksBroken: 0, timer: def.timeLimit || 0, holdTimer: 0,
    targetCar: null, startedAt: G.time,
  };
  G.mission = m;
  G.objective = def.objective;
  G.objectiveDetail = `JOB ${def.n}/8 — ${def.title} · $${def.reward.toLocaleString()}`;
  moveBeacon(G, def.marker);
  raiseWanted(G, def.wanted || 0);
  ensurePolice(G, scene);
  for (const line of def.dialogue || []) addMessage(G, line, 'crew');
  showBanner(G, `JOB ${def.n}: ${def.title}`, def.briefing, 4.5);

  if (def.type === 'steal') {
    const v = makeVehicle({
      kind: 'mission', id: 'mission-target', color: 0xffc21a, name: 'Comet GT',
      x: def.marker[0], z: def.marker[2], angle: 0.6, topSpeed: 52, accel: 30,
    });
    buildVehicleMesh(scene, v);
    G.cars.push(v);
    m.targetCar = v;
  }
  if (def.type === 'combat') {
    spawnGuards(scene, G, [
      [def.marker[0] - 8, def.marker[2] - 4],
      [def.marker[0] + 6, def.marker[2] + 8],
      [def.marker[0] + 10, def.marker[2] - 10],
    ]);
  }
  if (def.type === 'race') {
    def.checkpoints.forEach(([x, , z], i) => {
      const ring = G.world.raceRings[i];
      ring.position.set(x, 2.5, z);
      ring.visible = i === 0;
    });
  }
}

export function moveBeacon(G, pos) {
  if (G.world?.beacon) {
    G.world.beacon.position.set(pos[0], 0, pos[2]);
    G.world.beacon.visible = true;
  }
}

export function hideBeacon(G) {
  if (G.world?.beacon) G.world.beacon.visible = false;
}

function dist2d(ax, az, bx, bz) {
  return Math.hypot(ax - bx, az - bz);
}

function completeMission(G, scene) {
  const m = G.mission;
  if (!m) return;
  const def = m.def;
  G.cash += def.reward;
  G.respect += 10;
  G.missionsDone.push(def.id);
  hideBeacon(G);
  clearGuards(scene, G);
  for (const ring of G.world.raceRings) ring.visible = false;
  if (m.targetCar) {
    m.targetCar.kind = 'parked';
    m.targetCar = null;
  }
  saveGame(G);
  const next = G.missionIndex + 1;
  G.mission = null;
  if (next >= MISSIONS.length) {
    G.screen = 'finished';
    showBanner(G, 'CALA VERDE COMPLETE', 'The Verde Job is done. The city is yours, Leo.', 6);
    addMessage(G, 'CAMPAIGN COMPLETE — Cala Verde is yours.', 'good');
  } else {
    G.screen = 'complete';
    G.completedJob = def;
    G.completedReward = def.reward;
  }
}

function failMission(G, scene, reason) {
  const m = G.mission;
  if (!m) return;
  showBanner(G, 'JOB FAILED', reason, 3.5);
  addMessage(G, `Job failed: ${reason} — try it again.`, 'bad');
  const index = G.missionIndex;
  clearGuards(scene, G);
  for (const ring of G.world.raceRings) ring.visible = false;
  if (m.targetCar) {
    const i = G.cars.indexOf(m.targetCar);
    if (i >= 0) { scene.remove(m.targetCar.mesh); G.cars.splice(i, 1); }
  }
  G.mission = null;
  G.wanted = 0;
  G.player.health = 100;
  startMission(G, scene, index);
}

export function updateMission(G, scene, dt) {
  const m = G.mission;
  if (!m) return;
  const def = m.def;
  const p = G.player.pos;

  // race timer counts down on the deliver job
  if (def.type === 'deliver' && m.stage === 'deliver') {
    m.timer -= dt;
    G.objectiveDetail = `JOB ${def.n}/8 — ${def.title} · ${Math.max(0, Math.ceil(m.timer))}s left`;
    if (m.timer <= 0) { failMission(G, scene, 'The package went cold. Out of time.'); return; }
  }
  // heist vault hold
  if (def.type === 'heist' && m.stage === 'vault') {
    if (dist2d(p.x, p.z, def.marker[0], def.marker[2]) < 7) {
      m.holdTimer += dt;
      G.objectiveDetail = `JOB ${def.n}/8 — cracking the vault… ${Math.ceil(def.holdSeconds - m.holdTimer)}s`;
      if (m.holdTimer >= def.holdSeconds) {
        m.stage = 'escape';
        G.cash += 0; // cash lands on completion
        raiseWanted(G, 5);
        moveBeacon(G, def.escapeTo);
        G.objective = 'Cash grabbed! Escape by boat at the marina — 5 stars!';
        G.objectiveDetail = `JOB ${def.n}/8 — ${def.title} · boat at the marina`;
        showBanner(G, 'VAULT CRACKED', 'CONDOR-2 is on you. Run for the boat!', 3.5);
        addMessage(G, 'MARA: Vault is open. Five seconds was all we needed. GO.', 'crew');
      }
    } else {
      m.holdTimer = Math.max(0, m.holdTimer - dt * 0.5);
    }
    return;
  }

  switch (def.type) {
    case 'goto': {
      if (dist2d(p.x, p.z, def.marker[0], def.marker[2]) < 7) completeMission(G, scene);
      break;
    }
    case 'steal': {
      if (m.stage === 'start') {
        if (G.player.car === m.targetCar) {
          m.stage = 'deliver';
          moveBeacon(G, def.deliver);
          G.objective = 'Comet GT stolen! Deliver it to the garage';
          addMessage(G, 'RICO: That is our car now. Garage, south-west.', 'crew');
        }
      } else if (dist2d(p.x, p.z, def.deliver[0], def.deliver[2]) < 8 && G.player.car === m.targetCar) {
        completeMission(G, scene);
      }
      break;
    }
    case 'pickup': {
      if (m.stage === 'start') {
        if (dist2d(p.x, p.z, def.marker[0], def.marker[2]) < 7) {
          m.stage = 'escape';
          if (!G.crew.includes('mara')) G.crew.push('mara');
          moveBeacon(G, def.escapeTo);
          raiseWanted(G, 2);
          G.objective = 'Mara is in! Lose the tail — reach the safehouse';
          addMessage(G, 'MARA: I am in! They are right behind us!', 'crew');
        }
      } else if (dist2d(p.x, p.z, def.escapeTo[0], def.escapeTo[2]) < 9) {
        completeMission(G, scene);
      }
      break;
    }
    case 'race': {
      const cp = def.checkpoints[m.checkpointIndex];
      if (cp && dist2d(p.x, p.z, cp[0], cp[2]) < 8) {
        m.checkpointIndex++;
        if (m.checkpointIndex >= def.checkpoints.length) {
          completeMission(G, scene);
        } else {
          const ring = G.world.raceRings[m.checkpointIndex];
          if (ring) ring.visible = true;
          const prev = G.world.raceRings[m.checkpointIndex - 1];
          if (prev) prev.visible = false;
          G.objective = `Race: checkpoint ${m.checkpointIndex + 1} of ${def.checkpoints.length}`;
          addMessage(G, `Checkpoint ${m.checkpointIndex} of ${def.checkpoints.length} — keep it pinned!`, 'good');
        }
      }
      break;
    }
    case 'combat': {
      if (m.guardsDown >= 3) completeMission(G, scene);
      break;
    }
    case 'deliver': {
      if (m.stage === 'start') {
        if (dist2d(p.x, p.z, def.marker[0], def.marker[2]) < 7) {
          m.stage = 'deliver';
          m.timer = def.timeLimit;
          moveBeacon(G, def.deliver);
          G.objective = 'Package collected! Deliver to the north hotel — 90s';
          addMessage(G, 'MARA: Timer is running. Go go go!', 'crew');
        }
      } else if (dist2d(p.x, p.z, def.deliver[0], def.deliver[2]) < 8) {
        completeMission(G, scene);
      }
      break;
    }
    case 'escape': {
      if (m.roadblocksBroken >= (def.roadblocksToBreak || 2)) {
        G.objective = 'Roadblocks broken! Reach the hideout';
        moveBeacon(G, def.escapeTo);
        if (dist2d(p.x, p.z, def.escapeTo[0], def.escapeTo[2]) < 9) completeMission(G, scene);
      }
      break;
    }
    case 'heist': {
      if (m.stage === 'escape' && dist2d(p.x, p.z, def.escapeTo[0], def.escapeTo[2]) < 10) {
        completeMission(G, scene);
      }
      break;
    }
    default:
      break;
  }
}

// Garage: stand at the garage marker and press B to buy the next car you can afford.
export const GARAGE_POS = [-190, 0, 150];

export function tryBuyCar(G, scene) {
  const p = G.player.pos;
  if (dist2d(p.x, p.z, GARAGE_POS[0], GARAGE_POS[2]) > 12) {
    addMessage(G, 'Garage is south-west, by the marina road. Get close and press B.', 'info');
    return;
  }
  const next = GARAGE_CARS.find((c) => !G.ownedCars.includes(c.id));
  if (!next) { addMessage(G, 'Garage: you own every car in Cala Verde.', 'good'); return; }
  if (G.cash < next.price) {
    addMessage(G, `Garage: the ${next.name} costs $${next.price.toLocaleString()} — you have $${G.cash.toLocaleString()}.`, 'info');
    return;
  }
  G.cash -= next.price;
  G.ownedCars.push(next.id);
  G.activeCarId = next.id;
  const v = makeVehicle({
    kind: 'player', id: 'player-car-' + next.id, color: next.color, name: next.name,
    x: GARAGE_POS[0] + 8, z: GARAGE_POS[2], angle: Math.PI / 2, topSpeed: next.topSpeed, accel: next.accel,
  });
  // the bought car becomes the player's ride when they enter it
  buildVehicleMesh(scene, v);
  G.cars.push(v);
  saveGame(G);
  showBanner(G, `${next.name.toUpperCase()} YOURS`, `Bought for $${next.price.toLocaleString()}. It is parked at the garage.`, 3.5);
}
