// Living graph paper behind the page.
// The grid bulges under the cursor like a lens; classic curves in the margins take their
// parameters from the mouse; a click on blank space sends out polygon ripples; and a drag on
// blank space draws a shape that its own Fourier series then redraws with epicycles.
(() => {
  const canvas = document.querySelector('.geometry');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const root = document.documentElement;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const TAU = Math.PI * 2;
  const LENS = 160, BULGE = .5, MINOR = 24, MAJOR = 120;
  const TRACE = 3600, HOLD = 700, FADE = 900, EPICYCLES = 40;
  // Anything a visitor might want to read, select or use; drawing only starts outside these
  const BUSY = 'a, button, input, label, select, textarea, canvas, svg, p, h1, h2, h3, li, dt, dd, figcaption, header, footer, .card, .edu-card, .lab, .stat';

  let W = 0, H = 0, rgb = '40,109,192';
  const pointer = { x: 0, y: 0, inside: false, seen: false };
  const lens = { x: 0, y: 0, k: 0 };
  const knob = { u: .5, v: .5 }; // eased, normalized mouse position that drives the curves
  let places = [], ripples = [], sketches = [], stroke = null, lastPointerType = 'mouse';

  // On unless the device asks for reduced motion; either way the visitor can switch it and we remember.
  const hintOff = document.querySelector('.hint-off');
  const toggle = document.getElementById('geometry-toggle');
  let stored = null;
  try { stored = localStorage.getItem('geometry'); } catch {}
  let enabled = stored ? stored === 'on' : !reducedMotion.matches;

  const clamp01 = v => Math.min(1, Math.max(0, v));
  const ink = a => `rgba(${rgb},${a})`;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const circle = (r = 1, n = 120) => Array.from({ length: n + 1 }, (_, i) => [r * Math.cos(TAU * i / n), r * Math.sin(TAU * i / n)]);
  const curve = (f, end, n) => Array.from({ length: n + 1 }, (_, i) => f(end * i / n));

  // Radial bulge r → r(1 + A(1 − r/R)²); its derivative stays positive for A < 3, so lines never fold.
  function warp(x, y) {
    if (!lens.k) return [x, y];
    const dx = x - lens.x, dy = y - lens.y, r = Math.hypot(dx, dy);
    if (r >= LENS) return [x, y];
    const u = 1 - r / LENS, s = 1 + BULGE * lens.k * u * u;
    return [lens.x + dx * s, lens.y + dy * s];
  }

  // ---------- Curves, in unit coordinates; each takes the mouse knob ----------
  const FIGURES = {
    // Chords i → m·i (mod N): m = 2 traces a cardioid, 3 a nephroid, 4 an epicycloid with three cusps…
    timesTable({ u }) {
      const N = 144, m = 2 + u * 5;
      const at = i => { const a = TAU * i / N - Math.PI / 2; return [Math.cos(a), Math.sin(a)]; };
      const paths = [circle()];
      for (let i = 0; i < N; i++) paths.push([at(i), at(i * m)]);
      return { paths, label: `i ↦ ${m.toFixed(2)}·i (mod ${N})` };
    },
    spirograph({ v }) {
      const d = 1 + v * 3.5; // R = 5, r = 3
      const f = t => [(2 * Math.cos(t) + d * Math.cos(2 * t / 3)) / (2 + d), (2 * Math.sin(t) - d * Math.sin(2 * t / 3)) / (2 + d)];
      return { paths: [curve(f, 6 * Math.PI, 540)], label: `hypotrochoid  R=5 r=3 d=${d.toFixed(2)}` };
    },
    lissajous({ u }) {
      return { paths: [curve(t => [Math.sin(3 * t + u * Math.PI), Math.sin(2 * t)], TAU, 360)], label: `x = sin(3t + ${u.toFixed(2)}π)  y = sin(2t)` };
    },
    // Golden rectangle cut into squares, with a quarter-circle in each
    golden({ u }) {
      const phi = (1 + Math.sqrt(5)) / 2;
      let x = 0, y = 0, w = phi, h = 1;
      const squares = [], spiral = [];
      const square = (sx, sy, s) => squares.push([[sx, sy], [sx + s, sy], [sx + s, sy + s], [sx, sy + s], [sx, sy]]);
      const arc = (cx, cy, r, a0) => { for (let s = 0; s <= 16; s++) { const a = a0 + Math.PI / 2 * s / 16; spiral.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } };
      for (let i = 0; i < 9; i++) {
        switch (i % 4) {
          case 0: square(x, y, h); arc(x + h, y + h, h, Math.PI); x += h; w -= h; break;
          case 1: square(x, y, w); arc(x, y + w, w, 1.5 * Math.PI); y += w; h -= w; break;
          case 2: square(x + w - h, y, h); arc(x + w - h, y, h, 0); w -= h; break;
          case 3: square(x, y + h - w, w); arc(x + w, y + h - w, w, Math.PI / 2); h -= w; break;
        }
      }
      const s = 2 / Math.hypot(phi, 1); // the rectangle's diagonal spans the unit circle
      const fit = ([px, py]) => [(px - phi / 2) * s, (py - .5) * s];
      return { paths: [...squares, spiral].map(p => p.map(fit)), rot: (u - .5) * .8, label: 'φ = (1 + √5) / 2 ≈ 1.618' };
    },
    stars({ u }) {
      const n = 11, paths = [circle()];
      [[4, 1], [3, .74], [2, .5]].forEach(([k, r], j) => {
        const turn = (u - .5) * (j % 2 ? -1 : 1) * .9;
        paths.push(Array.from({ length: n + 1 }, (_, i) => {
          const a = TAU * ((i * k) % n) / n - Math.PI / 2 + turn;
          return [r * Math.cos(a), r * Math.sin(a)];
        }));
      });
      return { paths, label: '{11/4} · {11/3} · {11/2}' };
    },
    rose({ v }) {
      const k = 1.5 + v * 3.5;
      return { paths: [curve(t => { const r = Math.cos(k * t); return [r * Math.cos(t), r * Math.sin(t)]; }, 4 * TAU, 1100)], label: `r = cos(${k.toFixed(2)}·θ)` };
    },
    sierpinski({ u }) {
      const paths = [];
      const tri = (a, b, c, depth) => {
        if (!depth) return paths.push([a, b, c, a]);
        const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
        tri(a, ab, ca, depth - 1); tri(ab, b, bc, depth - 1); tri(ca, bc, c, depth - 1);
      };
      const corner = i => [Math.cos(TAU * i / 3 - Math.PI / 2), Math.sin(TAU * i / 3 - Math.PI / 2)];
      tri(corner(0), corner(1), corner(2), 4);
      return { paths, rot: (u - .5) * .6, label: 'dim = log 3 / log 2 ≈ 1.585' };
    },
  };

  const PLACES = [
    ['#hero-rosette', 'timesTable', 'center'],
    ['#about', 'spirograph', 'left'],
    ['#research', 'lissajous', 'right'],
    ['#projects', 'golden', 'left'],
    ['#education', 'stars', 'right'],
    ['#honors', 'rose', 'left'],
    ['#contact', 'sierpinski', 'right'],
  ];

  function measure() {
    places = PLACES.map(([sel, fig, side]) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const box = el.getBoundingClientRect();
      return { fig, side, top: box.top + scrollY, height: box.height, left: box.left, width: box.width };
    }).filter(Boolean);
  }

  // ---------- Fourier series of a drawn shape ----------
  function fourier(points) {
    const N = 128, closed = [...points, points[0]], seg = [];
    let total = 0;
    for (let i = 1; i < closed.length; i++) {
      const d = Math.hypot(closed[i][0] - closed[i - 1][0], closed[i][1] - closed[i - 1][1]);
      seg.push(d);
      total += d;
    }
    // resample evenly by arc length
    const samples = [];
    for (let n = 0, j = 0, acc = 0; n < N; n++) {
      const target = total * n / N;
      while (j < seg.length - 1 && acc + seg[j] < target) acc += seg[j++];
      const t = seg[j] ? (target - acc) / seg[j] : 0;
      samples.push([closed[j][0] + (closed[j + 1][0] - closed[j][0]) * t, closed[j][1] + (closed[j + 1][1] - closed[j][1]) * t]);
    }
    const cx = samples.reduce((s, p) => s + p[0], 0) / N, cy = samples.reduce((s, p) => s + p[1], 0) / N;
    // c_k = (1/N) Σ z_n e^(−2πikn/N), keeping the largest terms
    const terms = [];
    for (let k = -N / 2; k < N / 2; k++) {
      if (!k) continue;
      let re = 0, im = 0;
      samples.forEach(([x, y], n) => {
        const a = -TAU * k * n / N, c = Math.cos(a), s = Math.sin(a), zx = x - cx, zy = y - cy;
        re += zx * c - zy * s;
        im += zx * s + zy * c;
      });
      terms.push({ k, re: re / N, im: im / N, amp: Math.hypot(re, im) / N });
    }
    const top = terms.sort((a, b) => b.amp - a.amp).slice(0, EPICYCLES);
    const at = t => {
      let x = cx, y = cy;
      for (const { k, re, im } of top) {
        const a = TAU * k * t, c = Math.cos(a), s = Math.sin(a);
        x += re * c - im * s;
        y += re * s + im * c;
      }
      return [x, y];
    };
    const left = Math.min(...points.map(p => p[0])), upper = Math.min(...points.map(p => p[1]));
    return { cx, cy, top, raw: points, path: Array.from({ length: 241 }, (_, i) => at(i / 240)), labelAt: [left, upper - 12] };
  }

  // ---------- Drawing ----------
  function polyline(points, dy = 0, count = points.length) {
    ctx.beginPath();
    for (let i = 0; i < count; i++) i ? ctx.lineTo(points[i][0], points[i][1] + dy) : ctx.moveTo(points[i][0], points[i][1] + dy);
    ctx.stroke();
  }

  function axisLine(c, vertical) {
    ctx.moveTo(vertical ? c : 0, vertical ? 0 : c);
    if (lens.k && Math.abs(c - (vertical ? lens.x : lens.y)) < LENS) {
      const along = vertical ? lens.y : lens.x;
      for (let t = along - LENS; t <= along + LENS; t += 6) ctx.lineTo(...(vertical ? warp(c, t) : warp(t, c)));
    }
    ctx.lineTo(vertical ? c : W, vertical ? H : c);
  }

  function drawGrid() {
    ctx.lineWidth = 1;
    for (const [step, near, far] of [[MINOR, .16, .05], [MAJOR, .26, .09]]) {
      const glow = ctx.createRadialGradient(lens.x, lens.y, 0, lens.x, lens.y, LENS);
      glow.addColorStop(0, ink(far + (near - far) * lens.k));
      glow.addColorStop(1, ink(far));
      ctx.strokeStyle = glow;
      ctx.beginPath();
      for (let x = (W / 2) % step; x <= W; x += step) axisLine(x, true);
      for (let y = ((-scrollY % step) + step) % step; y <= H; y += step) axisLine(y, false);
      ctx.stroke();
    }
  }

  function drawFigures() {
    const margin = Math.max(0, (W - 1080) / 2), wide = margin >= 150;
    ctx.font = '500 11px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = 'center';
    for (const p of places) {
      const centered = p.side === 'center';
      const r = centered ? p.width * .68 : wide ? Math.min(230, margin * .85) : 130;
      const cx = centered ? p.left + p.width / 2 : p.side === 'left' ? (wide ? margin / 2 : 0) : (wide ? W - margin / 2 : W);
      const cy = p.top + p.height / 2 - scrollY;
      if (cy + r < -40 || cy - r > H + 40) continue;
      const { paths, label, rot = 0 } = FIGURES[p.fig](knob);
      const c = Math.cos(rot), s = Math.sin(rot);
      ctx.strokeStyle = ink(centered ? .11 : wide ? .2 : .1);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const path of paths) {
        path.forEach(([x, y], i) => {
          const [wx, wy] = warp(cx + r * (x * c - y * s), cy + r * (x * s + y * c));
          i ? ctx.lineTo(wx, wy) : ctx.moveTo(wx, wy);
        });
      }
      ctx.stroke();
      if (wide && !centered) {
        ctx.fillStyle = ink(.7);
        ctx.fillText(label, cx, cy + r + 22, margin - 16);
      }
    }
  }

  function drawRipples(now) {
    ripples = ripples.filter(r => now - r.t0 < 1000);
    ctx.lineWidth = 1.25;
    for (const r of ripples) {
      const age = (now - r.t0) / 1000, ease = 1 - (1 - age) ** 3;
      ctx.strokeStyle = ink(.55 * (1 - age));
      ctx.beginPath();
      for (let n = 3; n <= 7; n++) {
        const rad = 10 + ease * 26 * (n - 1), spin = (n % 2 ? 1 : -1) * ease * Math.PI / n;
        for (let i = 0; i <= n; i++) {
          const a = spin + TAU * i / n - Math.PI / 2;
          const x = r.x + rad * Math.cos(a), y = r.y - scrollY + rad * Math.sin(a);
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
      }
      ctx.stroke();
    }
  }

  function drawSketches(now) {
    sketches = sketches.filter(s => now - s.t0 < TRACE + HOLD + FADE);
    ctx.textAlign = 'left';
    for (const s of sketches) {
      const age = now - s.t0, t = Math.min(1, age / TRACE), dy = -scrollY;
      const fade = age > TRACE + HOLD ? 1 - (age - TRACE - HOLD) / FADE : 1;
      // the shape as drawn
      ctx.setLineDash([3, 5]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = ink(.35 * fade);
      polyline([...s.raw, s.raw[0]], dy);
      ctx.setLineDash([]);
      // epicycles: each term is a circle riding on the previous one
      if (t < 1) {
        let x = s.cx, y = s.cy + dy;
        const centers = [[x, y]];
        ctx.strokeStyle = ink(.16);
        ctx.beginPath();
        for (const { k, re, im, amp } of s.top) {
          if (amp > .6) { ctx.moveTo(x + amp, y); ctx.arc(x, y, amp, 0, TAU); }
          const a = TAU * k * t, c = Math.cos(a), sn = Math.sin(a);
          x += re * c - im * sn;
          y += re * sn + im * c;
          centers.push([x, y]);
        }
        ctx.stroke();
        ctx.strokeStyle = ink(.5);
        polyline(centers);
      }
      // the reconstruction, traced so far
      ctx.lineWidth = 2;
      ctx.strokeStyle = ink(.85 * fade);
      polyline(s.path, dy, Math.max(2, Math.ceil(t * (s.path.length - 1)) + 1));
      ctx.fillStyle = ink(.75 * fade);
      ctx.fillText(`Fourier series · ${s.top.length} epicycles`, s.labelAt[0], s.labelAt[1] + dy);
    }
  }

  function draw(now) {
    ctx.clearRect(0, 0, W, H);
    ctx.lineJoin = ctx.lineCap = 'round';
    drawGrid();
    drawFigures();
    drawRipples(now);
    drawSketches(now);
    if (stroke) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = ink(.8);
      polyline(stroke.pts, -scrollY);
    }
  }

  // ---------- Frame loop: runs only while something is changing ----------
  let raf = 0;
  const wake = () => { if (!raf) raf = requestAnimationFrame(tick); };

  function tick(now) {
    raf = 0;
    const live = pointer.inside && enabled;
    lens.x += (pointer.x - lens.x) * .2;
    lens.y += (pointer.y - lens.y) * .2;
    lens.k += ((live ? 1 : 0) - lens.k) * .12;
    if (!live && lens.k < .005) lens.k = 0;
    const goal = live ? [clamp01(pointer.x / W), clamp01(pointer.y / H)] : [knob.u, knob.v];
    knob.u += (goal[0] - knob.u) * .08;
    knob.v += (goal[1] - knob.v) * .08;
    draw(now);
    const settling = Math.abs(pointer.x - lens.x) + Math.abs(pointer.y - lens.y) > .3
      || Math.abs((live ? 1 : 0) - lens.k) > .005
      || Math.abs(goal[0] - knob.u) + Math.abs(goal[1] - knob.v) > .0005;
    if ((live && settling) || (!live && lens.k) || stroke || ripples.length || sketches.length) wake();
  }

  // ---------- Input ----------
  const isBlank = el => el instanceof Element && !el.closest(BUSY);

  addEventListener('pointermove', e => {
    lastPointerType = e.pointerType;
    if (e.pointerType === 'touch') return;
    if (!pointer.seen) { lens.x = e.clientX; lens.y = e.clientY; pointer.seen = true; }
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.inside = true;
    if (stroke && !(e.buttons & 1)) finishStroke(e); // the release happened somewhere we didn't hear it
    if (stroke) {
      const last = stroke.pts[stroke.pts.length - 1];
      if (Math.hypot(e.pageX - last[0], e.pageY - last[1]) > 3) stroke.pts.push([e.pageX, e.pageY]);
    } else {
      root.classList.toggle('drawable', enabled && isBlank(e.target));
    }
    wake();
  }, { passive: true });

  addEventListener('pointerdown', e => {
    lastPointerType = e.pointerType;
    if (!enabled || e.button !== 0 || e.pointerType === 'touch' || !isBlank(e.target)) return;
    e.preventDefault();
    root.setPointerCapture(e.pointerId);
    stroke = { pts: [[e.pageX, e.pageY]] };
    wake();
  });

  function finishStroke(e) {
    const pts = stroke.pts;
    stroke = null;
    let length = 0;
    for (let i = 1; i < pts.length; i++) length += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (length < 60 || pts.length < 6) ripples.push({ x: e.pageX, y: e.pageY, t0: performance.now() });
    else {
      sketches.push({ ...fourier(pts), t0: performance.now() });
      if (sketches.length > 3) sketches.shift();
    }
    wake();
  }
  addEventListener('pointerup', e => { if (stroke) finishStroke(e); });
  addEventListener('pointercancel', () => { stroke = null; wake(); });
  addEventListener('blur', () => { stroke = null; wake(); });
  document.addEventListener('selectstart', e => { if (stroke) e.preventDefault(); });

  // Taps on touch screens get a ripple; dragging there scrolls the page as usual
  addEventListener('click', e => {
    if (lastPointerType !== 'touch' || !enabled || !isBlank(e.target)) return;
    ripples.push({ x: e.pageX, y: e.pageY, t0: performance.now() });
    wake();
  });

  document.addEventListener('mouseout', e => {
    if (e.relatedTarget) return;
    pointer.inside = false;
    root.classList.remove('drawable');
    wake();
  });

  // ---------- Setup ----------
  function readColors() {
    const n = parseInt(getComputedStyle(root).getPropertyValue('--accent').trim().slice(1), 16);
    rgb = `${n >> 16},${n >> 8 & 255},${n & 255}`;
  }

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    measure();
    wake();
  }

  function setEnabled(on, remember) {
    enabled = on;
    root.dataset.geometry = on ? 'on' : 'off';
    toggle.textContent = on ? 'Pause' : 'Turn it on';
    hintOff.textContent = !on && reducedMotion.matches && !stored
      ? 'The moving geometry is paused because your device asks for reduced motion.'
      : 'The moving geometry is paused.';
    if (remember) {
      stored = on ? 'on' : 'off';
      try { localStorage.setItem('geometry', stored); } catch {}
    }
    if (!on) { stroke = null; ripples = []; sketches = []; root.classList.remove('drawable'); }
    wake();
  }

  toggle.addEventListener('click', () => setEnabled(!enabled, true));
  reducedMotion.addEventListener('change', () => { if (!stored) setEnabled(!reducedMotion.matches); });
  new MutationObserver(() => { readColors(); wake(); }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  new ResizeObserver(() => { measure(); wake(); }).observe(document.body);
  document.fonts?.ready.then(() => { measure(); wake(); });
  setEnabled(enabled);
  addEventListener('resize', resize);
  addEventListener('scroll', wake, { passive: true });
  readColors();
  resize();
})();
