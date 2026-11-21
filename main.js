/* Shared helpers for the pixel-art scenes: colors packed for ImageData, a seeded random
   generator, a coordinate hash for textures, smooth 1D noise, and small sprites. */
const PX = (() => {
  const rgb = (hex, a = 255) => {
    const n = parseInt(hex.slice(1), 16);
    return ((a << 24) | ((n & 255) << 16) | (n & 0xff00) | (n >> 16)) >>> 0;
  };
  const rng = (seed) => () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const hash = (x, y, s = 0) => {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  const smooth = (t) => t * t * (3 - 2 * t);
  const noise1 = (x, s = 0) => {
    const i = Math.floor(x), f = x - i;
    const a = hash(i, 0, s), b = hash(i + 1, 0, s);
    return a + (b - a) * smooth(f);
  };
  function sprite(w, h) {
    return {
      w, h, px: new Uint32Array(w * h),
      set(x, y, c) { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < w && y < h) this.px[y * w + x] = c; },
      get(x, y) { return x >= 0 && y >= 0 && x < w && y < h ? this.px[y * w + x] : 0; }
    };
  }
  // copy a sprite into a pixel buffer, skipping transparent pixels
  function blit(dst, dw, dh, s, x, y) {
    x = Math.round(x); y = Math.round(y);
    const x0 = Math.max(0, -x), y0 = Math.max(0, -y);
    const x1 = Math.min(s.w, dw - x), y1 = Math.min(s.h, dh - y);
    for (let j = y0; j < y1; j++) {
      const so = j * s.w, d = (y + j) * dw + x;
      for (let i = x0; i < x1; i++) { const c = s.px[so + i]; if (c) dst[d + i] = c; }
    }
  }
  const pick = (r, arr) => arr[(r() * arr.length) | 0];
  // weighted pick: [[weight, value], ...]
  const pickW = (r, list) => {
    let total = 0; for (const [w] of list) total += w;
    let u = r() * total;
    for (const [w, v] of list) { if ((u -= w) <= 0) return v; }
    return list[list.length - 1][1];
  };
  const toCanvas = (s) => {
    const c = document.createElement("canvas");
    c.width = s.w; c.height = s.h;
    const x = c.getContext("2d");
    const img = x.createImageData(s.w, s.h);
    new Uint32Array(img.data.buffer).set(s.px);
    x.putImageData(img, 0, 0);
    return c;
  };
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
  return { rgb, rng, hash, noise1, sprite, blit, pick, pickW, toCanvas, bayer };
})();

/* Space, behind everything below the underground section. Scrolling flies the camera
   forward or back through stars, galaxies, planets and nebulas; it also drifts on its own.
   Stars are mostly white, blue, purple and pink, with rare red, yellow and orange. */
(() => { try {
  const canvas = document.getElementById("space");
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext("2d");
  const dig = document.querySelector(".dig");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const { rgb, rng, sprite, toCanvas, pick, pickW, bayer } = PX;
  const rand = rng((Math.random() * 1e9) | 0);

  const STAR_COLORS = [
    [44, "236,240,248"], [18, "143,200,255"], [12, "190,150,255"], [12, "255,160,215"],
    [3, "255,110,110"], [4, "255,226,122"], [4, "255,170,100"]
  ];
  const FAMILIES = [
    [30, ["#2f4fbf", "#5b8cff", "#9fd0ff", "#e8f4ff"]],   // blue
    [26, ["#4b2fa8", "#8a5cff", "#c49bff", "#f0e4ff"]],   // purple
    [24, ["#8f2f6e", "#e05aa6", "#ff9bd2", "#ffe4f2"]],   // pink
    [5, ["#8a2020", "#d43a3a", "#ff7a6b", "#ffd0c8"]],    // red
    [6, ["#8a6516", "#d9a92e", "#ffe27a", "#fff6d0"]],    // yellow
    [6, ["#8a3f16", "#e0742e", "#ffb36b", "#ffe6cc"]]     // orange
  ];
  const family = () => pickW(rand, FAMILIES).map((h) => rgb(h));

  // ---- pixel sprites for deep-space objects ----
  function spiral() {
    const n = 44, s = sprite(n, n), pal = family();
    const acc = new Float32Array(n * n);
    const arms = 2 + ((rand() * 3) | 0), incl = 0.3 + rand() * 0.7, rot = rand() * Math.PI * 2;
    const twist = 2.4 + rand() * 2.2, R = n * 0.46;
    for (let i = 0; i < 1400; i++) {
      const r = Math.pow(rand(), 0.75) * R;
      const th = ((rand() * arms) | 0) * (2 * Math.PI / arms) + (r / R) * twist + (rand() - 0.5) * (0.9 - 0.5 * r / R);
      let x = r * Math.cos(th), y = r * Math.sin(th) * incl;
      const xr = x * Math.cos(rot) - y * Math.sin(rot), yr = x * Math.sin(rot) + y * Math.cos(rot);
      const ix = Math.round(n / 2 + xr), iy = Math.round(n / 2 + yr);
      if (ix >= 0 && iy >= 0 && ix < n && iy < n) acc[iy * n + ix] += 1;
    }
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const dx = x - n / 2, dy = y - n / 2;
      acc[y * n + x] += 7 * Math.exp(-(dx * dx + dy * dy) / 9);
    }
    tiers(s, acc, n, pal, [0.7, 1.6, 3.2, 7]);
    return s;
  }
  function tiers(s, acc, n, pal, cut) {
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      let v = 0, k = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const xx = x + i, yy = y + j;
        if (xx >= 0 && yy >= 0 && xx < n && yy < n) { v += acc[yy * n + xx] * (i || j ? 0.6 : 1.4); k++; }
      }
      v /= k * 0.7;
      const d = bayer(x, y) * 0.6 + 0.7;
      if (v * d > cut[3]) s.set(x, y, rgb("#fffaf0"));
      else if (v * d > cut[2]) s.set(x, y, pal[3]);
      else if (v * d > cut[1]) s.set(x, y, pal[2]);
      else if (v * d > cut[0]) s.set(x, y, pal[1]);
    }
  }
  function elliptical() {
    const n = 30, s = sprite(n, n), pal = family(), acc = new Float32Array(n * n);
    const a = 8 + rand() * 5, b = a * (0.45 + rand() * 0.5), rot = rand() * Math.PI;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const dx = x - n / 2, dy = y - n / 2;
      const u = dx * Math.cos(rot) + dy * Math.sin(rot), v = -dx * Math.sin(rot) + dy * Math.cos(rot);
      acc[y * n + x] = 9 * Math.exp(-((u * u) / (a * a) + (v * v) / (b * b)) * 2.4);
    }
    tiers(s, acc, n, pal, [0.9, 2.2, 4.4, 7.8]);
    return s;
  }
  function edgeOn() {
    const n = 46, s = sprite(n, 20), pal = family();
    for (let y = 0; y < 20; y++) for (let x = 0; x < n; x++) {
      const dx = (x - n / 2) / (n * 0.48), dy = (y - 10) / 3.2;
      const disk = 1 - dx * dx - dy * dy;
      const bulge = 1 - ((x - n / 2) ** 2 + (y - 10) ** 2) / 30;
      const v = Math.max(disk * 1.2, bulge * 1.6) + (bayer(x, y) - 0.5) * 0.3;
      if (v <= 0.05) continue;
      let c = v > 1.3 ? rgb("#fffaf0") : v > 0.8 ? pal[3] : v > 0.4 ? pal[2] : pal[1];
      if (y === 10 && Math.abs(x - n / 2) > 3 && disk > 0.2) c = pal[0];   // dust lane
      s.set(x, y, c);
    }
    return s;
  }
  function planet() {
    const r = 6 + ((rand() * 10) | 0), ringed = rand() < 0.4;
    const n = ringed ? Math.ceil(r * 4.2) : r * 2 + 4, s = sprite(n, n), pal = family();
    const c = n / 2, gas = rand() < 0.6, freq = 1.5 + rand() * 3, phase = rand() * 10;
    const ringTilt = 0.28 + rand() * 0.25, ringRot = (rand() - 0.5) * 0.7;
    const ringPx = (x, y) => {
      const dx = x - c, dy = y - c;
      const u = dx * Math.cos(ringRot) + dy * Math.sin(ringRot), v = (-dx * Math.sin(ringRot) + dy * Math.cos(ringRot)) / ringTilt;
      const d = Math.hypot(u, v) / r;
      return d > 1.45 && d < 1.95 && !(d > 1.68 && d < 1.74) ? v : null;
    };
    if (ringed) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const v = ringPx(x, y);
      if (v !== null && v < 0) s.set(x, y, pal[2]);   // back half of the ring
    }
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const nx = (x + 0.5 - c) / r, ny = (y + 0.5 - c) / r, d2 = nx * nx + ny * ny;
      if (d2 > 1) continue;
      const nz = Math.sqrt(1 - d2);
      const lam = -0.55 * nx - 0.5 * ny + 0.67 * nz;
      let band;
      if (gas) band = Math.sin(ny * freq * 3 + Math.sin(nx * 4 + phase) * 0.6 + phase);
      else band = Math.sin(nx * 5 + phase) * Math.cos(ny * 4 - phase) + Math.sin((nx + ny) * 9 + phase) * 0.4;
      let col = band > 0.45 ? pal[3] : band > -0.1 ? pal[2] : pal[1];
      const lit = lam + (bayer(x, y) - 0.5) * 0.35;
      if (lit < 0.05) col = rgb("#0c0f22");
      else if (lit < 0.28) col = pal[0];
      if (d2 > 0.82 && lit > 0.3) col = pal[3];   // lit rim
      s.set(x, y, col);
    }
    if (ringed) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const v = ringPx(x, y);
      if (v !== null && v >= 0) s.set(x, y, (x + y) % 5 === 0 ? pal[1] : pal[3]);   // front half
    }
    return s;
  }
  function nebula() {
    const n = 56, s = sprite(n, n), pal = family(), alpha = 150;
    const blobs = Array.from({ length: 6 }, () => ({ x: 14 + rand() * 28, y: 14 + rand() * 28, r: 6 + rand() * 10 }));
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      let v = 0;
      for (const b of blobs) v += Math.exp(-((x - b.x) ** 2 + (y - b.y) ** 2) / (b.r * b.r));
      v += (bayer(x, y) - 0.5) * 0.5;
      if (v > 1.3) s.set(x, y, (pal[2] & 0x00ffffff) | ((alpha) << 24));
      else if (v > 0.75) s.set(x, y, (pal[1] & 0x00ffffff) | ((alpha - 30) << 24));
      else if (v > 0.4) s.set(x, y, (pal[0] & 0x00ffffff) | ((alpha - 60) << 24));
    }
    return s;
  }
  function blackHole() {
    const n = 40, s = sprite(n, n), c = n / 2;
    const hot = [rgb("#8a3f16"), rgb("#e0742e"), rgb("#ffb36b"), rgb("#fff1c4")];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const dx = x + 0.5 - c, dy = y + 0.5 - c;
      const v = dy / 0.3, rr = Math.hypot(dx, v), d = Math.hypot(dx, dy);
      if (rr > 7 && rr < 19 && dy > -1) s.set(x, y, hot[Math.min(3, Math.floor(4 - (rr - 7) / 3.2 + bayer(x, y) * 0.8))]);
      else if (d > 6.2 && d < 7.6) s.set(x, y, hot[3]);
      else if (d <= 6.2) s.set(x, y, rgb("#05040a"));
      else if (rr > 7 && rr < 19 && dy <= -1 && d > 7.6) s.set(x, y, hot[Math.min(3, Math.floor(3.4 - (rr - 7) / 3.5 + bayer(x, y) * 0.8))]);
    }
    return s;
  }
  function brightStar() {
    const n = 15, s = sprite(n, n), pal = family(), c = 7;
    for (let i = -7; i <= 7; i++) {
      const k = Math.abs(i);
      const col = k < 2 ? rgb("#ffffff") : k < 4 ? pal[3] : pal[2];
      s.set(c + i, c, col); s.set(c, c + i, col);
      if (k < 3) { s.set(c + i, c + i, pal[2]); s.set(c + i, c - i, pal[2]); }
    }
    return s;
  }
  const KINDS = [[24, spiral], [11, elliptical], [11, edgeOn], [24, planet], [16, nebula], [3, blackHole], [11, brightStar]];
  const makeObject = () => toCanvas(pickW(rand, KINDS)());

  // ---- layout ----
  let W = 0, H = 0, dpr = 1, f = 1, stars = [], objs = [];
  function layout() {
    W = window.innerWidth; H = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    f = Math.min(W, H) * 0.5;
    const ax = (0.62 * W) / f, ay = (0.62 * H) / f;
    const n = Math.round(Math.min(1500, Math.max(380, (W * H) / 950)));
    stars = Array.from({ length: n }, () => ({
      x: (rand() * 2 - 1) * ax, y: (rand() * 2 - 1) * ay, z: rand(),
      tw: rand() * Math.PI * 2, c: pickW(rand, STAR_COLORS)
    }));
    const m = W < 700 ? 14 : 26;
    objs = Array.from({ length: m }, (_, i) => newObj((i + rand()) / m));
  }
  function newObj(z) {
    const ax = (0.42 * W) / f, ay = (0.42 * H) / f;
    return { x: (rand() * 2 - 1) * ax, y: (rand() * 2 - 1) * ay, z, img: makeObject(), last: null, scale: 0.75 + rand() * 0.6 };
  }

  let cam = 0, lastCam = 0, lastT = 0, drift = 0;
  const scrollCam = () => window.scrollY / 1600;
  function visible() {
    if (!dig) return true;
    const r = dig.getBoundingClientRect();
    return r.bottom - r.height * 0.35 < H;
  }

  function draw(t) {
    const dt = lastT ? Math.min((t - lastT) / 1000, 0.05) : 0;
    lastT = t;
    if (!reduceMotion) drift += dt * 0.018;
    cam = drift + scrollCam();
    const dCam = cam - lastCam;
    lastCam = cam;
    if (!visible()) return;
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H * 0.42;
    const big = W < 700 ? 1 : 1.5;

    // deep-space objects first, so stars sit on top
    ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < objs.length; i++) {
      const o = objs[i];
      const zr = (((o.z - cam) % 1) + 1) % 1;
      if (o.last !== null && Math.abs(zr - o.last) > 0.5) { objs[i] = newObj(o.z); objs[i].last = zr; continue; }
      o.last = zr;
      if (zr < 0.22) continue;
      const k = f / zr, x = cx + o.x * k, y = cy + o.y * k;
      const sc = (0.6 / zr) * big * o.scale;
      const w = o.img.width * sc, h = o.img.height * sc;
      if (x + w / 2 < 0 || x - w / 2 > W || y + h / 2 < 0 || y - h / 2 > H) continue;
      const fadeIn = Math.min(1, (1 - zr) / 0.15), fadeOut = Math.min(1, (zr - 0.22) / 0.14);
      ctx.globalAlpha = 0.62 * fadeIn * fadeOut;
      ctx.drawImage(o.img, Math.round(x - w / 2), Math.round(y - h / 2), Math.round(w), Math.round(h));
    }
    ctx.globalAlpha = 1;

    for (const s of stars) {
      const zr = (((s.z - cam) % 1) + 1) % 1;
      if (zr < 0.015) continue;
      const k = f / zr, x = cx + s.x * k, y = cy + s.y * k;
      if (x < -20 || x > W + 20 || y < -20 || y > H + 20) continue;
      const near = 1 - zr;
      const a = Math.min(1, 0.42 + near * 0.75) * (0.65 + 0.35 * Math.sin(t / 700 + s.tw));
      const size = Math.round(1 + near * near * 2.6);
      const zp = zr + dCam;
      if (Math.abs(dCam) > 0.0008 && zp > 0.015 && zp < 1) {
        const kp = f / zp;
        ctx.strokeStyle = `rgba(${s.c},${a})`;
        ctx.lineWidth = size;
        ctx.beginPath(); ctx.moveTo(cx + s.x * kp, cy + s.y * kp); ctx.lineTo(x, y); ctx.stroke();
      } else {
        ctx.fillStyle = `rgba(${s.c},${a})`;
        const px = Math.round(x), py = Math.round(y);
        ctx.fillRect(px - (size >> 1), py - (size >> 1), size, size);
        if (near > 0.82) {   // close stars get a small pixel cross
          ctx.fillRect(px - size - 1, py, size * 3 + 2 - size, 1);
          ctx.fillRect(px, py - size - 1, 1, size * 3 + 2 - size);
        }
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
    const still = () => { lastCam = scrollCam(); ctx.clearRect(0, 0, W, H); draw(1); };
    still();
    window.addEventListener("scroll", still, { passive: true });
    window.addEventListener("resize", () => { layout(); still(); });
    return;
  }
  start();
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  let rt = 0;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(layout, 150); });
} catch (err) { console.error("Scene failed to load:", err); } })();
/* Hero: a pixel-art landscape at dusk, seen from a moving train. Each layer scrolls at its
   own speed, and everything in it (trees, bushes, flowers, grass, rocks, clouds, mountain
   ridges) is generated as it comes into view, with random shapes, sizes, colors and spacing,
   so the scene never repeats. A robot runs along the path, and the wing sits in the airflow
   above the clouds. */
(() => { try {
  const hero = document.querySelector(".hero");
  const land = document.getElementById("land");
  const flowCanvas = document.getElementById("flow");
  const wingCanvas = document.getElementById("wing");
  if (!hero || !land || !land.getContext || !flowCanvas || !wingCanvas) return;
  const lctx = land.getContext("2d");
  const fctx = flowCanvas.getContext("2d");
  const wctx = wingCanvas.getContext("2d");
  const copy = hero.querySelector(".hero-copy");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const { rgb, rng, hash, noise1, sprite, blit, pick, pickW, bayer } = PX;
  const rand = rng((Math.random() * 1e9) | 0);
  const C = (arr) => arr.map((h) => rgb(h));

  // ---- palettes ----
  const GREENS = [
    C(["#173b2b", "#245a3b", "#357a48", "#5aa35a"]),
    C(["#173a37", "#225a52", "#2f7c67", "#55a88a"]),
    C(["#26401c", "#3a6226", "#538633", "#7fb24a"]),
    C(["#1c3d30", "#2b5e40", "#3f8350", "#69ad63"])
  ];
  const BLOSSOM = C(["#6e2f57", "#a84b80", "#d975aa", "#ffb3d6"]);
  const AUTUMN = C(["#5e2c17", "#9a4b1f", "#d07a2a", "#f5b04f"]);
  const TRUNK = C(["#2e2019", "#4a3326", "#6b4a33"]);
  const BIRCH = C(["#2a2a2e", "#bdb8ae", "#e9e5dc"]);
  const FLOWERS = C(["#ff5d8f", "#ffd84d", "#ff7a4a", "#b388ff", "#f4f1ff", "#6ec6ff", "#ff4f6d", "#ffa3d1"]);
  const CENTERS = C(["#ffe27a", "#fff4d6", "#ff9b3d"]);
  const STEM = C(["#245c30", "#3a8443", "#58b05a"]);
  const ROCK = C(["#3f3c4d", "#5d5a6b", "#7d7a8c", "#a19eb0"]);
  const CLOUD_NEAR = C(["#6f5f9b", "#a690c4", "#d8bcd8", "#ffe1d2"]);
  const CLOUD_FAR = C(["#3a376c", "#514b86", "#6f63a0", "#9483b8"]);
  const MEADOW = C(["#265838", "#2e6a42", "#37784a", "#45885a"]);
  const VERGE = C(["#2c683c", "#3a8048", "#4c9a56", "#62b062"]);
  const FG = C(["#1c4529", "#225432", "#2a6139", "#34723f"]);
  const PATH = C(["#5c586c", "#77728a", "#9e98a8", "#b4aebd", "#d3cedc"]);
  const RB = {
    out: rgb("#13151d"), dark: rgb("#3b4052"), mid: rgb("#626a82"), light: rgb("#9199b0"), shine: rgb("#ccd3e2"),
    fdark: rgb("#262a37"), fmid: rgb("#40465a"), flight: rgb("#5b6379"),
    visor: rgb("#090c14"), eye: rgb("#6ff7ff"), eye2: rgb("#dcffff"), chest: rgb("#ff6b4a")
  };

  // light comes from the low sun on the right
  const LX = 0.55, LY = -0.83;
  function shadeBlobs(s, blobs, pal, opts = {}) {
    const { w, h } = s;
    const n = new Float32Array(w * h * 2), mask = new Uint8Array(w * h);
    const bottom = opts.bottom ?? h;
    for (let y = 0; y < Math.min(h, bottom); y++) for (let x = 0; x < w; x++) {
      let best = -1, bx = 0, by = 0;
      for (const b of blobs) {
        const dx = (x + 0.5 - b.x) / b.r, dy = (y + 0.5 - b.y) / b.r, d2 = dx * dx + dy * dy;
        if (d2 <= 1 && 1 - d2 > best) { best = 1 - d2; bx = dx; by = dy; }
      }
      if (best >= 0) { mask[y * w + x] = 1; n[(y * w + x) * 2] = bx; n[(y * w + x) * 2 + 1] = by; }
    }
    const seed = (rand() * 1e6) | 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      const edge = !mask[i - 1] || !mask[i + 1] || !mask[i - w] || !mask[i + w] || x === 0 || x === w - 1;
      const d = n[i * 2] * LX + n[i * 2 + 1] * LY + (hash(x, y, seed) - 0.5) * (opts.noise ?? 0.4);
      let c = d > 0.5 ? pal[3] : d > 0.05 ? pal[2] : d > -0.45 ? pal[1] : pal[0];
      if (opts.flatShadow && y >= bottom - 2) c = pal[0];
      if (opts.edge !== false && edge && d < 0.25) c = pal[0];
      s.set(x, y, c);
    }
  }

  // ---- generators ----
  function oak(pal) {
    const rc = 6 + Math.floor(rand() * 7), th = 5 + Math.floor(rand() * 7);
    const w = Math.ceil(rc * 2.9) + 2, cyc = Math.ceil(rc * 1.35) + 1, h = Math.ceil(cyc + rc * 0.85 + th);
    const s = sprite(w, h), cx = w / 2, tw = rc > 9 ? 3 : 2, tx = Math.floor(cx - tw / 2);
    for (let y = cyc; y < h; y++) for (let x = 0; x < tw; x++) s.set(tx + x, y, x === tw - 1 ? TRUNK[2] : x === 0 ? TRUNK[0] : TRUNK[1]);
    s.set(tx - 1, h - 1, TRUNK[0]); s.set(tx + tw, h - 1, TRUNK[1]);
    if (rand() < 0.5) { s.set(tx + tw, cyc + rc * 0.7, TRUNK[1]); s.set(tx + tw + 1, cyc + rc * 0.6, TRUNK[1]); }
    const blobs = [{ x: cx, y: cyc, r: rc * 0.8 }];
    const k = 4 + Math.floor(rand() * 4);
    for (let i = 0; i < k; i++) {
      const a = rand() * Math.PI * 2, d = rand() * rc * 0.55;
      blobs.push({ x: cx + Math.cos(a) * d, y: cyc + Math.sin(a) * d * 0.75 - rc * 0.1, r: rc * (0.45 + rand() * 0.3) });
    }
    shadeBlobs(s, blobs, pal);
    if (pal === GREENS[0] && rand() < 0.25) for (let i = 0; i < 4; i++) s.set(cx + (rand() - 0.5) * rc * 1.4, cyc + (rand() - 0.5) * rc, rgb("#ff6b6b"));   // apples
    return s;
  }
  function pine() {
    const pal = pick(rand, GREENS), tiers = 3 + Math.floor(rand() * 3), hw = 5 + Math.floor(rand() * 5);
    const tierH = 6 + Math.floor(rand() * 4), trunkH = 3 + Math.floor(rand() * 2), step = Math.max(3, tierH - 3);
    const h = step * (tiers - 1) + tierH + trunkH, w = hw * 2 + 3, s = sprite(w, h), cx = Math.floor(w / 2);
    for (let y = h - trunkH - 1; y < h; y++) { s.set(cx - 1, y, TRUNK[0]); s.set(cx, y, TRUNK[1]); s.set(cx + 1, y, TRUNK[2]); }
    for (let t = 0; t < tiers; t++) {
      const top = t * step, half = Math.round(hw * (0.45 + (0.55 * (t + 1)) / tiers));
      for (let y = 0; y < tierH; y++) {
        const ww = Math.round(1 + (half - 1) * (y / (tierH - 1)));
        for (let x = -ww; x <= ww; x++) {
          const yy = top + y, lit = x > ww * 0.2;
          let c = lit ? pal[2] : x < -ww * 0.45 ? pal[0] : pal[1];
          if (x > ww * 0.5 && hash(x, yy, t) > 0.55) c = pal[3];
          if ((Math.abs(x) === ww || y === tierH - 1) && !lit) c = pal[0];
          s.set(cx + x, yy, c);
        }
      }
    }
    return s;
  }
  function birch() {
    const pal = rand() < 0.5 ? GREENS[2] : GREENS[3], rc = 4 + Math.floor(rand() * 4), th = 9 + Math.floor(rand() * 8);
    const w = rc * 3 + 2, cyc = Math.ceil(rc * 1.3), h = cyc + th + rc, s = sprite(w, h), cx = Math.floor(w / 2);
    for (let y = cyc; y < h; y++) {
      s.set(cx, y, hash(cx, y, 3) < 0.22 ? BIRCH[0] : BIRCH[1]);
      s.set(cx + 1, y, hash(cx + 1, y, 3) < 0.18 ? BIRCH[0] : BIRCH[2]);
    }
    const blobs = Array.from({ length: 4 + Math.floor(rand() * 3) }, () => ({ x: cx + (rand() - 0.5) * rc, y: cyc + (rand() - 0.5) * rc, r: rc * (0.55 + rand() * 0.35) }));
    shadeBlobs(s, blobs, pal);
    return s;
  }
  function poplar() {
    const pal = pick(rand, GREENS), rx = 3 + Math.floor(rand() * 3), ry = 9 + Math.floor(rand() * 8), th = 4;
    const w = rx * 2 + 4, h = ry * 2 + th + 2, s = sprite(w, h), cx = w / 2;
    for (let y = ry; y < h; y++) { s.set(cx - 1, y, TRUNK[0]); s.set(cx, y, TRUNK[2]); }
    const blobs = [];
    for (let i = 0; i < 4; i++) blobs.push({ x: cx + (rand() - 0.5) * 1.5, y: ry * 0.45 + i * ry * 0.38, r: rx * (1 + (i === 1 || i === 2 ? 0.25 : 0)) });
    shadeBlobs(s, blobs, pal);
    return s;
  }
  function bush() {
    const pal = rand() < 0.15 ? BLOSSOM : pick(rand, GREENS), r = 3 + Math.floor(rand() * 4);
    const w = r * 4, h = r * 2 + 1, s = sprite(w, h);
    const blobs = Array.from({ length: 3 + Math.floor(rand() * 3) }, () => ({ x: r + rand() * (w - 2 * r), y: h - r * 0.7, r: r * (0.7 + rand() * 0.4) }));
    shadeBlobs(s, blobs, pal);
    if (rand() < 0.35) { const fc = pick(rand, FLOWERS); for (let i = 0; i < 5; i++) s.set(1 + rand() * (w - 2), 1 + rand() * (h - 3), fc); }
    return s;
  }
  function makeTree() {
    const roll = rand();
    if (roll < 0.22) return pine();
    if (roll < 0.33) return birch();
    if (roll < 0.43) return poplar();
    if (roll < 0.53) return bush();
    return oak(roll < 0.64 ? BLOSSOM : roll < 0.67 ? AUTUMN : pick(rand, GREENS));
  }
  function tinyTree() {
    const h = 4 + Math.floor(rand() * 6), w = 3 + Math.floor(rand() * 3), s = sprite(w, h);
    const dark = rgb("#16323a"), lite = rgb("#24474d"), cone = rand() < 0.5;
    for (let y = 0; y < h - 1; y++) for (let x = 0; x < w; x++) {
      const inside = cone ? Math.abs(x - (w - 1) / 2) <= (y / (h - 1)) * (w / 2) + 0.2 : (x - (w - 1) / 2) ** 2 / ((w / 2) ** 2) + (y - (h - 2) / 2) ** 2 / (((h - 1) / 2) ** 2) <= 1;
      if (inside) s.set(x, y, x > w / 2 ? lite : dark);
    }
    s.set(Math.floor(w / 2), h - 1, dark);
    return s;
  }
  function flowerHead(s, cx, y, col) {
    const kind = rand(), mid = pick(rand, CENTERS);
    if (kind < 0.4) { s.set(cx, y, mid); s.set(cx - 1, y, col); s.set(cx + 1, y, col); s.set(cx, y - 1, col); s.set(cx, y + 1, col); }
    else if (kind < 0.7) {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s.set(cx + dx, y + dy, dx || dy ? col : mid);
      s.set(cx - 2, y, col); s.set(cx + 2, y, col); s.set(cx, y - 2, col);
    } else { s.set(cx - 1, y - 1, col); s.set(cx + 1, y - 1, col); s.set(cx - 1, y, col); s.set(cx, y, col); s.set(cx + 1, y, col); s.set(cx, y + 1, col); }
  }
  function flowers() {
    const count = rand() < 0.4 ? 1 : 2 + Math.floor(rand() * 2), w = count * 4 + 3, hmax = 12, s = sprite(w, hmax);
    const col = rand() < 0.7 ? pick(rand, FLOWERS) : null;
    for (let i = 0; i < count; i++) {
      const cx = 2 + i * 4 + Math.floor(rand() * 2), hh = 4 + Math.floor(rand() * 6), top = hmax - hh - 1;
      for (let y = top + 1; y < hmax; y++) s.set(cx, y, STEM[1]);
      if (hh > 5) { s.set(cx - 1, top + 3, STEM[2]); s.set(cx + 1, top + 4, STEM[0]); }
      flowerHead(s, cx, top, col ?? pick(rand, FLOWERS));
    }
    return s;
  }
  function tuft() {
    const n = 3 + Math.floor(rand() * 5), w = n * 2 + 2, hmax = 4 + Math.floor(rand() * 6), s = sprite(w, hmax);
    for (let i = 0; i < n; i++) {
      const x = 1 + i * 2, bh = 2 + Math.floor(rand() * (hmax - 1)), lean = rand() < 0.5 ? -1 : 1;
      for (let y = 0; y < bh; y++) s.set(x + (y > bh * 0.6 ? lean : 0), hmax - 1 - y, y === bh - 1 ? STEM[2] : y < 2 ? STEM[0] : STEM[1]);
    }
    return s;
  }
  function rock() {
    const w = 4 + Math.floor(rand() * 6), h = 3 + Math.floor(rand() * 3), s = sprite(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = (x + 0.5 - w / 2) / (w / 2), dy = (y + 0.5 - h) / h;
      if (dx * dx + dy * dy > 1) continue;
      const d = dx * LX + dy * LY;
      s.set(x, y, d > 0.45 ? ROCK[3] : d > 0 ? ROCK[2] : d > -0.5 ? ROCK[1] : ROCK[0]);
    }
    return s;
  }
  function mushroom() {
    const s = sprite(5, 5), cap = rand() < 0.6 ? rgb("#e2453a") : rgb("#c88a4a"), dot = rgb("#fff0e0"), stem = rgb("#efe6d6");
    for (let x = 0; x < 5; x++) s.set(x, 1, cap);
    for (let x = 1; x < 4; x++) s.set(x, 0, cap);
    s.set(1, 1, dot); s.set(3, 0, dot);
    s.set(2, 2, stem); s.set(2, 3, stem); s.set(1, 4, STEM[1]); s.set(2, 4, stem); s.set(3, 4, STEM[1]);
    return s;
  }
  function foreground() {
    return pickW(rand, [[40, flowers], [38, tuft], [12, rock], [4, mushroom], [6, bush]])();
  }
  function cloud(far) {
    const w = (far ? 16 : 22) + Math.floor(rand() * (far ? 20 : 30)), h = Math.floor(w * (0.32 + rand() * 0.12)) + 3, s = sprite(w, h);
    const blobs = [];
    const k = 3 + Math.floor(rand() * 4);
    for (let i = 0; i < k; i++) { const r = h * (0.32 + rand() * 0.4); blobs.push({ x: r + rand() * Math.max(1, w - 2 * r), y: h - r * 0.7 - 1, r }); }
    blobs.push({ x: w * (0.3 + rand() * 0.4), y: h * 0.56, r: h * 0.48 });
    shadeBlobs(s, blobs, far ? CLOUD_FAR : CLOUD_NEAR, { edge: false, bottom: h - 1, flatShadow: true, noise: 0.15 });
    return s;
  }

  // ---- layers that generate content as they scroll ----
  function makeLayer(factor, spawn, gap, drift = 0) {
    return {
      factor, drift, items: [], next: -80,
      offset(cam, t) { return cam * this.factor + t * this.drift; },
      update(off) {
        while (this.next < off + BW + 80) { const it = spawn(); it.x = this.next; this.items.push(it); this.next += gap(it); }
        while (this.items.length && this.items[0].x + this.items[0].s.w < off - 20) this.items.shift();
      }
    };
  }

  // ---- state ----
  let W = 0, H = 0, P = 4, BW = 0, BH = 0, img = null, buf = null, sky = null;
  let meadowTop = 0, pathTop = 0, fgTop = 0, robotX = 0, sun = null;
  let layers = null, skyStars = [], dust = [], cam = 0, phase = 0, lastStep = 0, shoot = null;
  const SPEED = 24;          // ground speed, buffer px per second

  let ready = false;
  function build() {
    const r = hero.getBoundingClientRect();
    W = r.width; H = r.height;
    ready = false;
    if (W < 16 || H < 16) return false;
    P = W >= 900 ? 4 : 3;
    BW = Math.ceil(W / P); BH = Math.ceil(H / P);
    land.width = BW; land.height = BH;
    land.style.width = BW * P + "px"; land.style.height = BH * P + "px";
    img = lctx.createImageData(BW, BH);
    buf = new Uint32Array(img.data.buffer);
    fgTop = BH - 20; pathTop = fgTop - 9; meadowTop = pathTop - 16;
    robotX = Math.round(BW * (W >= 900 ? 0.64 : 0.62));

    // sky with dithered bands, a striped setting sun, and a little haze over the horizon
    const stops = [[0, "#0b1424"], [0.3, "#141d44"], [0.55, "#262a5e"], [0.75, "#4a3473"], [0.88, "#8a4c7c"], [0.96, "#d9766e"], [1, "#f29a6a"]]
      .map(([t, h]) => [t, parseInt(h.slice(1), 16)]);
    const colAt = (t) => {
      for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) {
        const [t0, a] = stops[i - 1], [t1, b] = stops[i], u = (t - t0) / (t1 - t0);
        const ch = (sh) => Math.round(((a >> sh) & 255) + ((((b >> sh) & 255) - ((a >> sh) & 255)) * u));
        return rgb("#" + ((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0"));
      }
      return rgb("#f29a6a");
    };
    sky = new Uint32Array(BW * BH);
    const bands = 22;
    for (let y = 0; y < BH; y++) {
      const t = Math.min(1, y / meadowTop), b = Math.floor(t * bands), frac = t * bands - b;
      const c0 = colAt(b / bands), c1 = colAt(Math.min(1, (b + 1) / bands));
      for (let x = 0; x < BW; x++) sky[y * BW + x] = frac > bayer(x, y) ? c1 : c0;
    }
    const sx = Math.round(BW * 0.8), sr = W >= 900 ? 13 : 10, sy = meadowTop - (W >= 900 ? 44 : 34);
    sun = { x: sx, y: sy, r: sr };
    const sunCols = C(["#ff8a66", "#ffb27a", "#ffd88f", "#fff0b8"]);
    for (let y = sy - sr - 5; y <= sy + sr + 5; y++) for (let x = sx - sr - 5; x <= sx + sr + 5; x++) {
      if (x < 0 || y < 0 || x >= BW || y >= BH) continue;
      const d = Math.hypot(x - sx, y - sy);
      if (d <= sr) {
        const dy = y - sy;
        if (dy > 1 && dy % 4 === 0) continue;                     // retro stripes on the lower half
        sky[y * BW + x] = sunCols[Math.min(3, Math.floor(4 - (d / sr) * 3.2 - (dy / sr) * 0.8))] ?? sunCols[0];
      } else if (d <= sr + 5 && bayer(x, y) > (d - sr) / 5 + 0.25) {
        sky[y * BW + x] = rgb("#e9857a");
      }
    }
    skyStars = Array.from({ length: Math.round(BW / 8) }, () => ({ x: Math.floor(rand() * BW), y: Math.floor(rand() * meadowTop * 0.45), p: rand() * 6, c: rand() < 0.3 ? rgb("#b8d8ff") : rand() < 0.2 ? rgb("#ffc7e6") : rgb("#f3f1ff") }));

    // layers, back to front
    layers = {
      cloudsFar: makeLayer(0.05, () => ({ s: cloud(true), y: meadowTop - 64 - Math.floor(rand() * 28) }), (it) => it.s.w + 10 + rand() * 70, 1.2),
      cloudsNear: makeLayer(0.14, () => ({ s: cloud(false), y: meadowTop - 44 - Math.floor(rand() * 26) }), (it) => it.s.w + 20 + rand() * 90, 2.2),
      hillTrees: makeLayer(0.24, () => ({ s: tinyTree() }), () => 2 + rand() * (rand() < 0.3 ? 4 : 18)),
      trees: makeLayer(0.6, () => { const s = makeTree(); return { s, base: meadowTop + 3 + Math.floor(rand() * 11) }; }, (it) => Math.max(3, it.s.w * (0.35 + rand() * 0.9) + (rand() < 0.25 ? 20 + rand() * 40 : 0))),
      verge: makeLayer(1, () => ({ s: rand() < 0.5 ? flowers() : tuft() }), () => 8 + rand() * 40),
      fg: makeLayer(1.35, () => ({ s: foreground(), y: fgTop + 4 + Math.floor(rand() * 14) }), (it) => 2 + rand() * 12 + it.s.w * 0.4)
    };
  }

  const put = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < BW && y < BH) buf[y * BW + x] = c; };
  const rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(x + i, y + j, c); };

  function ridge(off, maxH, seed, cols, snow) {
    const hAt = (xw) => maxH * Math.pow(0.55 * noise1(xw / 38, seed) + 0.3 * noise1(xw / 15, seed + 1) + 0.15 * noise1(xw / 6, seed + 2), 1.35);
    const o = Math.floor(off);
    let prev = hAt(o - 1);
    for (let x = 0; x < BW; x++) {
      const h = hAt(x + o), next = hAt(x + o + 1), top = Math.round(meadowTop - h);
      const litFace = next < prev;
      for (let y = Math.max(0, top); y < meadowTop; y++) {
        let c = y === top ? cols[3] : litFace ? cols[2] : cols[1];
        if (snow && h > maxH * 0.62 && y < top + 2 + (h - maxH * 0.62) * 0.25) c = litFace ? snow[1] : snow[0];
        if (y > meadowTop - 7 && bayer(x, y) < (y - (meadowTop - 7)) / 9) c = cols[0];   // haze at the base
        buf[y * BW + x] = c;
      }
      prev = h;
    }
  }
  function hills(off) {
    const hAt = (xw) => 5 + 13 * (0.6 * noise1(xw / 26, 31) + 0.4 * noise1(xw / 9, 32));
    const o = Math.floor(off), dark = rgb("#1b383f"), mid = rgb("#214349"), top = rgb("#2f5a5c");
    for (let x = 0; x < BW; x++) {
      const h = hAt(x + o), t = Math.round(meadowTop - h);
      for (let y = t; y < meadowTop; y++) buf[y * BW + x] = y === t ? top : bayer(x, y) < 0.3 ? dark : mid;
    }
    return hAt;
  }

  function drawLayerItems(L, off, yOf) {
    for (const it of L.items) blit(buf, BW, BH, it.s, it.x - off, yOf(it));
  }

  // ---- the robot ----
  function limb(pts, near, thick) {
    const o = RB.out, m = near ? RB.mid : RB.fmid, l = near ? RB.light : RB.flight;
    const pts2 = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2));
      for (let k = 0; k <= n; k++) pts2.push([Math.round(a[0] + ((b[0] - a[0]) * k) / n), Math.round(a[1] + ((b[1] - a[1]) * k) / n)]);
    }
    const lo = thick ? -2 : -2, hi = thick ? 2 : 1;
    for (const [x, y] of pts2) for (let dy = lo; dy <= hi; dy++) for (let dx = lo; dx <= hi; dx++) {
      if ((dx === lo || dx === hi) && (dy === lo || dy === hi)) continue;
      put(x + dx, y + dy, o);
    }
    for (const [x, y] of pts2) for (let dy = lo + 1; dy <= hi - 1; dy++) for (let dx = lo + 1; dx <= hi - 1; dx++) put(x + dx, y + dy, m);
    for (const [x, y] of pts2) put(x + hi - 1, y + lo + 1, l);
  }
  function foot(a, near) {
    const x = Math.round(a[0]), y = Math.round(a[1]);
    rect(x - 3, y - 1, 7, 4, RB.out);
    rect(x - 2, y, 5, 2, near ? RB.mid : RB.fmid);
    rect(x - 1, y, 3, 1, near ? RB.light : RB.flight);
  }
  function drawRobot(t) {
    const gy = pathTop + 6;
    const bob = Math.round(Math.abs(Math.cos(phase)) * 1.6);
    const hx = robotX, hy = gy - 12 - bob;
    // shadow on the path
    for (let x = -6 + bob; x <= 6 - bob; x++) put(hx + x, gy + 1, PATH[1]);
    const legPts = (ph, near) => {
      const a1 = 0.72 * Math.sin(ph), flex = 0.15 + 1.2 * Math.max(0, Math.cos(ph)), a2 = a1 - flex;
      const hip = [hx + (near ? 1 : -1), hy];
      const knee = [hip[0] + 5.5 * Math.sin(a1), hip[1] + 5.5 * Math.cos(a1)];
      const ank = [knee[0] + 5.5 * Math.sin(a2), knee[1] + 5.5 * Math.cos(a2)];
      return [hip, knee, ank];
    };
    const armPts = (ph, near) => {
      const b1 = 0.95 * Math.sin(ph), b2 = b1 + 1.4;
      const sh = [hx + (near ? 2 : 0), hy - 7];
      const el = [sh[0] + 4.5 * Math.sin(b1), sh[1] + 4.5 * Math.cos(b1)];
      const hand = [el[0] + 4 * Math.sin(b2), el[1] + 4 * Math.cos(b2)];
      return [sh, el, hand];
    };
    // far side first
    limb(armPts(phase, false), false, false);
    const far = legPts(phase + Math.PI, false); limb(far, false, true); foot(far[2], false);

    // torso, leaning forward a little
    const tx = hx - 3, ty = hy - 9;
    rect(tx - 1, ty - 1, 11, 11, RB.out);
    rect(tx, ty, 9, 9, RB.mid);
    rect(tx, ty, 9, 1, RB.light); rect(tx + 8, ty, 1, 8, RB.light); rect(tx, ty, 1, 9, RB.dark);
    rect(tx, ty + 7, 9, 2, RB.dark); rect(tx + 1, ty + 7, 7, 1, RB.out);
    rect(tx + 4, ty + 2, 3, 3, RB.dark);
    put(tx + 5, ty + 3, Math.floor(t * 2.5) % 2 ? RB.chest : RB.eye);
    put(tx + 7, ty + 1, RB.shine);

    // head: rounded helmet, dark visor, cyan eyes facing forward
    const x = hx - 4, y = ty - 11;
    rect(x - 1, y, 13, 9, RB.out); rect(x, y - 1, 11, 11, RB.out);
    rect(x, y, 11, 9, RB.mid);
    rect(x + 1, y, 9, 2, RB.light); rect(x + 10, y + 1, 1, 6, RB.light);
    put(x + 7, y, RB.shine); put(x + 8, y, RB.shine); put(x + 9, y + 1, RB.shine);
    rect(x, y + 1, 1, 8, RB.dark); rect(x, y + 8, 11, 1, RB.dark);
    rect(x + 3, y + 3, 8, 4, RB.visor); rect(x + 3, y + 2, 8, 1, RB.dark);
    const blink = t % 3.7 < 0.14;
    if (blink) { rect(x + 5, y + 5, 2, 1, RB.eye); rect(x + 8, y + 5, 2, 1, RB.eye); }
    else {
      rect(x + 5, y + 4, 2, 2, RB.eye); rect(x + 8, y + 4, 2, 2, RB.eye);
      put(x + 5, y + 4, RB.eye2); put(x + 8, y + 4, RB.eye2);
    }
    rect(x + 1, y + 3, 2, 4, RB.dark); put(x + 1, y + 4, RB.light); put(x + 1, y + 5, RB.out);   // ear bolt
    rect(hx - 1, ty - 2, 3, 2, RB.out);                                                       // neck

    const near = legPts(phase, true); limb(near, true, true); foot(near[2], true);
    limb(armPts(phase + Math.PI, true), true, false);
  }

  // ---- one landscape frame ----
  function render(t, dt) {
    if (dt > 0) {
      cam += SPEED * dt;
      phase += dt * 11;
    }
    buf.set(sky);
    for (const s of skyStars) {
      const v = 0.5 + 0.5 * Math.sin(t * 1.7 + s.p * 3);
      if (v > 0.25) put(s.x, s.y, v > 0.8 ? s.c : rgb("#5d5f8e"));
    }
    // an occasional shooting star
    if (dt > 0 && !shoot && rand() < dt / 7) shoot = { x: rand() * BW * 0.9, y: rand() * meadowTop * 0.3, life: 0 };
    if (shoot) {
      shoot.life += dt;
      for (let k = 0; k < 7; k++) put(shoot.x + shoot.life * 70 - k, shoot.y + shoot.life * 26 - k * 0.37, k < 2 ? rgb("#ffffff") : rgb("#9fb4ff"));
      if (shoot.life > 0.6) shoot = null;
    }
    const L = layers;
    for (const key in L) L[key].update(L[key].offset(cam, t));

    drawLayerItems(L.cloudsFar, L.cloudsFar.offset(cam, t), (it) => it.y);
    ridge(cam * 0.035, Math.min(56, meadowTop * 0.55), 11, C(["#3a3466", "#3a3b72", "#4a4a84", "#6a5d9a"]), C(["#c49ac4", "#efc6dc"]));
    drawLayerItems(L.cloudsNear, L.cloudsNear.offset(cam, t), (it) => it.y);
    ridge(cam * 0.09, Math.min(36, meadowTop * 0.36), 23, C(["#2d2c58", "#262c55", "#33396a", "#4a4a7e"]), null);
    const hOff = L.hillTrees.offset(cam, t);
    const hAt = hills(cam * 0.24);
    for (const it of L.hillTrees.items) blit(buf, BW, BH, it.s, it.x - hOff, Math.round(meadowTop - hAt(Math.floor(it.x)) - it.s.h + 2));

    // meadow (moves with the trees)
    const mo = Math.floor(L.trees.offset(cam, t));
    for (let y = meadowTop; y < pathTop; y++) for (let x = 0; x < BW; x++) {
      const xw = x + mo, hv = hash(xw >> 1, y >> 1, 5) * 0.7 + hash(xw, y, 6) * 0.3;
      let c = MEADOW[hv < 0.2 ? 0 : hv < 0.55 ? 1 : hv < 0.88 ? 2 : 3];
      if (y === meadowTop && hash(xw, 0, 7) < 0.5) c = MEADOW[3];
      const fh = hash(xw, y, 8);
      if (fh < 0.012) c = FLOWERS[(fh * 1000) % FLOWERS.length | 0];
      buf[y * BW + x] = c;
    }
    const trees = L.trees.items.slice().sort((a, b) => a.base - b.base);
    for (const it of trees) blit(buf, BW, BH, it.s, it.x - mo, it.base - it.s.h);

    // path with a grass verge, both at ground speed
    const go = Math.floor(cam);
    for (let x = 0; x < BW; x++) {
      const xw = x + go, vh = Math.floor(hash(xw, 1, 9) * 3);
      for (let y = pathTop - 1 - vh; y < pathTop; y++) buf[y * BW + x] = VERGE[hash(xw, y, 10) < 0.5 ? 1 : 2];
      if (vh === 2) buf[(pathTop - 3) * BW + x] = VERGE[3];
      for (let y = pathTop; y < fgTop; y++) {
        const ly = y - pathTop, seam = (xw % 11 === 0) || (ly === 4 && (xw + 5) % 11 === 0);
        let c = ly === 0 ? PATH[4] : ly === fgTop - pathTop - 1 ? PATH[0] : PATH[hash(xw, y, 11) < 0.15 ? 3 : 2];
        if (seam && ly > 0 && ly < fgTop - pathTop - 1) c = PATH[1];
        if (ly === 4 && ly > 0) c = (xw % 11) > 5 ? PATH[1] : c;
        buf[y * BW + x] = c;
      }
    }
    drawLayerItems(L.verge, L.verge.offset(cam, t), (it) => pathTop - it.s.h + 1);

    // dust kicked up on each step
    if (dt > 0) {
      const step = Math.floor(phase / Math.PI);
      if (step !== lastStep) {
        lastStep = step;
        for (let k = 0; k < 3; k++) dust.push({ x: robotX - 1 + rand() * 3, y: pathTop + 5, vx: -SPEED * (0.5 + rand() * 0.6), vy: -4 - rand() * 6, life: 0.45 + rand() * 0.3 });
      }
    }
    dust = dust.filter((d) => (d.life -= dt) > 0);
    for (const d of dust) { d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 18 * dt; put(d.x, d.y, d.life > 0.25 ? PATH[4] : PATH[3]); }
    drawRobot(t);

    // foreground grass, passing faster than the path
    const fo = Math.floor(L.fg.offset(cam, t));
    for (let x = 0; x < BW; x++) {
      const xw = x + fo, bh = Math.floor(hash(xw, 2, 12) * 3);
      for (let y = fgTop - bh; y < BH; y++) {
        const hv = hash(xw >> 1, y >> 1, 13) * 0.6 + hash(xw, y, 14) * 0.4;
        buf[y * BW + x] = y < fgTop + 1 ? FG[3] : FG[hv < 0.25 ? 0 : hv < 0.6 ? 1 : hv < 0.9 ? 2 : 3];
      }
    }
    const fgItems = L.fg.items.slice().sort((a, b) => a.y - b.y);
    for (const it of fgItems) blit(buf, BW, BH, it.s, it.x - fo, it.y - it.s.h);

    lctx.putImageData(img, 0, 0);
  }

  /* ---- the wing in the airflow, above the clouds ----
     Potential flow past a Joukowski airfoil: a circle mapped by z = zeta + 1/zeta, with
     circulation set by the Kutta condition. Brighter streaks are faster air. */
  const cadd = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const csub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
  const cdiv = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
  const cabs = (a) => Math.hypot(a[0], a[1]);
  const csqrt = (a) => { const r = cabs(a); return [Math.sqrt((r + a[0]) / 2), Math.sign(a[1] || 1) * Math.sqrt(Math.max(0, (r - a[0]) / 2))]; };
  const expi = (t) => [Math.cos(t), Math.sin(t)];
  const mu = [-0.085, 0.055], RJ = cabs(csub([1, 0], mu)), beta = Math.asin(0.055 / RJ);
  let alpha = 0, eNegA, ePosA, R2eA, circ;
  function setAlpha(a) {
    alpha = a; eNegA = expi(-a); ePosA = expi(a);
    R2eA = [RJ * RJ * ePosA[0], RJ * RJ * ePosA[1]];
    circ = [0, 2 * RJ * Math.sin(a + beta)];
  }
  const alphaAt = (t) => ((6 + 2.5 * Math.sin((t / 10) * Math.PI * 2)) * Math.PI) / 180;
  function zetaOf(z) {
    const r = csqrt(csub(cmul(z, z), [4, 0]));
    const z1 = [(z[0] + r[0]) / 2, (z[1] + r[1]) / 2], z2 = [(z[0] - r[0]) / 2, (z[1] - r[1]) / 2];
    const d1 = cabs(csub(z1, mu)), d2 = cabs(csub(z2, mu));
    return Math.max(d1, d2) >= RJ * 1.0005 ? (d1 >= d2 ? z1 : z2) : null;
  }
  function velocity(z) {
    const zeta = zetaOf(z);
    if (!zeta) return null;
    const zp = csub(zeta, mu);
    const dW = cadd(csub(eNegA, cdiv(R2eA, cmul(zp, zp))), cdiv(circ, zp));
    const dz = csub([1, 0], cdiv([1, 0], cmul(zeta, zeta)));
    if (cabs(dz) < 1e-3) return null;
    return cdiv(dW, dz);
  }
  const outline = [];
  for (let i = 0; i <= 180; i++) {
    const t = (i / 180) * Math.PI * 2, zeta = cadd(mu, [RJ * Math.cos(t), RJ * Math.sin(t)]);
    outline.push(cadd(zeta, cdiv([1, 0], zeta)));
  }
  let dpr = 1, wcx = 0, wcy = 0, wcy0 = 0, ws = 1, flowBottom = 0, particles = [];
  const toScreen = (z) => { const zr = cmul(z, eNegA); return [wcx + ws * zr[0], wcy - ws * zr[1]]; };
  const toWorld = (x, y) => cmul([(x - wcx) / ws, -(y - wcy) / ws], ePosA);
  const spawnP = (any) => ({ x: any ? Math.random() * W : -10 - Math.random() * 40, y: Math.random() * flowBottom, life: 0 });

  function buildWing() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    [flowCanvas, wingCanvas].forEach((c) => { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); });
    fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cloudTop = (meadowTop - 92) * P;        // top of the far cloud band, in screen px
    flowBottom = Math.max(120, cloudTop + 40);
    if (W >= 900) {
      ws = Math.max(W * 0.05, Math.min(W * 0.068, (cloudTop - 30) / 2.6));
      wcx = W * 0.72; wcy0 = Math.max(ws * 0.9, Math.min(H * 0.26, cloudTop - ws * 1.3));
    } else {
      const top = copy ? copy.getBoundingClientRect().bottom - hero.getBoundingClientRect().top : H * 0.5;
      ws = Math.max(34, Math.min(W * 0.14, (cloudTop - top) / 2.2));
      wcx = W * 0.5; wcy0 = Math.max(top + ws * 0.9, (top + cloudTop) / 2);
      flowBottom = Math.max(flowBottom, wcy0 + ws * 1.5);
    }
    wcy = wcy0;
    const n = Math.round(Math.min(900, Math.max(200, (W * flowBottom) / 1300)));
    particles = Array.from({ length: n }, () => spawnP(true));
  }
  const bins = [
    { max: 0.92, color: "rgba(160, 170, 210, 0.30)", width: 1 },
    { max: 1.22, color: "rgba(143, 220, 255, 0.45)", width: 1 },
    { max: Infinity, color: "rgba(210, 242, 255, 0.9)", width: 1.3 }
  ];
  const paths = bins.map(() => []);
  function advance(p, k) {
    const q = velocity(toWorld(p.x, p.y));
    if (!q || !isFinite(q[0]) || !isFinite(q[1])) return -1;
    let V = cmul([q[0], -q[1]], eNegA), sp = cabs(V);
    if (sp > 3) { V = [V[0] * 3 / sp, V[1] * 3 / sp]; sp = 3; }
    p.x += 2.1 * k * V[0]; p.y -= 2.1 * k * V[1];
    return sp;
  }
  function stepFlow(k) {
    fctx.globalCompositeOperation = "destination-out";
    fctx.fillStyle = "rgba(0, 0, 0, 0.08)";
    fctx.fillRect(0, 0, W, H);
    fctx.globalCompositeOperation = "source-over";
    paths.forEach((a) => (a.length = 0));
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i], x0 = p.x, y0 = p.y, sp = advance(p, k);
      p.life++;
      if (sp < 0 || p.x > W + 20 || p.y < -20 || p.y > flowBottom + 20 || p.life > 1400) { particles[i] = spawnP(false); continue; }
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
  function drawWing() {
    wctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    wctx.clearRect(0, 0, W, H);
    wctx.beginPath();
    outline.forEach((z, i) => { const p = toScreen(z); i ? wctx.lineTo(p[0], p[1]) : wctx.moveTo(p[0], p[1]); });
    wctx.closePath();
    wctx.fillStyle = "#0b1424"; wctx.fill();
    wctx.lineWidth = 1.5; wctx.strokeStyle = "rgba(232, 237, 244, 0.92)"; wctx.stroke();
  }

  // ---- loop ----
  let running = false, visible = true, last = 0, raf = 0, clock = 0;
  function frame(dtMs) {
    if (!ready) return;
    const dt = dtMs / 1000;
    clock += dt;
    setAlpha(alphaAt(clock));
    wcy = wcy0 + Math.sin(clock * 0.8) * ws * 0.06;
    render(clock, dt);
    stepFlow(dtMs / 16.67);
    drawWing();
  }
  function loop(now) {
    if (!running) return;
    const dtMs = last ? Math.min(now - last, 50) : 16.67;
    last = now;
    frame(dtMs);
    raf = requestAnimationFrame(loop);
  }
  function start() { if (running || reduceMotion || !visible || document.hidden) return; running = true; last = 0; raf = requestAnimationFrame(loop); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  function init() {
    if (build() === false) return;
    ready = true;
    buildWing();
    cam = 0; phase = 0; dust = [];
    setAlpha(alphaAt(0));
    render(0, 0);
    if (reduceMotion) {
      for (let y = 8; y < flowBottom; y += 14) {
        const p = { x: -5, y, life: 0 };
        fctx.beginPath(); fctx.moveTo(p.x, p.y);
        for (let i = 0; i < 2200 && p.x < W + 10; i++) { if (advance(p, 0.6) < 0) break; fctx.lineTo(p.x, p.y); }
        fctx.strokeStyle = "rgba(143, 220, 255, 0.28)"; fctx.lineWidth = 1; fctx.stroke();
      }
      drawWing();
      return;
    }
    for (let i = 0; i < 90; i++) stepFlow(1);
    drawWing();
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
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { stop(); init(); });
  // rebuild if the hero gets its real width later (for example a tab hidden while loading)
  if ("ResizeObserver" in window) {
    new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      if (!ready && w >= 16) { lastW = w; stop(); init(); }
    }).observe(hero);
  }
  init();
} catch (err) { console.error("Scene failed to load:", err); } })();
/* Underground: a cut-away below the landscape, made of blocks. Dirt gives way to stone and
   then deepslate, with ores that get rarer and shinier with depth (coal, iron, gold, lapis,
   redstone, diamond, the odd emerald), fossils, a lava pocket, torches, and the pixel robot
   arm drilling ore in a cave. The bottom crumbles away into space. */
(() => { try {
  const sec = document.querySelector(".dig");
  const canvas = document.getElementById("dig");
  if (!sec || !canvas || !canvas.getContext) return;
  const ctx = canvas.getContext("2d");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const { rgb, rng, hash, pickW, bayer } = PX;
  const rand = rng((Math.random() * 1e9) | 0);
  const C = (arr) => arr.map((h) => rgb(h));

  const B = 8;   // block size in buffer pixels
  const T = { AIR: 0, CAVE: 1, DIRT: 2, GRAVEL: 3, STONE: 4, DEEP: 5, VOID: 6, LAVA: 7 };
  const PAL = {
    [T.DIRT]: C(["#4a3020", "#5e3f29", "#7a5236", "#8f6443"]),
    [T.GRAVEL]: C(["#5e5a57", "#77726d", "#8f8a84", "#aaa49d"]),
    [T.STONE]: C(["#55585f", "#666970", "#7b7e87", "#8f939c"]),
    [T.DEEP]: C(["#35363e", "#3f414a", "#4b4d57", "#5a5c66"]),
    [T.VOID]: C(["#17111f", "#21182e", "#2d2140", "#3e2e58"]),
    [T.CAVE]: C(["#0c0a10", "#120f17", "#16121d", "#1b1624"])
  };
  const ORES = {
    coal: C(["#141417", "#2a2a30", "#45454d"]),
    iron: C(["#9a6a4e", "#d8a989", "#f2d6c0"]),
    gold: C(["#a87c0c", "#f2cf3a", "#fff3a8"]),
    lapis: C(["#1a2f86", "#3c63d6", "#8aa8ff"]),
    redstone: C(["#7d1010", "#e03a2e", "#ff9078"]),
    diamond: C(["#13827d", "#4ee6e0", "#cbfffb"]),
    emerald: C(["#0e7036", "#2ed36b", "#aaffc8"])
  };
  const SHINY = new Set(["gold", "lapis", "diamond", "emerald", "redstone"]);
  const oreAt = (d) => pickW(rand, [
    [d < 0.7 ? 1 : 0.25, "coal"], [d > 0.08 && d < 0.85 ? 0.85 : 0.1, "iron"], [d > 0.4 ? 0.35 : 0.04, "gold"],
    [d > 0.45 ? 0.25 : 0, "lapis"], [d > 0.55 ? 0.35 : 0, "redstone"], [d > 0.6 ? 0.4 : 0, "diamond"], [0.04, "emerald"]
  ]);
  const BONE = C(["#5d5446", "#c9bd9d", "#ece2c4"]);
  const LAVA = C(["#b8300c", "#ff6a14", "#ffa52a", "#ffe07a"]);
  const ARM = {
    line: rgb("#050a14"), dark: rgb("#1c2943"), base: rgb("#3b5078"), light: rgb("#7f97c2"), shine: rgb("#dfe7f3"),
    joint: rgb("#c4cfe2"), jointDark: rgb("#6d7f9f"), flow: rgb("#8fdcff"), flowDim: rgb("#2b5b74"), flag: rgb("#ff6b4a")
  };

  let W = 0, H = 0, P = 4, BW = 0, BH = 0, cols = 0, rows = 0, img = null, buf = null, stat = null;
  let cells = [], lavaPx = [], shinyPx = [], floaters = [], torches = [], sparkles = [], parts = [];
  let mine = null;

  const cellAt = (c, r) => (c >= 0 && r >= 0 && c < cols && r < rows ? cells[r * cols + c] : null);
  const solid = (cell) => cell && cell.t !== T.AIR && cell.t !== T.CAVE && cell.t !== T.LAVA;

  function texel(cell, gx, gy) {
    const lx = gx % B, ly = gy % B;
    if (cell.t === T.CAVE) {
      const near = [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dx, dy]) => {
        const n = cellAt(Math.floor((gx + dx * 2) / B), Math.floor((gy + dy * 2) / B));
        return solid(n);
      });
      return PAL[T.CAVE][near ? 0 : hash(gx >> 1, gy >> 1, 3) < 0.5 ? 1 : 2];
    }
    const pal = PAL[cell.t] || PAL[T.STONE];
    let hv = hash(gx >> 1, gy >> 1, cell.t) * 0.6 + hash(gx, gy, cell.t + 9) * 0.4;
    if (cell.t === T.DEEP && gy % 3 === 0) hv -= 0.2;
    let i = hv < 0.18 ? 0 : hv < 0.48 ? 1 : hv < 0.85 ? 2 : 3;
    if (cell.t === T.GRAVEL) i = Math.floor(hash(gx >> 1, gy >> 1, 21) * 4);
    if (lx === B - 1 || ly === B - 1) i = Math.max(0, i - 1);   // soft block edges
    let col = pal[i];
    if (cell.ore && ORES[cell.ore]) {
      const o = ORES[cell.ore];
      for (let k = 0; k < 4; k++) {
        const cx = 1 + Math.floor(hash(cell.c, cell.r * 7 + k, 40 + cell.seed) * 5), cy = 1 + Math.floor(hash(cell.r, cell.c * 7 + k, 41 + cell.seed) * 5);
        if (lx >= cx && lx <= cx + 1 && ly >= cy && ly <= cy + 1) col = lx === cx && ly === cy ? o[2] : lx === cx + 1 && ly === cy + 1 ? o[0] : o[1];
      }
    }
    return col;
  }

  function carve(cx, cy, rx, ry) {
    for (let r = Math.floor(cy - ry); r <= Math.ceil(cy + ry); r++) for (let c = Math.floor(cx - rx); c <= Math.ceil(cx + rx); c++) {
      const cell = cellAt(c, r);
      if (cell && ((c - cx) / rx) ** 2 + ((r - cy) / ry) ** 2 <= 1 && cell.t !== T.AIR) { cell.t = T.CAVE; cell.ore = null; }
    }
  }

  let ready = false;
  function build() {
    const r = sec.getBoundingClientRect();
    W = r.width; H = r.height;
    ready = false;
    if (W < 16 || H < 16) return;
    P = W >= 900 ? 4 : 3;
    BW = Math.ceil(W / P); BH = Math.ceil(H / P);
    canvas.width = BW; canvas.height = BH;
    canvas.style.width = BW * P + "px"; canvas.style.height = BH * P + "px";
    img = ctx.createImageData(BW, BH);
    buf = new Uint32Array(img.data.buffer);
    stat = new Uint32Array(BW * BH);
    cols = Math.ceil(BW / B); rows = Math.ceil(BH / B);
    cells = [];
    const crumble = 7;
    for (let rr = 0; rr < rows; rr++) for (let c = 0; c < cols; c++) {
      const d = rr / rows;
      const dirtRows = 2 + (hash(c, 0, 50) < 0.5 ? 1 : 0) + (hash(c >> 1, 0, 51) < 0.3 ? 1 : 0);
      let t = rr < dirtRows ? T.DIRT : d > 0.56 + (hash(c >> 2, 0, 52) - 0.5) * 0.12 ? T.DEEP : T.STONE;
      if (t === T.STONE && hash(c >> 1, rr >> 1, 53) < 0.08) t = T.GRAVEL;
      const fromBottom = rows - rr;
      if (fromBottom <= crumble) {
        const keep = Math.pow((fromBottom - 1) / crumble, 1.3);
        t = hash(c, rr, 54) < keep ? (hash(c, rr, 55) < 0.55 ? T.DEEP : T.VOID) : T.AIR;
      }
      cells.push({ t, c, r: rr, ore: null, seed: (hash(c, rr, 56) * 100) | 0, float: fromBottom <= 4 });
    }
    // ores, in small veins
    for (const cell of cells) {
      if ((cell.t !== T.STONE && cell.t !== T.DEEP) || cell.r < 3 || rows - cell.r <= 4) continue;
      if (rand() < 0.055) {
        const ore = oreAt(cell.r / rows);
        cell.ore = ore;
        const n = rand() < 0.5 ? 1 + Math.floor(rand() * 3) : 0;
        for (let k = 0; k < n; k++) {
          const nb = cellAt(cell.c + Math.round(rand() * 2 - 1), cell.r + Math.round(rand() * 2 - 1));
          if (nb && (nb.t === T.STONE || nb.t === T.DEEP)) nb.ore = ore;
        }
      }
    }
    // caves: the mining chamber, a winding tunnel, and a lava pocket
    const wide = W >= 900;
    const mc = Math.round(cols * (wide ? 0.7 : 0.55)), mr = Math.round(rows * 0.42), mw = wide ? 4.6 : 3.6;
    carve(mc, mr, mw, 2.2);
    for (let c = Math.round(mc - mw); c <= Math.round(mc + mw); c++) { const cell = cellAt(c, mr + 2); if (cell) { cell.t = T.CAVE; cell.ore = null; } }
    let tx = cols * (wide ? 0.18 : 0.15), ty = rows * 0.28;
    for (let k = 0; k < 14; k++) { carve(tx, ty, 1.4, 1); tx += 0.9 + rand() * 0.6; ty += (rand() - 0.5) * 1.2; }
    const lc = Math.round(cols * (wide ? 0.32 : 0.7)), lr = Math.max(mr + 1, Math.min(Math.round(rows * 0.76), rows - 11));
    carve(lc, lr, 3.2, 1.4);
    for (let c = lc - 3; c <= lc + 3; c++) { const cell = cellAt(c, lr + 1); if (cell && cell.t === T.CAVE) cell.t = T.LAVA; }

    // mining target: the block in the chamber's right wall, one above the floor
    const floorRow = mr + 3;
    let wallC = Math.round(mc + mw);
    while (cellAt(wallC, floorRow - 1) && cellAt(wallC, floorRow - 1).t === T.CAVE) wallC++;
    const target = cellAt(wallC, floorRow - 1);
    if (target) { target.t = target.r / rows > 0.56 ? T.DEEP : T.STONE; target.ore = oreAt(0.7); }
    for (let c = Math.round(mc - mw) - 1; c <= wallC; c++) { const f = cellAt(c, floorRow); if (f && f.t === T.CAVE) { f.t = T.STONE; f.ore = null; } }

    // render the static blocks
    lavaPx = []; shinyPx = []; floaters = [];
    for (const cell of cells) {
      if (cell.t === T.AIR) continue;
      if (cell.float && solid(cell)) { floaters.push({ cell, ph: rand() * 6.28, amp: 1 + rand() * 1.5 }); continue; }
      for (let y = 0; y < B; y++) for (let x = 0; x < B; x++) {
        const gx = cell.c * B + x, gy = cell.r * B + y;
        if (gx >= BW || gy >= BH) continue;
        if (cell.t === T.LAVA) { lavaPx.push(gx, gy); continue; }
        const col = texel(cell, gx, gy);
        stat[gy * BW + gx] = col;
        if (cell.ore && SHINY.has(cell.ore) && col === ORES[cell.ore][2]) shinyPx.push(gx, gy);
      }
    }
    // grass roots along the top, meeting the meadow above
    for (let x = 0; x < BW; x++) {
      const h = Math.floor(hash(x, 0, 60) * 3);
      for (let y = 0; y <= h; y++) stat[y * BW + x] = hash(x, y, 61) < 0.5 ? rgb("#1c4529") : rgb("#225432");
      if (hash(x, 5, 62) < 0.08) for (let y = h + 1; y < h + 4 + hash(x, 6, 63) * 6; y++) stat[y * BW + x] = rgb("#3a2618");   // roots
    }
    // fossils
    const fossilKinds = [ammonite, fish, dino];
    const placed = [];
    for (let k = 0; k < (wide ? 3 : 2); k++) {
      for (let tries = 0; tries < 40; tries++) {
        const kind = fossilKinds[(k + tries) % 3];
        const fx = 6 + Math.floor(rand() * (BW - 40)), fy = Math.floor(BH * (0.18 + rand() * 0.42));
        if (placed.some((p) => Math.abs(p[0] - fx) < 40 && Math.abs(p[1] - fy) < 24)) continue;
        if (!kind(fx, fy, true)) continue;
        kind(fx, fy, false); placed.push([fx, fy]); break;
      }
    }
    // torches on cave walls
    torches = [];
    const addTorch = (c, r) => { const x = c * B + 3, y = r * B + 2; torches.push({ x, y }); };
    addTorch(Math.round(mc - mw) + 1, mr - 1);
    addTorch(Math.round(lc - 2), lr);
    for (const tch of torches) for (let y = tch.y + 3; y < tch.y + 8; y++) { stat[y * BW + tch.x] = rgb("#6b4a33"); stat[y * BW + tch.x + 1] = rgb("#4a3326"); }

    // mining arm setup (buffer px)
    const floorY = floorRow * B, faceX = wallC * B, faceY = (floorRow - 1) * B + 4;
    ready = true;
    mine = {
      target, floorY, faceX, faceY, drill: 6,
      base: [faceX - 30, floorY - 6], rest: [faceX - 26, floorY - 24],
      L1: 15, L2: 15, crack: Array.from({ length: 16 }, () => [Math.floor(rand() * B), Math.floor(rand() * B)]),
      order: Array.from({ length: 64 }, (_, i) => i).sort(() => rand() - 0.5), ore: target ? target.ore : "diamond"
    };
  }

  // ---- fossils: drawn as bone pixels with a dark outline, only over solid rock ----
  function bonesInto(fx, fy, mask, w, h, test) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const gx = fx + x, gy = fy + y;
      const cell = cellAt(Math.floor(gx / B), Math.floor(gy / B));
      if (!mask[y * w + x] && !(mask[(y - 1) * w + x] || mask[(y + 1) * w + x] || (x > 0 && mask[y * w + x - 1]) || (x < w - 1 && mask[y * w + x + 1]))) continue;
      if (!solid(cell) || cell.ore) { if (test) return false; continue; }
      if (test) continue;
      stat[gy * BW + gx] = mask[y * w + x] ? (hash(gx, gy, 70) < 0.35 ? BONE[2] : BONE[1]) : BONE[0];
    }
    return true;
  }
  function line(mask, w, h, x0, y0, x1, y1, th = 0) {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2) || 1;
    for (let k = 0; k <= n; k++) {
      const x = Math.round(x0 + ((x1 - x0) * k) / n), y = Math.round(y0 + ((y1 - y0) * k) / n);
      for (let j = 0; j <= th; j++) for (let i = 0; i <= th; i++) if (x + i >= 0 && y + j >= 0 && x + i < w && y + j < h) mask[(y + j) * w + x + i] = 1;
    }
  }
  function ammonite(fx, fy, test) {
    const w = 15, h = 15, m = new Uint8Array(w * h);
    let px = 7, py = 7;
    for (let a = 0; a < Math.PI * 5; a += 0.12) {
      const r = 0.5 + a * 0.42, x = 7 + Math.cos(a) * r, y = 7 + Math.sin(a) * r;
      line(m, w, h, px, py, x, y); px = x; py = y;
      if (a > 3 && Math.abs((a % 0.7) - 0.35) < 0.07) line(m, w, h, x, y, 7 + Math.cos(a) * (r - 1.6), 7 + Math.sin(a) * (r - 1.6));
    }
    return bonesInto(fx, fy, m, w, h, test);
  }
  function fish(fx, fy, test) {
    const w = 22, h = 11, m = new Uint8Array(w * h);
    line(m, w, h, 5, 5, 18, 5);
    for (let x = 7; x <= 16; x += 2) { const l = 4 - (x - 7) * 0.25; line(m, w, h, x, 5, x + 1, 5 - l); line(m, w, h, x, 5, x + 1, 5 + l); }
    line(m, w, h, 1, 3, 5, 3, 1); line(m, w, h, 1, 6, 5, 7, 1); line(m, w, h, 1, 3, 1, 6);    // skull
    line(m, w, h, 18, 5, 21, 2); line(m, w, h, 18, 5, 21, 8); line(m, w, h, 21, 2, 21, 8);   // tail
    m[4 * w + 3] = 0;
    return bonesInto(fx, fy, m, w, h, test);
  }
  function dino(fx, fy, test) {
    const w = 30, h = 16, m = new Uint8Array(w * h);
    let px = 2, py = 9;
    for (let x = 2; x <= 22; x++) { const y = 9 - Math.sin(((x - 2) / 20) * Math.PI) * 4; line(m, w, h, px, py, x, y); px = x; py = y; }
    for (let x = 8; x <= 18; x += 2) { const y = 9 - Math.sin(((x - 2) / 20) * Math.PI) * 4; line(m, w, h, x, y + 1, x - 1, y + 6); }
    line(m, w, h, 22, 9, 26, 5); line(m, w, h, 24, 3, 29, 4, 1); line(m, w, h, 24, 6, 29, 6);      // neck and skull
    for (let x = 25; x <= 28; x += 2) m[7 * w + x] = 1;                                             // teeth
    line(m, w, h, 8, 11, 6, 15); line(m, w, h, 16, 11, 18, 15);                                     // legs
    return bonesInto(fx, fy, m, w, h, test);
  }

  // ---- arm primitives (same pixel style as the hero arm) ----
  const put = (x, y, c) => { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < BW && y < BH) buf[y * BW + x] = c; };
  function capsule(a, b, r, cols3) {
    const [lineC, darkC, baseC, lightC, shineC] = cols3;
    const minX = Math.floor(Math.min(a[0], b[0]) - r - 2), maxX = Math.ceil(Math.max(a[0], b[0]) + r + 2);
    const minY = Math.floor(Math.min(a[1], b[1]) - r - 2), maxY = Math.ceil(Math.max(a[1], b[1]) + r + 2);
    const dx = b[0] - a[0], dy = b[1] - a[1], len2 = dx * dx + dy * dy || 1, len = Math.sqrt(len2);
    let nx = -dy / len, ny = dx / len;
    if (nx + ny > 0) { nx = -nx; ny = -ny; }
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5, py = y + 0.5;
      const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / len2));
      const qx = px - (a[0] + t * dx), qy = py - (a[1] + t * dy), d = Math.hypot(qx, qy);
      if (d > r + 1) continue;
      if (d > r) { put(x, y, lineC); continue; }
      const side = (qx * nx + qy * ny) / r;
      put(x, y, side > 0.62 ? shineC : side > 0.2 ? lightC : side > -0.5 ? baseC : darkC);
    }
  }
  function disc(c, r, col) {
    for (let y = -Math.ceil(r); y <= Math.ceil(r); y++) for (let x = -Math.ceil(r); x <= Math.ceil(r); x++) if (x * x + y * y <= r * r) put(c[0] + x, c[1] + y, col);
  }
  function joint(c, r, on) {
    disc(c, r + 1, ARM.line); disc(c, r, ARM.jointDark); disc([c[0] - 0.5, c[1] - 0.5], r - 0.8, ARM.joint);
    disc(c, Math.max(0.8, r * 0.4), on ? ARM.flow : ARM.flowDim);
  }
  function ik(base, target) {
    const { L1, L2 } = mine;
    const dx = target[0] - base[0], dy = target[1] - base[1], d = Math.min(Math.hypot(dx, dy), L1 + L2 - 0.5);
    const phi = Math.atan2(dy, dx), a = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
    const e1 = [base[0] + L1 * Math.cos(phi - a), base[1] + L1 * Math.sin(phi - a)];
    const e2 = [base[0] + L1 * Math.cos(phi + a), base[1] + L1 * Math.sin(phi + a)];
    const score = (e) => e[1] + 0.6 * e[0];   // elbow up and back
    return score(e1) < score(e2) ? e1 : e2;
  }
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const lerp2 = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];

  // ---- one frame ----
  const CYCLE = 6.5;
  let lastCycle = -1;
  function render(t, dt) {
    if (!ready) return;
    buf.set(stat);
    // lava
    for (let i = 0; i < lavaPx.length; i += 2) {
      const x = lavaPx[i], y = lavaPx[i + 1];
      const v = 0.5 + 0.28 * Math.sin(x * 0.55 + t * 2.4) + 0.22 * Math.sin(y * 1.3 - t * 1.7 + x * 0.21) + (bayer(x, y) - 0.5) * 0.25;
      buf[y * BW + x] = LAVA[y % B === 0 ? 3 : Math.max(0, Math.min(3, Math.floor(v * 4)))];
    }
    // floating blocks at the bottom, drifting into space
    for (const f of floaters) {
      const off = Math.round(Math.sin(t * 0.9 + f.ph) * f.amp);
      for (let y = 0; y < B; y++) for (let x = 0; x < B; x++) {
        const gx = f.cell.c * B + x, gy = f.cell.r * B + y + off;
        if (gx < BW && gy >= 0 && gy < BH) buf[gy * BW + gx] = texel(f.cell, gx, f.cell.r * B + y);
      }
    }
    // torches
    for (const tch of torches) {
      const fl = Math.floor(t * 9 + tch.x) % 3;
      put(tch.x, tch.y + 2, rgb("#ff8a1f")); put(tch.x + 1, tch.y + 2, rgb("#ffb43a"));
      put(tch.x + (fl === 1 ? 1 : 0), tch.y + 1, rgb("#ffd86b")); put(tch.x + (fl === 2 ? 0 : 1), tch.y, rgb("#fff1b0"));
    }
    // sparkles on shiny ore
    if (dt > 0 && shinyPx.length && rand() < dt * 10) {
      const k = Math.floor(rand() * (shinyPx.length / 2)) * 2;
      sparkles.push({ x: shinyPx[k], y: shinyPx[k + 1], life: 0.35 });
    }
    sparkles = sparkles.filter((s) => (s.life -= dt) > 0);
    for (const s of sparkles) {
      put(s.x, s.y, rgb("#ffffff"));
      if (s.life > 0.15) { put(s.x - 1, s.y, rgb("#d8fffd")); put(s.x + 1, s.y, rgb("#d8fffd")); put(s.x, s.y - 1, rgb("#d8fffd")); put(s.x, s.y + 1, rgb("#d8fffd")); }
    }
    if (mine && mine.target) drawMine(t, dt);
    ctx.putImageData(img, 0, 0);
  }

  function drawMine(t, dt) {
    const m = mine, cyc = t % CYCLE, cycleN = Math.floor(t / CYCLE);
    if (cycleN !== lastCycle) {   // a new block grows back each cycle
      lastCycle = cycleN;
      m.ore = oreAt(0.55 + rand() * 0.4);
      m.target.ore = m.ore;
      m.target.seed = (rand() * 100) | 0;
    }
    const contact = [m.faceX - m.drill - 1, m.faceY], approach = [m.faceX - m.drill - 4, m.faceY];
    let wrist, crack = 0, broken = false, grow = 1, drilling = false;
    if (cyc < 1) wrist = lerp2(m.rest, approach, ease(cyc));
    else if (cyc < 1.3) wrist = lerp2(approach, contact, ease((cyc - 1) / 0.3));
    else if (cyc < 3.6) { drilling = true; crack = (cyc - 1.3) / 2.3; wrist = [contact[0] + (Math.random() < 0.5 ? 0 : 1), contact[1] + (Math.random() < 0.5 ? 0 : 1) * 0.6]; }
    else if (cyc < 4.6) { broken = true; wrist = lerp2(contact, m.rest, ease(cyc - 3.6)); }
    else { wrist = m.rest; broken = cyc < 5.2; grow = cyc < 5.2 ? 0 : Math.min(1, (cyc - 5.2) / 1.1); }

    // the target block: cracking, broken, or growing back
    const tc = m.target, bx = tc.c * B, by = tc.r * B;
    const shown = Math.round(grow * 64);
    for (let i = 0; i < 64; i++) {
      const x = i % B, y = (i / B) | 0, gx = bx + x, gy = by + y;
      if (broken || m.order.indexOf(i) >= shown) buf[gy * BW + gx] = PAL[T.CAVE][x === 0 || y === B - 1 ? 0 : 1];
      else buf[gy * BW + gx] = texel(tc, gx, gy);
    }
    if (!broken && crack > 0) for (let k = 0; k < Math.floor(crack * m.crack.length); k++) put(bx + m.crack[k][0], by + m.crack[k][1], rgb("#0b090f"));
    if (dt > 0 && drilling && Math.random() < dt * 30) {
      const o = ORES[m.ore];
      parts.push({ x: m.faceX - 1, y: m.faceY + (Math.random() - 0.5) * 3, vx: -10 - Math.random() * 25, vy: -12 - Math.random() * 18, life: 0.6, c: Math.random() < 0.5 ? o[1] : PAL[T.STONE][2] });
    }
    if (dt > 0 && Math.abs(cyc - 3.6) < dt) {
      const o = ORES[m.ore];
      for (let k = 0; k < 22; k++) parts.push({ x: bx + Math.random() * B, y: by + Math.random() * B, vx: (Math.random() - 0.6) * 50, vy: -10 - Math.random() * 30, life: 0.9, c: k % 3 ? o[Math.floor(Math.random() * 3)] : PAL[T.STONE][3] });
    }

    // pedestal with a hazard band
    const [sx, sy] = m.base;
    for (let y = sy + 2; y < m.floorY; y++) {
      const half = 4 + (y - sy) * 0.4;
      for (let x = Math.round(sx - half); x <= Math.round(sx + half); x++) {
        const edge = x === Math.round(sx - half) || x === Math.round(sx + half);
        let c = edge ? ARM.line : x < sx - half * 0.4 ? ARM.light : x > sx + half * 0.5 ? ARM.dark : ARM.base;
        if (!edge && y === m.floorY - 2) c = (x >> 1) % 2 ? ARM.flag : ARM.line;
        put(x, y, c);
      }
    }
    const elbow = ik(m.base, wrist);
    const armCols = [ARM.line, ARM.dark, ARM.base, ARM.light, ARM.shine];
    capsule(m.base, elbow, 2.2, armCols);
    capsule(elbow, wrist, 1.7, armCols);
    // drill: housing plus a spinning bit pointing at the wall
    capsule([wrist[0] - 1, wrist[1]], [wrist[0] + 2, wrist[1]], 2, armCols);
    const spin = Math.floor(t * (drilling ? 24 : 6));
    for (let k = 0; k < m.drill; k++) {
      const half = Math.max(0, Math.round(1.5 - k * 0.3));
      for (let j = -half; j <= half; j++) put(wrist[0] + 3 + k, wrist[1] + j, (k + j + spin) % 2 ? rgb("#e6ebf2") : rgb("#7d8597"));
    }
    joint(elbow, 2.4, true);
    joint(m.base, 3, true);
    joint(wrist, 1.8, Math.floor(t * 2) % 2 === 0);

    parts = parts.filter((p) => (p.life -= dt) > 0);
    for (const p of parts) {
      p.vy += 70 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.y > m.floorY - 1) { p.y = m.floorY - 1; p.vy = 0; p.vx *= 0.8; }
      put(p.x, p.y, p.c);
    }
  }

  // ---- loop ----
  let running = false, visible = false, last = 0, raf = 0, clock = 0;
  function loop(now) {
    if (!running) return;
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
    last = now; clock += dt;
    render(clock, dt);
    raf = requestAnimationFrame(loop);
  }
  function start() { if (running || reduceMotion || !visible || document.hidden) return; running = true; last = 0; raf = requestAnimationFrame(loop); }
  function stop() { running = false; cancelAnimationFrame(raf); }
  function init() { build(); render(2.2, 0); }
  // rebuild when the section's width changes, including from zero (for example a tab that
  // was hidden while the page loaded)
  if ("ResizeObserver" in window) {
    let rw = 0;
    new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      if (Math.abs(w - rw) < 2) return;
      const first = rw === 0;
      rw = w;
      if (!first || !ready) { lastW = w; stop(); init(); start(); }
    }).observe(sec);
  }

  let rt = 0, lastW = sec.getBoundingClientRect().width;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      const w = sec.getBoundingClientRect().width;
      if (Math.abs(w - lastW) < 2) return;
      lastW = w; stop(); init(); start();
    }, 150);
  });
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((e) => { visible = e[0].isIntersecting; visible ? start() : stop(); }, { rootMargin: "100px" }).observe(sec);
  } else { visible = true; }
  init();
  start();
} catch (err) { console.error("Scene failed to load:", err); } })();
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
