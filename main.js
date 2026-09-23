const canvas = document.getElementById('GradientCanvas');
const context = canvas ? canvas.getContext('2d') : null;
const motionReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const soundtrack = document.getElementById('soundtrack-audio');
const soundtrackToggle = document.getElementById('soundtrack-toggle');
const trackName = document.getElementById('track-name');
const trackStatus = document.getElementById('track-status');
const tracks = [
  { name: 'Breeze', source: 'music/Breeze.mp3' },
  { name: 'Crazy My Beat', source: 'music/Crazy My Beat.mp3' },
  { name: 'Old Digicam', source: 'music/Old Digicam.mp3' },
];
let trackIndex = 0;
let trackLoadId = 0;
let pendingPlay = false;

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
  soundtrack.src = encodeURI(track.source);
  soundtrack.load();
  trackName.textContent = track.name;
  trackStatus.textContent = 'Paused';
  soundtrackToggle.textContent = 'Play';
  soundtrackToggle.setAttribute('aria-label', `Play ${track.name}`);
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

loadTrack(0);
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
soundtrack?.addEventListener('error', () => {
  pendingPlay = false;
  trackStatus.textContent = window.location.protocol === 'file:'
    ? 'Use Live Server'
    : 'Audio unavailable';
});

const characterBackdrop = document.getElementById('section-character');
const characterImage = characterBackdrop?.querySelector('img');
const characterSections = document.querySelectorAll('.character-section');
let activeCharacterIndex = -1;
let characterSwapTimer;

function showCharacter(section, visibility = 1) {
  if (!characterBackdrop || !characterImage) return;
  const sectionIndex = [...characterSections].indexOf(section);
  const image = section.dataset.characterImage || 'images/goku-black-hero.png';
  if (sectionIndex !== activeCharacterIndex) {
    activeCharacterIndex = sectionIndex;
    characterBackdrop.classList.remove('is-visible');
    clearTimeout(characterSwapTimer);
    characterSwapTimer = setTimeout(() => {
      characterImage.src = image;
      requestAnimationFrame(() => characterBackdrop.classList.add('is-visible'));
    }, 260);
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