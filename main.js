/* Hero: two robot arms assembling a little robot, on a loop.
   Arm A picks the base, body and head from the tray and stacks them on the fixture.
   Arm B drives a screw into each part. When the robot is complete its eyes light up,
   it drives off to the right, new parts drop into the tray, and the cycle repeats.
   Scene units: 560 x 340, floor at y = 300, y pointing down. */
(() => {
  const canvas = document.getElementById("scene");
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext("2d");
  const hero = canvas.parentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const C = {
    ink: "#0b1424", deck: "#13203a", chalk: "rgba(232, 237, 244, 0.92)",
    dim: "rgba(141, 154, 176, 0.55)", flow: "#8fdcff", flag: "#ff6b4a", spark: "#ffc49a"
  };

  const SCENE_W = 615;   // 560 of workbench plus room for arm B's elbow on the right
  const FLOOR = 300;
  const FIXTURE_TOP = 294;
  const STATION_X = 350;
  const L1 = 122, L2 = 122;
  const A = { base: [258, 232], rest: [250, 138] };
  const B = { base: [470, 232], rest: [482, 146] };
  const SLOTS = [48, 110, 172];
  // h: height, w: width, g: how far below the part's top the fingertips reach when gripping
  const PARTS = [
    { name: "base", w: 56, h: 32, g: 14 },
    { name: "body", w: 48, h: 40, g: 14 },
    { name: "head", w: 40, h: 36, g: 20 }
  ];
  const WRIST_TO_TIP = 34;   // gripper fingertip below the wrist
  const TOOL_TO_TIP = 30;    // screwdriver bit tip below the wrist

  // ---- easing and keyframe tracks ----
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeIn = (t) => t * t;
  const outBounce = (t) => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  };
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp01 = (t) => Math.max(0, Math.min(1, t));

  function track(first) {
    const keys = [{ t: 0, v: first }];
    return {
      keys,
      to(dt, v) { keys.push({ t: keys[keys.length - 1].t + dt, v }); return this; },
      hold(dt) { return this.to(dt, keys[keys.length - 1].v); },
      waitUntil(t) { const last = keys[keys.length - 1]; if (t > last.t) keys.push({ t, v: last.v }); return this; },
      get end() { return keys[keys.length - 1].t; },
      at(t) {
        if (t <= keys[0].t) return keys[0].v;
        for (let i = 1; i < keys.length; i++) {
          const k0 = keys[i - 1], k1 = keys[i];
          if (t <= k1.t) {
            const u = k1.t === k0.t ? 1 : easeInOut((t - k0.t) / (k1.t - k0.t));
            if (Array.isArray(k0.v)) return [lerp(k0.v[0], k1.v[0], u), lerp(k0.v[1], k1.v[1], u)];
            return lerp(k0.v, k1.v, u);
          }
        }
        return keys[keys.length - 1].v;
      }
    };
  }

  // ---- build one cycle ----
  const armA = track(A.rest);
  const armB = track(B.rest);
  const gapA = track(PARTS[0].w + 16);
  const grabT = [], placeT = [], spin = [];
  let stack = FIXTURE_TOP;
  const placedBottom = [];

  PARTS.forEach((p, i) => {
    const trayTop = FLOOR - p.h;
    const wGrab = trayTop + p.g - WRIST_TO_TIP;
    armA.to(0.85, [SLOTS[i], wGrab - 70]).to(0.45, [SLOTS[i], wGrab]);
    gapA.waitUntil(armA.end).to(0.22, p.w + 1);
    grabT[i] = armA.end + 0.1;
    armA.hold(0.28).to(0.42, [SLOTS[i], wGrab - 70]);

    placedBottom[i] = stack;
    const top = stack - p.h;
    const wPlace = top + p.g - WRIST_TO_TIP;
    armA.to(0.9, [STATION_X, wPlace - 60]).to(0.5, [STATION_X, wPlace]);
    placeT[i] = armA.end;
    gapA.waitUntil(armA.end).to(0.22, p.w + 16);
    armA.hold(0.26).to(0.4, [STATION_X, wPlace - 60]);
    stack = top;

    // arm B screws the part down once arm A has let go
    const screwTop = top + (p.name === "head" ? 10 : 0);
    const bx = STATION_X + (p.name === "base" ? 20 : 16);
    const wScrew = screwTop - TOOL_TO_TIP;
    armB.waitUntil(placeT[i] + 0.3).to(0.6, [bx, wScrew - 44]).to(0.3, [bx, wScrew]);
    const s0 = armB.end;
    armB.hold(0.8);
    spin.push([s0, armB.end, [bx, screwTop]]);
    armB.to(0.3, [bx, wScrew - 44]).to(0.55, B.rest);

    // next part needs a matching open gap before the grab
    if (i < PARTS.length - 1) gapA.waitUntil(armA.end + 0.2).to(0.2, PARTS[i + 1].w + 16);
  });
  armA.to(0.8, A.rest);
  const powerT = spin[spin.length - 1][1] + 0.35;
  const driveT = powerT + 1.4;
  const DRIVE_DUR = 2.6;
  const restockT = driveT + 0.6;
  const CYCLE = driveT + DRIVE_DUR + 0.4;
  armA.waitUntil(CYCLE); armB.waitUntil(CYCLE);
  gapA.waitUntil(CYCLE - 0.6).to(0.3, PARTS[0].w + 16).waitUntil(CYCLE);

  // ---- geometry helpers ----
  // side = -1 keeps the elbow up and out to the left (arm A), +1 up and out to the right (arm B),
  // so the two arms never cross
  function ik(base, target, side) {
    const dx = target[0] - base[0], dy = target[1] - base[1];
    const d = Math.min(Math.hypot(dx, dy), L1 + L2 - 0.5);
    const phi = Math.atan2(dy, dx);
    const a = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
    const e1 = [base[0] + L1 * Math.cos(phi - a), base[1] + L1 * Math.sin(phi - a)];
    const e2 = [base[0] + L1 * Math.cos(phi + a), base[1] + L1 * Math.sin(phi + a)];
    const score = (e) => e[1] - side * 0.6 * e[0];
    return score(e1) < score(e2) ? e1 : e2;
  }

  // ---- canvas layout ----
  let W = 0, H = 0, dpr = 1, s = 1, ox = 0, oy = 0, lw = 1;
  function layout() {
    const r = hero.getBoundingClientRect();
    W = r.width; H = r.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    if (W >= 900) {
      const areaW = W * 0.47, areaH = H * 0.8;
      s = Math.min(areaW / SCENE_W, areaH / 340);
      ox = W * 0.5 + (areaW - SCENE_W * s) / 2;
      oy = H * 0.5 - 175 * s;
    } else {
      s = Math.min((W - 16) / SCENE_W, 0.9);
      ox = (W - SCENE_W * s) / 2;
      oy = H - 330 * s - 4;
    }
    lw = 1.5 / s;
  }

  // ---- drawing ----
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
  }
  function shape(fill = C.deck, stroke = C.chalk) {
    ctx.fillStyle = fill; ctx.fill();
    ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke();
  }

  function drawPart(p, x, bottom, opts = {}) {
    ctx.save();
    ctx.translate(x, bottom);
    if (p.name === "base") {
      rr(-28, -32, 56, 18, 4); shape();
      ctx.beginPath(); ctx.moveTo(-18, -23); ctx.lineTo(18, -23);
      ctx.strokeStyle = C.dim; ctx.lineWidth = lw; ctx.stroke();
      [-16, 16].forEach((wx) => {
        ctx.beginPath(); ctx.arc(wx, -9, 9, 0, Math.PI * 2); shape();
        const a = (opts.wheel || 0);
        ctx.beginPath(); ctx.moveTo(wx + Math.cos(a) * 6, -9 + Math.sin(a) * 6);
        ctx.lineTo(wx - Math.cos(a) * 6, -9 - Math.sin(a) * 6);
        ctx.strokeStyle = C.flow; ctx.lineWidth = lw; ctx.stroke();
      });
    } else if (p.name === "body") {
      rr(-24, -40, 48, 40, 5); shape();
      rr(-12, -30, 24, 14, 3); shape(C.ink, C.dim);
      ctx.beginPath(); ctx.arc(0, -23, 3, 0, Math.PI * 2);
      ctx.fillStyle = opts.lit ? C.flag : C.dim; ctx.fill();
      [-30, 30].forEach((sx) => { rr(sx - (sx < 0 ? 0 : 6), -32, 6, 14, 2); shape(); });
    } else {
      ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(0, -34);
      ctx.strokeStyle = C.chalk; ctx.lineWidth = lw; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -35, 2.6, 0, Math.PI * 2);
      ctx.fillStyle = opts.lit ? C.flag : C.deck; ctx.fill(); ctx.strokeStyle = C.chalk; ctx.stroke();
      rr(-20, -26, 40, 26, 7); shape();
      [-8, 8].forEach((ex) => {
        ctx.beginPath(); ctx.arc(ex, -14, 4, 0, Math.PI * 2);
        if (opts.lit) { ctx.fillStyle = C.flow; ctx.fill(); }
        ctx.strokeStyle = opts.lit ? C.flow : C.dim; ctx.lineWidth = lw; ctx.stroke();
      });
    }
    ctx.restore();
  }

  function drawLink(a, b, width) {
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
    ctx.strokeStyle = C.chalk; ctx.lineWidth = width; ctx.stroke();
    ctx.strokeStyle = C.deck; ctx.lineWidth = width - 2 * lw; ctx.stroke();
    ctx.lineCap = "butt";
  }
  function joint(p, r, active) {
    ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI * 2); shape();
    ctx.beginPath(); ctx.arc(p[0], p[1], r * 0.38, 0, Math.PI * 2);
    ctx.fillStyle = active ? C.flow : C.dim; ctx.fill();
  }

  function drawArm(base, wrist, tool, gap, active, spinA, side) {
    const [bx, by] = base;
    // pedestal
    ctx.beginPath();
    ctx.moveTo(bx - 24, FLOOR - 6); ctx.lineTo(bx - 14, by + 8); ctx.lineTo(bx + 14, by + 8); ctx.lineTo(bx + 24, FLOOR - 6);
    ctx.closePath(); shape();
    rr(bx - 32, FLOOR - 6, 64, 6, 2); shape();
    ctx.beginPath(); ctx.arc(bx, FLOOR - 24, 2.4, 0, Math.PI * 2);
    ctx.fillStyle = active ? C.flow : C.dim; ctx.fill();

    const elbow = ik(base, wrist, side);
    drawLink(base, elbow, 18);
    drawLink(elbow, wrist, 13);

    // tool
    const [wx, wy] = wrist;
    rr(wx - 8, wy, 16, 8, 2); shape();
    if (tool === "gripper") {
      const half = gap / 2;
      rr(wx - half - 4, wy + 8, gap + 8, 5, 2); shape();
      rr(wx - half - 4, wy + 12, 4, WRIST_TO_TIP - 12, 1.5); shape();
      rr(wx + half, wy + 12, 4, WRIST_TO_TIP - 12, 1.5); shape();
    } else {
      rr(wx - 6, wy + 8, 12, 14, 2); shape();
      ctx.beginPath(); ctx.moveTo(wx, wy + 22); ctx.lineTo(wx, wy + TOOL_TO_TIP);
      ctx.strokeStyle = C.chalk; ctx.lineWidth = lw * 1.6; ctx.stroke();
      if (spinA !== null) {
        for (let k = 0; k < 3; k++) {
          const a = spinA + (k * Math.PI * 2) / 3;
          ctx.beginPath(); ctx.moveTo(wx + Math.cos(a) * 3, wy + 15); ctx.lineTo(wx + Math.cos(a) * 6, wy + 15);
          ctx.strokeStyle = C.flow; ctx.lineWidth = lw; ctx.stroke();
        }
      }
    }
    joint(elbow, 8, active);
    joint(base, 11, active);
    joint(wrist, 5, active);
  }

  function drawStage(farX) {
    ctx.beginPath(); ctx.moveTo(0, FLOOR); ctx.lineTo(farX, FLOOR);
    ctx.strokeStyle = C.chalk; ctx.lineWidth = lw; ctx.stroke();
    ctx.strokeStyle = "rgba(141, 154, 176, 0.25)";
    ctx.beginPath();
    for (let x = 12; x < farX; x += 12) { ctx.moveTo(x, FLOOR + 2); ctx.lineTo(x - 8, FLOOR + 10); }
    ctx.stroke();
    // tray dividers
    ctx.strokeStyle = C.dim;
    ctx.beginPath();
    [16, 79, 141, 204].forEach((x) => { ctx.moveTo(x, FLOOR); ctx.lineTo(x, FLOOR - 10); });
    ctx.stroke();
    // fixture plate
    rr(STATION_X - 36, FIXTURE_TOP, 72, 6, 1.5); shape(C.deck, C.chalk);
  }

  // ---- sparks ----
  let sparks = [];
  function emitSparks(at, dt) {
    const n = Math.random() < dt * 40 ? 2 : 0;
    for (let k = 0; k < n; k++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const v = 60 + Math.random() * 90;
      sparks.push({ x: at[0], y: at[1], vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.35 + Math.random() * 0.25 });
    }
  }
  function drawSparks(dt) {
    ctx.lineWidth = lw;
    sparks = sparks.filter((p) => (p.life -= dt) > 0);
    sparks.forEach((p) => {
      const x0 = p.x, y0 = p.y;
      p.vy += 420 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = p.life > 0.2 ? C.spark : C.flag; ctx.stroke();
    });
  }

  // ---- one frame at cycle time t ----
  function render(t, dt) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * oy);
    const farX = (W - ox) / s + 40;
    drawStage(farX);

    const wA = armA.at(t), wB = armB.at(t), gap = gapA.at(t);
    const lit = t >= powerT;
    const blink = lit && t < powerT + 0.7 && Math.floor((t - powerT) / 0.18) % 2 === 1;
    const driveU = clamp01((t - driveT) / DRIVE_DUR);
    const driveDist = easeIn(driveU) * (farX - STATION_X + 60);
    const hop = lit && t < driveT ? -3 * Math.abs(Math.sin((t - powerT) * 7)) * (1 - clamp01((t - powerT) / 1.2)) : 0;

    PARTS.forEach((p, i) => {
      // the copy restocking the tray
      const rs = restockT + i * 0.22;
      if (t >= rs) {
        const u = clamp01((t - rs) / 0.6);
        drawPart(p, SLOTS[i], FLOOR - (1 - outBounce(u)) * 170);
      }
      if (t < grabT[i]) {
        if (t < restockT) drawPart(p, SLOTS[i], FLOOR);
      } else if (t < placeT[i]) {
        const tipY = wA[1] + WRIST_TO_TIP;
        drawPart(p, wA[0], tipY - p.g + p.h);
      } else {
        drawPart(p, STATION_X + driveDist, placedBottom[i] + hop,
          { lit: lit && !blink, wheel: driveDist / 9 });
      }
    });

    let spinA = null, spinAt = null;
    spin.forEach(([a, b, at]) => { if (t >= a && t < b) { spinA = t * 30; spinAt = at; } });
    if (spinAt && dt > 0) emitSparks(spinAt, dt);

    const movingA = Math.hypot(armA.at(t + 0.05)[0] - wA[0], armA.at(t + 0.05)[1] - wA[1]) > 0.05;
    const movingB = spinA !== null || Math.hypot(armB.at(t + 0.05)[0] - wB[0], armB.at(t + 0.05)[1] - wB[1]) > 0.05;
    drawArm(A.base, wA, "gripper", gap, movingA, null, -1);
    drawArm(B.base, wB, "driver", 0, movingB, spinA, 1);
    drawSparks(dt);
  }

  // ---- loop ----
  let running = false, visible = true, last = 0, raf = 0, clock = 0;
  const SPEED = 1.15;
  function loop(now) {
    if (!running) return;
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
    last = now;
    clock = (clock + dt * SPEED) % CYCLE;
    render(clock, dt * SPEED);
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
    if (reduceMotion) { render(placeT[1] + 2.6, 0); return; }
    render(clock, 0);
    start();
  }

  let resizeTimer = 0, lastW = hero.getBoundingClientRect().width;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const w = hero.getBoundingClientRect().width;
      if (Math.abs(w - lastW) < 2) return;   // ignore height-only changes (mobile address bar)
      lastW = w;
      layout();
      if (!running) render(reduceMotion ? placeT[1] + 2.6 : clock, 0);
    }, 150);
  });
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      visible ? start() : stop();
    }).observe(hero);
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
