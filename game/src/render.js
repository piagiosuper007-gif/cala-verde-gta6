// Renderer + chase camera for CALA VERDE. One job: own the WebGL renderer and
// keep the camera behind the player — on foot or in a car — with a little shake.

import * as THREE from 'three';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  return renderer;
}

export function createScene() {
  return new THREE.Scene();
}

export function createCamera() {
  const cam = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
  return cam;
}

// Third-person follow: behind the player's heading, eased; mouse drag orbits yaw.
export function updateCamera(G, camera, dt) {
  const p = G.player.pos;
  const cam = G.camera;
  const dist = cam.dist;
  const height = cam.pitch * dist + (G.player.onFoot ? 3.2 : 4.2);
  const backX = Math.sin(cam.yaw) * dist;
  const backZ = Math.cos(cam.yaw) * dist;
  const shake = cam.shake > 0 ? (Math.random() - 0.5) * cam.shake : 0;
  const tx = p.x + backX;
  const ty = height + shake;
  const tz = p.z + backZ;
  // ease toward target so the camera never snaps
  const k = 1 - Math.exp(-dt * 7);
  camera.position.x += (tx - camera.position.x) * k;
  camera.position.y += (ty - camera.position.y) * k;
  camera.position.z += (tz - camera.position.z) * k;
  camera.lookAt(p.x, (G.player.onFoot ? 1.8 : 1.4) + shake, p.z);
  if (cam.shake > 0) cam.shake = Math.max(0, cam.shake - dt * 1.4);
}

export function onResize(renderer, camera) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
