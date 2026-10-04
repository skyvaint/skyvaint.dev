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
  for (let f = 0, count = 4 + Math.floor(Math.random() * 4); f < count; f += 1) {
    const start = main[Math.floor(main.length * (0.25 + Math.random() * 0.5))];
    const angle = Math.atan2(endY, endX - x) + (Math.random() - 0.5) * 1.6;
    const reach = height * (0.08 + Math.random() * 0.16);
    forks.push(makeBoltPath(start[0], start[1], start[0] + Math.cos(angle) * reach, start[1] + Math.sin(angle) * reach, 0.4, 5));
  }
  const styles = getComputedStyle(document.body);
  const glow = styles.getPropertyValue('--bolt-glow').trim() || '#ff1f1f';
  const core = styles.getPropertyValue('--bolt-core').trim() || '#ffe2dc';
  thunder.bolts.push({ main, forks, glow, core, born: performance.now(), life: 480 + Math.random() * 260 });
  if (thunder.bolts.length > 10) thunder.bolts.shift();
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
  const small = window.innerWidth < 700;
  thunder.timer = setTimeout(() => {
    if (!document.hidden) {
      // Storm: a strike every ~0.3–1s, usually in bursts of 2–4.
      const burst = 1 + Math.floor(Math.random() * (small ? 2 : 4));
      for (let k = 0; k < burst; k += 1) setTimeout(() => spawnBolt(), k * (70 + Math.random() * 160));
    }
    scheduleThunder();
  }, (small ? 600 : 300) + Math.random() * 700);
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
    setTimeout(() => spawnBolt(), 560);
    setTimeout(() => spawnBolt(), 740);
  });
  window.addEventListener('sv:page', () => {
    spawnBolt();
    setTimeout(() => spawnBolt(), 140);
    setTimeout(() => spawnBolt(), 300);
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

// Dot-matrix silk (karbon.cloud style): a WebGL shader renders flowing fabric
// folds, then quantises them to a halftone dot grid — bright fold edges become
// big glowing dots, shadows become pinpoints. Reacts to the cursor (folds bend
// and light up around it) and to scroll. Paused while the tab is hidden.
const meshCanvas = document.getElementById('mesh');
const gl = meshCanvas?.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: false, powerPreference: 'low-power' });
if (meshCanvas && gl) {
  const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const FRAG = `
precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform float uPitch;
uniform float uScroll;
uniform vec3 uMouse;      // xy in px (GL coords), z = strength
uniform vec3 uDim;
uniform vec3 uHot;

// Fold height field: domain-warped sine sheets, tilted diagonally, drifting.
float fold(vec2 q, float t) {
  float c = cos(0.42), sn = sin(0.42);
  vec2 p = mat2(c, -sn, sn, c) * q * vec2(1.7, 1.0);
  p.y += uScroll;
  for (int i = 1; i < 5; i++) {
    float fi = float(i);
    p.x += 0.6 / fi * sin(fi * 1.25 * p.y + t * 0.3 + fi * 1.7);
    p.y += 0.3 / fi * cos(fi * 1.05 * p.x - t * 0.2 + fi);
  }
  return sin(p.x * 4.1 + p.y * 0.8);
}

void main() {
  vec2 cell = floor(gl_FragCoord.xy / uPitch);
  vec2 center = (cell + 0.5) * uPitch;
  float aspect = uRes.x / uRes.y;
  vec2 q = center / uRes.y;

  // Cursor: bend the cloth toward the pointer and light it up.
  vec2 m = uMouse.xy / uRes.y;
  vec2 dm = q - m;
  float near = uMouse.z * exp(-dot(dm, dm) * 18.0);
  q -= dm * near * 0.35;

  float t = uTime;
  float e = 0.003;
  float h = fold(q, t);
  float hx = fold(q + vec2(e, 0.0), t);
  float hy = fold(q + vec2(0.0, e), t);
  vec2 g = vec2(hx - h, hy - h) / e;
  vec3 n = normalize(vec3(-g, 3.0));
  vec3 light = normalize(vec3(-0.45, 0.55, 0.7));
  float diff = clamp(dot(n, light), 0.0, 1.0);
  float spec = pow(clamp(dot(reflect(-light, n), vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 10.0);

  // Fabric body (dim dots), dark troughs (pinpoints), and thin bright lines
  // tracing the fold edges: distance in px to the h = 0.55 contour.
  float body = smoothstep(-0.35, 0.45, h);
  float edgeDist = abs(h - 0.55) / max(length(g), 0.001) * uRes.y;
  float edge = exp(-pow(edgeDist / (uPitch * 0.85), 2.0)) * smoothstep(0.0, 0.6, diff + 0.2);
  float lum = body * (0.26 + 0.5 * diff) + spec * 0.4 * body + edge * 0.72 + near * 0.45;
  lum *= smoothstep(1.35, 0.15, abs(q.x / aspect - 0.62)) * 0.5 + 0.5; // calmer left side
  lum = clamp(lum, 0.0, 1.0);

  // Halftone dot: radius grows with brightness, tiny pinpoint floor.
  float r = uPitch * (0.07 + 0.41 * pow(lum, 0.8));
  float d = length(gl_FragCoord.xy - center);
  float a = clamp(r - d + 0.5, 0.0, 1.0);
  vec3 col = mix(uDim, uHot, smoothstep(0.25, 1.0, lum));
  gl_FragColor = vec4(col, a * (0.3 + 0.55 * lum));
}`;
  const compile = (type, src) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  };
  try {
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    const u = (name) => gl.getUniformLocation(program, name);
    const uRes = u('uRes');
    const uTime = u('uTime');
    const uPitch = u('uPitch');
    const uScroll = u('uScroll');
    const uMouse = u('uMouse');
    const uDim = u('uDim');
    const uHot = u('uHot');

    const state = { dpr: 1, frame: 0, start: performance.now(), mx: -1e4, my: -1e4, tx: -1e4, ty: -1e4, power: 0, scroll: 0 };
    const hexToRgb = (value, fallback) => {
      const parts = value.match(/[\d.]+/g);
      return parts && parts.length >= 3 ? parts.slice(0, 3).map((n) => Number(n) / 255) : fallback;
    };
    const readColors = () => {
      const styles = getComputedStyle(document.body);
      gl.uniform3fv(uDim, hexToRgb(styles.getPropertyValue('--dots-dim'), [0.45, 0.08, 0.1]));
      gl.uniform3fv(uHot, hexToRgb(styles.getPropertyValue('--dots-hot'), [1, 0.42, 0.36]));
    };
    const resize = () => {
      state.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      meshCanvas.width = Math.floor(window.innerWidth * state.dpr);
      meshCanvas.height = Math.floor(window.innerHeight * state.dpr);
      gl.viewport(0, 0, meshCanvas.width, meshCanvas.height);
      gl.uniform2f(uRes, meshCanvas.width, meshCanvas.height);
      gl.uniform1f(uPitch, (window.innerWidth < 700 ? 8 : 9) * state.dpr);
    };
    const draw = (now) => {
      // Ease the cursor and its influence for a fluid feel.
      state.mx += (state.tx - state.mx) * 0.08;
      state.my += (state.ty - state.my) * 0.08;
      state.power *= 0.975;
      state.scroll += (window.scrollY * 0.0009 - state.scroll) * 0.08;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uTime, (now - state.start) / 1000);
      gl.uniform1f(uScroll, state.scroll);
      gl.uniform3f(uMouse, state.mx * state.dpr, (window.innerHeight - state.my) * state.dpr, state.power);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const loop = (now) => {
      state.frame = requestAnimationFrame(loop);
      draw(now);
    };
    const start = () => { if (!state.frame) state.frame = requestAnimationFrame(loop); };
    const stop = () => { cancelAnimationFrame(state.frame); state.frame = 0; };

    resize();
    readColors();
    let resizeTimer;
    window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 120); });
    window.addEventListener('sv:page', readColors);
    window.addEventListener('pointermove', (event) => {
      state.tx = event.clientX;
      state.ty = event.clientY;
      if (state.mx < -9e3) { state.mx = state.tx; state.my = state.ty; }
      state.power = Math.min(1, state.power + 0.06);
    }, { passive: true });
    if (reduceMotion.matches) {
      draw(performance.now() + 20000);
    } else {
      start();
      document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    }
  } catch (error) {
    meshCanvas.remove();
  }
} else if (meshCanvas) {
  meshCanvas.remove();
}
