const canvas = document.getElementById('GradientCanvas');
const context = canvas ? canvas.getContext('2d') : null;
const motionReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
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
let interactionAudioContext;
const characterImages = [
  'images/goku-black-hero.png',
  'images/goku-black-hero2.png',
  'images/goku-black-hero3.png',
  'images/goku-black-hero4.png',
];

const state = {
  width: 0,
  height: 0,
  dpr: Math.min(window.devicePixelRatio || 1, window.innerWidth <= 900 ? 0.75 : 1),
  pointerFrame: 0,
  pointerX: 0,
  pointerY: 0,
};

function resizeCanvas() {
  if (!canvas || !context) return;
  const width = window.innerWidth;
  const height = window.innerHeight;
  if (width === state.width && height === state.height) return;
  state.width = width;
  state.height = height;
  canvas.width = Math.floor(state.width * state.dpr);
  canvas.height = Math.floor(state.height * state.dpr);
  context.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  drawStaticVectors();
}

function drawStaticVectors() {
  if (!canvas || !context || motionReduced.matches) return;

  const { width, height } = state;

  context.clearRect(0, 0, width, height);
  context.fillStyle = '#08050f';
  context.fillRect(0, 0, width, height);
  const drawCurve = (offset, side) => {
    const spread = 16 + offset * 1.9;
    const startX = side === 'left' ? -width * 0.32 - spread : width * 1.32 + spread;
    const endX = side === 'left' ? width * 0.28 + spread : width * 0.72 - spread;
    const startY = height * 0.94 - offset * 2.2;
    const endY = side === 'left'
      ? height * 0.12 + offset * 2.2
      : height * 0.88 - offset * 2.2;
    const controlX = side === 'left'
      ? width * 0.04
      : width * 0.96;
    const controlY = height * 0.5;
    context.beginPath();
    context.moveTo(startX, startY);
    context.quadraticCurveTo(controlX, controlY, endX, endY);
    context.lineCap = 'round';
    context.lineWidth = 1.2 + (offset % 5 === 0 ? 0.7 : 0);
    context.strokeStyle = offset % 5 === 0
      ? 'rgba(157, 91, 255, 0.58)'
      : 'rgba(109, 59, 193, 0.32)';
    context.stroke();
  };

  const vectorGroupCount = width <= 900 ? 2 : 3;
  for (let vectorGroup = 0; vectorGroup < vectorGroupCount; vectorGroup += 1) {
    context.globalAlpha = 0.34 + (vectorGroup % 3) * 0.08;
    for (let offset = -6; offset < 30; offset += 1) {
      drawCurve(offset + vectorGroup * 0.72, vectorGroup % 2 ? 'right' : 'left');
    }
  }
  context.globalAlpha = 1;
}

window.addEventListener('resize', resizeCanvas);
window.addEventListener('pointermove', (event) => {
  state.pointerX = event.clientX;
  state.pointerY = event.clientY;
  if (state.pointerFrame) return;
  state.pointerFrame = requestAnimationFrame(() => {
    document.documentElement.style.setProperty('--pointer-x', `${state.pointerX}px`);
    document.documentElement.style.setProperty('--pointer-y', `${state.pointerY}px`);
    state.pointerFrame = 0;
  });
});

resizeCanvas();
if (motionReduced.matches) {
  if (canvas) canvas.style.display = 'none';
}

// Footer year
document.getElementById('year').textContent = new Date().getFullYear();

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
  soundtrackToggle.textContent = 'Resume';
  soundtrackToggle.setAttribute('aria-label', `Resume ${track.name}`);
  if (progressFill) progressFill.style.width = '0%';
  return trackLoadId;
}

function playLoadedTrack(loadId) {
  if (!soundtrack || loadId !== trackLoadId) return;
  soundtrack.play().then(() => {
    if (loadId !== trackLoadId) return;
    soundtrackToggle.textContent = 'Stop';
    soundtrackToggle.setAttribute('aria-label', `Stop ${tracks[trackIndex].name}`);
    trackStatus.textContent = 'Playing';
  }).catch((error) => {
    if (loadId !== trackLoadId || error.name === 'AbortError') return;
    trackStatus.textContent = 'Audio unavailable';
    console.error('Unable to play soundtrack:', error);
  });
}

function playCurrentTrack() {
  if (!soundtrack) return;
  pendingPlay = true;
  trackStatus.textContent = 'Loading...';
  soundtrackToggle.textContent = 'Loading';
  soundtrackToggle.setAttribute('aria-label', `Loading ${tracks[trackIndex].name}`);
  if (soundtrack.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
    playLoadedTrack(trackLoadId);
  }
}

function toggleSoundtrack() {
  if (!soundtrack) return;
  if (soundtrack.paused) {
    playCurrentTrack();
  } else {
    soundtrack.pause();
    pendingPlay = false;
    soundtrackToggle.textContent = 'Resume';
    soundtrackToggle.setAttribute('aria-label', `Resume ${tracks[trackIndex].name}`);
    trackStatus.textContent = 'Paused';
  }
}

loadTrack(trackIndex);
pendingPlay = true;
trackStatus.textContent = 'Loading stream...';
soundtrackToggle.textContent = 'Loading';
soundtrackToggle.setAttribute('aria-label', `Loading ${tracks[trackIndex].name}`);
soundtrackToggle?.addEventListener('click', toggleSoundtrack);
const retryAutoplay = () => {
  if (soundtrack?.paused && pendingPlay) playCurrentTrack();
};
document.addEventListener('pointerdown', retryAutoplay, { once: true });
document.addEventListener('keydown', retryAutoplay, { once: true });
document.getElementById('track-prev')?.addEventListener('click', () => {
  loadTrack(trackIndex - 1);
  playCurrentTrack();
});
document.getElementById('track-next')?.addEventListener('click', () => {
  loadTrack(trackIndex + 1);
  playCurrentTrack();
});
soundtrack?.addEventListener('ended', () => {
  loadTrack(trackIndex + 1);
  playCurrentTrack();
});
soundtrack?.addEventListener('canplay', () => {
  if (pendingPlay) playLoadedTrack(trackLoadId);
});
soundtrack?.addEventListener('canplaythrough', () => {
  if (!pendingPlay) trackStatus.textContent = sourceMode === 'remote' ? 'Ready · GitHub stream' : 'Ready · local fallback';
  if (pendingPlay) playLoadedTrack(trackLoadId);
});
soundtrack?.addEventListener('error', () => {
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
soundtrack?.addEventListener('timeupdate', () => {
  if (!progressFill || !soundtrack.duration) return;
  if (progressFrame) return;
  progressFrame = requestAnimationFrame(() => {
    progressFill.style.width = `${(soundtrack.currentTime / soundtrack.duration) * 100}%`;
    progressFrame = 0;
  });
});
progressBar?.addEventListener('click', (event) => {
  if (!soundtrack?.duration) return;
  const bounds = progressBar.getBoundingClientRect();
  soundtrack.currentTime = ((event.clientX - bounds.left) / bounds.width) * soundtrack.duration;
});

function getInteractionAudioContext() {
  if (!interactionAudioContext) {
    interactionAudioContext = new AudioContext();
  }
  if (interactionAudioContext.state === 'suspended') interactionAudioContext.resume();
  return interactionAudioContext;
}

function playInteractionTone(type) {
  if (motionReduced.matches) return;
  try {
    const audioContext = getInteractionAudioContext();
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
    if (error.name !== 'NotAllowedError') console.warn('Interaction sound unavailable:', error);
  }
}

document.querySelectorAll('a, button, .project-card, .social-card, .tool, .price-card, .stat').forEach((element) => {
  element.addEventListener('mouseenter', () => {
    element.classList.add('is-hovered');
    playInteractionTone('enter');
  });
  element.addEventListener('mouseleave', () => {
    element.classList.remove('is-hovered');
    playInteractionTone('leave');
  });
});

document.querySelectorAll('.btn, .project-card, .social-card, .tool, .price-card, .stat, .hero-frame').forEach((element) => {
  element.addEventListener('pointermove', (event) => {
    if (motionReduced.matches) return;
    const bounds = element.getBoundingClientRect();
    const rotateX = ((event.clientY - bounds.top) / bounds.height - 0.5) * -5;
    const rotateY = ((event.clientX - bounds.left) / bounds.width - 0.5) * 5;
    element.style.setProperty('--tilt-x', `${rotateX}deg`);
    element.style.setProperty('--tilt-y', `${rotateY}deg`);
  });
  element.addEventListener('pointerleave', () => {
    element.style.removeProperty('--tilt-x');
    element.style.removeProperty('--tilt-y');
  });
});

const characterBackdrop = document.getElementById('section-character');
const characterLayers = characterBackdrop ? [...characterBackdrop.querySelectorAll('.character-layer')] : [];
const characterSections = document.querySelectorAll('.character-section');
let activeCharacterIndex = -1;
let characterSwapTimer;
let activeCharacterLayer = 0;
let activeCharacterImage = '';
let characterCycleIndex = 0;

function swapCharacterImage(image) {
  if (!characterBackdrop || characterLayers.length < 2 || image === activeCharacterImage) return;
  activeCharacterImage = image;
  const nextLayer = activeCharacterLayer === 0 ? 1 : 0;
  const currentLayer = characterLayers[activeCharacterLayer];
  const incomingLayer = characterLayers[nextLayer];
  clearTimeout(characterSwapTimer);
  characterBackdrop.classList.remove('is-visible');
  characterSwapTimer = setTimeout(() => {
    incomingLayer.src = image;
    incomingLayer.classList.add('is-active');
    currentLayer.classList.remove('is-active');
    activeCharacterLayer = nextLayer;
    requestAnimationFrame(() => characterBackdrop.classList.add('is-visible'));
  }, 420);
}

function showCharacter(section, visibility = 1) {
  if (!characterBackdrop || characterLayers.length < 2) return;
  characterBackdrop.style.setProperty('--character-opacity', String(visibility * 0.16));
  if (visibility > 0.08) characterBackdrop.classList.add('is-visible');
}

if (characterBackdrop && characterLayers.length) {
  characterBackdrop.style.setProperty('--character-opacity', '0.16');
  characterLayers[0].classList.add('is-active');
  activeCharacterImage = characterImages[0];
  characterBackdrop.classList.add('is-visible');
}
let characterCycleTimer;
function cycleCharacter() {
  if (motionReduced.matches || !characterLayers.length || document.hidden) return;
  characterCycleIndex = (characterCycleIndex + 1) % characterImages.length;
  swapCharacterImage(characterImages[characterCycleIndex]);
}
function startCharacterCycle() {
  if (!characterCycleTimer && characterLayers.length) {
    characterCycleTimer = setInterval(cycleCharacter, 20000);
  }
}
function stopCharacterCycle() {
  clearInterval(characterCycleTimer);
  characterCycleTimer = undefined;
}
startCharacterCycle();
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopCharacterCycle();
  else startCharacterCycle();
});

// Simple local clock (edit the timeZone below if you want to lock it to a specific place)
function updateClock() {
  const el = document.getElementById('clock');
  if (!el) return;
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  el.textContent = `${h}:${m}`;
}
updateClock();
setInterval(updateClock, 1000 * 120);