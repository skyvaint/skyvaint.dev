// Site effects: themed thunder canvas (persistent across page swaps) plus page
// modules for scroll reveals, the Goku Black background and the stats banner.
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
  for (let f = 0, count = 3 + Math.floor(Math.random() * 3); f < count; f += 1) {
    const start = main[Math.floor(main.length * (0.25 + Math.random() * 0.5))];
    const angle = Math.atan2(endY, endX - x) + (Math.random() - 0.5) * 1.6;
    const reach = height * (0.08 + Math.random() * 0.16);
    forks.push(makeBoltPath(start[0], start[1], start[0] + Math.cos(angle) * reach, start[1] + Math.sin(angle) * reach, 0.4, 5));
  }
  const styles = getComputedStyle(document.body);
  const glow = styles.getPropertyValue('--bolt-glow').trim() || '#ff1f1f';
  const core = styles.getPropertyValue('--bolt-core').trim() || '#ffe2dc';
  thunder.bolts.push({ main, forks, glow, core, born: performance.now(), life: 520 });
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
    thunderCtx.strokeStyle = bolt.glow;
    thunderCtx.lineWidth = 14;
    strokePath(bolt.main);
    thunderCtx.globalAlpha = flicker * 0.55;
    thunderCtx.lineWidth = 5;
    strokePath(bolt.main);
    thunderCtx.lineWidth = 2.5;
    bolt.forks.forEach(strokePath);
    thunderCtx.globalAlpha = flicker;
    thunderCtx.strokeStyle = bolt.core;
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
    if (!document.hidden) {
      spawnBolt();
      // Frequent double and triple strikes.
      if (Math.random() < 0.55) setTimeout(() => spawnBolt(), 90 + Math.random() * 180);
      if (Math.random() < 0.25) setTimeout(() => spawnBolt(), 300 + Math.random() * 250);
    }
    scheduleThunder();
  }, 1100 + Math.random() * 2300);
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
    setTimeout(() => spawnBolt(), 380);
  });
  window.addEventListener('sv:page', () => {
    spawnBolt();
    setTimeout(() => spawnBolt(), 140);
  });
} else if (thunderCanvas) {
  thunderCanvas.remove();
}

// Scroll reveals.
SV.page((root) => {
  const revealEls = root.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window) || reduceMotion.matches) {
    revealEls.forEach((el) => el.classList.add('is-in'));
    return undefined;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12 });
  revealEls.forEach((el) => observer.observe(el));
  return () => observer.disconnect();
});

// Goku Black background: two layers cross-fade through the character art.
SV.page((root) => {
  const layers = [...root.querySelectorAll('.goku-bg img')];
  if (layers.length < 2 || reduceMotion.matches) return undefined;
  const images = (root.querySelector('.goku-bg').dataset.images || '').split(',').filter(Boolean);
  let index = 0;
  let active = 0;
  const timer = setInterval(() => {
    if (document.hidden || images.length < 2) return;
    index = (index + 1) % images.length;
    const incoming = layers[1 - active];
    incoming.src = images[index];
    incoming.decode?.().catch(() => {}).finally(() => {
      incoming.classList.add('is-active');
      layers[active].classList.remove('is-active');
      active = 1 - active;
    });
  }, 9000);
  return () => clearInterval(timer);
});

// Stats banner: live Roblox numbers when reachable, otherwise the values
// written in the HTML stay. roproxy.com mirrors the Roblox API with CORS.
SV.page((root) => {
  const banner = root.querySelector('.stats-banner');
  if (!banner) return undefined;
  const controller = new AbortController();
  const get = (url) => fetch(url, { signal: controller.signal }).then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  });
  const compact = (value) => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  const userId = banner.dataset.userId;
  const placeIds = (banner.dataset.placeIds || '').split(',').filter(Boolean);

  if (userId) {
    get(`https://thumbnails.roproxy.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png`)
      .then((data) => {
        const url = data?.data?.[0]?.imageUrl;
        const img = banner.querySelector('.stat-profile img');
        if (url && img) img.src = url;
      })
      .catch(() => {});
  }
  if (placeIds.length) {
    Promise.all(placeIds.map((id) => get(`https://apis.roproxy.com/universes/v1/places/${id}/universe`).then((data) => data.universeId)))
      .then((ids) => get(`https://games.roproxy.com/v1/games?universeIds=${ids.join(',')}`))
      .then((data) => {
        const games = data?.data || [];
        if (!games.length) return;
        const visits = games.reduce((sum, game) => sum + (game.visits || 0), 0);
        const playing = games.reduce((sum, game) => sum + (game.playing || 0), 0);
        const visitsEl = banner.querySelector('[data-stat="visits"]');
        const liveEl = banner.querySelector('[data-stat="live"]');
        if (visitsEl && visits) visitsEl.textContent = `${compact(visits)}+`;
        if (liveEl) {
          liveEl.textContent = compact(playing);
          liveEl.classList.add('is-live');
        }
      })
      .catch(() => {});
  }
  return () => controller.abort();
});
