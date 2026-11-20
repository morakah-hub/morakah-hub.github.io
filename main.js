/* Star field behind the whole page. Scrolling down flies the camera forward through it,
   scrolling up flies it back, and it drifts slowly on its own. */
(() => {
  const canvas = document.getElementById("space");
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext("2d");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let W = 0, H = 0, dpr = 1, f = 1, stars = [];
  const COLORS = ["232,237,244", "232,237,244", "232,237,244", "232,237,244", "143,220,255", "143,220,255", "255,196,154"];

  function layout() {
    W = window.innerWidth; H = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    f = Math.min(W, H) * 0.5;
    const n = Math.round(Math.min(1500, Math.max(380, (W * H) / 950)));
    const ax = (0.62 * W) / f, ay = (0.62 * H) / f;
    stars = Array.from({ length: n }, () => ({
      x: (Math.random() * 2 - 1) * ax,
      y: (Math.random() * 2 - 1) * ay,
      z: Math.random(),
      tw: Math.random() * Math.PI * 2,
      c: COLORS[(Math.random() * COLORS.length) | 0]
    }));
  }

  let cam = 0, lastCam = 0, lastT = 0, drift = 0;
  const scrollCam = () => window.scrollY / 1600;

  function draw(t) {
    const dt = lastT ? Math.min((t - lastT) / 1000, 0.05) : 0;
    lastT = t;
    if (!reduceMotion) drift += dt * 0.018;
    cam = drift + scrollCam();
    const dCam = cam - lastCam;
    lastCam = cam;
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H * 0.42;
    for (const s of stars) {
      let zr = (((s.z - cam) % 1) + 1) % 1;
      if (zr < 0.015) continue;
      const k = f / zr;
      const x = cx + s.x * k, y = cy + s.y * k;
      if (x < -20 || x > W + 20 || y < -20 || y > H + 20) continue;
      const near = 1 - zr;
      const a = Math.min(1, 0.42 + near * 0.75) * (0.65 + 0.35 * Math.sin(t / 700 + s.tw));
      const size = 1 + near * near * 2.6;
      const zp = zr + dCam;
      if (Math.abs(dCam) > 0.0008 && zp > 0.015 && zp < 1) {
        const kp = f / zp;
        ctx.strokeStyle = `rgba(${s.c},${a})`;
        ctx.lineWidth = size;
        ctx.beginPath(); ctx.moveTo(cx + s.x * kp, cy + s.y * kp); ctx.lineTo(x, y); ctx.stroke();
      } else {
        ctx.fillStyle = `rgba(${s.c},${a})`;
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
      }
    }
  }

  let raf = 0, running = false;
  function loop(t) { if (!running) return; draw(t); raf = requestAnimationFrame(loop); }
  function start() { if (running || document.hidden) return; running = true; lastT = 0; raf = requestAnimationFrame(loop); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  layout();
  lastCam = scrollCam();
  if (reduceMotion) {
    draw(0);
    window.addEventListener("resize", () => { layout(); draw(0); });
    return;
  }
  start();
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  let rt = 0;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(layout, 150); });
})();

/* Hero: a pixel-art robot arm holds a wing in the airflow and slowly pitches it.
   The flow is potential flow past a Joukowski airfoil: a circle mapped by z = zeta + 1/zeta,
   with circulation from the Kutta condition. The angle of attack follows the arm, so the
   streamlines change as the wing pitches. Brighter streaks are faster air. */
(() => {
  const flowCanvas = document.getElementById("flow");
  const rigCanvas = document.getElementById("rig");
  if (!flowCanvas || !rigCanvas || !flowCanvas.getContext) return;
  const fctx = flowCanvas.getContext("2d");
  const rctx = rigCanvas.getContext("2d");
  const hero = flowCanvas.parentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- complex math ----
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
  const div = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
  const abs = (a) => Math.hypot(a[0], a[1]);
  const csqrt = (a) => { const r = abs(a); return [Math.sqrt((r + a[0]) / 2), Math.sign(a[1] || 1) * Math.sqrt(Math.max(0, (r - a[0]) / 2))]; };
  const expi = (t) => [Math.cos(t), Math.sin(t)];

  const eps = 0.085, del = 0.055;
  const mu = [-eps, del];
  const R = abs(sub([1, 0], mu));
  const beta = Math.asin(del / R);
  let alpha = 0, eNegA, ePosA, R2eA, circ;
  function setAlpha(a) {
    alpha = a; eNegA = expi(-a); ePosA = expi(a);
    R2eA = [R * R * ePosA[0], R * R * ePosA[1]];
    circ = [0, 2 * R * Math.sin(a + beta)];
  }
  // angle of attack over time: eases between about 1 and 11 degrees
  const alphaAt = (t) => ((6 + 5 * Math.sin((t / 9) * Math.PI * 2)) * Math.PI) / 180;

  function zetaOf(z) {
    const r = csqrt(sub(mul(z, z), [4, 0]));
    const z1 = [(z[0] + r[0]) / 2, (z[1] + r[1]) / 2], z2 = [(z[0] - r[0]) / 2, (z[1] - r[1]) / 2];
    const d1 = abs(sub(z1, mu)), d2 = abs(sub(z2, mu));
    return Math.max(d1, d2) >= R * 1.0005 ? (d1 >= d2 ? z1 : z2) : null;
  }
  function velocity(z) {
    const zeta = zetaOf(z);
    if (!zeta) return null;
    const zp = sub(zeta, mu);
    const dWdzeta = add(sub(eNegA, div(R2eA, mul(zp, zp))), div(circ, zp));
    const dzdzeta = sub([1, 0], div([1, 0], mul(zeta, zeta)));
    if (abs(dzdzeta) < 1e-3) return null;
    return div(dWdzeta, dzdzeta);
  }
  const outline = [];
  for (let i = 0; i <= 180; i++) {
    const t = (i / 180) * Math.PI * 2;
    const zeta = add(mu, [R * Math.cos(t), R * Math.sin(t)]);
    outline.push(add(zeta, div([1, 0], zeta)));
  }

  // ---- layout ----
  let W = 0, H = 0, dpr = 1, cx = 0, cy = 0, s = 1, P = 3;
  let particles = [];
  let arm = null;  // pixel-art geometry in screen px
  const STEP = 2.1;

  const toScreen = (z) => { const zr = mul(z, eNegA); return [cx + s * zr[0], cy - s * zr[1]]; };
  const toWorld = (x, y) => mul([(x - cx) / s, -(y - cy) / s], ePosA);

  function layout() {
    const r = hero.getBoundingClientRect();
    W = r.width; H = r.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    [flowCanvas, rigCanvas].forEach((c) => { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); });
    fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (W >= 900) {
      s = Math.min(W * 0.082, (H * 0.6 - 24) / 2.95);
      cx = W * 0.71; cy = H * 0.4; P = 3;
    } else {
      s = Math.min(W * 0.15, 70);
      cx = W * 0.47; cy = H - 8 - 2.95 * s; P = 2;
    }
    const floorY = cy + 2.95 * s;
    const L = 1.3 * s;
    arm = {
      floorY, L1: L, L2: L,
      base: [cx + 1.15 * s, floorY - 0.5 * s],   // shoulder joint, on top of the pedestal
      rod: 0.95 * s
    };
    // pixel buffer covering the arm's reach
    const x0 = cx - 0.6 * s, x1 = arm.base[0] + 2 * L + 20;
    const y0 = cy - 0.6 * s, y1 = floorY + 6;
    arm.x0 = x0; arm.y0 = y0;
    arm.bw = Math.ceil((x1 - x0) / P); arm.bh = Math.ceil((y1 - y0) / P);
    arm.off = document.createElement("canvas");
    arm.off.width = arm.bw; arm.off.height = arm.bh;
    arm.octx = arm.off.getContext("2d");
    arm.img = arm.octx.createImageData(arm.bw, arm.bh);
    arm.buf = new Uint32Array(arm.img.data.buffer);
    const n = Math.round(Math.min(1100, Math.max(260, (W * H) / 1300)));
    particles = Array.from({ length: n }, () => spawn(true));
  }
  const spawn = (anywhere) => ({ x: anywhere ? Math.random() * W : -10 - Math.random() * 40, y: Math.random() * H, life: 0 });

  // ---- flow particles ----
  const bins = [
    { max: 0.92, color: "rgba(141, 154, 176, 0.30)", width: 1 },
    { max: 1.22, color: "rgba(143, 220, 255, 0.42)", width: 1 },
    { max: Infinity, color: "rgba(196, 238, 255, 0.85)", width: 1.3 }
  ];
  const paths = bins.map(() => []);
  function advance(p, k) {
    const q = velocity(toWorld(p.x, p.y));
    if (!q || !isFinite(q[0]) || !isFinite(q[1])) return -1;
    let V = mul([q[0], -q[1]], eNegA);
    let sp = abs(V);
    if (sp > 3) { V = [V[0] * 3 / sp, V[1] * 3 / sp]; sp = 3; }
    p.x += STEP * k * V[0]; p.y -= STEP * k * V[1];
    return sp;
  }
  function stepFlow(k) {
    fctx.globalCompositeOperation = "destination-out";
    fctx.fillStyle = "rgba(0, 0, 0, 0.075)";
    fctx.fillRect(0, 0, W, H);
    fctx.globalCompositeOperation = "source-over";
    paths.forEach((a) => (a.length = 0));
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i], x0 = p.x, y0 = p.y;
      const sp = advance(p, k);
      p.life++;
      if (sp < 0 || p.x > W + 20 || p.y < -20 || p.y > H + 20 || p.life > 1400) { particles[i] = spawn(false); continue; }
      paths[sp < bins[0].max ? 0 : sp < bins[1].max ? 1 : 2].push(x0, y0, p.x, p.y);
    }
    bins.forEach((bin, b) => {
      const a = paths[b];
      if (!a.length) return;
      fctx.beginPath();
      for (let j = 0; j < a.length; j += 4) { fctx.moveTo(a[j], a[j + 1]); fctx.lineTo(a[j + 2], a[j + 3]); }
      fctx.strokeStyle = bin.color; fctx.lineWidth = bin.width; fctx.stroke();
    });
  }

  // ---- pixel-art arm ----
  const rgba = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return (255 << 24) | ((n & 255) << 16) | (((n >> 8) & 255) << 8) | (n >> 16);
  };
  const PAL = {
    line: rgba("#050a14"), dark: rgba("#1c2943"), base: rgba("#3b5078"), light: rgba("#7f97c2"),
    shine: rgba("#dfe7f3"), joint: rgba("#c4cfe2"), jointDark: rgba("#6d7f9f"),
    flow: rgba("#8fdcff"), flowDim: rgba("#2b5b74"), flag: rgba("#ff6b4a"), amber: rgba("#ffc49a"), screen: rgba("#0a1a2a")
  };

  function plot(x, y, c) {
    x |= 0; y |= 0;
    if (x >= 0 && y >= 0 && x < arm.bw && y < arm.bh) arm.buf[y * arm.bw + x] = c;
  }
  const B = (pt) => [(pt[0] - arm.x0) / P, (pt[1] - arm.y0) / P];

  // shaded cylinder between a and b (buffer coords), lit from the upper left
  function capsule(a, b, r, cols) {
    const [lineC, darkC, baseC, lightC, shineC] = cols;
    const minX = Math.floor(Math.min(a[0], b[0]) - r - 2), maxX = Math.ceil(Math.max(a[0], b[0]) + r + 2);
    const minY = Math.floor(Math.min(a[1], b[1]) - r - 2), maxY = Math.ceil(Math.max(a[1], b[1]) + r + 2);
    const dx = b[0] - a[0], dy = b[1] - a[1], len2 = dx * dx + dy * dy || 1;
    const len = Math.sqrt(len2);
    let nx = -dy / len, ny = dx / len;
    if (nx + ny > 0) { nx = -nx; ny = -ny; }   // normal pointing toward the light (up-left)
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5, py = y + 0.5;
        let t = ((px - a[0]) * dx + (py - a[1]) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        const qx = px - (a[0] + t * dx), qy = py - (a[1] + t * dy);
        const d = Math.hypot(qx, qy);
        if (d > r + 1) continue;
        if (d > r) { plot(x, y, lineC); continue; }
        const side = (qx * nx + qy * ny) / r;   // +1 toward the light
        plot(x, y, side > 0.62 ? shineC : side > 0.2 ? lightC : side > -0.5 ? baseC : darkC);
      }
    }
  }
  function disc(c, r, col) {
    for (let y = -Math.ceil(r); y <= Math.ceil(r); y++)
      for (let x = -Math.ceil(r); x <= Math.ceil(r); x++)
        if (x * x + y * y <= r * r) plot(c[0] + x, c[1] + y, col);
  }
  function joint(c, r, ledOn) {
    disc(c, r + 1, PAL.line);
    disc(c, r, PAL.jointDark);
    disc([c[0] - 0.6, c[1] - 0.6], r - 1, PAL.joint);
    disc(c, Math.max(1.2, r * 0.42), PAL.line);
    disc(c, Math.max(0.8, r * 0.3), ledOn ? PAL.flow : PAL.flowDim);
    // rivets
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + Math.PI / 4;
      plot(c[0] + Math.cos(a) * (r - 1.6), c[1] + Math.sin(a) * (r - 1.6), PAL.jointDark);
    }
  }
  function rect(x0, y0, w, h, col) {
    for (let y = Math.round(y0); y < Math.round(y0 + h); y++)
      for (let x = Math.round(x0); x < Math.round(x0 + w); x++) plot(x, y, col);
  }

  function ik(base, target) {
    const dx = target[0] - base[0], dy = target[1] - base[1];
    const L1 = arm.L1, L2 = arm.L2;
    const d = Math.min(Math.hypot(dx, dy), L1 + L2 - 1);
    const phi = Math.atan2(dy, dx);
    const a = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
    const e1 = [base[0] + L1 * Math.cos(phi - a), base[1] + L1 * Math.sin(phi - a)];
    const e2 = [base[0] + L1 * Math.cos(phi + a), base[1] + L1 * Math.sin(phi + a)];
    const score = (e) => e[1] - 0.6 * e[0];   // elbow up and out to the right, away from the wing
    return score(e1) < score(e2) ? e1 : e2;
  }

  const history = [];   // angle history for the little screen on the pedestal
  function drawArm(t) {
    arm.buf.fill(0);
    const pivot = [cx, cy];
    const n = [-Math.sin(alpha), Math.cos(alpha)];           // down-normal of the chord
    const wrist = [pivot[0] + n[0] * arm.rod, pivot[1] + n[1] * arm.rod];
    const elbow = ik(arm.base, wrist);
    const S = s / P;                                           // scene scale in buffer px
    const bP = B(arm.base), eP = B(elbow), wP = B(wrist), pP = B(pivot);
    const floor = (arm.floorY - arm.y0) / P;

    // pedestal with hazard band and a little screen showing the angle history
    const pw = 0.62 * S, top = bP[1] + 0.12 * S;
    for (let y = Math.round(top); y < Math.round(floor - 0.12 * S); y++) {
      const u = (y - top) / (floor - top);
      const half = pw * (0.55 + 0.45 * u);
      for (let x = Math.round(bP[0] - half); x <= Math.round(bP[0] + half); x++) {
        const edge = x <= Math.round(bP[0] - half) || x >= Math.round(bP[0] + half);
        const lit = x < bP[0] - half * 0.45;
        let c = edge ? PAL.line : lit ? PAL.light : x > bP[0] + half * 0.55 ? PAL.dark : PAL.base;
        if (!edge && u > 0.72 && u < 0.86) c = ((x + y) >> 1) % 3 === 0 ? PAL.line : PAL.flag;
        plot(x, y, c);
      }
    }
    rect(bP[0] - pw * 1.2, floor - 0.12 * S, pw * 2.4, 0.12 * S + 1, PAL.line);
    rect(bP[0] - pw * 1.2 + 1, floor - 0.12 * S + 1, pw * 2.4 - 2, 0.12 * S - 1, PAL.base);
    rect(bP[0] - pw * 1.2 + 1, floor - 0.12 * S + 1, pw * 2.4 - 2, 1, PAL.light);
    // screen
    const sw = Math.round(pw * 0.95), sh = Math.round(0.2 * S);
    const sx = Math.round(bP[0] - sw / 2), sy = Math.round(top + (floor - top) * 0.3);
    rect(sx - 1, sy - 1, sw + 2, sh + 2, PAL.line);
    rect(sx, sy, sw, sh, PAL.screen);
    for (let i = 0; i < history.length && i < sw; i++) {
      const v = history[history.length - 1 - i];
      plot(sx + sw - 1 - i, sy + sh - 1 - Math.round(((v - 0.5) / 11) * (sh - 1)), i === 0 ? PAL.amber : PAL.flow);
    }

    // cable from pedestal to elbow, sagging a little
    for (let k = 0; k <= 40; k++) {
      const u = k / 40;
      const x = lerp(bP[0] + pw * 0.5, eP[0], u), y = lerp(bP[1] + 0.2 * S, eP[1], u) + Math.sin(u * Math.PI) * 0.18 * S;
      plot(x, y, PAL.line); plot(x + 1, y, PAL.line); plot(x, y - 1, PAL.flowDim);
    }

    const armCols = [PAL.line, PAL.dark, PAL.base, PAL.light, PAL.shine];
    capsule(bP, eP, 0.14 * S, armCols);
    capsule(eP, wP, 0.105 * S, armCols);
    // mount rod up into the wing
    capsule(wP, pP, 0.035 * S + 0.6, [PAL.line, PAL.dark, PAL.jointDark, PAL.joint, PAL.shine]);
    // clamp at the wrist, along the rod
    const cA = [wP[0] - n[0] * 0.02 * S, wP[1] - n[1] * 0.02 * S];
    const cB = [wP[0] - n[0] * 0.22 * S, wP[1] - n[1] * 0.22 * S];
    capsule(cA, cB, 0.075 * S, armCols);
    const blink = Math.floor(t * 2) % 2 === 0;
    joint(eP, 0.15 * S, true);
    joint(bP, 0.2 * S, true);
    joint(wP, 0.1 * S, blink);
    disc([cB[0] + 0.05 * S, cB[1]], 1, blink ? PAL.flag : PAL.dark);

    arm.octx.putImageData(arm.img, 0, 0);
    rctx.imageSmoothingEnabled = false;
    rctx.drawImage(arm.off, arm.x0, arm.y0, arm.bw * P, arm.bh * P);
  }
  const lerp = (a, b, u) => a + (b - a) * u;

  function drawWing() {
    rctx.beginPath();
    outline.forEach((z, i) => { const p = toScreen(z); i ? rctx.lineTo(p[0], p[1]) : rctx.moveTo(p[0], p[1]); });
    rctx.closePath();
    rctx.fillStyle = "#0b1424"; rctx.fill();
    rctx.lineWidth = 1.5; rctx.strokeStyle = "rgba(232, 237, 244, 0.9)"; rctx.stroke();
  }

  function frame(t, k) {
    setAlpha(alphaAt(t));
    if (!history.length || t - history.lastT > 0.12) {
      history.push((alpha * 180) / Math.PI); history.lastT = t;
      if (history.length > 120) history.shift();
    }
    if (k > 0) stepFlow(k);
    rctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rctx.clearRect(0, 0, W, H);
    drawArm(t);
    drawWing();
  }

  function drawStill() {
    setAlpha(alphaAt(2.2));
    fctx.clearRect(0, 0, W, H);
    for (let y = 8; y < H; y += 14) {
      const p = { x: -5, y, life: 0 };
      fctx.beginPath(); fctx.moveTo(p.x, p.y);
      for (let i = 0; i < 2200 && p.x < W + 10; i++) { if (advance(p, 0.6) < 0) break; fctx.lineTo(p.x, p.y); }
      fctx.strokeStyle = "rgba(143, 220, 255, 0.28)"; fctx.lineWidth = 1; fctx.stroke();
    }
    history.lastT = -1;
    frame(2.2, 0);
  }

  let running = false, visible = true, last = 0, raf = 0, clock = 0;
  function loop(now) {
    if (!running) return;
    const dtMs = last ? Math.min(now - last, 50) : 16.67;
    last = now;
    clock += dtMs / 1000;
    frame(clock, dtMs / 16.67);
    raf = requestAnimationFrame(loop);
  }
  function start() { if (running || reduceMotion || !visible || document.hidden) return; running = true; last = 0; raf = requestAnimationFrame(loop); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  function init() {
    layout();
    history.length = 0; history.lastT = -1;
    if (reduceMotion) { drawStill(); return; }
    for (let i = 0; i < 90; i++) { setAlpha(alphaAt(0)); stepFlow(1); }
    frame(clock, 0);
    start();
  }

  let rt = 0, lastW = hero.getBoundingClientRect().width;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      const w = hero.getBoundingClientRect().width;
      if (Math.abs(w - lastW) < 2) return;   // ignore height-only changes (mobile address bar)
      lastW = w; stop(); init();
    }, 150);
  });
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((e) => { visible = e[0].isIntersecting; visible ? start() : stop(); }).observe(hero);
  }
  init();
})();
/* Scroll effects: progress line under the nav, hero drift, and reveals */
(() => {
  const root = document.documentElement;
  const hero = document.querySelector(".hero");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const max = root.scrollHeight - window.innerHeight;
      root.style.setProperty("--sp", max > 0 ? (window.scrollY / max).toFixed(4) : 0);
      if (hero && !reduceMotion) {
        const h = hero.offsetHeight || 1;
        root.style.setProperty("--hp", Math.min(1, window.scrollY / h).toFixed(4));
      }
      ticking = false;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll();

  const items = [...document.querySelectorAll("[data-reveal]")];
  document.querySelectorAll("[data-reveal-group]").forEach((g) => {
    [...g.children].forEach((c, i) => { c.style.setProperty("--i", i); c.setAttribute("data-reveal", ""); items.push(c); });
  });
  if (reduceMotion || !("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-in"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
  items.forEach((el) => io.observe(el));
})();

/* Project rail buttons */
(() => {
  const rail = document.getElementById("rail");
  if (!rail) return;
  const buttons = document.querySelectorAll(".rail-btn");
  const step = () => {
    const card = rail.querySelector(".project");
    const gap = parseFloat(getComputedStyle(rail).columnGap) || 24;
    return card ? card.getBoundingClientRect().width + gap : 400;
  };
  const update = () => {
    const max = rail.scrollWidth - rail.clientWidth - 2;
    buttons.forEach((b) => {
      b.disabled = b.dataset.dir === "-1" ? rail.scrollLeft <= 2 : rail.scrollLeft >= max;
    });
  };
  buttons.forEach((b) =>
    b.addEventListener("click", () => rail.scrollBy({ left: Number(b.dataset.dir) * step(), behavior: "smooth" }))
  );
  rail.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  update();
})();

/* Nav hairline once the page scrolls */
(() => {
  const nav = document.querySelector(".nav");
  if (!nav) return;
  const set = () => nav.classList.toggle("is-scrolled", window.scrollY > 8);
  window.addEventListener("scroll", set, { passive: true });
  set();
})();
