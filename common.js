// Shared across every page: shot transition, soundtrack, hover tones, lazy video slots.
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

function finishArrival() {
  const html = document.documentElement;
  if (!html.classList.contains('is-arriving')) return;
  requestAnimationFrame(() => requestAnimationFrame(() => html.classList.add('is-arrived')));
  setTimeout(() => html.classList.remove('is-arriving', 'is-arrived'), 900);
}
finishArrival();

function clearShot() {
  document.querySelectorAll('.shot-ball, .shot-veil').forEach((el) => el.remove());
  document.documentElement.classList.remove('is-shooting');
}
// Back/forward cache restores the page mid-transition; wipe it.
window.addEventListener('pageshow', (event) => { if (event.persisted) clearShot(); });

function navigateWithShot(link) {
  const href = link.href;
  const color = link.dataset.shotColor || '#050505';
  try { sessionStorage.setItem(SHOT_KEY, color); } catch (error) { /* storage blocked: plain navigation */ }
  window.dispatchEvent(new CustomEvent('sv:shot', { detail: { link } }));

  if (motionReduced.matches || !Element.prototype.animate) {
    window.location.href = href;
    return;
  }

  document.documentElement.classList.add('is-shooting');
  const bounds = link.getBoundingClientRect();
  const size = Math.round(Math.min(110, Math.max(64, bounds.height * 1.1)));
  const startX = bounds.left + bounds.width / 2 - size / 2;
  const startY = bounds.top + bounds.height / 2 - size / 2;
  const dx = window.innerWidth / 2 - size / 2 - startX;
  const dy = window.innerHeight / 2 - size / 2 - startY;
  const lift = Math.min(220, window.innerHeight * 0.28);
  const cover = (Math.hypot(window.innerWidth, window.innerHeight) / size) * 1.25;

  const ball = document.createElement('div');
  ball.className = 'shot-ball';
  ball.innerHTML = BALL_SVG;
  Object.assign(ball.style, { width: `${size}px`, height: `${size}px`, left: `${startX}px`, top: `${startY}px` });

  const veil = document.createElement('div');
  veil.className = 'shot-veil';
  veil.style.background = color;
  document.body.append(ball, veil);

  const kick = ball.animate([
    { transform: 'translate(0, 0) rotate(0deg) scale(.55)' },
    { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - lift}px) rotate(420deg) scale(1.05)`, offset: 0.5 },
    { transform: `translate(${dx}px, ${dy}px) rotate(780deg) scale(1.35)` },
  ], { duration: 560, easing: 'cubic-bezier(.22,.8,.32,1)', fill: 'forwards' });

  kick.onfinish = () => {
    const fill = ball.animate([
      { transform: `translate(${dx}px, ${dy}px) rotate(780deg) scale(1.35)` },
      { transform: `translate(${dx}px, ${dy}px) rotate(1040deg) scale(${cover})` },
    ], { duration: 520, easing: 'cubic-bezier(.7,0,.84,0)', fill: 'forwards' });
    fill.onfinish = () => {
      const fade = veil.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, fill: 'forwards' });
      fade.onfinish = () => { window.location.href = href; };
    };
  };
}

document.querySelectorAll('a[data-shot]').forEach((link) => {
  link.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (document.documentElement.classList.contains('is-shooting')) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    navigateWithShot(link);
  });
  // Warm the next page so the fade-in is instant.
  const prefetch = () => {
    if (link.dataset.prefetched) return;
    link.dataset.prefetched = '1';
    const hint = document.createElement('link');
    hint.rel = 'prefetch';
    hint.href = link.href;
    document.head.appendChild(hint);
  };
  link.addEventListener('pointerenter', prefetch, { once: true });
  link.addEventListener('focus', prefetch, { once: true });
});

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
  if (!saved || saved.playing) playCurrentTrack();
  else trackStatus.textContent = 'Paused';

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

document.querySelectorAll('a, button, [data-hover]').forEach((element) => {
  element.addEventListener('mouseenter', () => playInteractionTone('enter'));
  element.addEventListener('mouseleave', () => playInteractionTone('leave'));
});

document.querySelectorAll('[data-tilt]').forEach((element) => {
  element.addEventListener('pointermove', (event) => {
    if (motionReduced.matches || event.pointerType !== 'mouse') return;
    const bounds = element.getBoundingClientRect();
    element.style.setProperty('--tilt-x', `${((event.clientY - bounds.top) / bounds.height - 0.5) * -6}deg`);
    element.style.setProperty('--tilt-y', `${((event.clientX - bounds.left) / bounds.width - 0.5) * 6}deg`);
  });
  element.addEventListener('pointerleave', () => {
    element.style.removeProperty('--tilt-x');
    element.style.removeProperty('--tilt-y');
  });
});

/* ---------- Gameplay video slots ----------
   Drop an MP4 at the path in data-src (e.g. videos/future-soccer.mp4) and it
   appears automatically; until then the placeholder stays. Videos only load
   and play while on screen. */
const videoSlots = document.querySelectorAll('video[data-src]');
if (videoSlots.length) {
  const attach = (video) => {
    if (video.dataset.loaded) return;
    video.dataset.loaded = '1';
    video.addEventListener('loadeddata', () => video.closest('.video-slot')?.classList.add('has-video'), { once: true });
    video.addEventListener('error', () => video.remove(), { once: true });
    video.src = video.dataset.src;
  };
  const observer = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      if (isIntersecting) {
        attach(target);
        if (!motionReduced.matches) target.play?.().catch(() => {});
      } else if (!target.paused) {
        target.pause();
      }
    });
  }, { rootMargin: '200px 0px' }) : null;
  videoSlots.forEach((video) => (observer ? observer.observe(video) : attach(video)));
}

/* ---------- Small bits ---------- */
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

const clockEl = document.getElementById('clock');
if (clockEl) {
  const updateClock = () => {
    const now = new Date();
    clockEl.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };
  updateClock();
  setInterval(updateClock, 30000);
}
