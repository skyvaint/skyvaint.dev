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
let nextThunderAt = 0;
let thunder = null;
const characterImages = [
  'images/goku-black-hero.png',
  'images/goku-black-hero2.png',
  'images/goku-black-hero3.png',
  'images/goku-black-hero4.png',
];

const state = {
  width: 0,
  height: 0,
  dpr: Math.min(window.devicePixelRatio || 1, 1.5),
  pointer: { x: 0.5, y: 0.5, targetX: 0.5, targetY: 0.5, speed: 0 },
};

function resizeCanvas() {
  if (!canvas || !context) return;
  state.width = window.innerWidth;
  state.height = window.innerHeight;
  canvas.width = state.width * state.dpr;
  canvas.height = state.height * state.dpr;
  context.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
}

function drawMesh(time) {
  if (!canvas || !context || motionReduced.matches) return;

  const { width, height, pointer } = state;
  const influenceX = pointer.x * width;
  const influenceY = pointer.y * height;
  const hoverStrength = Math.min(1, pointer.speed * 0.18 + 0.04);

  context.clearRect(0, 0, width, height);
  context.fillStyle = '#08050f';
  context.fillRect(0, 0, width, height);

  const drawCurve = (offset, side) => {
    const phase = time * 0.00012 + offset * 0.06;
    const spread = 16 + offset * 1.9;
    const startX = side === 'left' ? -width * 0.32 - spread : width * 1.32 + spread;
    const endX = side === 'left' ? width * 0.28 + spread : width * 0.72 - spread;
    const startY = height * 0.94 - offset * 2.2;
    const endY = side === 'left'
      ? height * 0.12 + offset * 2.2
      : height * 0.88 - offset * 2.2;
    const controlX = side === 'left'
      ? width * 0.04 + Math.sin(phase) * 28
      : width * 0.96 + Math.sin(phase) * 28;
    const controlY = height * 0.5 + (influenceY - height * 0.5) * hoverStrength * 0.18;
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

  context.shadowColor = 'rgba(125, 54, 255, 0.42)';
  context.shadowBlur = 10;
  for (let offset = -10; offset < 52; offset += 1) {
    drawCurve(offset, 'left');
    drawCurve(offset, 'right');
  }
  context.shadowBlur = 0;

  if (time > nextThunderAt) {
    thunder = {
      side: Math.random() > 0.5 ? 'left' : 'right',
      started: time,
      duration: 180 + Math.random() * 180,
      seed: Math.random() * 100,
    };
    nextThunderAt = time + 850 + Math.random() * 1900;
  }
  if (thunder) {
    const age = time - thunder.started;
    if (age < thunder.duration) {
      const progress = age / thunder.duration;
      const alpha = Math.sin(progress * Math.PI) * (0.65 + Math.random() * 0.35);
      const originX = thunder.side === 'left' ? width * 0.08 : width * 0.92;
      const direction = thunder.side === 'left' ? 1 : -1;
      context.save();
      context.globalAlpha = alpha;
      context.strokeStyle = '#ff8fdd';
      context.shadowColor = '#ff3ec8';
      context.shadowBlur = 22;
      context.lineWidth = 2.4;
      context.beginPath();
      context.moveTo(originX, -10);
      for (let bolt = 0; bolt < 9; bolt += 1) {
        const y = 40 + bolt * height * 0.09;
        const x = originX + direction * (Math.sin(thunder.seed + bolt * 8) * 70 + bolt * 12);
        context.lineTo(x, y);
      }
      context.stroke();
      context.strokeStyle = 'rgba(255, 255, 255, .9)';
      context.shadowBlur = 4;
      context.lineWidth = 0.8;
      context.stroke();
      context.restore();
    } else {
      thunder = null;
    }
  }

  // Small drifting particles add depth without competing with the content.
  for (let particle = 0; particle < 82; particle += 1) {
    const phase = time * 0.00025 + particle * 2.7;
    const x = ((particle * 137 + time * 0.018 * (particle % 2 ? 1 : -1)) % (width + 120)) - 60;
    const y = ((particle * 83 + time * 0.006 * (particle % 3 ? 1 : -1) + Math.sin(phase) * 90) % (height + 80)) - 40;
    const twinkle = 0.45 + Math.sin(phase * 2.4) * 0.35;
    context.fillStyle = particle % 3 === 0
      ? `rgba(255, 143, 221, ${Math.max(0.08, twinkle)})`
      : `rgba(180, 142, 255, ${Math.max(0.06, twinkle * 0.72)})`;
    context.beginPath();
    context.arc(x, y, 0.7 + (particle % 4) * 0.45, 0, Math.PI * 2);
    context.fill();
  }

  // Brief side flashes respond to pointer speed, like distant energy strikes.
  const flash = Math.min(0.22, pointer.speed * 0.12);
  if (flash > 0.01) {
    context.fillStyle = `rgba(255, 62, 200, ${flash})`;
    context.fillRect(0, 0, 5, height);
    context.fillStyle = `rgba(139, 61, 255, ${flash})`;
    context.fillRect(width - 5, 0, 5, height);
  }
}

function animate(time) {
  const { pointer } = state;
  pointer.x += (pointer.targetX - pointer.x) * 0.06;
  pointer.y += (pointer.targetY - pointer.y) * 0.06;
  pointer.speed += (0 - pointer.speed) * 0.08;
  drawMesh(time);
  if (!motionReduced.matches) requestAnimationFrame(animate);
}

window.addEventListener('resize', resizeCanvas);
window.addEventListener('pointermove', (event) => {
  const nextX = event.clientX / window.innerWidth;
  const nextY = event.clientY / window.innerHeight;
  state.pointer.speed = Math.min(
    1,
    Math.hypot(nextX - state.pointer.targetX, nextY - state.pointer.targetY) * 12,
  );
  state.pointer.targetX = nextX;
  state.pointer.targetY = nextY;
  document.documentElement.style.setProperty('--pointer-x', `${event.clientX}px`);
  document.documentElement.style.setProperty('--pointer-y', `${event.clientY}px`);
});

resizeCanvas();
if (motionReduced.matches) {
  if (canvas) canvas.style.display = 'none';
} else {
  requestAnimationFrame(animate);
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
  soundtrackToggle.textContent = 'Play';
  soundtrackToggle.setAttribute('aria-label', `Play ${track.name}`);
  if (progressFill) progressFill.style.width = '0%';
  return trackLoadId;
}

function playLoadedTrack(loadId) {
  if (!soundtrack || loadId !== trackLoadId) return;
  soundtrack.play().then(() => {
    if (loadId !== trackLoadId) return;
    soundtrackToggle.textContent = 'Pause';
    soundtrackToggle.setAttribute('aria-label', `Pause ${tracks[trackIndex].name}`);
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
    soundtrackToggle.textContent = 'Play';
    soundtrackToggle.setAttribute('aria-label', `Play ${tracks[trackIndex].name}`);
    trackStatus.textContent = 'Paused';
  }
}

loadTrack(trackIndex);
soundtrackToggle?.addEventListener('click', toggleSoundtrack);
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
soundtrack?.addEventListener('timeupdate', () => {
  if (!progressFill || !soundtrack.duration) return;
  progressFill.style.width = `${(soundtrack.currentTime / soundtrack.duration) * 100}%`;
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
    oscillator.type = type === 'leave' ? 'sine' : 'triangle';
    oscillator.frequency.setValueAtTime(type === 'leave' ? 180 : 260, now);
    oscillator.frequency.exponentialRampToValueAtTime(type === 'leave' ? 110 : 420, now + 0.07);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.025, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.11);
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

document.querySelectorAll('.project-card, .social-card, .tool, .price-card, .stat, .hero-frame').forEach((element) => {
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
  const sectionIndex = [...characterSections].indexOf(section);
  const image = section.dataset.characterImage || 'images/goku-black-hero.png';
  if (sectionIndex !== activeCharacterIndex) {
    activeCharacterIndex = sectionIndex;
    characterCycleIndex = Math.max(0, characterImages.indexOf(image));
    swapCharacterImage(image);
    return;
  }
  characterBackdrop.style.setProperty('--character-opacity', String(visibility * 0.16));
  if (visibility <= 0.08) characterBackdrop.classList.remove('is-visible');
  else if (sectionIndex === activeCharacterIndex) characterBackdrop.classList.add('is-visible');
}

function updateCharacterOnScroll() {
  if (!characterSections.length) return;
  const viewportCenter = window.innerHeight * 0.5;
  let closestSection = characterSections[0];
  let closestDistance = Infinity;

  characterSections.forEach((section) => {
    const rect = section.getBoundingClientRect();
    const sectionCenter = rect.top + rect.height * 0.5;
    const distance = Math.abs(sectionCenter - viewportCenter);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestSection = section;
    }
  });

  const fadeRange = window.innerHeight * 0.72;
  showCharacter(closestSection, Math.max(0, 1 - closestDistance / fadeRange));
}

window.addEventListener('scroll', updateCharacterOnScroll, { passive: true });
window.addEventListener('resize', updateCharacterOnScroll);
updateCharacterOnScroll();
setInterval(() => {
  if (motionReduced.matches || !characterSections.length) return;
  characterCycleIndex = (characterCycleIndex + 1) % characterImages.length;
  swapCharacterImage(characterImages[characterCycleIndex]);
}, 20000);

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
setInterval(updateClock, 1000 * 30);