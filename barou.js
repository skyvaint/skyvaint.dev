// Barou pages: red thunder canvas + scroll reveals.
// The canvas only draws while a bolt is alive (~0.5s), then sits idle — no constant render loop.
const thunderCanvas = document.getElementById('thunder');
const thunderCtx = thunderCanvas?.getContext('2d');
const flashEl = document.querySelector('.flash');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const thunder = { width: 0, height: 0, dpr: 1, bolts: [], frame: 0, timer: 0 };

function resizeThunder() {
  if (!thunderCanvas) return;
  thunder.dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth <= 900 ? 1 : 1.5);
  thunder.width = window.innerWidth;
  thunder.height = window.innerHeight;
  thunderCanvas.width = Math.floor(thunder.width * thunder.dpr);
  thunderCanvas.height = Math.floor(thunder.height * thunder.dpr);
  thunderCtx.setTransform(thunder.dpr, 0, 0, thunder.dpr, 0, 0);
}

// Midpoint-displacement bolt with a couple of forks.
function makeBoltPath(x1, y1, x2, y2, roughness, depth) {
  let points = [[x1, y1], [x2, y2]];
  let spread = Math.hypot(x2 - x1, y2 - y1) * roughness;
  for (let d = 0; d < depth; d += 1) {
    const next = [points[0]];
    for (let i = 0; i < points.length - 1; i += 1) {
      const [ax, ay] = points[i];
      const [bx, by] = points[i + 1];
      const nx = -(by - ay);
      const ny = bx - ax;
      const len = Math.hypot(nx, ny) || 1;
      const offset = (Math.random() - 0.5) * spread;
      next.push([(ax + bx) / 2 + (nx / len) * offset, (ay + by) / 2 + (ny / len) * offset], points[i + 1]);
    }
    points = next;
    spread /= 2;
  }
  return points;
}

function spawnBolt(originX) {
  const { width, height } = thunder;
  const x = originX ?? width * (Math.random() < 0.5 ? 0.05 + Math.random() * 0.3 : 0.65 + Math.random() * 0.3);
  const endX = x + (Math.random() - 0.5) * width * 0.25;
  const endY = height * (0.45 + Math.random() * 0.45);
  const main = makeBoltPath(x, -10, endX, endY, 0.32, 7);
  const forks = [];
  for (let f = 0; f < 3; f += 1) {
    const start = main[Math.floor(main.length * (0.25 + Math.random() * 0.5))];
    const angle = Math.atan2(endY, endX - x) + (Math.random() - 0.5) * 1.6;
    const reach = height * (0.08 + Math.random() * 0.16);
    forks.push(makeBoltPath(start[0], start[1], start[0] + Math.cos(angle) * reach, start[1] + Math.sin(angle) * reach, 0.4, 5));
  }
  thunder.bolts.push({ main, forks, born: performance.now(), life: 520 });
  if (flashEl) {
    flashEl.style.setProperty('--flash-x', `${(x / width) * 100}%`);
    flashEl.classList.remove('is-on');
    void flashEl.offsetWidth;
    flashEl.classList.add('is-on');
  }
  if (!thunder.frame) thunder.frame = requestAnimationFrame(drawThunder);
}

function strokePath(points) {
  thunderCtx.beginPath();
  thunderCtx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) thunderCtx.lineTo(points[i][0], points[i][1]);
  thunderCtx.stroke();
}

function drawThunder(now) {
  thunderCtx.clearRect(0, 0, thunder.width, thunder.height);
  thunder.bolts = thunder.bolts.filter((bolt) => now - bolt.born < bolt.life);
  thunderCtx.lineJoin = 'round';
  thunderCtx.lineCap = 'round';
  for (const bolt of thunder.bolts) {
    const t = (now - bolt.born) / bolt.life;
    // Two quick strikes, then a fade.
    const flicker = t < 0.12 ? 1 : t < 0.2 ? 0.25 : t < 0.32 ? 0.95 : 1 - (t - 0.32) / 0.68;
    // Glow pass (wide, translucent) + core pass (thin, bright) — cheaper than shadowBlur.
    thunderCtx.globalAlpha = flicker * 0.22;
    thunderCtx.strokeStyle = '#ff1f1f';
    thunderCtx.lineWidth = 14;
    strokePath(bolt.main);
    thunderCtx.globalAlpha = flicker * 0.55;
    thunderCtx.lineWidth = 5;
    strokePath(bolt.main);
    thunderCtx.lineWidth = 2.5;
    bolt.forks.forEach(strokePath);
    thunderCtx.globalAlpha = flicker;
    thunderCtx.strokeStyle = '#ffe2dc';
    thunderCtx.lineWidth = 1.6;
    strokePath(bolt.main);
    thunderCtx.lineWidth = 0.9;
    bolt.forks.forEach(strokePath);
  }
  thunderCtx.globalAlpha = 1;
  thunder.frame = thunder.bolts.length ? requestAnimationFrame(drawThunder) : 0;
}

function scheduleThunder() {
  clearTimeout(thunder.timer);
  thunder.timer = setTimeout(() => {
    if (!document.hidden) spawnBolt();
    scheduleThunder();
  }, 2600 + Math.random() * 4200);
}

if (thunderCanvas && thunderCtx && !reduceMotion.matches) {
  resizeThunder();
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resizeThunder, 120);
  });
  setTimeout(() => spawnBolt(), 700);
  scheduleThunder();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearTimeout(thunder.timer);
    else scheduleThunder();
  });
  // Thunder clap when a shot is taken.
  window.addEventListener('sv:shot', (event) => {
    const bounds = event.detail.link.getBoundingClientRect();
    spawnBolt(bounds.left + bounds.width / 2);
    setTimeout(() => spawnBolt(), 160);
  });
} else if (thunderCanvas) {
  thunderCanvas.remove();
}

// Scroll reveals.
const revealEls = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window && !reduceMotion.matches) {
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: 0.12 });
  revealEls.forEach((el) => revealObserver.observe(el));
} else {
  revealEls.forEach((el) => el.classList.add('is-in'));
}
