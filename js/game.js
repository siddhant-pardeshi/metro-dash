/* ============================================================
 * METRO DASH — rooftop rush across the last metro line.
 * Three-lane endless runner on a dusk viaduct: barrier crates,
 * signal gantries, maintenance drones, roof gaps and oncoming
 * train cars. Transit tickets, boost pads, close-call bonuses
 * and three run missions. All art is drawn with canvas paths
 * each frame; all audio is synthesized. No image or sound assets.
 * ============================================================ */
(function () {
  'use strict';

  /* ---------------- tuning ---------------- */
  const LANE_W = 300;               // world units between lane centers
  const DECK_HALF = 590;            // viaduct half width, world units
  const CAMD = 430;                 // perspective camera distance
  const DRAW_DIST = 3300;           // world units drawn ahead
  const SPAWN_AHEAD = 3000;         // patterns spawn this far out
  const BASE_SPEED = 380;           // world units / second
  const SPEED_RAMP = 12;            // per second of run time
  const MAX_SPEED = 900;
  const BOOST_MULT = 1.5;
  const BOOST_TIME = 2;
  const JUMP_T = 0.55;              // seconds airborne
  const JUMP_H = 150;               // apex height, world units
  const SLIDE_T = 0.6;
  const CRATE_H = 62;
  const DRONE_H = 96;
  const GANTRY_H = 74;
  const GAP_HALF = 95;              // half depth of a roof gap
  const TRAIN_SPEED = 620;          // oncoming car closing speed
  const TRAIN_LEN = 520;
  const POLE_GAP = 720;             // catenary pole spacing
  const TIE_GAP = 95;               // track sleeper spacing
  const WARN_D = 1750;              // where the train '!' marker shows
  const UNITS_M = 14;               // world units per meter
  const HZ = 0.42, GY = 0.86;       // horizon / player ground line

  /* ---------------- world state ---------------- */
  let obstacles = [], pickups = [], floats = [];
  let dist = 0, speed = 0, runTime = 0;
  let laneX = 0, laneTarget = 0, runPhase = 0;
  let jumpT = -1, slideT = 0, pendingSlide = false, landT = 0;
  let boostT = 0, invulnT = 0, stumbleT = 0;
  let state = 'attract';
  let slowmoT = 0, timeScale = 1, crashT = 0, crashSpin = 0, briefingOpen = false;
  let tickets = 0, closeCalls = 0, score = 0;
  let missions = [], milestoneAt = 1000, nextSpawnZ = 0, lastPattern = '', transitPass = 0;
  let particles = Kit.particles();

  const W = { w: 0, h: 0 };
  let PXU = 0, PYU = 0;             // px per world unit, horizontal / vertical
  let skyGrad = null, sunGlow = null, hazeGrad = null, deckGrad = null;
  let railAmber = null, railSky = null, vignette = null;
  let stars = [], skylineFar = [], skylineNear = [];

  /* ---------------- scenery ---------------- */
  function buildScenery() {
    stars = [];
    for (let i = 0; i < 90; i++) stars.push({ x: Math.random(), y: Math.random() * 0.4, r: Math.random() * 1.3 + 0.4, p: Math.random() * 6.28 });
    skylineFar = []; skylineNear = [];
    let x = 0;
    while (x < 2.2) {
      skylineFar.push({ x, w: 0.03 + Math.random() * 0.06, h: 0.2 + Math.random() * 0.55, lit: Math.random() });
      x += 0.045 + Math.random() * 0.04;
    }
    x = -0.1;
    while (x < 2.2) {
      skylineNear.push({ x, w: 0.05 + Math.random() * 0.09, h: 0.3 + Math.random() * 0.55, lit: Math.random() });
      x += 0.07 + Math.random() * 0.05;
    }
  }

  /* ---------------- run control ---------------- */
  let G = null;                     // assigned at boot

  function makeMissions() {
    const types = ['tickets', 'close', 'drones', 'distance'];
    for (let i = types.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [types[i], types[j]] = [types[j], types[i]];
    }
    return types.slice(0, 3).map(t => {
      if (t === 'tickets') { const need = Kit.pick([10, 14, 18]); return { type: t, need, got: 0, done: false, short: 'Tickets', toast: `collect ${need} tickets` }; }
      if (t === 'close') { const need = Kit.pick([3, 4, 5]); return { type: t, need, got: 0, done: false, short: 'Close calls', toast: `land ${need} close calls` }; }
      if (t === 'drones') { const need = Kit.pick([6, 8, 10]); return { type: t, need, got: 0, done: false, short: 'Drones', toast: `dodge ${need} drones` }; }
      const need = Kit.pick([600, 900, 1200]);
      return { type: t, need, got: 0, done: false, short: 'Distance', toast: `reach ${need} m` };
    });
  }

  function startRun() {
    obstacles = []; pickups = []; floats = [];
    dist = 0; runTime = 0; speed = BASE_SPEED * 0.75;
    laneX = 0; laneTarget = 0; runPhase = 0;
    jumpT = -1; slideT = 0; pendingSlide = false; landT = 0;
    boostT = 0; invulnT = 0; stumbleT = 0;
    slowmoT = 0; timeScale = 1; crashT = 0; crashSpin = 0;
    tickets = 0; closeCalls = 0; score = 0;
    milestoneAt = 1000; nextSpawnZ = 1200; lastPattern = ''; transitPass = 0;
    missions = makeMissions();
    particles.clear();
    state = 'run';
    buildHUD();
    Audio.stopSong({ fade: 0.2 });
    Audio.playSong('run');
    Audio.loop('wind', { wave: 'sawtooth', freq: 90, maxFreq: 380, cutoff: 480, gain: 0.05 });
    Audio.setIntensity(0.3);
    Mascot.react('start');
    Kit.toast('3 · 2 · 1 — GO!', 950);
  }

  function toAttract() {
    state = 'attract';
    obstacles = []; pickups = []; floats = [];
    dist = 0; nextSpawnZ = 700; lastPattern = '';
    speed = BASE_SPEED * 0.85;
    laneX = 0; laneTarget = 0; jumpT = -1; slideT = 0; boostT = 0; runPhase = 0;
    particles.clear();
    Audio.stopLoop('wind');
    Audio.playSong('menu');
    Audio.setIntensity(0.12);
  }

  function finishRun() {
    state = 'done';
    Audio.stopLoop('wind');
    G.pause();
    /* rooftop debrief: one scam-radar concept before the results board */
    if (window.Learn && window.LEARN_DATA) {
      const card = Learn.nextCard();
      if (card) {
        Learn.show(card, { timer: 0 }).then(ok => {
          if (ok) {
            score += 150;
            Kit.toast('+150 — sharp eye');
          }
          showResultsBoard();
        });
        return;
      }
    }
    showResultsBoard();
  }

  function showResultsBoard() {
    const meters = Math.floor(dist / UNITS_M);
    const done = missions.filter(m => m.done).length;
    Kit.showResults({
      medal: done === 3 ? '🏆' : meters > 1200 ? '🎫' : '🛠️',
      kicker: done === 3 ? 'All missions cleared' : 'Run complete',
      title: done === 3 ? 'Perfect commute' : meters > 1200 ? 'Skyline sprinter' : 'The metro waits for no one',
      stats: [
        { label: 'Distance', value: Kit.fmt(meters) + ' m' },
        { label: 'Tickets', value: Kit.fmt(tickets) },
        { label: 'Close calls', value: Kit.fmt(closeCalls) },
        { label: 'Missions', value: done + ' / 3' },
        { label: 'Score', value: Kit.fmt(score + meters) }
      ],
      best: { value: meters },
      mascotLine: done === 3 ? 'Every mission and then some. The drivers will hear about this.' : 'The rooftops keep the score. Same time tomorrow?'
    });
    Mascot.react(done === 3 ? 'win' : 'fail');
  }

  /* ---------------- actions ---------------- */
  function moveLane(dir) {
    const next = Kit.clamp(laneTarget + dir, -1, 1);
    if (next !== laneTarget) { laneTarget = next; Kit.buzz(12); }
  }

  function doJump() {
    if (state !== 'run' || jumpT >= 0) return;
    slideT = 0;
    jumpT = 0;
    Audio.sfx('jump');
  }

  function doSlide() {
    if (state !== 'run') return;
    if (jumpT >= 0) { pendingSlide = true; jumpT = Math.max(jumpT, JUMP_T * 0.6); return; }
    if (slideT > 0) return;
    slideT = SLIDE_T;
    Audio.sfx('whoosh');
  }

  function playerY() {
    if (jumpT < 0) return 0;
    const u = jumpT / JUMP_T;
    return JUMP_H * 4 * u * (1 - u);
  }

  function onLand() {
    landT = 0.3;
    if (pendingSlide) { pendingSlide = false; slideT = SLIDE_T; Audio.sfx('whoosh'); }
    if (!Kit.reducedMotion()) {
      const sp = screenPos(laneX, 0, 4);
      particles.spawn(sp.x, W.h * GY, { count: 7, color: '#8A7FA8', spread: 150, vy: -60, grav: 220, decay: 2.4, size: 2.4 });
    }
  }

  /* ---------------- spawning ---------------- */
  function ticketLine(lane, z, n, y) {
    for (let i = 0; i < n; i++) pickups.push({ kind: 'ticket', lane, z: z + i * 115, y, ph: Math.random() * 6.28 });
  }

  function spawnPattern() {
    const z = nextSpawnZ;
    const r = Math.random();
    let kind;
    if (r < 0.24) kind = 'crates';
    else if (r < 0.42) kind = 'drones';
    else if (r < 0.56) kind = 'gantry';
    else if (r < 0.68) kind = 'gap';
    else if (r < 0.78 && dist / UNITS_M > 250) kind = 'train';
    else if (r < 0.92) kind = 'tickets';
    else kind = 'boost';
    if (kind === lastPattern && (kind === 'gap' || kind === 'train')) kind = 'crates';
    lastPattern = kind;

    const laneA = Kit.irand(0, 2) - 1;

    if (kind === 'crates') {
      obstacles.push({ kind: 'crate', lane: laneA, z });
      if (Math.random() < 0.55) {
        let laneB = Kit.irand(0, 2) - 1;
        if (laneB === laneA) laneB = laneA === 1 ? -1 : laneA + 1;
        obstacles.push({ kind: 'crate', lane: laneB, z });
      }
      if (Math.random() < 0.6) ticketLine(Kit.irand(0, 2) - 1, z + 420, 4, 55);
    } else if (kind === 'drones') {
      obstacles.push({ kind: 'drone', lane: laneA, z, ph: Math.random() * 6.28 });
      if (Math.random() < 0.45) obstacles.push({ kind: 'drone', lane: laneA === 1 ? -1 : 1, z: z + 140, ph: Math.random() * 6.28 });
      if (Math.random() < 0.4) ticketLine(Kit.irand(0, 2) - 1, z + 380, 3, 55);
    } else if (kind === 'gantry') {
      obstacles.push({ kind: 'gantry', lane: 0, z });
      if (Math.random() < 0.5) ticketLine(Kit.irand(0, 2) - 1, z, 3, 42);
    } else if (kind === 'gap') {
      obstacles.push({ kind: 'gap', lane: 0, z, half: GAP_HALF, hit: false });
      const tl = Kit.irand(0, 2) - 1;
      for (let i = 0; i < 5; i++) {
        const t = (i / 4) * 2 - 1;
        pickups.push({ kind: 'ticket', lane: tl, z: z + t * 240, y: 175 - 95 * t * t, ph: Math.random() * 6.28 });
      }
    } else if (kind === 'train') {
      obstacles.push({ kind: 'train', lane: laneA, z: z + 900, warned: false });
    } else if (kind === 'tickets') {
      ticketLine(laneA, z, 5, 55);
    } else {
      pickups.push({ kind: 'boost', lane: laneA, z });
    }
    nextSpawnZ += 820 + speed * 0.3 + Kit.rand(0, 240);
  }

  /* ---------------- collisions ---------------- */
  function hitInvulnerable() { return boostT > 0 || invulnT > 0; }

  function checkObstacle(o, dz) {
    if (state !== 'run') return;
    const dxl = Math.abs(laneX - o.lane);
    if (o.kind === 'crate' && Math.abs(dz) < 55 && dxl < 0.55) {
      if (playerY() > CRATE_H - 12) return;          // hopped it
      if (!hitInvulnerable()) return crash();
      return smash(o);
    }
    if (o.kind === 'gantry' && Math.abs(dz) < 42 && slideT <= 0) {
      if (!hitInvulnerable()) return crash();
      return;                                        // shimmer through
    }
    if (o.kind === 'drone' && Math.abs(dz) < 55 && dxl < 0.55 && slideT <= 0) {
      if (!hitInvulnerable()) return crash();
      return smash(o);
    }
    if (o.kind === 'gap' && !o.hit && playerY() < 12 && Math.abs(dz) < o.half + 26) {
      o.hit = true;
      return stumble();
    }
    if (o.kind === 'train' && dz < 60 && dz > -TRAIN_LEN && dxl < 0.6) {
      if (!hitInvulnerable()) return crash();
      return;                                        // the boost carries you between cars
    }
  }

  function smash(o) {
    o.dead = true;
    const sp = screenPos(o.lane, o.z - dist, 40);
    Audio.sfx('hit');
    G.shake(4);
    if (!Kit.reducedMotion()) particles.spawn(sp.x, sp.y, { count: 12, color: '#FFB84D', spread: 240, decay: 2, size: 2.6, glow: true });
  }

  function stumble() {
    speed *= 0.5;
    stumbleT = 0.55; invulnT = 1;
    landT = 0.3;
    Audio.sfx('brake');
    G.shake(6);
    addFloat('STUMBLE!', W.w / 2 + laneX * LANE_W * PXU, W.h * 0.66, '#FFB84D');
    if (!Kit.reducedMotion()) {
      const sp = screenPos(laneX, 0, 4);
      particles.spawn(sp.x, W.h * GY, { count: 10, color: '#8A7FA8', spread: 190, vy: -70, grav: 240, decay: 2.2, size: 2.6 });
    }
  }

  function crash() {
    if (state !== 'run') return;
    if (transitPass > 0) {
      transitPass = 0;
      invulnT = 2.5;
      Audio.sfx('powerup');
      Kit.buzz(40);
      Kit.toast('Transit pass used — back on the roof!');
      Mascot.react('mission');
      return;
    }
    state = 'crashing';
    crashT = 0.6; crashSpin = 0;
    Audio.sfx('hit'); Audio.sfx('explode');
    Audio.stopLoop('wind');
    Audio.stopSong({ fade: 0.3 });
    Audio.duck(600);
    G.shake(13);
    Kit.buzz(140);
    if (!Kit.reducedMotion()) {
      const cx = W.w / 2 + laneX * LANE_W * PXU, cy = W.h * 0.72;
      particles.spawn(cx, cy, { count: 16, color: '#FFB84D', spread: 330, decay: 1.7, size: 3, glow: true });
      particles.spawn(cx, cy, { count: 12, color: '#FF6B5C', spread: 260, decay: 1.9, size: 2.6 });
    }
  }

  function registerPass(o) {
    if (state !== 'run') return;
    const dxl = Math.abs(laneX - o.lane);
    if (o.kind === 'drone') {
      progressMission('drones', 1);
      if (dxl < 0.9) nearMiss();
    } else if (o.kind === 'crate') {
      if (dxl < 0.5) nearMiss();
    } else if (o.kind === 'gantry') {
      nearMiss();                                    // cleared it by inches
    } else if (o.kind === 'train') {
      if (dxl < 0.9) nearMiss();
    }
  }

  function nearMiss() {
    closeCalls++; score += 25;
    slowmoT = 0.2;                                   // a beat of slow-mo
    Audio.sfx('whoosh');
    setTimeout(() => Audio.sfx('laser'), 70);
    addFloat('CLOSE! +25', W.w / 2 + laneX * LANE_W * PXU, W.h * 0.62, '#6BD0FF');
    Mascot.react('nearmiss');
    progressMission('close', 1);
    Kit.buzz(30);
  }

  function collectTicket(t, dz, i) {
    tickets++; score += 10;
    Audio.sfx('coin');
    progressMission('tickets', 1);
    const sp = screenPos(t.lane, dz, t.y);
    addFloat('+10', sp.x, sp.y, '#FFD9A0');
    if (!Kit.reducedMotion()) particles.spawn(sp.x, sp.y, { count: 6, color: '#FFD9A0', spread: 120, decay: 2.6, size: 2, glow: true });
    pickups.splice(i, 1);
  }

  /* ---------------- missions ---------------- */
  function progressMission(type, n) {
    for (const ms of missions) {
      if (ms.done || ms.type !== type) continue;
      ms.got += n;
      if (ms.got >= ms.need) completeMission(ms);
    }
  }

  function completeMission(ms) {
    ms.done = true;
    ms.got = ms.need;
    score += 150;
    Audio.sfx('checkpoint');
    Kit.toast(`Mission clear +150 — ${ms.toast}`);
    Mascot.react('mission');
  }

  /* ---------------- attract autopilot ---------------- */
  function attractAI() {
    const danger = [0, 0, 0];
    let act = null, actD = 1e9;
    for (const o of obstacles) {
      const dz = o.z - dist;
      if (dz < -60 || dz > 950) continue;
      const lanes = o.kind === 'crate' || o.kind === 'drone' || o.kind === 'train' ? [o.lane] : [-1, 0, 1];
      for (const L of lanes) danger[L + 1] += dz < 400 ? 2 : 1;
      if (dz < actD) {
        if (o.kind === 'crate' || o.kind === 'gap') { act = 'jump'; actD = dz; }
        else if (o.kind === 'gantry' || o.kind === 'drone') { act = 'slide'; actD = dz; }
        else if (o.kind === 'train') { act = 'dodge'; actD = dz; }
      }
    }
    let best = 0;
    if (danger[1] + 1 < danger[0] || danger[1] + 1 < danger[2]) {
      best = danger[0] <= danger[2] ? -1 : 1;
      if (danger[best + 1] >= danger[1]) best = 0;
    }
    laneTarget = best;
    if (actD < 300 && jumpT < 0 && slideT <= 0) {
      if (act === 'jump') jumpT = 0;
      else if (act === 'slide') slideT = SLIDE_T;
    }
  }

  /* ---------------- update ---------------- */
  function update(dt) {
    const input = Kit.input;

    /* slow-mo / crash-cam: timers run on real time, world on scaled time */
    if (slowmoT > 0) slowmoT = Math.max(0, slowmoT - dt);
    const wantTS = state === 'crashing' ? 0.2 : slowmoT > 0 ? 0.85 : 1;
    timeScale += (wantTS - timeScale) * Math.min(1, dt * 14);
    const d = dt * timeScale;

    /* controls */
    if (state === 'run') {
      if (input.pressed('left')) moveLane(-1);
      if (input.pressed('right')) moveLane(1);
      if (input.pressed('up') || input.pressed('action')) doJump();
      if (input.pressed('down') || input.pressed('slide')) doSlide();
    } else if (state === 'attract') attractAI();

    const running = state === 'run' || state === 'attract';

    /* speed */
    if (state === 'run') {
      runTime += d;
      boostT = Math.max(0, boostT - d);
      invulnT = Math.max(0, invulnT - d);
      stumbleT = Math.max(0, stumbleT - d);
      const target = Math.min(MAX_SPEED, BASE_SPEED + SPEED_RAMP * runTime) * (boostT > 0 ? BOOST_MULT : 1);
      speed += (target - speed) * Math.min(1, d * 1.5);
      if (stumbleT > 0) speed *= 1 - 1.1 * d;
    } else if (state === 'attract') {
      speed += (BASE_SPEED * 0.85 - speed) * Math.min(1, d * 0.8);
    } else if (state === 'crashing') {
      speed *= 1 - 2 * d;
    }

    if (running) {
      dist += speed * d;
      if (jumpT >= 0) {
        jumpT += d;
        if (jumpT >= JUMP_T) { jumpT = -1; onLand(); }
      }
      if (slideT > 0) {
        slideT = Math.max(0, slideT - d);
        if (!Kit.reducedMotion() && Math.random() < 0.35) {
          const sp = screenPos(laneX, 0, 6);
          particles.spawn(sp.x, W.h * GY, { count: 1, color: '#8A7FA8', spread: 60, vy: -50, grav: 160, decay: 2.6, size: 2.2 });
        }
      }
      landT = Math.max(0, landT - d * 2.4);
      runPhase += d * (5 + speed / 62);
      laneX += (laneTarget - laneX) * (1 - Math.exp(-13 * d));
      while (nextSpawnZ < dist + SPAWN_AHEAD) spawnPattern();
    }

    if (state === 'crashing') {
      crashT -= dt;
      crashSpin += d * 10;
      if (crashT <= 0) { finishRun(); return; }
    }

    /* obstacles */
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      if (o.kind === 'train') {
        o.z -= TRAIN_SPEED * d;
        if (!o.warned && (o.z - dist) / (speed + TRAIN_SPEED) < 1) {
          o.warned = true;
          if (state === 'run') Audio.sfx('alarm');
        }
      }
      const dz = o.z - dist;
      if (dz < -700 || o.dead) { obstacles.splice(i, 1); continue; }
      if (running) checkObstacle(o, dz);
      if (!o.passed && dz < 0 && o.kind !== 'gap') registerPass(o);
    }

    /* pickups */
    for (let i = pickups.length - 1; i >= 0; i--) {
      const t = pickups[i];
      const dz = t.z - dist;
      if (dz < -140) { pickups.splice(i, 1); continue; }
      if (state !== 'run') continue;
      if (t.kind === 'ticket') {
        /* magnet-ish pull when the runner passes close */
        if (dz < 240 && dz > -40 && Math.abs(laneX - t.lane) < 1.05) {
          t.lane += (laneX - t.lane) * Math.min(1, d * 4);
          if (dz < 130) t.y += (playerY() + 58 - t.y) * Math.min(1, d * 4);
        }
        if (Math.abs(dz) < 62 && Math.abs(laneX - t.lane) < 0.48) {
          const top = playerY() + (slideT > 0 ? 64 : 130);
          if (t.y > playerY() - 28 && t.y < top + 28) collectTicket(t, dz, i);
        }
      } else if (t.kind === 'boost' && Math.abs(dz) < 70 && Math.abs(laneX - t.lane) < 0.6 && playerY() < 40) {
        boostT = BOOST_TIME;
        Audio.sfx('powerup');
        Kit.buzz(40);
        const sp = screenPos(t.lane, dz, 40);
        addFloat('BOOST!', sp.x, sp.y, '#6BD0FF');
        if (!Kit.reducedMotion()) particles.spawn(sp.x, sp.y, { count: 10, color: '#6BD0FF', spread: 200, decay: 2.2, size: 2.4, glow: true });
        pickups.splice(i, 1);
      }
    }

    /* missions + milestones */
    if (state === 'run') {
      const meters = Math.floor(dist / UNITS_M);
      for (const ms of missions) {
        if (ms.done || ms.type !== 'distance') continue;
        ms.got = meters;
        if (ms.got >= ms.need) completeMission(ms);
      }
      if (meters >= milestoneAt) {
        milestoneAt += 1000;
        Kit.toast(Kit.fmt(meters) + ' m');
        Audio.sfx('chime');
        Mascot.react('milestone');
        /* station stop: a correct concept check earns a transit pass */
        if (window.Learn && window.LEARN_DATA && !briefingOpen) {
          const card = Learn.nextCard();
          if (card) {
            briefingOpen = true;
            G.pause();
            Learn.show(card, { timer: 0, onClose: () => {
              briefingOpen = false;
              if (state === 'run') G.resume();
            } }).then(ok => {
              if (ok) {
                transitPass = 1;
                score += 250;
                Kit.toast('Transit pass earned — it will save you once');
                Audio.sfx('powerup');
              } else {
                Kit.toast('Missed check — no pass. Watch the gantries.');
                Audio.sfx('fail');
              }
            });
          }
        }
      }
    }

    /* audio follows the run */
    const sr = Math.min(1, speed / MAX_SPEED);
    Audio.setLoop('wind', 'pitch', sr);
    Audio.setLoop('wind', 'gain', running ? 0.05 : 0);
    Audio.setIntensity(state === 'run' ? 0.3 + 0.7 * sr : 0.12);

    particles.update(d);
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.life -= d * 1.15;
      f.y -= d * 52;
      if (f.life <= 0) floats.splice(i, 1);
    }
  }

  /* ---------------- projection ---------------- */
  function persp(dz) { return CAMD / Math.max(1, CAMD + dz); }

  function screenPos(lane, dz, wy) {
    const s = persp(Math.max(dz, 1));
    return {
      x: W.w / 2 + lane * LANE_W * PXU * s,
      y: W.h * HZ + (W.h * GY - W.h * HZ) * s - wy * PYU * s
    };
  }

  /* ---------------- render ---------------- */
  function render(ctx, gg) {
    const { w, h } = W;
    const hz = h * HZ, gy = h * GY;

    /* dusk sky */
    if (!skyGrad) {
      skyGrad = ctx.createLinearGradient(0, 0, 0, hz * 1.04);
      skyGrad.addColorStop(0, '#0C091D');
      skyGrad.addColorStop(0.42, '#1D1440');
      skyGrad.addColorStop(0.7, '#3E1F55');
      skyGrad.addColorStop(0.88, '#7A3358');
      skyGrad.addColorStop(1, '#C9684B');
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, hz + 2);

    /* stars */
    ctx.fillStyle = '#EAF1FF';
    for (const st of stars) {
      ctx.globalAlpha = Kit.reducedMotion() ? 0.4 : (0.25 + 0.5 * Math.abs(Math.sin(gg.t * 1.2 + st.p))) * 0.7;
      ctx.fillRect(st.x * w, st.y * hz, st.r, st.r);
    }
    ctx.globalAlpha = 1;

    /* sodium glow pooled on the horizon */
    if (!sunGlow) {
      sunGlow = ctx.createRadialGradient(w * 0.5, hz, 10, w * 0.5, hz, h * 0.52);
      sunGlow.addColorStop(0, 'rgba(255,166,96,0.3)');
      sunGlow.addColorStop(1, 'rgba(255,166,96,0)');
    }
    ctx.fillStyle = sunGlow;
    ctx.fillRect(0, 0, w, hz + 2);

    drawSearchlights(ctx, gg, hz, h);
    drawSkyline(ctx, skylineFar, hz, dist * 0.00003, h * 0.3, '#231C44', '#FFB184', w, h);
    drawSkyline(ctx, skylineNear, hz, dist * 0.00008 + 0.4, h * 0.38, '#151129', '#FFD9A0', w, h);

    /* haze floor */
    if (!hazeGrad) {
      hazeGrad = ctx.createLinearGradient(0, hz, 0, h);
      hazeGrad.addColorStop(0, '#2A1838');
      hazeGrad.addColorStop(1, '#120F22');
    }
    ctx.fillStyle = hazeGrad;
    ctx.fillRect(0, hz, w, h - hz);

    /* viaduct deck converging on the vanishing point */
    const halfW = DECK_HALF * PXU;
    const sFar = persp(DRAW_DIST);
    const yFar = hz + (gy - hz) * sFar;
    if (!deckGrad) {
      deckGrad = ctx.createLinearGradient(0, hz, 0, h);
      deckGrad.addColorStop(0, '#1B1633');
      deckGrad.addColorStop(1, '#2B2347');
    }
    ctx.fillStyle = deckGrad;
    ctx.beginPath();
    ctx.moveTo(w / 2 - halfW * sFar, yFar);
    ctx.lineTo(w / 2 + halfW * sFar, yFar);
    ctx.lineTo(w / 2 + halfW, gy);
    ctx.lineTo(w / 2 - halfW, gy);
    ctx.closePath();
    ctx.fill();

    /* sleepers rushing past */
    const tieOff = dist % TIE_GAP;
    for (let i = 30; i >= 0; i--) {
      const z = i * TIE_GAP - tieOff + TIE_GAP;
      if (z < 6 || z > DRAW_DIST) continue;
      const s = persp(z);
      const y = hz + (gy - hz) * s;
      ctx.strokeStyle = `rgba(12,9,26,${0.16 + 0.3 * s})`;
      ctx.lineWidth = Math.max(1, 13 * PYU * s);
      ctx.beginPath();
      ctx.moveTo(w / 2 - halfW * s * 0.97, y);
      ctx.lineTo(w / 2 + halfW * s * 0.97, y);
      ctx.stroke();
    }

    /* glowing rails: amber outer, sky inner */
    if (!railAmber) {
      railAmber = ctx.createLinearGradient(0, hz, 0, gy);
      railAmber.addColorStop(0, 'rgba(255,184,77,0.05)');
      railAmber.addColorStop(1, 'rgba(255,184,77,0.8)');
      railSky = ctx.createLinearGradient(0, hz, 0, gy);
      railSky.addColorStop(0, 'rgba(107,208,255,0.04)');
      railSky.addColorStop(1, 'rgba(107,208,255,0.5)');
    }
    for (const [rx, grad] of [[-1.5, railAmber], [-0.5, railSky], [0.5, railSky], [1.5, railAmber]]) {
      const xf = w / 2 + rx * LANE_W * PXU * sFar;
      const xn = w / 2 + rx * LANE_W * PXU;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(xf - 0.6, yFar);
      ctx.lineTo(xf + 0.6, yFar);
      ctx.lineTo(xn + 2.6, gy);
      ctx.lineTo(xn - 2.6, gy);
      ctx.closePath();
      ctx.fill();
    }

    /* roof gaps chewed out of the deck */
    for (const o of obstacles) {
      if (o.kind !== 'gap' || o.dead) continue;
      const dz0 = o.z - o.half - dist;
      const dz1 = o.z + o.half - dist;
      if (dz1 < 2 || dz0 > DRAW_DIST) continue;
      const s0 = persp(Math.max(dz0, 3));
      const s1 = persp(dz1);
      const y0 = hz + (gy - hz) * s0;
      const y1 = hz + (gy - hz) * s1;
      ctx.fillStyle = '#070512';
      ctx.beginPath();
      ctx.moveTo(w / 2 - halfW * s0, y0);
      ctx.lineTo(w / 2 + halfW * s0, y0);
      ctx.lineTo(w / 2 + halfW * s1, y1);
      ctx.lineTo(w / 2 - halfW * s1, y1);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,184,77,0.5)';
      ctx.lineWidth = Math.max(1, 3 * s0);
      ctx.beginPath();
      ctx.moveTo(w / 2 - halfW * s0, y0);
      ctx.lineTo(w / 2 + halfW * s0, y0);
      ctx.stroke();
    }

    drawPoles(ctx, gg, hz, gy);

    /* sprites far -> near */
    const sprites = [];
    for (const o of obstacles) {
      if (o.kind === 'gap' || o.dead) continue;
      const dz = o.z - dist;
      if (dz > -120 && dz < DRAW_DIST) sprites.push({ dz, o });
    }
    for (const t of pickups) {
      const dz = t.z - dist;
      if (dz > -80 && dz < DRAW_DIST) sprites.push({ dz, o: t });
    }
    sprites.sort((a, b) => b.dz - a.dz);
    for (const sp of sprites) drawSprite(ctx, sp, gg);

    drawWarnings(ctx, gg, hz, gy);
    drawPlayer(ctx, gg);
    particles.render(ctx);

    /* boost speedlines */
    if (boostT > 0 && !Kit.reducedMotion()) {
      ctx.strokeStyle = 'rgba(107,208,255,0.25)';
      ctx.lineWidth = 2;
      const cx = w / 2, cy = h * 0.55;
      for (let i = 0; i < 9; i++) {
        const a = Math.random() * Math.PI * 2;
        const r0 = Math.min(w, h) * 0.26, r1 = r0 + 90;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.6);
        ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 0.6);
        ctx.stroke();
      }
    }

    drawFloats(ctx);

    /* crash-cam flash */
    if (state === 'crashing') {
      ctx.fillStyle = `rgba(255,84,60,${0.14 * (crashT / 0.6)})`;
      ctx.fillRect(0, 0, w, h);
    }

    if (!vignette || vignette.w !== w) {
      vignette = { w, g: ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.44, w / 2, h / 2, Math.max(w, h) * 0.75) };
      vignette.g.addColorStop(0, 'rgba(0,0,0,0)'); vignette.g.addColorStop(1, 'rgba(5,4,12,0.55)');
    }
    ctx.fillStyle = vignette.g;
    ctx.fillRect(0, 0, w, h);

    updateHUD();
  }

  /* ---------------- scenery render ---------------- */
  function drawSearchlights(ctx, gg, hz, h) {
    const w = W.w;
    for (const [fx, ph] of [[0.16, 0], [0.82, 2.4]]) {
      const ox = w * fx, oy = hz - h * 0.06;
      const sway = Kit.reducedMotion() ? 0.34 : Math.sin(gg.t * 0.21 + ph) * 0.55;
      const a = -Math.PI / 2 + sway;
      const len = h * 0.6, spread = 0.055;
      ctx.fillStyle = 'rgba(107,208,255,0.055)';
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + Math.cos(a - spread) * len, oy + Math.sin(a - spread) * len);
      ctx.lineTo(ox + Math.cos(a + spread) * len, oy + Math.sin(a + spread) * len);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawSkyline(ctx, layer, horizon, off, maxH, dark, lit, w, h) {
    for (const b of layer) {
      const bx = (((b.x + off) % 2.2) + 2.2) % 2.2 * w - w * 0.1;
      const bw = b.w * w, bh = b.h * maxH;
      if (bx + bw < -40 || bx > w + 40) continue;
      ctx.fillStyle = dark;
      ctx.fillRect(bx, horizon - bh, bw, bh);
      ctx.fillStyle = lit;
      ctx.globalAlpha = 0.22 + 0.3 * b.lit;
      const cols = Math.max(1, Math.floor(bw / 9)), rows = Math.max(1, Math.floor(bh / 12));
      for (let c = 0; c < cols; c += 2) {
        for (let r = 0; r < rows; r += 2) {
          if ((c * 7 + r * 13 + b.lit * 97) % 5 < 2.4) ctx.fillRect(bx + 3 + c * 9, horizon - bh + 5 + r * 12, 3, 4.5);
        }
      }
      ctx.globalAlpha = 1;
      /* rooftop beacon */
      if (b.lit > 0.72) {
        ctx.globalAlpha = Kit.reducedMotion() ? 0.7 : 0.4 + 0.5 * Math.abs(Math.sin(performance.now() / 700 + b.lit * 9));
        ctx.fillStyle = '#FF6B5C';
        ctx.fillRect(bx + bw / 2 - 1.5, horizon - bh - 5, 3, 5);
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawPoles(ctx, gg, hz, gy) {
    const first = POLE_GAP - (dist % POLE_GAP);
    for (let i = 4; i >= 0; i--) {
      const z = first + i * POLE_GAP;
      if (z > DRAW_DIST || z < 60) continue;
      drawString(ctx, gg, z - POLE_GAP, z, hz, gy);
      drawPole(ctx, z, hz, gy);
    }
  }

  function drawPole(ctx, z, hz, gy) {
    const { w } = W;
    const s = persp(z);
    const gyl = hz + (gy - hz) * s;
    const topY = gyl - 340 * PYU * s;
    for (const side of [-1, 1]) {
      const x = w / 2 + side * 1.98 * LANE_W * PXU * s;
      ctx.strokeStyle = '#2B2449';
      ctx.lineWidth = Math.max(1, 14 * PXU * s);
      ctx.beginPath(); ctx.moveTo(x, gyl); ctx.lineTo(x, topY); ctx.stroke();
      ctx.lineWidth = Math.max(1, 8 * PXU * s);
      ctx.beginPath();
      ctx.moveTo(x - 40 * PXU * s, topY + 10 * PYU * s);
      ctx.lineTo(x + 40 * PXU * s, topY + 10 * PYU * s);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,184,77,0.85)';
      ctx.beginPath();
      ctx.arc(x, topY + 18 * PYU * s, Math.max(1.2, 5 * PXU * s), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawString(ctx, gg, zA, zB, hz, gy) {
    const { w } = W;
    const z0 = Math.max(zA, 50);
    if (z0 >= zB) return;
    for (const side of [-1, 1]) {
      ctx.strokeStyle = 'rgba(255,217,160,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = 0; k <= 6; k++) {
        const t = k / 6;
        const s = persp(z0 + (zB - z0) * t);
        const x = w / 2 + side * 1.98 * LANE_W * PXU * s;
        const y = hz + (gy - hz) * s - 340 * PYU * s + Math.sin(Math.PI * t) * 70 * PYU * s + 22 * PYU * s;
        k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
      for (let k = 1; k < 6; k++) {
        const t = k / 6;
        const s = persp(z0 + (zB - z0) * t);
        const x = w / 2 + side * 1.98 * LANE_W * PXU * s;
        const y = hz + (gy - hz) * s - 340 * PYU * s + Math.sin(Math.PI * t) * 70 * PYU * s + 26 * PYU * s;
        ctx.globalAlpha = 0.5 + 0.4 * Math.sin(gg.t * 2.2 + k * 1.7 + side);
        ctx.fillStyle = '#FFD9A0';
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.8, 3.4 * PXU * s), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  /* ---------------- sprite render ---------------- */
  function drawSprite(ctx, sp, gg) {
    const { w, h } = W;
    const o = sp.o, dz = sp.dz;
    const s = persp(Math.max(dz, 1));
    const baseY = h * HZ + (h * GY - h * HZ) * s;
    const x = w / 2 + o.lane * LANE_W * PXU * s;
    if (o.kind === 'crate') drawCrate(ctx, x, baseY, s);
    else if (o.kind === 'gantry') drawGantry(ctx, gg, s, baseY);
    else if (o.kind === 'drone') drawDrone(ctx, gg, o, x, baseY, s);
    else if (o.kind === 'train') drawTrain(ctx, gg, o, s, baseY, dz);
    else if (o.kind === 'ticket') drawTicket(ctx, gg, o, x, baseY, s);
    else if (o.kind === 'boost') drawBoostPad(ctx, gg, o, s, baseY);
  }

  function drawCrate(ctx, x, y, s) {
    const cw = 205 * PXU * s, ch = CRATE_H * PYU * s;
    if (ch < 3) return;
    ctx.fillStyle = '#3B3358';
    roundedPath(ctx, x - cw / 2, y - ch, cw, ch, Math.max(1, 4 * s));
    ctx.fill();
    ctx.save();
    roundedPath(ctx, x - cw / 2, y - ch, cw, ch, Math.max(1, 4 * s));
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,184,77,0.75)';
    ctx.lineWidth = Math.max(1, ch * 0.16);
    for (let i = -1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(x - cw / 2 + i * cw * 0.34, y);
      ctx.lineTo(x - cw / 2 + i * cw * 0.34 + ch * 0.7, y - ch);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(12,9,24,0.8)';
    ctx.lineWidth = Math.max(1, 2 * s);
    roundedPath(ctx, x - cw / 2, y - ch, cw, ch, Math.max(1, 4 * s));
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,224,174,0.5)';
    ctx.fillRect(x - cw / 2, y - ch, cw, Math.max(1, 2.2 * s));
  }

  function drawGantry(ctx, gg, s, baseY) {
    const { w } = W;
    const postH = 210 * PYU * s;
    if (postH < 4) return;
    const barY = baseY - GANTRY_H * PYU * s;
    const xL = w / 2 - 1.72 * LANE_W * PXU * s, xR = w / 2 + 1.72 * LANE_W * PXU * s;
    const pw = Math.max(2, 10 * PXU * s);
    ctx.fillStyle = '#241E40';
    ctx.fillRect(xL - pw / 2, baseY - postH, pw, postH);
    ctx.fillRect(xR - pw / 2, baseY - postH, pw, postH);
    const barH = Math.max(2, 26 * PYU * s);
    ctx.fillStyle = '#2E2750';
    ctx.fillRect(xL, barY - barH / 2, xR - xL, barH);
    ctx.save();
    ctx.beginPath();
    ctx.rect(xL, barY - barH / 2, xR - xL, barH);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,184,77,0.55)';
    ctx.lineWidth = Math.max(1, barH * 0.5);
    for (let i = 0; i < 8; i++) {
      const sx = xL + i * (xR - xL) / 7;
      ctx.beginPath();
      ctx.moveTo(sx, barY + barH);
      ctx.lineTo(sx + barH, barY - barH);
      ctx.stroke();
    }
    ctx.restore();
    const blink = Math.sin(gg.t * 9) > 0;
    for (const lx of [xL + (xR - xL) * 0.3, xL + (xR - xL) * 0.7]) {
      ctx.fillStyle = blink ? '#FF5C4C' : 'rgba(255,92,76,0.25)';
      ctx.beginPath();
      ctx.arc(lx, barY - barH - 8 * PYU * s, Math.max(1.5, 8 * PXU * s), 0, Math.PI * 2);
      ctx.fill();
    }
    /* clearance line hinting the slide path */
    ctx.strokeStyle = 'rgba(107,208,255,0.35)';
    ctx.lineWidth = Math.max(1, 2 * s);
    ctx.beginPath();
    ctx.moveTo(xL, barY + barH / 2 + 2);
    ctx.lineTo(xR, barY + barH / 2 + 2);
    ctx.stroke();
  }

  function drawDrone(ctx, gg, o, x, baseY, s) {
    const bob = Math.sin(gg.t * 3.1 + o.ph) * 12;
    const dw = 150 * PXU * s, dh = 52 * PYU * s;
    if (dw < 4) return;
    const y = baseY - (DRONE_H + bob) * PYU * s;
    ctx.fillStyle = 'rgba(8,6,18,0.3)';
    ctx.beginPath();
    ctx.ellipse(x, baseY, dw * 0.42, dw * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#241E40';
    ctx.lineWidth = Math.max(1, 5 * PXU * s);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + side * dw * 0.55, y - dh * 0.2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(200,210,255,0.28)';
      ctx.beginPath();
      ctx.ellipse(x + side * dw * 0.55, y - dh * 0.28, dw * 0.26, dh * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#1C1734';
    roundedPath(ctx, x - dw * 0.34, y - dh * 0.5, dw * 0.68, dh, dh * 0.4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,184,77,0.5)';
    ctx.lineWidth = Math.max(1, 1.5 * s);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,184,77,0.25)';
    ctx.beginPath();
    ctx.arc(x, y + dh * 0.1, Math.max(2.5, dw * 0.18), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFB84D';
    ctx.beginPath();
    ctx.arc(x, y + dh * 0.1, Math.max(1.4, dw * 0.09), 0, Math.PI * 2);
    ctx.fill();
  }

  function drawTrain(ctx, gg, o, s, baseY, dz) {
    const { w, h } = W;
    const hz = h * HZ, gy = h * GY;
    const s2 = persp(Math.max(dz + TRAIN_LEN, 1));
    const baseY2 = hz + (gy - hz) * s2;
    const x = w / 2 + o.lane * LANE_W * PXU * s;
    const x2 = w / 2 + o.lane * LANE_W * PXU * s2;
    const tw = 258 * PXU * s, tw2 = 258 * PXU * s2;
    if (tw < 5) return;
    const th = 268 * PYU * s, th2 = 268 * PYU * s2;
    /* roof receding away from the viewer */
    ctx.fillStyle = '#221C3E';
    ctx.beginPath();
    ctx.moveTo(x - tw / 2, baseY - th);
    ctx.lineTo(x + tw / 2, baseY - th);
    ctx.lineTo(x2 + tw2 / 2, baseY2 - th2);
    ctx.lineTo(x2 - tw2 / 2, baseY2 - th2);
    ctx.closePath();
    ctx.fill();
    /* front face */
    ctx.fillStyle = '#5A2B44';
    roundedPath(ctx, x - tw / 2, baseY - th, tw, th, Math.max(2, 10 * PXU * s));
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,184,77,0.4)';
    ctx.lineWidth = Math.max(1, 2 * s);
    ctx.stroke();
    ctx.fillStyle = '#171331';
    ctx.fillRect(x - tw * 0.36, baseY - th + th * 0.12, tw * 0.72, th * 0.22);
    ctx.fillStyle = '#FFB84D';
    ctx.fillRect(x - tw * 0.44, baseY - th * 0.42, tw * 0.88, Math.max(1.5, th * 0.05));
    const hl = th * 0.16;
    for (const side of [-1, 1]) {
      ctx.fillStyle = '#FFE0AE';
      ctx.beginPath();
      ctx.arc(x + side * tw * 0.3, baseY - th * 0.18, Math.max(1.5, hl * 0.35), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,210,140,0.1)';
      ctx.beginPath();
      ctx.moveTo(x + side * tw * 0.3, baseY - th * 0.18);
      ctx.lineTo(x + side * tw * 0.75, baseY + 4);
      ctx.lineTo(x + side * tw * 0.1, baseY + 4);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawWarnings(ctx, gg, hz, gy) {
    const { w } = W;
    ctx.textAlign = 'center';
    for (const o of obstacles) {
      if (o.kind !== 'train') continue;
      const eta = (o.z - dist) / (speed + TRAIN_SPEED);
      if (eta > 1.25 || o.z - dist < 0) continue;
      const s = persp(WARN_D);
      const x = w / 2 + o.lane * LANE_W * PXU * s;
      const y = hz + (gy - hz) * s - 120 * PYU * s;
      const a = 0.55 + 0.45 * Math.sin(gg.t * 11);
      const r = Math.max(6, 26 * PXU * s);
      ctx.fillStyle = `rgba(255,184,77,${0.25 * a})`;
      ctx.beginPath();
      ctx.arc(x, y, r * 1.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,184,77,${a})`;
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r * 0.9, y + r * 0.7);
      ctx.lineTo(x - r * 0.9, y + r * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#131120';
      ctx.font = `900 ${Math.round(r * 1.2)}px 'Trebuchet MS', sans-serif`;
      ctx.fillText('!', x, y + r * 0.55);
    }
  }

  function drawTicket(ctx, gg, o, x, baseY, s) {
    const tw = 64 * PXU * s, thh = 42 * PYU * s;
    if (tw < 2.5) return;
    const bob = Math.sin(gg.t * 3.4 + o.ph) * 8 * PYU * s;
    const y = baseY - o.y * PYU * s + bob;
    const spin = 0.3 + 0.7 * Math.abs(Math.cos(gg.t * 2.6 + o.ph));
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(spin, 1);
    ctx.shadowColor = '#FFB84D';
    ctx.shadowBlur = 10 * s;
    ctx.fillStyle = '#FFB84D';
    roundedPath(ctx, -tw / 2, -thh / 2, tw, thh, thh * 0.22);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#131120';
    ctx.fillRect(-tw * 0.18, -thh * 0.32, Math.max(1, 3 * s), thh * 0.64);
    ctx.fillStyle = 'rgba(19,17,32,0.55)';
    ctx.fillRect(tw * 0.12, -thh * 0.14, tw * 0.3, Math.max(1, thh * 0.16));
    ctx.restore();
  }

  function drawBoostPad(ctx, gg, o, s, baseY) {
    const { w } = W;
    const x = w / 2 + o.lane * LANE_W * PXU * s;
    const pw = 200 * PXU * s, pl = 150 * PYU * s;
    if (pw < 4) return;
    ctx.fillStyle = 'rgba(107,208,255,0.16)';
    ctx.fillRect(x - pw / 2, baseY - pl, pw, pl);
    for (let k = 0; k < 3; k++) {
      const t = (gg.t * 1.6 + k / 3) % 1;
      const cy = baseY - t * pl;
      ctx.strokeStyle = `rgba(107,208,255,${0.75 * Math.sin(t * Math.PI)})`;
      ctx.lineWidth = Math.max(1.5, 6 * PXU * s);
      ctx.beginPath();
      ctx.moveTo(x - pw * 0.3, cy - pl * 0.12);
      ctx.lineTo(x, cy);
      ctx.lineTo(x + pw * 0.3, cy - pl * 0.12);
      ctx.stroke();
    }
  }

  /* ---------------- player ---------------- */
  function drawPlayer(ctx, gg) {
    const { w, h } = W;
    const gy = h * GY;
    const x = w / 2 + laneX * LANE_W * PXU;
    const py = playerY();
    const slide = slideT > 0;
    const air = jumpT >= 0;
    const PH = h * (slide ? 0.1 : 0.168);

    /* shadow shrinks with height */
    const shK = 1 - Kit.clamp(py / JUMP_H, 0, 1) * 0.65;
    ctx.fillStyle = `rgba(6,4,14,${0.42 * shK})`;
    ctx.beginPath();
    ctx.ellipse(x, gy + 3, PH * (0.3 * shK + 0.08), PH * 0.075, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(x, gy - py * PYU);
    if (state === 'crashing') {
      ctx.rotate(crashSpin * 1.4);
    } else {
      ctx.rotate((laneTarget - laneX) * 0.13);
      const sq = landT * 0.9;
      ctx.scale(1 + sq * 0.45, 1 - sq * 0.55);
    }

    /* legs: alternating stubs on the run phase */
    const swing = air ? 0 : Math.sin(runPhase);
    const swing2 = air ? 0 : Math.sin(runPhase + Math.PI);
    const legW = PH * 0.11, legTop = -PH * 0.36;
    const legPairs = air ? [[-1, PH * 0.1], [1, PH * 0.16]]
      : slide ? [[-1, 0], [1, 0]]
        : [[-1, Math.max(0, swing) * PH * 0.2], [1, Math.max(0, swing2) * PH * 0.2]];
    for (const [side, lift] of legPairs) {
      const lx = side * PH * 0.09 + (slide ? side * PH * 0.1 : 0);
      const lh = Math.max(2, -legTop - lift);
      ctx.fillStyle = '#221D38';
      roundedPath(ctx, lx - legW / 2, legTop + lift, legW, lh, legW * 0.45);
      ctx.fill();
      ctx.fillStyle = '#FFB84D';
      roundedPath(ctx, lx - legW / 2 + (slide ? side * PH * 0.06 : 0), legTop + lift + lh - legW * 0.5, legW * 1.15, legW * 0.5, legW * 0.24);
      ctx.fill();
    }

    /* hoodie torso */
    const tw = PH * 0.46, th = PH * 0.44, ty = -PH * 0.82;
    ctx.fillStyle = '#FFB84D';
    roundedPath(ctx, -tw / 2, ty, tw, th + PH * 0.06, PH * 0.1);
    ctx.fill();
    ctx.fillStyle = 'rgba(150,90,20,0.28)';
    roundedPath(ctx, tw * 0.16, ty, tw * 0.34, th + PH * 0.06, PH * 0.09);
    ctx.fill();
    ctx.fillStyle = '#D08F33';
    ctx.fillRect(-tw / 2, ty + th - PH * 0.02, tw, PH * 0.05);

    /* backpack */
    ctx.fillStyle = '#3D76B8';
    roundedPath(ctx, -PH * 0.15, ty + PH * 0.06, PH * 0.3, PH * 0.3, PH * 0.06);
    ctx.fill();
    ctx.fillStyle = '#6BD0FF';
    roundedPath(ctx, -PH * 0.09, ty + PH * 0.14, PH * 0.18, PH * 0.14, PH * 0.04);
    ctx.fill();

    /* arms swinging against the legs */
    if (!slide) {
      for (const [side, sw] of [[-1, air ? -0.5 : swing2], [1, air ? -0.5 : swing]]) {
        ctx.fillStyle = '#E8A23C';
        const ax = side * (tw / 2 + PH * 0.015);
        const ay = ty + PH * 0.08 - Math.max(0, sw) * PH * 0.1;
        roundedPath(ctx, ax - PH * 0.04, ay, PH * 0.08, PH * 0.24, PH * 0.04);
        ctx.fill();
      }
    }

    /* hood seen from behind */
    ctx.fillStyle = '#FFB84D';
    ctx.beginPath();
    ctx.arc(0, ty - PH * 0.09, PH * 0.155, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#D08F33';
    ctx.lineWidth = Math.max(1, PH * 0.02);
    ctx.beginPath();
    ctx.arc(0, ty - PH * 0.09, PH * 0.155, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(150,90,20,0.4)';
    ctx.beginPath();
    ctx.moveTo(0, ty - PH * 0.235);
    ctx.lineTo(0, ty - PH * 0.02);
    ctx.stroke();

    /* invincibility shimmer while boosted */
    if (boostT > 0 && state === 'run') {
      const pl = 0.5 + 0.5 * Math.sin(gg.t * 11);
      ctx.strokeStyle = `rgba(107,208,255,${0.3 + 0.35 * pl})`;
      ctx.lineWidth = Math.max(2, PH * 0.03);
      ctx.beginPath();
      ctx.ellipse(0, -PH * 0.5, PH * 0.46, PH * 0.62, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------------- floating score text ---------------- */
  function addFloat(txt, x, y, color) {
    if (floats.length > 8) floats.shift();
    floats.push({ txt, x, y, color, life: 1 });
  }

  function drawFloats(ctx) {
    const h = W.h;
    ctx.textAlign = 'center';
    ctx.font = `800 ${Math.round(h * 0.032)}px 'Trebuchet MS', sans-serif`;
    for (const f of floats) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life * 1.6));
      ctx.strokeStyle = 'rgba(10,8,20,0.8)';
      ctx.lineWidth = 4;
      ctx.strokeText(f.txt, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.txt, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  function roundedPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ---------------- HUD ---------------- */
  let hudEls = null;
  function buildHUD() {
    const hud = document.getElementById('hud');
    hud.innerHTML = `
      <div class="hud-top">
        <div class="chip dist-chip"><small>Distance</small><b id="hw-dist">0</b> m</div>
        <div class="chip tix-chip"><small>Tickets</small><b id="hw-tix">0</b></div>
        <div class="chip speed-chip"><small>Speed</small><b id="hw-speed">0</b> km/h</div>
      </div>
      <div class="hud-missions">${missions.map((m, i) =>
        `<div class="mchip" id="mw${i}"><small>${m.short}</small><b>0/${m.need}</b></div>`).join('')}</div>`;
    hudEls = {
      dist: document.getElementById('hw-dist'),
      tix: document.getElementById('hw-tix'),
      speed: document.getElementById('hw-speed'),
      chips: missions.map((m, i) => document.getElementById('mw' + i))
    };
  }
  function updateHUD() {
    if (!hudEls || state === 'attract') return;
    hudEls.dist.textContent = Kit.fmt(Math.floor(dist / UNITS_M));
    hudEls.tix.textContent = tickets;
    hudEls.speed.textContent = Math.round(speed * 0.257);
    missions.forEach((m, i) => {
      const el = hudEls.chips[i];
      if (!el) return;
      el.classList.toggle('done', m.done);
      el.querySelector('b').textContent = `${Math.min(m.got, m.need)}/${m.need}`;
    });
  }

  /* ---------------- touch: swipe + tap-to-jump ----------------
     The shell mounts an empty touchui, but the canvas is what
     actually sits under the thumb — bind here so the topbar
     buttons above stay untouched. */
  function bindGestures() {
    const el = document.getElementById('stage');
    let sx = 0, sy = 0, st = 0, live = false;
    el.addEventListener('touchstart', e => {
      const t = e.changedTouches[0];
      sx = t.clientX; sy = t.clientY;
      st = performance.now();
      live = true;
    }, { passive: true });
    el.addEventListener('touchend', e => {
      if (!live) return;
      live = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - sx, dy = t.clientY - sy;
      const adx = Math.abs(dx), ady = Math.abs(dy);
      if (Math.max(adx, ady) > 28) {
        gesture(adx > ady ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
      } else if (performance.now() - st < 350) {
        gesture('tap');
      }
    }, { passive: true });
  }

  function gesture(dir) {
    if (state !== 'run') return;
    if (dir === 'left') moveLane(-1);
    else if (dir === 'right') moveLane(1);
    else if (dir === 'up' || dir === 'tap') doJump();
    else doSlide();
  }

  /* ---------------- songs ---------------- */
  /* steps are token arrays so playStep resolves real pitches:
     'A2' = note, '.' = rest, '-' = sustain, 'a' = drum accent */
  Audio.defineSong('menu', {
    bpm: 110,
    bars: 2,
    layers: [
      { type: 'pad', wave: 'sawtooth', steps: ['A2', '-', '-', '-', '-', '-', '-', '-', 'F2', '-', '-', '-', '-', '-', '-', '-', 'C3', '-', '-', '-', '-', '-', '-', '-', 'G2', '-', '-', '-', '-', '-', '-', '-'], gain: 0.14, cutoff: 950, attack: 0.5, release: 1.6 },
      { type: 'bass', wave: 'triangle', steps: ['A1', '.', '.', '.', '.', '.', '.', '.', 'F1', '.', '.', '.', '.', '.', '.', '.', 'C2', '.', '.', '.', '.', '.', '.', '.', 'G1', '.', '.', '.', 'E1', '.', '.', '.'], gain: 0.26 },
      { type: 'arp', wave: 'square', steps: ['A3', '.', 'C4', '.', 'E4', '.', 'C4', '.', 'F3', '.', 'A3', '.', 'C4', '.', 'A3', '.', 'C4', '.', 'E4', '.', 'G4', '.', 'E4', '.', 'G3', '.', 'B3', '.', 'D4', '.', 'B3', '.'], gain: 0.08, cutoff: 2100 },
      { type: 'hat', steps: ['.', '.', 'a', '.', '.', '.', 'a', '.', '.', '.', 'a', '.', '.', '.', 'a', 'a', '.', '.', 'a', '.', '.', '.', 'a', '.', '.', '.', 'a', '.', '.', '.', 'a', '.'], gain: 0.08 }
    ]
  });
  Audio.defineSong('run', {
    bpm: 126,
    bars: 2,
    layers: [
      { type: 'bass', wave: 'sawtooth', steps: ['A1', '.', '.', '.', 'C2', '.', '.', '.', 'D2', '.', '.', '.', 'E2', '.', '.', '.', 'F2', '.', '.', '.', 'E2', '.', '.', '.', 'D2', '.', '.', '.', 'C2', '.', 'B1', '.'], gain: 0.26, cutoff: 720 },
      { type: 'kick', steps: ['a', '.', '.', '.', 'a', '.', '.', '.', 'a', '.', '.', '.', 'a', '.', '.', '.', 'a', '.', '.', '.', 'a', '.', '.', '.', 'a', '.', '.', '.', 'a', '.', 'a', '.'], gain: 0.6 },
      { type: 'snare', steps: ['.', '.', '.', '.', 'a', '.', '.', '.', '.', '.', '.', '.', 'a', '.', '.', '.', '.', '.', '.', '.', 'a', '.', '.', '.', '.', '.', '.', '.', 'a', '.', '.', '.'], gain: 0.42 },
      { type: 'hat', steps: ['.', '.', 'a', '.', '.', '.', 'a', '.', '.', '.', 'a', '.', '.', '.', 'a', 'a', '.', '.', 'a', '.', '.', '.', 'a', '.', '.', '.', 'a', '.', '.', '.', 'a', 'a'], gain: 0.13 },
      { type: 'arp', wave: 'square', steps: ['A3', '.', 'C4', '.', 'E4', '.', 'C4', '.', 'A3', '.', 'C4', '.', 'E4', '.', 'G4', '.', 'F3', '.', 'A3', '.', 'C4', '.', 'A3', '.', 'G3', '.', 'B3', '.', 'D4', '.', 'B3', '.'], gain: 0.1, cutoff: 2500 },
      { type: 'lead', wave: 'sawtooth', steps: ['.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', 'A4', '.', '.', 'G4', '.', 'A4', '.', '.', 'C5', '.', '.', 'G4', '.', 'E4', '.', '.'], gain: 0.13, cutoff: 2600, intensity: true }
    ]
  });

  /* ---------------- shell wiring ---------------- */
  window.GAME = {
    id: 'metro-dash',
    brand: 'METRO DASH',
    kicker: 'Last Train Out',
    title: 'METRO <em>DASH</em>',
    tagline: 'The last metro left forty seconds ago — take the rooftops, outrun the timetable and get there before the doors close.',
    best: { key: 'metro.best', display: Kit.fmt },
    controls: [
      { key: '← → / A D', text: '<b>Switch lanes.</b> Three tracks run the viaduct. On touch, swipe left or right anywhere on the scene.' },
      { key: '↑ / Space', text: '<b>Jump.</b> Clears barrier crates and the roof gaps between train cars. Swipe up — or just tap — works too.' },
      { key: '↓ / S', text: '<b>Slide.</b> Signal gantries and maintenance drones sit at torso height: slide under them or change lanes. Swipe down.' },
      { key: 'Tickets', text: '<b>Collect transit tickets</b> for +10 each — they drift toward you when you pass close. Sky-blue boost pads surge your speed for 2 seconds behind an invincibility shimmer.' },
      { key: 'Missions', text: '<b>Three objectives per run</b> — tickets, close calls, drone dodges or distance. Each one pays +150 and Ziggy always has a comment.' },
      { key: 'Near-miss', text: '<b>Graze an obstacle</b> without touching it for a CLOSE! +25 bonus and a beat of slow-mo. Crashing into anything else ends the run.' }
    ],
    touch: { joy: false, buttons: [] },
    mascot: {
      name: 'Ziggy — fellow commuter',
      accent: '#FFB84D',
      lines: {
        welcome: ['Ziggy! You made the last train... mostly. Roof route is faster anyway.', 'Welcome aboard the roof deck. Watch the gantries, they do not watch you.'],
        return: ['Tickets are collected, legs are stretched. Run it back?', 'The 23:40 just left without us. As usual.'],
        start: ['Go go go — the gap at Carlson Street opens in ten!', 'Legs warm? Good. Fly.'],
        mission: ['Mission done! That one pays for dinner.', 'Objective cleared — keep the streak.'],
        nearmiss: ['CLOSE one! My heart rate spiked for you.', 'That drone clipped your hood. Insane.'],
        milestone: ['Thousand meters! The skyline is yours.', 'You are outrunning the timetable now.'],
        win: ['What a run — every mission and then some.', 'The drivers are telling stories about you already.'],
        fail: ['Rough landing. The metro waits for no one... but we do.', 'Crash and burn. Same rooftops tomorrow?']
      },
      cooldowns: { mission: 8000, nearmiss: 5000, milestone: 15000 }
    },
    learn: {
      intro: window.LEARN_DATA.intro,
      banks: window.LEARN_DATA.banks
    },
    menuSong: 'menu',
    gameSong: 'run',
    onStart() { startRun(); G.resume(); Kit.showScreen('hud'); },
    onRestart() { startRun(); G.resume(); },
    onPause() { G.pause(); Audio.stopLoop('wind'); Audio.stopSong({ fade: 0.15 }); Audio.duck(400); },
    onResume() {
      if (state === 'run' || state === 'crashing') {
        G.resume();
        Audio.playSong('run');
        Audio.loop('wind', { wave: 'sawtooth', freq: 90, maxFreq: 380, cutoff: 480, gain: 0.05 });
      }
    },
    onQuit() { G.stop(); Audio.stopLoop('wind'); toAttract(); G.start(); }
  };

  /* ---------------- boot ---------------- */
  const canvas = document.getElementById('stage');
  G = Kit.game({
    canvas,
    onResize(dim) {
      W.w = dim.w; W.h = dim.h;
      PXU = dim.w * 0.00077;
      PYU = dim.h * 0.00145;
      skyGrad = null; sunGlow = null; hazeGrad = null; deckGrad = null;
      railAmber = null; railSky = null; vignette = null;
    },
    update,
    render
  });

  buildScenery();
  toAttract();
  bindGestures();
  G.start();

})();
