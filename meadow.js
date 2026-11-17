/* Paper meadow — a quiet ink field behind the content.
   Three depth layers: distant glowing dust, painted blossoms, and a few
   near plants with stems that lean together in a travelling wind.
   The pointer pushes a ripple through all of them. */
(() => {
  const cv = document.getElementById("meadow");
  const ctx = cv && cv.getContext("2d");
  if (!cv || !ctx) return;

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const SPECIES = [
    { petal: "#a78bd8", deep: "#5b4687", core: "#f4edff" },
    { petal: "#b06f92", deep: "#6a3c52", core: "#ffe9f3" },
    { petal: "#9dbc84", deep: "#516d46", core: "#f5ffe6" },
    { petal: "#cdb989", deep: "#7a663c", core: "#fff3d2" },
  ];

  const LAYERS = [
    { share: 0.5, sizeMin: 2, sizeMax: 4.5, alpha: 0.48, blur: 1.6, sprite: 48, sway: 0.7, par: 0.55, flow: 7, tuft: 0.5, plant: false },
    { share: 0.34, sizeMin: 6, sizeMax: 12, alpha: 0.72, blur: 1, sprite: 64, sway: 1.2, par: 0.82, flow: 12, tuft: 0.42, plant: false },
    { share: 0.16, sizeMin: 15, sizeMax: 25, alpha: 0.85, blur: 0.7, sprite: 96, sway: 2.2, par: 1, flow: 18, tuft: 0, plant: true },
  ];

  const PAD = 140; // fade band above and below the viewport
  let W = 0, H = 0;
  let layers = [];
  let raf = 0;
  let pulse = 0;
  const ptr = { x: -9e3, y: -9e3, sx: -9e3, sy: -9e3 };
  const rand = (a, b) => a + Math.random() * (b - a);

  const hexA = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };

  function blurCanvas(src, px) {
    const c = document.createElement("canvas");
    c.width = src.width;
    c.height = src.height;
    const g = c.getContext("2d");
    if ("filter" in g) g.filter = `blur(${px}px)`;
    g.drawImage(src, 0, 0);
    return c;
  }

  function whorl(g, cx, cy, R, n, phase, alpha, sp) {
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + phase;
      const len = R * rand(0.9, 1.05);
      g.save();
      g.translate(cx, cy);
      g.rotate(ang);
      const grad = g.createLinearGradient(0, 0, len, 0);
      grad.addColorStop(0, hexA(sp.deep, alpha * 0.95));
      grad.addColorStop(0.45, hexA(sp.petal, alpha));
      grad.addColorStop(0.85, hexA(sp.petal, alpha * 0.55));
      grad.addColorStop(1, hexA(sp.petal, 0));
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(0, 0);
      g.bezierCurveTo(len * 0.3, -len * 0.5, len * 0.82, -len * 0.34, len, 0);
      g.bezierCurveTo(len * 0.82, len * 0.34, len * 0.3, len * 0.5, 0, 0);
      g.fill();
      g.restore();
    }
  }

  function paintHead(g, cx, cy, R, sp, petals) {
    const halo = g.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.2);
    halo.addColorStop(0, hexA(sp.petal, 0.3));
    halo.addColorStop(1, hexA(sp.petal, 0));
    g.fillStyle = halo;
    g.beginPath();
    g.arc(cx, cy, R * 1.2, 0, Math.PI * 2);
    g.fill();

    whorl(g, cx, cy, R, petals, -Math.PI / 2, 0.5, sp);
    whorl(g, cx, cy, R * 0.66, petals, -Math.PI / 2 + Math.PI / petals, 0.62, sp);

    const shade = g.createRadialGradient(cx, cy, 0, cx, cy, R * 0.6);
    shade.addColorStop(0, "rgba(18,14,26,0.4)");
    shade.addColorStop(0.65, "rgba(18,14,26,0.14)");
    shade.addColorStop(1, "rgba(18,14,26,0)");
    g.fillStyle = shade;
    g.beginPath();
    g.arc(cx, cy, R * 0.6, 0, Math.PI * 2);
    g.fill();

    const core = g.createRadialGradient(cx, cy, 0, cx, cy, R * 0.34);
    core.addColorStop(0, sp.core);
    core.addColorStop(0.3, hexA(sp.core, 0.85));
    core.addColorStop(1, hexA(sp.core, 0));
    g.fillStyle = core;
    g.beginPath();
    g.arc(cx, cy, R * 0.34, 0, Math.PI * 2);
    g.fill();
  }

  function headSprite(sp, petals, size, blur) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    paintHead(g, size / 2, size / 2, size * 0.4, sp, petals);
    return blur > 0 ? blurCanvas(c, blur) : c;
  }

  function tuftSprite(size, blur) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    const base = size * 0.94;
    const grad = g.createLinearGradient(0, base, 0, base - size * 0.62);
    grad.addColorStop(0, "rgba(28,42,28,0)");
    grad.addColorStop(0.35, "rgba(38,56,34,0.75)");
    grad.addColorStop(1, "rgba(52,74,44,0.35)");
    g.strokeStyle = grad;
    g.lineCap = "round";
    const n = 5 + ((Math.random() * 4) | 0);
    for (let i = 0; i < n; i++) {
      const bx = size / 2 + rand(-size * 0.16, size * 0.16);
      const h = rand(size * 0.3, size * 0.62);
      const lean = rand(-0.6, 0.6) * h;
      g.lineWidth = rand(1, 1.8);
      g.beginPath();
      g.moveTo(bx, base);
      g.quadraticCurveTo(bx + lean * 0.25, base - h * 0.6, bx + lean, base - h);
      g.stroke();
    }
    return blur > 0 ? blurCanvas(c, blur) : c;
  }

  function paintLeaf(g, x, y, len, wid, ang, color) {
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(len * 0.25, -wid, len * 0.7, -wid * 0.9, len, 0);
    g.bezierCurveTo(len * 0.7, wid * 0.9, len * 0.25, wid, 0, 0);
    g.fill();
    g.restore();
  }

  function plantSprite(sp, petals) {
    const w = 128, h = 176;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d");
    const bx = w / 2, by = h - 6;
    const tx = w / 2 + 8, ty = h * 0.32;

    const sg = g.createLinearGradient(0, by, 0, ty);
    sg.addColorStop(0, "#1b2a1b");
    sg.addColorStop(1, "#3a5233");
    g.strokeStyle = sg;
    g.lineWidth = 5;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(bx, by);
    g.bezierCurveTo(bx - 10, by - h * 0.34, tx - 10, ty + 34, tx, ty);
    g.stroke();

    paintLeaf(g, bx - 1, by - h * 0.28, 34, 9, Math.PI * 0.82, "#26381f");
    paintLeaf(g, bx + 2, by - h * 0.42, 26, 7, -Math.PI * 0.18, "#2c4123");
    paintLeaf(g, bx, by - 6, 18, 5, Math.PI * 0.95, "#223320");

    paintHead(g, tx, ty, w * 0.26, sp, petals);
    return blurCanvas(c, 0.6);
  }

  function buildPools() {
    return LAYERS.map((L) => {
      const heads = [];
      for (const sp of SPECIES) {
        for (const petals of [5, 6]) heads.push(headSprite(sp, petals, L.sprite, L.blur));
      }
      return {
        heads,
        tuft: L.tuft > 0 ? tuftSprite(L.sprite, L.blur) : null,
        plants: L.plant ? SPECIES.map((sp) => plantSprite(sp, Math.random() < 0.5 ? 5 : 6)) : null,
      };
    });
  }

  let pools = [];

  function build() {
    W = innerWidth;
    H = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    cv.style.width = W + "px";
    cv.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const per = W < 760 ? 6200 : 4600;
    const baseN = Math.min(1500, Math.max(220, Math.round((W * H) / per)));

    const clusters = [];
    const nc = Math.max(4, Math.round(W / 240));
    for (let i = 0; i < nc; i++) {
      clusters.push({ x: Math.random() * W, y: Math.random() * H, r: rand(160, 440) });
    }

    pools = buildPools();

    layers = LAYERS.map((L, li) => {
      const pool = pools[li];
      const n = Math.max(1, Math.round(baseN * L.share));
      const arr = new Array(n);
      for (let i = 0; i < n; i++) {
        let x, y;
        if (Math.random() < 0.58) {
          const c = clusters[(Math.random() * clusters.length) | 0];
          const a = Math.random() * Math.PI * 2;
          const rr = Math.sqrt(Math.random()) * c.r;
          x = c.x + Math.cos(a) * rr;
          y = c.y + Math.sin(a) * rr;
          if (x < 0) x += W; else if (x > W) x -= W;
          if (y < -PAD) y = -PAD + Math.random() * PAD;
          else if (y > H + PAD) y = H + Math.random() * PAD;
        } else {
          x = Math.random() * W;
          y = rand(-PAD, H + PAD);
        }
        const useTuft = pool.tuft && Math.random() < L.tuft;
        const usePlant = pool.plants && Math.random() < 0.86;
        arr[i] = {
          x, y,
          seed: Math.random() * Math.PI * 2,
          rot: rand(-0.12, 0.12),
          size: rand(L.sizeMin, L.sizeMax),
          scale: rand(0.9, 1.12),
          alpha: Math.min(1, L.alpha * rand(0.72, 1.06)),
          par: L.par,
          fall: L.flow * rand(0.7, 1.3),
          plant: usePlant,
          ground: usePlant || useTuft,
          sprite: usePlant ? pool.plants[(Math.random() * pool.plants.length) | 0]
            : useTuft ? pool.tuft
            : pool.heads[(Math.random() * pool.heads.length) | 0],
        };
        if (useTuft) arr[i].alpha *= 0.55;
      }
      return arr;
    });
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    const T = reduce ? 0 : t;
    const sy = scrollY;
    ptr.x += (ptr.sx - ptr.x) * 0.2;
    ptr.y += (ptr.sy - ptr.y) * 0.2;
    pulse *= 0.94;

    const gust = 0.55 + 0.45 * Math.sin(T * 0.085 + Math.sin(T * 0.028) * 1.6);

    for (let li = 0; li < layers.length; li++) {
      const L = LAYERS[li];
      const arr = layers[li];
      for (let i = 0; i < arr.length; i++) {
        const it = arr[i];
        // blossoms drift down through the viewport; rooted plants and grass stay put
        const fall = it.ground ? 0 : T * it.fall;
        const spanY = H + PAD * 2;
        let vy = (it.y - sy * it.par + fall + PAD) % spanY;
        if (vy < 0) vy += spanY;
        vy -= PAD;

        const bx = it.x;
        const fade = Math.min(
          1,
          Math.min(vy + PAD, H + PAD - vy) / PAD,
          Math.min(bx + 60, W + 60 - bx) / 60
        );
        if (fade < 0.02) continue;

        const ph = it.seed + bx * 0.004 + vy * 0.002;
        const wind = Math.sin(ph - T * 0.5 + Math.sin(T * 0.02 + bx * 0.0006) * 1.5);
        const sway = wind * L.sway * (0.5 + gust * 0.55);
        const bob = Math.cos(ph * 0.7 - T * 0.35) * L.sway * (0.3 + gust * 0.2);

        const dx = bx - ptr.x;
        const dy = vy - ptr.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        let infl = 0;
        if (d < 380) {
          infl = 1 - d / 380;
          infl *= infl;
        }
        const ripple = Math.sin(d * 0.045 - T * 1.15) * infl;
        const push = infl * (26 + pulse * 34) + ripple * 14;
        const ux = d > 0.5 ? dx / d : 0;
        const uy = d > 0.5 ? dy / d : 0;

        const x = bx + sway + ux * push;
        const y = vy + bob + uy * push * 0.6;
        const rot = it.rot + sway * 0.02 + wind * (it.plant ? 0.09 : 0.18) + ripple * 0.12 + ux * infl * 0.6;
        const sc = it.scale * (1 + infl * 0.25 + ripple * 0.06);

        ctx.globalAlpha = it.alpha * fade * (0.88 + 0.12 * Math.sin(T * 0.25 + it.seed));

        if (it.plant) {
          const dw = it.size * 1.94 * sc;
          const dh = dw * 1.375;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(rot);
          ctx.drawImage(it.sprite, -dw * 0.5, -dh, dw, dh);
          ctx.restore();
        } else {
          const dw = it.size * 1.25 * sc;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(rot);
          ctx.drawImage(it.sprite, -dw * 0.5, -dw * 0.5, dw, dw);
          ctx.restore();
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  let last = 0;
  function tick(now) {
    raf = requestAnimationFrame(tick);
    if (document.hidden) return;
    const t = now / 1000;
    if (t - last < 1 / 30) return; // ambient layer, 30fps is plenty
    last = t;
    draw(t);
  }

  function refresh() {
    if (innerWidth !== W || innerHeight !== H) build();
  }

  addEventListener("pointermove", (e) => {
    ptr.sx = e.clientX;
    ptr.sy = e.clientY;
  }, { passive: true });
  addEventListener("pointerdown", (e) => {
    ptr.sx = ptr.x = e.clientX;
    ptr.sy = ptr.y = e.clientY;
    pulse = 1;
  }, { passive: true });
  addEventListener("pointerleave", () => { ptr.sx = ptr.sy = -9e3; });

  let rt = 0;
  addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      build();
      if (reduce) draw(0);
    }, 160);
  });

  build();
  if (reduce) {
    addEventListener("scroll", () => draw(0), { passive: true });
    draw(0);
  } else {
    raf = requestAnimationFrame(tick);
  }

  addEventListener("load", refresh);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
  setTimeout(refresh, 2500);

  addEventListener("pagehide", () => cancelAnimationFrame(raf));
})();
