/* Hero: potential flow past a Joukowski airfoil.
   Circle in the zeta-plane with center mu and radius R through zeta = 1,
   mapped by z = zeta + 1/zeta. Circulation is set by the Kutta condition
   so the flow leaves the trailing edge smoothly. Particles are advected
   with the exact velocity field; color tracks local speed, so the fast
   suction side over the top of the wing reads brighter. */
(() => {
  const canvas = document.getElementById("flow");
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext("2d");
  const hero = canvas.parentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // complex helpers, [re, im]
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
  const div = (a, b) => {
    const d = b[0] * b[0] + b[1] * b[1];
    return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
  };
  const abs = (a) => Math.hypot(a[0], a[1]);
  const csqrt = (a) => {
    const r = abs(a);
    const re = Math.sqrt((r + a[0]) / 2);
    const im = Math.sign(a[1] || 1) * Math.sqrt(Math.max(0, (r - a[0]) / 2));
    return [re, im];
  };
  const expi = (t) => [Math.cos(t), Math.sin(t)];

  // airfoil and flow parameters
  const eps = 0.085, del = 0.055;               // thickness, camber
  const mu = [-eps, del];
  const R = abs(sub([1, 0], mu));
  const beta = Math.asin(del / R);
  const alpha = (6 * Math.PI) / 180;
  const gamma = 4 * Math.PI * R * Math.sin(alpha + beta);
  const eNegA = expi(-alpha), ePosA = expi(alpha);
  const R2eA = [R * R * ePosA[0], R * R * ePosA[1]];
  const circ = [0, gamma / (2 * Math.PI)];

  // exterior preimage of z, or null if z is inside the airfoil
  function zetaOf(z) {
    const r = csqrt(sub(mul(z, z), [4, 0]));
    const z1 = [(z[0] + r[0]) / 2, (z[1] + r[1]) / 2];
    const z2 = [(z[0] - r[0]) / 2, (z[1] - r[1]) / 2];
    const d1 = abs(sub(z1, mu)), d2 = abs(sub(z2, mu));
    const best = d1 >= d2 ? z1 : z2;
    return Math.max(d1, d2) >= R * 1.0005 ? best : null;
  }

  // complex velocity u - i v at z, or null inside the body
  function velocity(z) {
    const zeta = zetaOf(z);
    if (!zeta) return null;
    const zp = sub(zeta, mu);
    const dWdzeta = add(sub(eNegA, div(R2eA, mul(zp, zp))), div(circ, zp));
    const dzdzeta = sub([1, 0], div([1, 0], mul(zeta, zeta)));
    if (abs(dzdzeta) < 1e-3) return null;
    return div(dWdzeta, dzdzeta);
  }

  // airfoil outline in z
  const outline = [];
  for (let i = 0; i <= 180; i++) {
    const t = (i / 180) * Math.PI * 2;
    const zeta = add(mu, [R * Math.cos(t), R * Math.sin(t)]);
    outline.push(add(zeta, div([1, 0], zeta)));
  }

  let W = 0, H = 0, dpr = 1, cx = 0, cy = 0, s = 1;
  let particles = [];
  const STEP = 2.1; // px per frame at freestream speed

  // view: rotate by -alpha so the freestream is horizontal and the wing pitches nose up
  const toScreen = (z) => {
    const zr = mul(z, eNegA);
    return [cx + s * zr[0], cy - s * zr[1]];
  };
  const toWorld = (x, y) => mul([(x - cx) / s, -(y - cy) / s], ePosA);

  function layout() {
    const rect = hero.getBoundingClientRect();
    W = rect.width; H = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (W >= 900) {
      cx = W * 0.71; cy = H * 0.47; s = (W * 0.34) / 4;
    } else {
      cx = W * 0.56; cy = H - 92; s = (W * 0.66) / 4;
    }
    const n = Math.round(Math.min(1100, Math.max(260, (W * H) / 1300)));
    particles = Array.from({ length: n }, () => spawn(true));
  }

  function spawn(anywhere) {
    return {
      x: anywhere ? Math.random() * W : -10 - Math.random() * 40,
      y: Math.random() * H,
      life: 0
    };
  }

  function drawBody() {
    ctx.beginPath();
    outline.forEach((z, i) => {
      const p = toScreen(z);
      i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
    });
    ctx.closePath();
    ctx.fillStyle = "#0b1424";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(232, 237, 244, 0.9)";
    ctx.stroke();

    // chord line extended ahead of the nose, the freestream direction, and the angle between them
    const le = toScreen([-2.03, 0.05]);
    const te = toScreen([2, 0]);
    const L = s * 0.85;
    const ux = (le[0] - te[0]) / Math.hypot(le[0] - te[0], le[1] - te[1]);
    const uy = (le[1] - te[1]) / Math.hypot(le[0] - te[0], le[1] - te[1]);
    ctx.setLineDash([3, 5]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(141, 154, 176, 0.6)";
    ctx.beginPath(); ctx.moveTo(te[0], te[1]); ctx.lineTo(le[0] + ux * L, le[1] + uy * L); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(le[0], le[1]); ctx.lineTo(le[0] - L, le[1]); ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(255, 107, 74, 0.95)";
    ctx.beginPath();
    ctx.arc(le[0], le[1], L * 0.85, Math.PI, Math.atan2(uy, ux) + 2 * Math.PI, false);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 107, 74, 0.95)";
    ctx.font = "600 13px Switzer, system-ui, sans-serif";
    ctx.fillText("α", le[0] - L * 0.98, le[1] - L * 0.07 - 4);
  }

  const bins = [
    { max: 0.92, color: "rgba(141, 154, 176, 0.30)", width: 1 },
    { max: 1.22, color: "rgba(143, 220, 255, 0.42)", width: 1 },
    { max: Infinity, color: "rgba(196, 238, 255, 0.85)", width: 1.3 }
  ];
  const paths = bins.map(() => []);

  function advance(p, k) {
    const q = velocity(toWorld(p.x, p.y));
    if (!q || !isFinite(q[0]) || !isFinite(q[1])) return -1;
    // q = u - i v ; screen velocity is (u, -v) rotated into view
    let V = mul([q[0], -q[1]], eNegA);
    let speed = abs(V);
    if (speed > 3) { V = [V[0] * 3 / speed, V[1] * 3 / speed]; speed = 3; }
    p.x += STEP * k * V[0];
    p.y -= STEP * k * V[1];
    return speed;
  }

  function frame(k) {
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0, 0, 0, 0.075)";
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";

    paths.forEach((a) => (a.length = 0));
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const x0 = p.x, y0 = p.y;
      const speed = advance(p, k);
      p.life++;
      if (speed < 0 || p.x > W + 20 || p.y < -20 || p.y > H + 20 || p.life > 1400) {
        particles[i] = spawn(false);
        continue;
      }
      const b = speed < bins[0].max ? 0 : speed < bins[1].max ? 1 : 2;
      paths[b].push(x0, y0, p.x, p.y);
    }
    bins.forEach((bin, b) => {
      const a = paths[b];
      if (!a.length) return;
      ctx.beginPath();
      for (let j = 0; j < a.length; j += 4) { ctx.moveTo(a[j], a[j + 1]); ctx.lineTo(a[j + 2], a[j + 3]); }
      ctx.strokeStyle = bin.color;
      ctx.lineWidth = bin.width;
      ctx.stroke();
    });
    drawBody();
  }

  // still version for reduced motion: integrate a set of streamlines once
  function drawStill() {
    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = 1;
    for (let y = 8; y < H; y += 14) {
      const p = { x: -5, y, life: 0 };
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      for (let i = 0; i < 2200 && p.x < W + 10; i++) {
        if (advance(p, 0.6) < 0) break;
        ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = "rgba(143, 220, 255, 0.28)";
      ctx.stroke();
    }
    drawBody();
  }

  let running = false, visible = true, last = 0, raf = 0;
  function loop(t) {
    if (!running) return;
    const k = last ? Math.min((t - last) / 16.67, 2.5) : 1;
    last = t;
    frame(k);
    raf = requestAnimationFrame(loop);
  }
  function start() {
    if (running || reduceMotion || !visible || document.hidden) return;
    running = true; last = 0;
    raf = requestAnimationFrame(loop);
  }
  function stop() { running = false; cancelAnimationFrame(raf); }

  function init() {
    layout();
    if (reduceMotion) { drawStill(); return; }
    // warm up so the first painted frame already shows the flow pattern
    for (let i = 0; i < 90; i++) frame(1);
    start();
  }

  let resizeTimer = 0, lastW = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      // ignore height-only changes (mobile address bar showing and hiding)
      const w = hero.getBoundingClientRect().width;
      if (Math.abs(w - lastW) < 2) return;
      lastW = w;
      stop(); init();
    }, 150);
  });
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      visible ? start() : stop();
    }).observe(hero);
  }
  lastW = hero.getBoundingClientRect().width;
  init();
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
