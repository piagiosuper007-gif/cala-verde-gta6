// Game state for CALA VERDE. One job: a single mutable object every system reads
// and writes, so missions, police, vehicles and the HUD never drift apart.

import { MISSIONS, GARAGE_CARS, WEAPONS } from './config.js';

export function createGameState() {
  return {
    // flow: 'title' | 'playing' | 'paused' | 'complete' | 'busted' | 'wasted' | 'finished'
    screen: 'title',
    time: 0, // seconds since load
    frame: 0,
    seed: 1337,
    // player
    player: {
      pos: { x: 150, y: 0, z: 170 },
      angle: Math.PI, // facing the city from the marina
      health: 100,
      onFoot: true,
      car: null, // vehicle object when driving
      speed: 0,
      weapon: 0, // index into WEAPONS
      lastShotAt: 0,
    },
    camera: { yaw: Math.PI, pitch: 0.32, dist: 11, shake: 0 },
    // progression
    cash: 800,
    respect: 0,
    missionIndex: 0,
    mission: null, // live mission runtime (see missions.js)
    missionsDone: [],
    ownedCars: GARAGE_CARS.filter((c) => c.owned).map((c) => c.id),
    activeCarId: 'comet',
    crew: ['rico'],
    crewActive: 'rico',
    radio: 0,
    radioOn: true,
    // wanted
    wanted: 0,
    wantedHeat: 0, // 0..1 fractional progress toward next star
    bustedTimer: 0,
    // world objects (filled by world.js / vehicles.js / police.js)
    cars: [], // traffic + parked + mission cars
    peds: [],
    police: [],
    roadblocks: [],
    heli: null,
    guards: [],
    pickups: [],
    markers: [],
    // fx
    tracers: [],
    particles: [],
    messages: [], // dispatch / dialogue feed lines {text, kind, at}
    banner: null, // {title, sub, until}
    objective: 'Press ENTER to start',
    objectiveDetail: '',
    raceTimer: 0,
    saveExists: false,
    muted: false,
    // shot mode
    shot: null,
    shotReady: false,
  };
}

export function currentMissionDef(G) {
  return MISSIONS[G.missionIndex] ?? null;
}

export function weaponOf(G) {
  return WEAPONS[G.player.weapon] ?? WEAPONS[0];
}

export function addMessage(G, text, kind = 'info') {
  G.messages.push({ text, kind, at: G.time });
  if (G.messages.length > 6) G.messages.splice(0, G.messages.length - 6);
}

export function showBanner(G, title, sub = '', seconds = 3) {
  G.banner = { title, sub, until: G.time + seconds };
}

export function saveGame(G) {
  try {
    const data = {
      cash: G.cash, respect: G.respect, missionIndex: G.missionIndex,
      missionsDone: G.missionsDone, ownedCars: G.ownedCars,
      activeCarId: G.activeCarId, crew: G.crew, radio: G.radio,
    };
    localStorage.setItem('calaverde-save-v1', JSON.stringify(data));
    G.saveExists = true;
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem('calaverde-save-v1');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function applySave(G, data) {
  if (!data) return;
  G.cash = data.cash ?? G.cash;
  G.respect = data.respect ?? 0;
  G.missionIndex = data.missionIndex ?? 0;
  G.missionsDone = data.missionsDone ?? [];
  G.ownedCars = data.ownedCars ?? G.ownedCars;
  G.activeCarId = data.activeCarId ?? G.activeCarId;
  G.crew = data.crew ?? G.crew;
  G.saveExists = true;
}
