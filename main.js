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
  const hoverStrength = Math.min(1, pointer.speed * 0.3 + 0.08);
  const spacing = Math.max(38, height / 17);

  context.clearRect(0, 0, width, height);
  context.fillStyle = '#08050f';
  context.fillRect(0, 0, width, height);

  const drawRibbon = (row, color, lineWidth, glow = false) => {
    const baseY = row * spacing - spacing;
    const phase = time * 0.00045 + row * 0.8;
    const amplitude = 12 + hoverStrength * 30;

    context.beginPath();
    for (let x = -40; x <= width + 40; x += 24) {
      const distance = Math.abs(x - influenceX);
      const focus = Math.max(0, 1 - distance / (width * 0.42));
      const swell = Math.sin(focus * Math.PI) * (influenceY - baseY) * hoverStrength * 0.12;
      const wave = Math.sin(x * 0.0035 + phase) * amplitude;
      const secondaryWave = Math.sin(x * 0.007 + phase * 1.7) * amplitude * 0.16;
      const y = baseY + wave + secondaryWave + swell;
      if (x === -40) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = lineWidth;
    context.strokeStyle = color;
    if (glow) {
      context.shadowColor = 'rgba(255, 45, 183, 0.5)';
      context.shadowBlur = 24;
    }
    context.stroke();
    context.shadowBlur = 0;
  };

  for (let row = -2; row < 19; row += 1) {
    drawRibbon(row, '#020105', 14 + hoverStrength * 7);
    drawRibbon(row, row % 2 === 0 ? 'rgba(255, 48, 188, 0.92)' : 'rgba(206, 31, 145, 0.76)', 2.5 + hoverStrength * 2.5, true);
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

function showCharacter(section) {
  if (!characterBackdrop || !characterImage) return;
  characterImage.src = section.dataset.characterImage || 'images/goku-black-hero.png';
  characterBackdrop.classList.add('is-visible');
}

function hideCharacter() {
  characterBackdrop?.classList.remove('is-visible');
}

characterSections.forEach((section) => {
  section.addEventListener('pointerenter', () => showCharacter(section));
  section.addEventListener('pointerleave', hideCharacter);
});

if ('IntersectionObserver' in window) {
  const sectionObserver = new IntersectionObserver((entries) => {
    if (window.matchMedia('(pointer: coarse)').matches) {
      const visibleSection = entries.find((entry) => entry.isIntersecting);
      if (visibleSection) showCharacter(visibleSection.target);
    }
  }, { threshold: 0.5 });
  characterSections.forEach((section) => sectionObserver.observe(section));
}

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