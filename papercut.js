// Fold & cut studio. One snip through folded paper repeats all the way round;
// here every stroke is copied through the dihedral group D_n (n rotations, each mirrored).
(() => {
  const stage = document.querySelector('.studio-stage');
  if (!stage) return;
  const paper = document.getElementById('paper');
  const guides = document.getElementById('guides');
  const hint = stage.querySelector('.studio-hint');
  const foldInput = document.getElementById('folds');
  const bladeInput = document.getElementById('blade');
  const guideToggle = document.getElementById('show-folds');
  const ctx = paper.getContext('2d');
  const gctx = guides.getContext('2d');
  const PAPER = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim() || '#286dc0';

  const strokes = []; // { width, points: [[x, y], …] } in units of the paper radius
  let size = 0, radius = 0, stroke = null;

  function symmetries() {
    const n = +foldInput.value;
    return Array.from({ length: 2 * n }, (_, k) => {
      const a = 2 * Math.PI * Math.floor(k / 2) / n;
      return [Math.cos(a), Math.sin(a), k % 2 ? -1 : 1];
    });
  }

  function cut(points, width) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = width * radius;
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.beginPath();
    for (const [c, s, flip] of symmetries()) {
      points.forEach(([x, y], i) => {
        y *= flip;
        const px = size / 2 + radius * (x * c - y * s);
        const py = size / 2 + radius * (x * s + y * c);
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        if (points.length === 1) ctx.lineTo(px + .01, py); // a click still punches a hole
      });
    }
    ctx.stroke();
    ctx.restore();
  }

  function paint() {
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = PAPER;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, radius, 0, 2 * Math.PI);
    ctx.fill();
    strokes.forEach(s => (s.batch || [s]).forEach(t => cut(t.points, t.width)));
    hint.hidden = strokes.length > 0;
  }

  function paintGuides() {
    gctx.clearRect(0, 0, size, size);
    if (!guideToggle.checked) return;
    const n = +foldInput.value, px = size / stage.clientWidth;
    gctx.strokeStyle = 'rgba(255, 247, 238, .45)';
    gctx.lineWidth = px;
    gctx.setLineDash([4 * px, 6 * px]);
    gctx.beginPath();
    for (let k = 0; k < n; k++) {
      const a = Math.PI * k / n, dx = radius * Math.cos(a), dy = radius * Math.sin(a);
      gctx.moveTo(size / 2 - dx, size / 2 - dy);
      gctx.lineTo(size / 2 + dx, size / 2 + dy);
    }
    gctx.stroke();
  }

  function resize() {
    size = Math.round(stage.clientWidth * (window.devicePixelRatio || 1));
    radius = size / 2 * .94;
    paper.width = paper.height = guides.width = guides.height = size;
    paint();
    paintGuides();
  }
  new ResizeObserver(resize).observe(stage);

  function toPaper(e) {
    const box = paper.getBoundingClientRect();
    return [
      ((e.clientX - box.left) / box.width - .5) * size / radius,
      ((e.clientY - box.top) / box.height - .5) * size / radius,
    ];
  }

  paper.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    paper.setPointerCapture(e.pointerId);
    stroke = { width: bladeInput.value / 250, points: [toPaper(e)] };
    strokes.push(stroke);
    cut(stroke.points, stroke.width);
    hint.hidden = true;
  });
  paper.addEventListener('pointermove', e => {
    if (!stroke) return;
    stroke.points.push(toPaper(e));
    cut(stroke.points.slice(-2), stroke.width);
  });
  const lift = () => { stroke = null; };
  paper.addEventListener('pointerup', lift);
  paper.addEventListener('pointercancel', lift);

  // A few short, mostly radial snips inside one wedge; the symmetry does the rest.
  // They go in as one batch so a single Undo takes them all back.
  function scatter() {
    const wedge = Math.PI / +foldInput.value, batch = [];
    for (let i = 0; i < 5; i++) {
      const r = .12 + Math.random() * .74, a = Math.random() * wedge;
      const start = [r * Math.cos(a), r * Math.sin(a)];
      const len = Math.random() < .3 ? 0 : .04 + Math.random() * .16;
      const dir = a + (Math.random() - .5) * .8;
      const points = len ? [start, [start[0] + len * Math.cos(dir), start[1] + len * Math.sin(dir)]] : [start];
      batch.push({ width: (4 + Math.random() * 16) / 250, points });
    }
    strokes.push({ batch });
    paint();
  }

  const showValue = input => { document.querySelector(`output[for="${input.id}"]`).value = input.value; };
  foldInput.addEventListener('input', () => { showValue(foldInput); paint(); paintGuides(); });
  bladeInput.addEventListener('input', () => showValue(bladeInput));
  guideToggle.addEventListener('change', paintGuides);
  document.getElementById('scatter').addEventListener('click', scatter);
  document.getElementById('undo').addEventListener('click', () => { strokes.pop(); paint(); });
  document.getElementById('clear').addEventListener('click', () => { strokes.length = 0; paint(); });
  document.getElementById('save').addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = `paper-cut-${foldInput.value}-fold.png`;
    link.href = paper.toDataURL('image/png');
    link.click();
  });
})();
