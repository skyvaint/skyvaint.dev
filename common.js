// Shared across every page: in-place page switching with the shot transition,
// soundtrack, hover tones, tilt, lazy video slots.
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
// Goku Black's green Potara earring.
const POTARA_SVG = `<svg viewBox="0 0 100 100" aria-hidden="true">
  <defs><radialGradient id="shot-potara-gem" cx="50%" cy="50%" r="50%" fx="38%" fy="34%">
    <stop offset="0" stop-color="#d6ffb0"/><stop offset=".45" stop-color="#3fd45a"/><stop offset="1" stop-color="#0b4f1e"/>
  </radialGradient></defs>
  <circle cx="50" cy="15" r="9" fill="none" stroke="#f4cf55" stroke-width="5"/>
  <path d="M50 24v14" stroke="#f4cf55" stroke-width="5" stroke-linecap="round"/>
  <circle cx="50" cy="68" r="30" fill="url(#shot-potara-gem)" stroke="#0b3d18" stroke-width="2"/>
  <ellipse cx="40" cy="56" rx="8" ry="5" fill="#fff" opacity=".55" transform="rotate(-30 40 56)"/>
</svg>`;
// focus = the point the zoom dives into (fraction of the icon box);
// radius = how much of the icon around that point is solid colour.
const SHOT_ICONS = {
  ball: { svg: BALL_SVG, focusX: 0.5, focusY: 0.5, radius: 0.155, spin: true, glow: 'rgba(255, 30, 30, .75)' },
  potara: { svg: POTARA_SVG, focusX: 0.5, focusY: 0.68, radius: 0.27, spin: false, glow: 'rgba(80, 255, 120, .7)' },
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
      // The ball spins; the Potara flies straight with no rotation.
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

/* ---------- Soundtrack (state carries across pages) ---------- */
const SOUND_KEY = 'sv-soundtrack';
const soundtrack = document.getElementById('soundtrack-audio');
const soundtrackToggle = document.getElementById('soundtrack-toggle');
const trackName = document.getElementById('track-name');
const trackStatus = document.getElementById('track-status');
const progressFill = document.getElementById('track-progress-fill');
const progressBar = document.querySelector('.track-progress');
const tracks = [
  { name: 'Breeze', local: 'music/Breeze.mp3', remote: 'https://raw.githubusercontent.com/skyvaint/skyvaint.dev/main/music/Breeze.mp3' },
  { name: 'Crazy My Beat', local: 'music/Crazy%20My%20Beat.mp3', remote: 'https://raw.githubusercontent.com/skyvaint/skyvaint.dev/main/music/Crazy%20My%20Beat.mp3' },
  { name: 'Old Digicam', local: 'music/Old%20Digicam.mp3', remote: 'https://raw.githubusercontent.com/skyvaint/skyvaint.dev/main/music/Old%20Digicam.mp3' },
];
let trackIndex = 2;
let trackLoadId = 0;
let pendingPlay = false;
let sourceMode = 'remote';
let resumeAt = 0;

function readSoundState() {
  try { return JSON.parse(sessionStorage.getItem(SOUND_KEY) || 'null'); } catch (error) { return null; }
}
function saveSoundState() {
  if (!soundtrack) return;
  try {
    sessionStorage.setItem(SOUND_KEY, JSON.stringify({
      index: trackIndex,
      time: soundtrack.currentTime || 0,
      playing: !soundtrack.paused || pendingPlay,
    }));
  } catch (error) { /* storage blocked */ }
}

function setToggle(label, verb) {
  soundtrackToggle.textContent = label;
  soundtrackToggle.setAttribute('aria-label', `${verb} ${tracks[trackIndex].name}`);
}

function loadTrack(index) {
  if (!soundtrack) return;
  trackLoadId += 1;
  pendingPlay = false;
  trackIndex = (index + tracks.length) % tracks.length;
  const track = tracks[trackIndex];
  sourceMode = 'remote';
  soundtrack.src = track.remote;
  soundtrack.load();
  trackName.textContent = track.name;
  trackStatus.textContent = 'Loading stream...';
  setToggle('Resume', 'Resume');
  if (progressFill) progressFill.style.width = '0%';
}

function playLoadedTrack(loadId) {
  if (!soundtrack || loadId !== trackLoadId) return;
  soundtrack.play().then(() => {
    if (loadId !== trackLoadId) return;
    setToggle('Stop', 'Stop');
    trackStatus.textContent = 'Playing';
  }).catch((error) => {
    if (loadId !== trackLoadId || error.name === 'AbortError') return;
    // Autoplay blocked: wait for the first gesture (retryAutoplay below).
    trackStatus.textContent = 'Tap anywhere to play';
    setToggle('Play', 'Play');
  });
}

function playCurrentTrack() {
  if (!soundtrack) return;
  pendingPlay = true;
  trackStatus.textContent = 'Loading...';
  setToggle('Loading', 'Loading');
  if (soundtrack.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) playLoadedTrack(trackLoadId);
}

function toggleSoundtrack() {
  if (!soundtrack) return;
  if (soundtrack.paused) {
    playCurrentTrack();
  } else {
    soundtrack.pause();
    pendingPlay = false;
    setToggle('Resume', 'Resume');
    trackStatus.textContent = 'Paused';
  }
}

if (soundtrack) {
  const saved = readSoundState();
  loadTrack(saved ? saved.index : trackIndex);
  resumeAt = saved ? saved.time : 0;
  // Off by default; only resumes if the visitor had it playing.
  if (saved && saved.playing) playCurrentTrack();
  else {
    trackStatus.textContent = 'Muted · press Play';
    setToggle('Play', 'Play');
  }
  const playerEl = soundtrack.closest('.soundtrack');
  soundtrack.addEventListener('play', () => playerEl?.classList.add('is-playing'));
  soundtrack.addEventListener('pause', () => playerEl?.classList.remove('is-playing'));

  soundtrackToggle?.addEventListener('click', toggleSoundtrack);
  const retryAutoplay = (event) => {
    if (event.target.closest?.('#soundtrack-toggle')) return;
    if (soundtrack.paused && pendingPlay) playLoadedTrack(trackLoadId);
  };
  document.addEventListener('pointerdown', retryAutoplay, { once: true });
  document.addEventListener('keydown', retryAutoplay, { once: true });

  soundtrack.addEventListener('loadedmetadata', () => {
    if (resumeAt && resumeAt < soundtrack.duration) soundtrack.currentTime = resumeAt;
    resumeAt = 0;
  });
  soundtrack.addEventListener('ended', () => {
    loadTrack(trackIndex + 1);
    playCurrentTrack();
  });
  soundtrack.addEventListener('canplay', () => {
    if (pendingPlay && soundtrack.paused) playLoadedTrack(trackLoadId);
  });
  soundtrack.addEventListener('error', () => {
    const track = tracks[trackIndex];
    if (sourceMode === 'remote' && track.local) {
      sourceMode = 'local';
      trackStatus.textContent = 'Retrying local file...';
      soundtrack.src = track.local;
      soundtrack.load();
      return;
    }
    pendingPlay = false;
    trackStatus.textContent = window.location.protocol === 'file:' ? 'Use Live Server' : 'Audio unavailable';
  });
  let progressFrame = 0;
  soundtrack.addEventListener('timeupdate', () => {
    if (!progressFill || !soundtrack.duration || progressFrame) return;
    progressFrame = requestAnimationFrame(() => {
      progressFill.style.width = `${(soundtrack.currentTime / soundtrack.duration) * 100}%`;
      progressFrame = 0;
    });
  });
  progressBar?.addEventListener('click', (event) => {
    if (!soundtrack.duration) return;
    const bounds = progressBar.getBoundingClientRect();
    soundtrack.currentTime = ((event.clientX - bounds.left) / bounds.width) * soundtrack.duration;
  });
  window.addEventListener('pagehide', saveSoundState);
  window.addEventListener('sv:shot', saveSoundState);
}

/* ---------- Hover tones + tilt ---------- */
let interactionAudioContext;
function playInteractionTone(type) {
  if (motionReduced.matches) return;
  try {
    if (!interactionAudioContext) interactionAudioContext = new AudioContext();
    if (interactionAudioContext.state === 'suspended') interactionAudioContext.resume();
    const audioContext = interactionAudioContext;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;
    oscillator.type = type === 'leave' ? 'sine' : 'sawtooth';
    oscillator.frequency.setValueAtTime(type === 'leave' ? 310 : 480, now);
    oscillator.frequency.exponentialRampToValueAtTime(type === 'leave' ? 170 : 760, now + 0.16);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.018, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.25);
  } catch (error) {
    // Browsers can deny Web Audio until a user gesture; visual effects still work.
  }
}

const HOVER_SELECTOR = 'a, button, [data-hover]';
document.addEventListener('mouseover', (event) => {
  const el = event.target.closest?.(HOVER_SELECTOR);
  if (el && !el.contains(event.relatedTarget)) playInteractionTone('enter');
});
document.addEventListener('mouseout', (event) => {
  const el = event.target.closest?.(HOVER_SELECTOR);
  if (el && !el.contains(event.relatedTarget)) playInteractionTone('leave');
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
