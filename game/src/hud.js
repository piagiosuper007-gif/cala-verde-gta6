// HUD + minimap for CALA VERDE. One job: every number, star, message and the
// 2D minimap the player reads — and the overlays for title, pause and results.

import { CITY, RADIO_STATIONS } from './config.js';
import { crewById } from './crew.js';

export function grabHud() {
  const $ = (id) => document.getElementById(id);
  return {
    root: $('hud'), cash: $('cash'), respect: $('respect'), healthFill: $('health-fill'),
    healthText: $('health-text'), stars: $('stars'), objective: $('objective'),
    objectiveDetail: $('objective-detail'), speed: $('speed'), speedUnit: $('speed-unit'),
    radio: $('radio'), feed: $('feed'), banner: $('banner'), bannerTitle: $('banner-title'),
    bannerSub: $('banner-sub'), minimap: $('minimap'),
    titleScreen: $('title-screen'), pauseScreen: $('pause-screen'),
    completeScreen: $('complete-screen'), bustedScreen: $('busted-screen'),
    wastedScreen: $('wasted-screen'), finishedScreen: $('finished-screen'),
    titleSave: $('title-save'), completeTitle: $('complete-title'),
    completeReward: $('complete-reward'), completeCash: $('complete-cash'),
    finishedCash: $('finished-cash'), prompt: $('prompt'),
  };
}

function starString(n) {
  let s = '';
  for (let i = 0; i < 5; i++) s += i < n ? '★' : '☆';
  return s;
}

export function updateHud(G, hud) {
  if (!hud.root) return;
  hud.cash.textContent = '$' + G.cash.toLocaleString();
  hud.respect.textContent = 'RESPECT ' + G.respect;
  hud.healthFill.style.width = Math.max(0, G.player.health) + '%';
  hud.healthText.textContent = Math.ceil(Math.max(0, G.player.health)) + '';
  hud.stars.textContent = starString(G.wanted);
  hud.stars.classList.toggle('hot', G.wanted > 0);
  hud.objective.textContent = G.objective || '';
  hud.objectiveDetail.textContent = G.objectiveDetail || '';
  if (G.player.onFoot) {
    hud.speed.textContent = 'ON FOOT';
    hud.speedUnit.textContent = '';
  } else {
    const kmh = Math.round(Math.abs(G.player.speed) * 3.6);
    hud.speed.textContent = String(kmh);
    hud.speedUnit.textContent = 'km/h';
  }
  const station = RADIO_STATIONS[G.radio % RADIO_STATIONS.length];
  hud.radio.textContent = G.muted ? 'MUTED' : '♪ ' + station.name;
  // feed: last 3 messages
  const recent = G.messages.slice(-3);
  hud.feed.innerHTML = recent.map((m) => `<div class="feed-${m.kind}">${escapeHtml(m.text)}</div>`).join('');
  // banner
  if (G.banner && G.time < G.banner.until) {
    hud.banner.style.display = 'block';
    hud.bannerTitle.textContent = G.banner.title;
    hud.bannerSub.textContent = G.banner.sub || '';
  } else {
    hud.banner.style.display = 'none';
  }
  // overlays by screen
  const show = (el, on) => { if (el) el.style.display = on ? 'flex' : 'none'; };
  show(hud.titleScreen, G.screen === 'title');
  show(hud.pauseScreen, G.screen === 'paused');
  show(hud.completeScreen, G.screen === 'complete');
  show(hud.bustedScreen, G.screen === 'busted');
  show(hud.wastedScreen, G.screen === 'wasted');
  show(hud.finishedScreen, G.screen === 'finished');
  hud.root.style.display = G.screen === 'title' ? 'none' : 'block';
  if (G.screen === 'complete' && G.completedJob) {
    hud.completeTitle.textContent = 'JOB COMPLETE — ' + G.completedJob.title.toUpperCase();
    hud.completeReward.textContent = '+$' + G.completedReward.toLocaleString();
    hud.completeCash.textContent = 'Cash: $' + G.cash.toLocaleString() + ' · Respect +' + 10;
  }
  if (G.screen === 'finished') {
    hud.finishedCash.textContent = 'Final cash: $' + G.cash.toLocaleString() + ' · Respect ' + G.respect;
  }
  if (hud.titleSave) {
    hud.titleSave.textContent = G.saveExists
      ? `Save found — Job ${Math.min(8, G.missionIndex + 1)}/8 · $${G.cash.toLocaleString()} · press ENTER to continue`
      : 'No save yet — press ENTER for a new game';
  }
  // context prompt (near car / at garage)
  if (hud.prompt) {
    let text = '';
    if (G.screen === 'playing') {
      if (G.nearCar) text = '[E] STEAL / ENTER ' + G.nearCar.name.toUpperCase();
      else if (G.nearGarage) text = '[B] GARAGE — buy cars';
      else if (!G.player.onFoot) text = '[E] EXIT CAR';
    }
    hud.prompt.textContent = text;
    hud.prompt.style.display = text ? 'block' : 'none';
  }
  drawMinimap(G, hud.minimap);
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function drawMinimap(G, canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const S = canvas.width;
  const half = CITY.halfSize + 30;
  const toMap = (x, z) => [((x + half) / (half * 2)) * S, ((z + half) / (half * 2)) * S];
  ctx.clearRect(0, 0, S, S);
  // sea + sand + city base
  ctx.fillStyle = '#123a4a';
  ctx.fillRect(0, 0, S, S);
  const [bx0, by0] = toMap(-half, CITY.beachZ);
  ctx.fillStyle = '#8a6f45';
  ctx.fillRect(0, by0, S, S - by0);
  ctx.fillStyle = '#2c2c30';
  ctx.fillRect(0, 0, S, by0);
  // streets
  ctx.strokeStyle = 'rgba(220,220,210,0.35)';
  ctx.lineWidth = 1;
  for (let i = -4; i <= 4; i++) {
    const [x] = toMap(i * CITY.pitch, 0);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, by0); ctx.stroke();
    const [, y] = toMap(0, i * CITY.pitch);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S, y); ctx.stroke();
  }
  // mission marker (pulsing gold)
  if (G.mission?.def.marker && G.world?.beacon.visible) {
    const [mx, my] = toMap(G.mission.def.marker[0], G.mission.def.marker[2]);
    const pulse = 4 + Math.sin(G.time * 5) * 1.5;
    ctx.fillStyle = '#ffc21a';
    ctx.beginPath(); ctx.arc(mx, my, pulse + 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', mx, my + 3);
  }
  // roadblocks
  ctx.fillStyle = '#ff7a3d';
  for (const rb of G.roadblocks) {
    if (rb.broken) continue;
    const [rx, ry] = toMap(rb.x, rb.z);
    ctx.fillRect(rx - 2, ry - 2, 4, 4);
  }
  // traffic
  ctx.fillStyle = '#ddd';
  for (const v of G.cars) {
    if (v.kind !== 'traffic') continue;
    const [vx, vy] = toMap(v.pos.x, v.pos.z);
    ctx.fillRect(vx - 1, vy - 1, 2, 2);
  }
  // police
  ctx.fillStyle = '#4d8dff';
  for (const v of G.police) {
    const [vx, vy] = toMap(v.pos.x, v.pos.z);
    ctx.beginPath(); ctx.arc(vx, vy, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  // heli
  if (G.heli) {
    const [hx, hy] = toMap(G.heli.group.position.x, G.heli.group.position.z);
    ctx.fillStyle = '#c07dff';
    ctx.beginPath(); ctx.arc(hx, hy, 3, 0, Math.PI * 2); ctx.fill();
  }
  // player arrow
  const [px, py] = toMap(G.player.pos.x, G.player.pos.z);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(Math.PI - G.player.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(0, -6); ctx.lineTo(4, 5); ctx.lineTo(-4, 5); ctx.closePath();
  ctx.fill();
  ctx.restore();
  // north + border
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('N', 6, 12);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, S - 2, S - 2);
}
