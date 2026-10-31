// ---------- Theme ----------
// Light by default; dark only when the visitor picks it, and that choice is remembered.
const root = document.documentElement;
const themeButton = document.querySelector('.theme-toggle');
const themeMeta = document.querySelector('meta[name="theme-color"]');
const currentTheme = () => root.dataset.theme || 'light';

function syncThemeUI() {
  const dark = currentTheme() === 'dark';
  themeButton.setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} theme`);
  themeMeta.content = dark ? '#0c1a2c' : '#e3eefc';
}
themeButton.addEventListener('click', () => {
  root.dataset.theme = currentTheme() === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('theme', root.dataset.theme); } catch {}
  syncThemeUI();
});
syncThemeUI();

// ---------- Paper-cut rosettes ----------
// Seeded, so a given pattern number always produces the same cut.
function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const tidy = d => d.replace(/-?[\d.]+e[-+]?\d+|-?\d+\.\d{3,}/g, n => +(+n).toFixed(2));
const circlePath = (x, r) => `M${x - r} 0a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;

// Cut shapes in local coordinates: the radial axis runs along +x from a to b, half-width w.
const SHAPES = {
  petal: (a, b, w) => `M${a} 0Q${(a + b) / 2} ${2 * w} ${b} 0Q${(a + b) / 2} ${-2 * w} ${a} 0Z`,
  tear: (a, b, w) => {
    const l = b - a;
    return `M${a} 0C${a + l / 2} ${w / 5} ${b + l / 10} ${2 * w} ${b} 0C${b + l / 10} ${-2 * w} ${a + l / 2} ${-w / 5} ${a} 0Z`;
  },
  diamond: (a, b, w) => `M${a} 0L${(a + b) / 2} ${w}L${b} 0L${(a + b) / 2} ${-w}Z`,
  dot: (a, b, w) => circlePath((a + b) / 2, Math.min(w, (b - a) / 2)),
};

let rosetteCount = 0;

function cutRosette(svg, seed) {
  const rand = mulberry32(seed);
  const pick = list => list[Math.floor(rand() * list.length)];
  const folds = pick([6, 8, 8, 10, 12]);
  const R = 84;

  // Scalloped outline: one shallow arc per scallop
  const scallops = folds * pick([2, 3, 4]);
  const step = 2 * Math.PI / scallops;
  const halfChord = R * Math.sin(step / 2);
  const arc = halfChord * 1.25;
  let edge = `M${R} 0`;
  for (let i = 1; i <= scallops; i++) edge += `A${arc} ${arc} 0 0 1 ${R * Math.cos(i * step)} ${R * Math.sin(i * step)}`;
  edge = tidy(edge + 'Z');

  const cuts = []; // [path, rotation in degrees, ring]
  const star = Array.from({ length: folds * 2 }, (_, i) => {
    const r = i % 2 ? 4.5 : 11, a = i * Math.PI / folds;
    return `${r * Math.cos(a)} ${r * Math.sin(a)}`;
  });
  cuts.push([`M${star.join('L')}Z`, 0, 0]);

  // Concentric rings of cuts, separated by bands of uncut paper
  let r = 15 + rand() * 3, ring = 1;
  while (r < R - 20) {
    const r1 = Math.min(r + 8 + rand() * 12, R - 9);
    const count = folds * (r > 32 ? pick([1, 2]) : 1);
    const shape = SHAPES[pick(Object.keys(SHAPES))];
    const offset = rand() < .5 ? 0 : 180 / count;
    const w = Math.min(Math.PI * (r + r1) / count * .3, (r1 - r) * .45);
    for (let i = 0; i < count; i++) cuts.push([shape(r, r1, w), offset + i * 360 / count, ring]);
    r = r1 + 3 + rand() * 3;
    ring++;
  }
  // a pinhole in every scallop
  for (let i = 0; i < scallops; i++) {
    cuts.push([circlePath(R + halfChord * .1, Math.min(1.8, halfChord * .12)), (i + .5) * 360 / scallops, ring]);
  }

  const id = `rosette-${++rosetteCount}`;
  const holes = cuts.map(([d, deg, ring], i) =>
    `<g transform="rotate(${+deg.toFixed(2)})"><path class="cut" d="${tidy(d)}" style="animation-delay:${ring * 110 + (i % 24) * 6}ms"/></g>`
  ).join('');
  svg.innerHTML = `<defs><mask id="${id}"><path d="${edge}" fill="#fff"/><g fill="#000">${holes}</g></mask></defs>` +
    `<g class="spin"><path class="paper" d="${edge}" mask="url(#${id})"/></g>`;
  return folds;
}

const heroRosette = document.getElementById('hero-rosette');
const rosetteMeta = document.querySelector('.rosette-meta');
function recut() {
  const seed = 1 + Math.floor(Math.random() * 9999);
  const folds = cutRosette(heroRosette, seed);
  rosetteMeta.textContent = `No. ${String(seed).padStart(4, '0')} · ${folds}-fold`;
}
recut();
document.getElementById('recut').addEventListener('click', recut);
document.querySelectorAll('.rosette[data-seed]').forEach(svg => cutRosette(svg, +svg.dataset.seed));

// ---------- Scroll reveal ----------
const revealer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    entry.target.classList.add('is-in');
    revealer.unobserve(entry.target);
  }
}, { rootMargin: '0px 0px -8% 0px' });
document.querySelectorAll('.reveal').forEach(el => revealer.observe(el));

// ---------- Current section in the nav ----------
// The section crossing the middle of the screen is current; at the very bottom, Contact is.
// On phones the nav is a scrolling strip, so it scrolls to keep the current link in view.
const navLinks = new Map([...document.querySelectorAll('.nav-links a')].map(a => [a.hash.slice(1), a]));
const navStrip = document.querySelector('.nav > nav');
let spied = '', shown = '';

function markCurrent() {
  const atBottom = innerHeight + scrollY >= document.documentElement.scrollHeight - 4;
  const id = atBottom ? 'contact' : spied;
  if (id === shown) return;
  shown = id;
  navLinks.forEach((a, key) => key === id ? a.setAttribute('aria-current', 'location') : a.removeAttribute('aria-current'));
  const link = navLinks.get(id);
  if (!link) return;
  const strip = navStrip.getBoundingClientRect(), box = link.getBoundingClientRect();
  navStrip.scrollTo({ left: navStrip.scrollLeft + box.left - strip.left - (strip.width - box.width) / 2, behavior: 'smooth' });
}

const spy = new IntersectionObserver((entries) => {
  for (const entry of entries) if (entry.isIntersecting) spied = entry.target.id;
  markCurrent();
}, { rootMargin: '-45% 0px -50% 0px' });
navLinks.forEach((_, id) => spy.observe(document.getElementById(id)));
addEventListener('scroll', markCurrent, { passive: true });
