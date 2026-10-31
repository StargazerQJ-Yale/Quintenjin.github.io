// B-spline playground: a clamped B-spline with draggable control points.
// The active point's basis function and the stretch of curve it controls are highlighted.
(() => {
  const svg = document.getElementById('spline');
  if (!svg) return;
  const NS = 'http://www.w3.org/2000/svg';
  const W = 600, H = 340, PAD = 12, MAX_POINTS = 12;
  const BX = 16, BW = 568, BY = 112, BH = 84; // basis plot frame
  const START = [[50, 250], [105, 95], [195, 60], [255, 210], [330, 285], [415, 240], [470, 80], [550, 140]];

  const basisSvg = document.getElementById('basis');
  const degreeInput = document.getElementById('degree');
  const degreeOut = document.querySelector('output[for="degree"]');
  const polygon = svg.querySelector('.spline-polygon');
  const support = svg.querySelector('.spline-support');
  const curve = svg.querySelector('.spline-curve');
  const dot = svg.querySelector('.spline-dot');
  const handles = svg.querySelector('.spline-handles');
  const cursor = basisSvg.querySelector('.basis-cursor');
  const basisCurves = basisSvg.querySelector('.basis-curves');
  const knotMarks = basisSvg.querySelector('.basis-knots');

  let points = START.map(p => [...p]);
  let degree = 3, U = [], active = -1, dragging = false, phase = 1.2;

  const f = n => Math.round(n * 10) / 10;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const bx = t => f(BX + t * BW);
  const by = v => f(BY - v * BH);
  const pathThrough = pts => 'M' + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L');
  const range = (a, b, steps) => Array.from({ length: steps + 1 }, (_, s) => a + (b - a) * s / steps);

  // Clamped, uniform knot vector: the curve starts and ends on the first and last points.
  const knotVector = (n, p) => Array.from({ length: n + p + 1 }, (_, i) => clamp((i - p) / (n - p), 0, 1));

  // Cox–de Boor recursion, evaluated bottom-up in place.
  function basis(t) {
    const n = points.length;
    const N = U.slice(0, -1).map((u, i) => +(u <= t && t < U[i + 1]));
    if (t >= 1) N[n - 1] = 1;
    for (let d = 1; d <= degree; d++) {
      for (let i = 0; i < N.length - d; i++) {
        const a = U[i + d] - U[i], b = U[i + d + 1] - U[i + 1];
        N[i] = (a ? (t - U[i]) / a * N[i] : 0) + (b ? (U[i + d + 1] - t) / b * N[i + 1] : 0);
      }
    }
    return N.slice(0, n);
  }

  const pointAt = t => basis(t).reduce(([x, y], w, i) => [x + w * points[i][0], y + w * points[i][1]], [0, 0]);

  function buildHandles() {
    handles.replaceChildren(...points.map((_, i) => {
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'handle');
      g.setAttribute('tabindex', '0');
      g.setAttribute('aria-roledescription', 'draggable point');
      g.dataset.i = i;
      g.innerHTML = `<circle class="hit" r="22"/><circle class="knob" r="9"/><text x="13" y="-13">P${i}</text>`;
      return g;
    }));
  }

  function render() {
    const n = points.length;
    degreeInput.max = Math.min(5, n - 1);
    degree = +degreeInput.value;
    degreeOut.value = degree;
    U = knotVector(n, degree);

    if (handles.children.length !== n) buildHandles();
    [...handles.children].forEach((g, i) => {
      g.setAttribute('transform', `translate(${f(points[i][0])} ${f(points[i][1])})`);
      g.setAttribute('aria-label', `Control point ${i}: ${Math.round(points[i][0])}, ${Math.round(points[i][1])}`);
      g.classList.toggle('is-active', i === active);
    });
    polygon.setAttribute('points', points.map(p => p.map(f).join(',')).join(' '));
    curve.setAttribute('d', pathThrough(range(0, 1, 160).map(pointAt)));
    // A control point only influences the curve on [U[i], U[i + p + 1]]
    support.setAttribute('d', active < 0 ? '' : pathThrough(range(U[active], U[active + degree + 1], 60).map(pointAt)));

    const ts = range(0, 1, 120);
    const table = ts.map(basis);
    basisCurves.innerHTML = points.map((_, i) =>
      `<path class="basis-curve${i === active ? ' is-active' : ''}" d="${pathThrough(ts.map((t, s) => [bx(t), by(table[s][i])]))}"/>`
    ).join('');
    knotMarks.innerHTML = U.slice(degree, n + 1).map(u => `<line x1="${bx(u)}" x2="${bx(u)}" y1="${BY}" y2="${BY + 7}"/>`).join('');
    placeDot();
  }

  // The dot eases back and forth along the curve; the dashed line marks the same t below.
  function placeDot() {
    const t = (1 - Math.cos(phase)) / 2;
    const [x, y] = pointAt(t);
    dot.setAttribute('cx', f(x));
    dot.setAttribute('cy', f(y));
    cursor.setAttribute('x1', bx(t));
    cursor.setAttribute('x2', bx(t));
  }

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let visible = false, running = false, last = 0;
  function tick(now) {
    if (!visible || reducedMotion.matches) { running = false; last = 0; return; }
    if (last) phase += (now - last) / 1000;
    last = now;
    placeDot();
    requestAnimationFrame(tick);
  }
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && !running) { running = true; requestAnimationFrame(tick); }
  }).observe(svg);

  function setActive(i) {
    if (i === active) return;
    active = i;
    render();
  }

  function removePoint(i) {
    if (points.length <= 2) return;
    points.splice(i, 1);
    active = -1;
    render();
  }

  function insertPoint(p, after) {
    if (points.length >= MAX_POINTS) return;
    points.splice(after + 1, 0, p);
    active = after + 1;
    render();
  }

  function distToSegment([px, py], [ax, ay], [qx, qy]) {
    const dx = qx - ax, dy = qy - ay;
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    return Math.hypot(px - ax - t * dx, py - ay - t * dy);
  }

  function toSvg(e) {
    const { x, y } = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
    return [clamp(x, PAD, W - PAD), clamp(y, PAD, H - PAD)];
  }

  const handleIndex = e => {
    const g = e.target.closest('.handle');
    return g ? +g.dataset.i : -1;
  };

  svg.addEventListener('pointerdown', e => {
    const i = handleIndex(e);
    if (i < 0) return;
    dragging = true;
    svg.setPointerCapture(e.pointerId);
    setActive(i);
  });
  svg.addEventListener('pointermove', e => {
    if (!dragging) return;
    points[active] = toSvg(e);
    render();
  });
  const release = () => { dragging = false; };
  svg.addEventListener('pointerup', release);
  svg.addEventListener('pointercancel', release);
  svg.addEventListener('pointerover', e => { if (!dragging && e.pointerType === 'mouse') setActive(handleIndex(e)); });

  svg.addEventListener('dblclick', e => {
    const i = handleIndex(e);
    if (i >= 0) return removePoint(i);
    // Insert into the nearest edge of the control polygon
    const p = toSvg(e);
    let best = 0;
    for (let s = 1; s < points.length - 1; s++) {
      if (distToSegment(p, points[s], points[s + 1]) < distToSegment(p, points[best], points[best + 1])) best = s;
    }
    insertPoint(p, best);
  });

  handles.addEventListener('focusin', e => {
    const g = e.target.closest('.handle');
    if (g) setActive(+g.dataset.i);
  });
  handles.addEventListener('focusout', () => { if (!dragging) setActive(-1); });
  handles.addEventListener('keydown', e => {
    const i = +e.target.dataset.i;
    const step = e.shiftKey ? 24 : 6;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) {
      e.preventDefault();
      const [dx, dy] = moves[e.key];
      points[i] = [clamp(points[i][0] + dx, PAD, W - PAD), clamp(points[i][1] + dy, PAD, H - PAD)];
      render();
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && points.length > 2) {
      e.preventDefault();
      removePoint(i);
      handles.children[Math.min(i, points.length - 1)].focus();
    }
  });

  degreeInput.addEventListener('input', render);
  document.getElementById('add-point').addEventListener('click', () => {
    // Split the longest edge of the control polygon
    let best = 0;
    for (let s = 1; s < points.length - 1; s++) {
      if (Math.hypot(...points[s + 1].map((v, k) => v - points[s][k])) >
          Math.hypot(...points[best + 1].map((v, k) => v - points[best][k]))) best = s;
    }
    insertPoint(points[best].map((v, k) => (v + points[best + 1][k]) / 2), best);
  });
  document.getElementById('reset-spline').addEventListener('click', () => {
    points = START.map(p => [...p]);
    degreeInput.max = 5;
    degreeInput.value = 3;
    active = -1;
    render();
  });

  render();
})();
