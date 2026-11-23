// Crew for CALA VERDE. One job: the two crew members, their abilities, and
// switching the active crew mate. Rico makes cars faster; Mara cools the heat.

import { CREW } from './config.js';
import { addMessage, showBanner } from './state.js';

export function crewById(id) {
  return CREW.find((c) => c.id === id) || CREW[0];
}

export function cycleCrew(G) {
  if (G.crew.length < 2) {
    addMessage(G, 'Your crew is just Rico for now — Mara joins in Job 3.', 'info');
    return;
  }
  const i = G.crew.indexOf(G.crewActive);
  G.crewActive = G.crew[(i + 1) % G.crew.length];
  const c = crewById(G.crewActive);
  showBanner(G, `${c.name.toUpperCase()} ACTIVE`, `${c.role} — ${c.ability}`, 2.5);
}

// Q — Mara scrambles one roadblock; Rico gives a short speed surge instead.
export function useCrewAbility(G, scene) {
  const now = G.time;
  if (G.crewCooldownUntil && now < G.crewCooldownUntil) {
    addMessage(G, 'Crew ability is recharging…', 'info');
    return;
  }
  if (G.crewActive === 'mara') {
    const rb = G.roadblocks.find((r) => !r.broken);
    if (!rb) { addMessage(G, 'MARA: no roadblock in range to scramble.', 'info'); return; }
    rb.broken = true;
    rb.group.visible = false;
    if (G.mission?.def.type === 'escape') G.mission.roadblocksBroken++;
    G.crewCooldownUntil = now + 20;
    addMessage(G, 'MARA: roadblock scrambled — its crew just got a fake stand-down order.', 'good');
  } else {
    // Rico: slipstream surge — 6 seconds of +30% top speed
    G.surgeUntil = now + 6;
    G.crewCooldownUntil = now + 20;
    addMessage(G, 'RICO: Slipstream! Floor it, Leo!', 'good');
  }
}

export function surgeMultiplier(G) {
  return G.surgeUntil && G.time < G.surgeUntil ? 1.3 : 1;
}
