// CALA VERDE — tuning, city layout, missions, crew, radio. One job: the numbers.
// The city is a 9x9 block grid. Streets run on a 52-unit pitch; the beach and the sea
// sit on the south edge (+Z). Downtown towers cluster near the centre.

export const CITY = {
  seed: 1337,
  blocks: 9,
  pitch: 52,
  streetWidth: 14,
  halfSize: 9 * 52 / 2, // 234 — playable area is roughly -234..234 on X and Z
  beachZ: 210, // south of this line the sand starts
  seaZ: 252,
  sunsetHour: 18.4, // golden hour, fixed for the whole game
};

export const PLAYER = {
  walkSpeed: 9,
  runSpeed: 14,
  radius: 0.7,
  health: 100,
};

export const DRIVING = {
  accel: 26,
  brake: 42,
  reverseAccel: 14,
  maxSpeed: 46,
  maxReverse: 14,
  steer: 1.9,
  grip: 6.5,
  handbrakeGrip: 2.2,
};

export const WANTED = {
  decayPerSecond: 0.05, // stars drain slowly when no police can see the player
  decaySeen: 0.0,
  stealCarStars: 1,
  shootStars: 2,
  killGuardStars: 1,
  maxStars: 5,
  pursuitCarsPerStar: [0, 1, 2, 3, 4, 5],
  roadblockFromStar: 3,
  heliFromStar: 4,
};

// 8 story jobs. type: goto | steal | pickup | race | combat | deliver | escape | heist
// Each job: marker position, objective text, briefing line, reward, wanted set on start.
export const MISSIONS = [
  {
    id: 'first-light', n: 1, title: 'First Light', type: 'goto',
    briefing: 'Rico is waiting at the marina. New in town — go say hello.',
    objective: 'Meet Rico at the marina beacon',
    marker: [150, 0, 190], reward: 500, wanted: 0,
    dialogue: ['RICO: Leo! You made it. Cala Verde eats slow drivers.', 'RICO: I got work. Real work. Follow my lead.'],
  },
  {
    id: 'hot-wheels', n: 2, title: 'Hot Wheels', type: 'steal',
    briefing: 'A yellow Comet GT sits at the dealership on Palm Row. Take it. Quietly is optional.',
    objective: 'Steal the Comet GT, then deliver it to the garage',
    marker: [-130, 0, -78], deliver: [-190, 0, 150], reward: 1200, wanted: 1,
    dialogue: ['MARA: Alarm is dead. I killed it from here. Go.', 'RICO: That car is worth more than my house. Bring it home.'],
  },
  {
    id: 'the-getaway', n: 3, title: 'The Getaway', type: 'pickup',
    briefing: 'Mara lifted a ledger from the docks. CVPD is already rolling. Pick her up, lose the tail.',
    objective: 'Pick up Mara at the plaza, then lose the 2-star tail',
    marker: [20, 0, 20], escapeTo: [-190, 0, 190], reward: 1800, wanted: 2,
    dialogue: ['MARA: They saw my face. Drive, Leo. DRIVE.', 'RICO: Safehouse is south-west. Do not stop for red lights.'],
  },
  {
    id: 'bay-run', n: 4, title: 'Bay Run', type: 'race',
    briefing: 'Street race along the bay front. Five checkpoints, one winner, no cops invited.',
    objective: 'Race through all 5 checkpoints',
    checkpoints: [[-180, 0, 180], [-180, 0, -180], [0, 0, -190], [180, 0, -180], [180, 0, 180]],
    reward: 2500, wanted: 0,
    dialogue: ['RICO: The bay front is ours tonight. Win it and the town knows your name.', 'MARA: I rigged the lights. Green all the way.'],
  },
  {
    id: 'silent-harbor', n: 5, title: 'Silent Harbor', type: 'combat',
    briefing: 'Three dock guards stand between us and the cargo. On foot. Make it quiet — or don\'t.',
    objective: 'Neutralise the 3 dock guards',
    marker: [170, 0, -140], reward: 2200, wanted: 2,
    dialogue: ['MARA: Guards patrol the east dock. Three of them.', 'RICO: You shoot straight, Leo. I have seen it.'],
  },
  {
    id: 'golden-hour', n: 6, title: 'Golden Hour', type: 'deliver',
    briefing: 'A package for the hotel on the north strip. Ninety seconds. The sun is setting and so is our window.',
    objective: 'Deliver the package to the north hotel in 90s',
    marker: [-26, 0, 156], deliver: [78, 0, -182], timeLimit: 90, reward: 2000, wanted: 0,
    dialogue: ['MARA: Package is hot. Ninety seconds or it is worthless.', 'RICO: Straight up the strip. Do not crash my car.'],
  },
  {
    id: 'roadblock-run', n: 7, title: 'Roadblock Run', type: 'escape',
    briefing: 'CVPD has the whole grid locked down. Four stars. Smash through two roadblocks and vanish.',
    objective: 'Break through 2 roadblocks, then reach the hideout',
    marker: [26, 0, 26], escapeTo: [-190, 0, -190], roadblocksToBreak: 2, reward: 3500, wanted: 4,
    dialogue: ['CVPD DISPATCH: All units, suspect is running the grid. Roadblocks up.', 'MARA: I can scramble one roadblock. Press Q when you see it.'],
  },
  {
    id: 'the-verde-job', n: 8, title: 'The Verde Job', type: 'heist',
    briefing: 'The Verde bank. Five stars, CONDOR-2 in the air, the whole city watching. Take the cash, reach the boat.',
    objective: 'Hold the bank vault 5s, then escape by boat at 5 stars',
    marker: [26, 0, -26], escapeTo: [200, 0, 230], holdSeconds: 5, reward: 10000, wanted: 5,
    dialogue: ['RICO: This is the one, Leo. Everything we did was for this.', 'MARA: Vault is open. Five seconds. Then run like the sun is chasing you.'],
  },
];

export const CREW = [
  { id: 'rico', name: 'Rico', role: 'Driver', ability: 'Slipstream: +15% top speed while active', bonus: 'speed' },
  { id: 'mara', name: 'Mara', role: 'Hacker', ability: 'Scramble: wanted drains twice as fast, Q kills one roadblock', bonus: 'heat' },
];

export const GARAGE_CARS = [
  { id: 'comet', name: 'Comet GT', color: 0xffc21a, price: 0, topSpeed: 46, accel: 26, owned: true },
  { id: 'falco', name: 'Falco S', color: 0x2e6bff, price: 2500, topSpeed: 52, accel: 30, owned: false },
  { id: 'viento', name: 'Viento R', color: 0xd21f3c, price: 6000, topSpeed: 58, accel: 34, owned: false },
  { id: 'aurora', name: 'Aurora X', color: 0x18c8a0, price: 12000, topSpeed: 64, accel: 38, owned: false },
];

export const RADIO_STATIONS = [
  { id: 'verde-fm', name: 'VERDE FM', desc: 'sunset synth', bpm: 96, root: 220, wave: 'sawtooth' },
  { id: 'costa-lofi', name: 'COSTA LO-FI', desc: 'slow bay grooves', bpm: 72, root: 174, wave: 'triangle' },
  { id: 'marina-talk', name: 'MARINA TALK', desc: 'news & static', bpm: 60, root: 110, wave: 'square' },
];

export const WEAPONS = [
  { id: 'pistol', name: 'Pistol', damage: 34, rate: 0.28, spread: 0.012, range: 70 },
  { id: 'smg', name: 'SMG', damage: 16, rate: 0.09, spread: 0.05, range: 55 },
  { id: 'shotgun', name: 'Shotgun', damage: 22, pellets: 6, rate: 0.7, spread: 0.09, range: 30 },
];

export const PALETTE = {
  skyTop: 0x2b4a7a, skyHorizon: 0xff9e57, sun: 0xffd27a,
  sea: 0x1f6f8b, sand: 0xe8c98f, asphalt: 0x54545e, sidewalk: 0x8d8578,
  buildingFaces: [0xe8dcc8, 0xd9b48f, 0xc98a6b, 0x9fb8c8, 0xe0a458, 0xb8c4a8, 0xd98a8a, 0x7fa3a8],
  carColors: [0xc23b2e, 0x2e6bff, 0xffc21a, 0x18c8a0, 0xe8e8e8, 0x222226, 0x7a4fd0, 0xd21f3c],
};
