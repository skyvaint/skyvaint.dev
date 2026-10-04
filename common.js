// Shared across every page: in-place page switching with the shot transition,
// ambient soundtrack, hover sounds, tilt, lazy video slots.
const motionReduced = window.matchMedia('(prefers-reduced-motion: reduce)');

/* ---------- Shot transition ---------- */
const SHOT_KEY = 'sv-shot';
const BALL_SVG = `<svg viewBox="0 0 100 100" aria-hidden="true">
  <defs><clipPath id="shot-ball-clip"><circle cx="50" cy="50" r="47"/></clipPath></defs>
  <circle cx="50" cy="50" r="48" fill="#f7f3f3"/>
  <g clip-path="url(#shot-ball-clip)" fill="#0a0a0a" stroke="#0a0a0a" stroke-width="3" stroke-linejoin="round">
    <path d="M50 30 69 44 62 66H38L31 44Z"/>
    <path d="M50 30V12M69 44l17-6M62 66l11 15M38 66 27 81M31 44l-17-6" fill="none"/>
    <path d="M38 -2 38 12H62L62 -2ZM86 38l16-6 2 30-14 4ZM73 81l17-2-4 24-20-6ZM27 81l-17-2 4 24 20-6ZM14 38-2 32-4 62l14 4Z"/>
  </g>
  <circle cx="50" cy="50" r="48" fill="none" stroke="#0a0a0a" stroke-width="3"/>
</svg>`;
// Blue Lock emblem (UI page) and the four-star Dragon Ball (scripting page).
const BLUELOCK_SVG = `<svg viewBox="0 0 100 100" aria-hidden="true">
  <polygon points="50.00,10.00 91.85,40.40 75.86,89.60 24.14,89.60 8.15,40.40" fill="#1238c4" stroke="#fff" stroke-width="5" stroke-linejoin="round"/>
  <path d="M50.00 54.00L70.92 25.20M50.00 54.00L83.85 65.00M50.00 54.00L50.00 89.60M50.00 54.00L16.15 65.00M50.00 54.00L29.08 25.20" stroke="#fff" stroke-width="5.6"/>
  <polygon points="50.00,40.50 62.84,49.83 57.94,64.92 42.06,64.92 37.16,49.83" fill="#fff" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/>
</svg>`;
const STAR = 'M0-7 1.9-2.4 6.7-2.2 2.9.8 4.2 5.6 0 2.8-4.2 5.6-2.9.8-6.7-2.2-1.9-2.4Z';
const DRAGONBALL_SVG = `<svg viewBox="0 0 100 100" aria-hidden="true">
  <defs><radialGradient id="shot-db-gem" cx="50%" cy="50%" r="50%" fx="36%" fy="32%"><stop offset="0" stop-color="#fff1b8"/><stop offset=".35" stop-color="#ffb21f"/><stop offset=".8" stop-color="#f07400"/><stop offset="1" stop-color="#b34700"/></radialGradient></defs>
  <circle cx="50" cy="50" r="46" fill="url(#shot-db-gem)" stroke="#8a3600" stroke-width="2"/>
  <g fill="#d81b1b">${[[42, 38], [60, 42], [40, 57], [58, 61]].map(([x, y]) => `<path d="${STAR}" transform="translate(${x} ${y})"/>`).join('')}</g>
  <ellipse cx="34" cy="26" rx="11" ry="6" fill="#fff" opacity=".6" transform="rotate(-35 34 26)"/>
</svg>`;
// focus = the point the zoom dives into (fraction of the icon box);
// radius = how much of the icon around that point is solid colour.
const SHOT_ICONS = {
  ball: { svg: BALL_SVG, focusX: 0.5, focusY: 0.5, radius: 0.155, spin: true, glow: 'rgba(255, 30, 30, .75)' },
  bluelock: { svg: BLUELOCK_SVG, focusX: 0.5, focusY: 0.27, radius: 0.095, spin: false, glow: 'rgba(70, 130, 255, .8)' },
  dragonball: { svg: DRAGONBALL_SVG, focusX: 0.5, focusY: 0.8, radius: 0.13, spin: false, glow: 'rgba(255, 160, 30, .8)' },
};

/* ---------- Page lifecycle ----------
   Pages switch in place: the next page's #page is fetched and swapped in, so
   the soundtrack, thunder canvas and mesh keep running between pages.
   Page modules register with SV.page(fn); fn(root) runs on every page and may
   return a cleanup function that runs before the next swap. */
const pageModules = [];
let pageCleanups = [];
window.SV = { page(fn) { pageModules.push(fn); } };

function initPage() {
  const root = document.getElementById('page');
  pageCleanups = pageModules.map((fn) => fn(root)).filter((fn) => typeof fn === 'function');
}
function cleanupPage() {
  pageCleanups.forEach((fn) => fn());
  pageCleanups = [];
}
document.addEventListener('DOMContentLoaded', initPage);

const pageCache = new Map();
function loadPage(url) {
  const key = url.split('#')[0];
  if (!pageCache.has(key)) {
    const request = fetch(key, { credentials: 'same-origin' })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
      })
      .then((html) => new DOMParser().parseFromString(html, 'text/html'));
    request.catch(() => pageCache.delete(key));
    pageCache.set(key, request);
  }
  return pageCache.get(key);
}

const pageKey = (url) => new URL(url, location.href).pathname;
let shownPage = pageKey(location.href);

async function swapPage(url, push) {
  const doc = await loadPage(url);
  const next = doc.getElementById('page');
  const current = document.getElementById('page');
  if (!next || !current) throw new Error('missing #page');
  cleanupPage();
  current.replaceWith(document.importNode(next, true));
  document.title = doc.title;
  document.body.dataset.theme = doc.body.dataset.theme || 'red';
  ['meta[name="theme-color"]', 'meta[name="description"]'].forEach((selector) => {
    const from = doc.querySelector(selector);
    const to = document.querySelector(selector);
    if (from && to) to.content = from.content;
  });
  if (push) history.pushState({ sv: true }, '', url);
  shownPage = pageKey(url);
  const hash = new URL(url, location.href).hash;
  const target = hash && document.getElementById(hash.slice(1));
  if (target) target.scrollIntoView();
  else window.scrollTo(0, 0);
  initPage();
  window.dispatchEvent(new CustomEvent('sv:page'));
}

function makeVeil(color) {
  const veil = document.createElement('div');
  veil.className = 'shot-veil';
  veil.style.background = color;
  document.body.appendChild(veil);
  return veil;
}
const finished = (animation) => new Promise((resolve) => { animation.onfinish = resolve; animation.oncancel = resolve; });

async function revealAfterSwap(veil) {
  await finished(veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: motionReduced.matches ? 1 : 520, easing: 'ease-out', fill: 'forwards' }));
  veil.remove();
}

function hardNavigate(href, color) {
  try { sessionStorage.setItem(SHOT_KEY, color); } catch (error) { /* storage blocked */ }
  window.location.href = href;
}

let navigating = false;
async function navigateWithShot(link) {
  if (navigating) return;
  navigating = true;
  const href = link.href;
  const color = link.dataset.shotColor || '#050505';
  const pending = loadPage(href);
  window.dispatchEvent(new CustomEvent('sv:shot', { detail: { link } }));
  document.documentElement.classList.add('is-shooting');

  let ball;
  const veil = makeVeil(color);
  try {
    if (!motionReduced.matches && Element.prototype.animate) {
      const icon = SHOT_ICONS[link.dataset.shotIcon] || SHOT_ICONS.ball;
      const bounds = (link.querySelector('.shot-origin') || link).getBoundingClientRect();
      const size = Math.round(Math.min(110, Math.max(56, bounds.height * 1.1)));
      const startX = bounds.left + bounds.width / 2 - size / 2;
      const startY = bounds.top + bounds.height / 2 - size / 2;
      // Move so the focus point (not the box centre) lands on screen centre.
      const dx = window.innerWidth / 2 - (startX + icon.focusX * size);
      const dy = window.innerHeight / 2 - (startY + icon.focusY * size);
      const lift = Math.min(220, window.innerHeight * 0.28);
      // Scale until the solid area around the focus covers the whole screen.
      const cover = (Math.hypot(window.innerWidth, window.innerHeight) / 2 / (icon.radius * size)) * 1.12;
      // The soccer ball spins; the other icons fly straight.
      const turn = (deg) => (icon.spin ? deg : 0);
      ball = document.createElement('div');
      ball.className = 'shot-ball';
      ball.innerHTML = icon.svg;
      Object.assign(ball.style, {
        width: `${size}px`,
        height: `${size}px`,
        left: `${startX}px`,
        top: `${startY}px`,
        transformOrigin: `${icon.focusX * 100}% ${icon.focusY * 100}%`,
        filter: `drop-shadow(0 0 14px ${icon.glow})`,
      });
      document.body.appendChild(ball);
      await finished(ball.animate([
        { transform: `translate(0, 0) rotate(0deg) scale(.55)` },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - lift}px) rotate(${turn(420)}deg) scale(1.05)`, offset: 0.5 },
        { transform: `translate(${dx}px, ${dy}px) rotate(${turn(780)}deg) scale(1.35)` },
      ], { duration: 560, easing: 'cubic-bezier(.22,.8,.32,1)', fill: 'forwards' }));
      // A huge drop-shadow is expensive to paint; drop it for the dive.
      ball.style.filter = 'none';
      await finished(ball.animate([
        { transform: `translate(${dx}px, ${dy}px) rotate(${turn(780)}deg) scale(1.35)` },
        { transform: `translate(${dx}px, ${dy}px) rotate(${turn(1000)}deg) scale(${cover})` },
      ], { duration: 640, easing: 'cubic-bezier(.7,0,.84,0)', fill: 'forwards' }));
    }
    await finished(veil.animate([{ opacity: 0 }, { opacity: 1 }], { duration: motionReduced.matches ? 120 : 240, fill: 'forwards' }));
    await pending;
    await swapPage(href, true);
    ball?.remove();
    document.documentElement.classList.remove('is-shooting');
    await revealAfterSwap(veil);
  } catch (error) {
    hardNavigate(href, color);
    return;
  } finally {
    navigating = false;
  }
  syncWithLocation();
}

history.replaceState({ sv: true }, '', location.href);

// Back/forward: show whatever page the address bar now points at. If a
// transition is mid-flight, it calls this again when it finishes.
async function syncWithLocation() {
  if (navigating || pageKey(location.href) === shownPage) return;
  navigating = true;
  const veil = makeVeil(getComputedStyle(document.body).backgroundColor);
  try {
    await finished(veil.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, fill: 'forwards' }));
    await swapPage(location.href, false);
    await revealAfterSwap(veil);
  } catch (error) {
    window.location.reload();
    return;
  } finally {
    navigating = false;
  }
  syncWithLocation();
}
window.addEventListener('popstate', syncWithLocation);

function finishArrival() {
  const html = document.documentElement;
  if (!html.classList.contains('is-arriving')) return;
  requestAnimationFrame(() => requestAnimationFrame(() => html.classList.add('is-arrived')));
  setTimeout(() => html.classList.remove('is-arriving', 'is-arrived'), 900);
}
finishArrival();
window.addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  document.querySelectorAll('.shot-ball, .shot-veil').forEach((el) => el.remove());
  document.documentElement.classList.remove('is-shooting');
});

document.addEventListener('click', (event) => {
  const link = event.target.closest?.('a[data-shot]');
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigateWithShot(link);
});
// Warm the next page on hover/focus so the swap is instant.
const warm = (event) => {
  const link = event.target.closest?.('a[data-shot]');
  if (link) loadPage(link.href).catch(() => {});
};
document.addEventListener('pointerover', warm, { passive: true });
document.addEventListener('focusin', warm);

/* ---------- Ambient soundtrack + hover sounds ----------
   A calm, generative ambient piece synthesised with Web Audio: slow pad
   chords, sparse soft bell notes, all through a generated reverb. No audio
   file to download. Off by default; the choice is remembered for the session. */
const SOUND_KEY = 'sv-ambient';
const player = document.querySelector('.soundtrack');
const soundToggle = document.getElementById('soundtrack-toggle');
const soundStatus = document.getElementById('track-status');
let audioCtx = null;
let ambient = null;

function getAudio() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function makeReverb(ctx, seconds) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  }
  const convolver = ctx.createConvolver();
  convolver.buffer = impulse;
  return convolver;
}

const midi = (note) => 440 * 2 ** ((note - 69) / 12);
// Fmaj9 → Am7 → Dm9 → Bbmaj7, voiced low and open.
const CHORDS = [[41, 53, 57, 60, 64], [45, 52, 55, 60, 64], [38, 53, 57, 60, 64], [46, 53, 57, 62, 65]];
const BELLS = [72, 74, 76, 79, 81, 84];

function startAmbient() {
  const ctx = getAudio();
  if (!ctx || ambient) return;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, ctx.currentTime);
  master.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 3);
  const reverb = makeReverb(ctx, 4.5);
  const wet = ctx.createGain();
  wet.gain.value = 0.55;
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 1400;
  tone.connect(master);
  tone.connect(reverb).connect(wet).connect(master);
  master.connect(ctx.destination);

  const state = { master, tone, chord: 0, timers: [], voices: new Set() };
  const playChord = () => {
    const now = ctx.currentTime;
    CHORDS[state.chord % CHORDS.length].forEach((note, i) => {
      [-4, 4].forEach((detune) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = i === 0 ? 'sine' : 'triangle';
        osc.frequency.value = midi(note);
        osc.detune.value = detune;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(i === 0 ? 0.05 : 0.022, now + 3.5);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 11);
        osc.connect(gain).connect(tone);
        osc.start(now);
        osc.stop(now + 11.2);
        state.voices.add(osc);
        osc.onended = () => state.voices.delete(osc);
      });
    });
    state.chord += 1;
    state.timers.push(setTimeout(playChord, 8000));
  };
  const playBell = () => {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = midi(BELLS[Math.floor(Math.random() * BELLS.length)]);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.03, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);
    osc.connect(gain).connect(tone);
    osc.start(now);
    osc.stop(now + 3.3);
    state.timers.push(setTimeout(playBell, 1800 + Math.random() * 3800));
  };
  playChord();
  state.timers.push(setTimeout(playBell, 2500));
  ambient = state;
}

function stopAmbient() {
  if (!ambient || !audioCtx) return;
  const { master, timers, voices } = ambient;
  timers.forEach(clearTimeout);
  const now = audioCtx.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
  setTimeout(() => {
    voices.forEach((osc) => { try { osc.stop(); } catch (error) { /* already stopped */ } });
    master.disconnect();
  }, 1300);
  ambient = null;
}

function saveSound(on) {
  try { sessionStorage.setItem(SOUND_KEY, on ? '1' : '0'); } catch (error) { /* storage blocked */ }
}
function renderSound(on, status) {
  player?.classList.toggle('is-playing', on);
  if (soundToggle) {
    soundToggle.textContent = on ? 'Pause' : 'Play';
    soundToggle.setAttribute('aria-label', on ? 'Pause ambient soundtrack' : 'Play ambient soundtrack');
  }
  if (soundStatus) soundStatus.textContent = status || (on ? 'Playing · ambient' : 'Muted · press Play');
}

if (player) {
  renderSound(false);
  soundToggle?.addEventListener('click', () => {
    const on = !ambient;
    if (on) startAmbient(); else stopAmbient();
    saveSound(on);
    renderSound(on);
  });
  // A full reload can't start audio without a gesture: resume on the first one.
  let wanted = false;
  try { wanted = sessionStorage.getItem(SOUND_KEY) === '1'; } catch (error) { /* storage blocked */ }
  if (wanted) {
    renderSound(false, 'Tap anywhere to resume');
    const resume = (event) => {
      if (event.target.closest?.('#soundtrack-toggle')) return;
      startAmbient();
      renderSound(true);
    };
    document.addEventListener('pointerdown', resume, { once: true });
    document.addEventListener('keydown', resume, { once: true });
  }
}

// Hover: a soft, short, low-volume glassy tick on a pentatonic note.
const TICKS = [76, 79, 81, 84, 86];
let lastTick = 0;
function playHoverTick() {
  if (motionReduced.matches || !audioCtx || audioCtx.state !== 'running') return;
  const now = audioCtx.currentTime;
  if (now - lastTick < 0.06) return;
  lastTick = now;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 2400;
  osc.type = 'sine';
  osc.frequency.value = midi(TICKS[Math.floor(Math.random() * TICKS.length)]);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.012, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
  osc.connect(filter).connect(gain).connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.25);
}
// Unlock audio on the first gesture so hover ticks can play.
document.addEventListener('pointerdown', () => getAudio(), { once: true });

const HOVER_SELECTOR = 'a, button, [data-hover]';
document.addEventListener('mouseover', (event) => {
  const el = event.target.closest?.(HOVER_SELECTOR);
  if (el && !el.contains(event.relatedTarget)) playHoverTick();
});

let tiltEl = null;
let tiltFrame = 0;
let tiltEvent = null;
function resetTilt() {
  if (!tiltEl) return;
  tiltEl.style.removeProperty('--tilt-x');
  tiltEl.style.removeProperty('--tilt-y');
  tiltEl = null;
}
document.addEventListener('pointermove', (event) => {
  if (motionReduced.matches || event.pointerType !== 'mouse') return;
  tiltEvent = event;
  if (tiltFrame) return;
  tiltFrame = requestAnimationFrame(() => {
    tiltFrame = 0;
    const el = tiltEvent.target.closest?.('[data-tilt]');
    if (el !== tiltEl) resetTilt();
    if (!el) return;
    tiltEl = el;
    const bounds = el.getBoundingClientRect();
    el.style.setProperty('--tilt-x', `${((tiltEvent.clientY - bounds.top) / bounds.height - 0.5) * -6}deg`);
    el.style.setProperty('--tilt-y', `${((tiltEvent.clientX - bounds.left) / bounds.width - 0.5) * 6}deg`);
  });
}, { passive: true });
document.addEventListener('pointerleave', resetTilt);

/* ---------- Gameplay video slots ----------
   Drop an MP4 at the path in data-src (e.g. videos/future-soccer.mp4) and it
   appears automatically; until then the placeholder stays. Videos only load
   and play while on screen. */
SV.page((root) => {
  const videos = root.querySelectorAll('video[data-src]');
  if (!videos.length) return undefined;
  const attach = (video) => {
    if (video.dataset.loaded) return;
    video.dataset.loaded = '1';
    video.addEventListener('loadeddata', () => video.closest('.video-slot')?.classList.add('has-video'), { once: true });
    video.addEventListener('error', () => video.remove(), { once: true });
    video.src = video.dataset.src;
  };
  if (!('IntersectionObserver' in window)) {
    videos.forEach(attach);
    return undefined;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      if (isIntersecting) {
        attach(target);
        if (!motionReduced.matches) target.play?.().catch(() => {});
      } else if (!target.paused) {
        target.pause();
      }
    });
  }, { rootMargin: '200px 0px' });
  videos.forEach((video) => observer.observe(video));
  return () => observer.disconnect();
});

/* ---------- Small bits ---------- */
SV.page((root) => {
  const yearEl = root.querySelector('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
  const clockEl = root.querySelector('#clock');
  if (!clockEl) return undefined;
  const updateClock = () => {
    const now = new Date();
    clockEl.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };
  updateClock();
  const timer = setInterval(updateClock, 30000);
  return () => clearInterval(timer);
});
