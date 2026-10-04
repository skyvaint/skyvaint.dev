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

// Reactive mesh: a wireframe terrain flying toward the viewer (karbon-style).
// It rolls forward over time and with scroll, swells under the cursor and
// leans with the mouse. ~1k points per frame; paused when the tab is hidden.
const meshCanvas = document.getElementById('mesh');
const meshCtx = meshCanvas?.getContext('2d');
if (meshCanvas && meshCtx) {
  const mesh = { w: 0, h: 0, cols: 0, rows: 0, rgb: [255, 40, 40], frame: 0, last: 0 };
  const pointer = { x: -9999, y: -9999, sx: -9999, sy: -9999, power: 0, lean: 0 };
  const Z_NEAR = 1;
  const Z_FAR = 15;

  const readColor = () => {
    const raw = getComputedStyle(document.body).getPropertyValue('--mesh');
    const parts = raw.match(/[\d.]+/g);
    if (parts && parts.length >= 3) mesh.rgb = parts.slice(0, 3).map(Number);
  };
  const resizeMesh = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    mesh.w = window.innerWidth;
    mesh.h = window.innerHeight;
    meshCanvas.width = Math.floor(mesh.w * dpr);
    meshCanvas.height = Math.floor(mesh.h * dpr);
    meshCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const small = mesh.w < 700;
    mesh.cols = small ? 26 : 46;
    mesh.rows = small ? 20 : 28;
  };

  const drawMesh = (now) => {
    const t = now / 1000;
    const { w, h, cols, rows } = mesh;
    const [r, g, b] = mesh.rgb;
    const f = h * 0.95;
    const horizon = h * 0.3;
    const camHeight = 1.25;
    // Ease pointer for a soft, fluid response.
    pointer.sx += (pointer.x - pointer.sx) * 0.12;
    pointer.sy += (pointer.y - pointer.sy) * 0.12;
    pointer.power *= 0.985;
    pointer.lean += (((pointer.x > -999 ? pointer.x / w : 0.5) - 0.5) * -60 - pointer.lean) * 0.05;
    const cx = w / 2 + pointer.lean;
    const travel = t * 0.55 + window.scrollY * 0.004;
    const dz = (Z_FAR - Z_NEAR) / rows;
    const offset = travel % dz;
    const xMax = ((w / 2) * Z_FAR) / f;
    const radius2 = 2 * 150 * 150;

    meshCtx.clearRect(0, 0, w, h);
    const grid = [];
    for (let i = rows; i >= 0; i -= 1) {
      const z = Z_NEAR + i * dz - offset;
      const worldZ = z + travel;
      const row = [];
      for (let j = 0; j <= cols; j += 1) {
        const x = -xMax + (2 * xMax * j) / cols;
        let y = 0.2 * Math.sin(x * 0.55 + t * 0.8)
          + 0.16 * Math.sin(worldZ * 0.7 - t * 0.6)
          + 0.08 * Math.sin((x + worldZ) * 1.4 + t * 1.5);
        const sx = cx + (x * f) / z;
        let sy = horizon + ((camHeight - y) * f) / z;
        let lift = 0;
        if (pointer.power > 0.01) {
          const ddx = sx - pointer.sx;
          const ddy = sy - pointer.sy;
          lift = pointer.power * Math.exp(-(ddx * ddx + ddy * ddy) / radius2);
          y += lift * 0.7;
          sy = horizon + ((camHeight - y) * f) / z;
        }
        row.push([sx, sy, lift]);
      }
      grid.push({ z, row });
    }

    meshCtx.lineWidth = 1;
    // Rows: fade into the distance.
    for (const { z, row } of grid) {
      const depth = (z - Z_NEAR) / (Z_FAR - Z_NEAR);
      const alpha = Math.max(0, (1 - depth) ** 1.3) * 0.62;
      if (alpha < 0.01) continue;
      meshCtx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
      meshCtx.beginPath();
      row.forEach(([x, y], j) => (j ? meshCtx.lineTo(x, y) : meshCtx.moveTo(x, y)));
      meshCtx.stroke();
    }
    // Columns: one path, faded toward the horizon with a gradient.
    const fade = meshCtx.createLinearGradient(0, horizon, 0, h);
    fade.addColorStop(0, `rgba(${r},${g},${b},0)`);
    fade.addColorStop(0.5, `rgba(${r},${g},${b},.22)`);
    fade.addColorStop(1, `rgba(${r},${g},${b},.4)`);
    meshCtx.strokeStyle = fade;
    meshCtx.beginPath();
    for (let j = 0; j <= cols; j += 1) {
      grid.forEach(({ row }, i) => (i ? meshCtx.lineTo(row[j][0], row[j][1]) : meshCtx.moveTo(row[j][0], row[j][1])));
    }
    meshCtx.stroke();
    // Glowing nodes where the cursor lifts the mesh.
    if (pointer.power > 0.05) {
      for (const { row } of grid) {
        for (const [x, y, lift] of row) {
          if (lift < 0.12) continue;
          meshCtx.fillStyle = `rgba(255,255,255,${Math.min(1, lift * 1.4)})`;
          meshCtx.fillRect(x - 1.5, y - 1.5, 3, 3);
        }
      }
    }
  };

  const loop = (now) => {
    mesh.frame = requestAnimationFrame(loop);
    // ~30fps on small screens, full rate elsewhere.
    if (mesh.w < 700 && now - mesh.last < 32) return;
    mesh.last = now;
    drawMesh(now);
  };
  const start = () => { if (!mesh.frame) mesh.frame = requestAnimationFrame(loop); };
  const stop = () => { cancelAnimationFrame(mesh.frame); mesh.frame = 0; };

  resizeMesh();
  readColor();
  let meshResize;
  window.addEventListener('resize', () => { clearTimeout(meshResize); meshResize = setTimeout(resizeMesh, 120); });
  window.addEventListener('sv:page', readColor);
  window.addEventListener('pointermove', (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    if (pointer.sx < -999) { pointer.sx = pointer.x; pointer.sy = pointer.y; }
    pointer.power = Math.min(1, pointer.power + 0.08);
  }, { passive: true });
  if (reduceMotion.matches) {
    drawMesh(0);
  } else {
    start();
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  }
}
