// CALA VERDE — main loop. One job: boot the city, run the states (title /
// playing / paused / complete / busted / wasted / finished) and keep every
// system — driving, police, missions, combat, HUD, audio — ticking together.

import * as THREE from 'three';
import { createGameState, loadSave, applySave, saveGame, addMessage, showBanner } from './state.js';
import { buildWorld, collideBuildings } from './world.js';
import { createRenderer, createScene, createCamera, updateCamera, onResize } from './render.js';
import { createInput } from './input.js';
import {
  spawnTraffic, spawnParkedCars, spawnPedestrians, updateTraffic,
  updatePedestrians, driveCar, nearestCar, enterCar, exitCar,
} from './vehicles.js';
import { updatePolice, raiseWanted } from './police.js';
import { startMission, updateMission, tryBuyCar, GARAGE_POS } from './missions.js';
import { fireWeapon, updateTracers, updateGuards } from './combat.js';
import { grabHud, updateHud } from './hud.js';
import { AudioEngine } from './audio.js';
import { cycleCrew, useCrewAbility } from './crew.js';
import { applyShot } from './shots.js';

window.__cvError = null;
window.addEventListener('error', (e) => { window.__cvError = String(e.message || e.error); });

const canvas = document.getElementById('game');
const G = createGameState();
window.__game = G;

const renderer = createRenderer(canvas);
const scene = createScene();
const camera = createCamera();
scene.add(camera);

buildWorld(scene, G);
spawnParkedCars(scene, G);
spawnTraffic(scene, G, 10);
spawnPedestrians(scene, G, 16);

const input = createInput(canvas);
const hud = grabHud();
G.audio = new AudioEngine();

// --- player character mesh (visible on foot) ---
const playerMesh = new THREE.Group();
{
  const jacket = new THREE.MeshLambertMaterial({ color: 0x18a08a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc9a06a });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a2f3a });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 1.05, 10), jacket);
  body.position.y = 1.05;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
  head.position.y = 1.85;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.55, 0.22), pants);
  legL.position.set(-0.16, 0.28, 0);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.55, 0.22), pants);
  legR.position.set(0.16, 0.28, 0);
  playerMesh.add(body, head, legL, legR);
}
playerMesh.position.set(G.player.pos.x, 0, G.player.pos.z);
scene.add(playerMesh);
G.playerMesh = playerMesh;

// --- save / title ---
const existingSave = loadSave();
if (existingSave) applySave(G, existingSave);

// --- shot mode (?shot=start|onfoot|chase|complete) ---
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
if (shotName) {
  applyShot(G, scene, shotName);
  updateHud(G, hud);
}

// --- input actions shared across screens ---
function startGame() {
  G.audio.init();
  G.audio.resume();
  if (G.saveExists) {
    startMission(G, scene, Math.min(7, G.missionIndex));
    addMessage(G, `Welcome back, Leo. Job ${Math.min(8, G.missionIndex + 1)} of 8 — pick up where you left off.`, 'good');
  } else {
    G.missionIndex = 0;
    startMission(G, scene, 0);
  }
  G.screen = 'playing';
}

function retryMission() {
  G.player.health = 100;
  G.wanted = 0;
  G.bustedTimer = 0;
  G.player.pos = { x: 150, y: 0, z: 170 };
  if (G.player.car) { G.player.car.speed = 0; G.player.car = null; }
  G.player.onFoot = true;
  startMission(G, scene, G.missionIndex);
  G.screen = 'playing';
}

function updateOnFoot(dt) {
  const p = G.player;
  const axis = input.axis();
  // camera-relative movement: forward is away from the camera
  const fx = -Math.sin(G.camera.yaw);
  const fz = -Math.cos(G.camera.yaw);
  const rx = Math.cos(G.camera.yaw);
  const rz = -Math.sin(G.camera.yaw);
  let mx = fx * axis.f + rx * axis.r;
  let mz = fz * axis.f + rz * axis.r;
  const len = Math.hypot(mx, mz);
  if (len > 0) {
    mx /= len; mz /= len;
    const running = input.isDown('Shift');
    const speed = running ? 14 : 9;
    p.pos.x += mx * speed * dt;
    p.pos.z += mz * speed * dt;
    p.angle = Math.atan2(mx, mz);
    p.speed = speed;
    playerMesh.position.y = Math.abs(Math.sin(G.time * 10)) * 0.08;
  } else {
    p.speed = 0;
    playerMesh.position.y = 0;
  }
  collideBuildings(G, p.pos, 0.7);
  playerMesh.position.set(p.pos.x, playerMesh.position.y, p.pos.z);
  playerMesh.rotation.y = p.angle;
  // camera yaw follows drag; zoom by wheel
  G.camera.yaw += input.dragDX * 0.005;
  G.camera.pitch = Math.max(0.08, Math.min(0.9, G.camera.pitch + input.dragDY * 0.002));
  G.camera.dist = Math.max(6, Math.min(20, G.camera.dist + input.wheel * 0.01));
}

function updateDriving(dt) {
  const v = G.player.car;
  if (!v) return;
  driveCar(G, v, input, dt);
  // camera chases behind the car
  let targetYaw = v.angle + Math.PI;
  let dy = targetYaw - G.camera.yaw;
  while (dy > Math.PI) dy -= Math.PI * 2;
  while (dy < -Math.PI) dy += Math.PI * 2;
  G.camera.yaw += dy * Math.min(1, dt * 1.6) + input.dragDX * 0.005;
  G.camera.pitch = Math.max(0.08, Math.min(0.9, G.camera.pitch + input.dragDY * 0.002));
  G.camera.dist = Math.max(8, Math.min(22, G.camera.dist + input.wheel * 0.01));
  playerMesh.visible = false;
}

function handlePlayingKeys() {
  if (input.wasPressed('p') || input.wasPressed('Escape')) {
    G.screen = 'paused';
    saveGame(G);
    return;
  }
  if (input.wasPressed('m')) {
    G.muted = !G.muted;
    G.audio.setMuted(G.muted);
  }
  if (input.wasPressed('r')) {
    G.radio = (G.radio + 1) % 3;
    G.audio.setStation(G.radio);
  }
  if (input.wasPressed('c')) cycleCrew(G);
  if (input.wasPressed('q')) useCrewAbility(G, scene);
  if (input.wasPressed('1')) G.player.weapon = 0;
  if (input.wasPressed('2')) G.player.weapon = 1;
  if (input.wasPressed('3')) G.player.weapon = 2;
  if (input.wasPressed('b')) tryBuyCar(G, scene);
  if (G.player.onFoot) {
    if (input.wasPressed('e') && G.nearCar) {
      enterCar(G, G.nearCar);
      playerMesh.visible = false;
      if (G.audio) G.audio.resume();
    }
    if (input.isDown('f')) fireWeapon(G, scene, camera);
  } else if (input.wasPressed('e')) {
    exitCar(G);
    playerMesh.visible = true;
    playerMesh.position.set(G.player.pos.x, 0, G.player.pos.z);
  }
}

// --- main loop ---
const clock = new THREE.Clock();
let saveTimer = 0;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta() || 0.016);
  G.time += dt;
  G.frame++;

  if (G.shot) {
    // scripted screenshot: frozen tableau, camera only
    if (G.shotOrbit) G.camera.yaw += dt * 0.03;
    // keep the player mesh on the staged position (gameplay updates are skipped)
    playerMesh.visible = G.player.onFoot && G.screen === 'playing';
    playerMesh.position.set(G.player.pos.x, 0, G.player.pos.z);
    playerMesh.rotation.y = G.player.angle;
    updateCamera(G, camera, dt);
    updateHud(G, hud);
    renderer.render(scene, camera);
    if (G.frame >= 5 && !G.shotReady) {
      G.shotReady = true;
      window.__shotReady = true;
    }
    return;
  }

  if (G.screen === 'title') {
    if (input.wasPressed('Enter') || input.wasPressed(' ')) startGame();
    G.camera.yaw += dt * 0.02; // slow orbit behind the title
    updateCamera(G, camera, dt);
  } else if (G.screen === 'playing') {
    // proximity prompts FIRST: handlePlayingKeys reads G.nearCar on the same
    // frame, so a key pressed the moment the player reaches a car must land
    G.nearCar = G.player.onFoot ? nearestCar(G, 5) : null;
    G.nearGarage = Math.hypot(G.player.pos.x - GARAGE_POS[0], G.player.pos.z - GARAGE_POS[2]) < 12;
    handlePlayingKeys();
    if (G.player.onFoot) {
      playerMesh.visible = true;
      updateOnFoot(dt);
    } else {
      updateDriving(dt);
    }
    updateTraffic(G, dt);
    updatePedestrians(G, dt);
    updatePolice(G, scene, dt);
    updateMission(G, scene, dt);
    updateGuards(G, dt);
    updateTracers(G, scene);
    // slow health regen while calm
    if (G.wanted === 0 && G.player.health > 0 && G.player.health < 100) {
      G.player.health = Math.min(100, G.player.health + 2 * dt);
    }
    updateCamera(G, camera, dt);
    saveTimer += dt;
    if (saveTimer > 30) { saveTimer = 0; saveGame(G); }
  } else if (G.screen === 'paused') {
    if (input.wasPressed('p') || input.wasPressed('Escape') || input.wasPressed('Enter')) {
      G.screen = 'playing';
    }
  } else if (G.screen === 'complete') {
    if (input.wasPressed('Enter')) {
      const next = G.missionIndex + 1;
      startMission(G, scene, next);
      G.screen = 'playing';
    }
    updateCamera(G, camera, dt);
  } else if (G.screen === 'busted' || G.screen === 'wasted') {
    if (input.wasPressed('Enter')) retryMission();
    updateCamera(G, camera, dt);
  } else if (G.screen === 'finished') {
    if (input.wasPressed('Enter')) {
      G.screen = 'playing';
      G.objective = 'Cala Verde is yours. Free roam — the city never sleeps.';
      G.objectiveDetail = 'Campaign complete · $' + G.cash.toLocaleString();
    }
    updateCamera(G, camera, dt);
  }

  if (G.audio) G.audio.update(G, dt);
  updateHud(G, hud);
  renderer.render(scene, camera);
  if (G.frame >= 5 && !window.__shotReady) window.__shotReady = true;
  input.endFrame();
}

window.addEventListener('resize', () => onResize(renderer, camera));
document.getElementById('title-screen')?.addEventListener('click', () => {
  if (G.screen === 'title') startGame();
});
frame();
