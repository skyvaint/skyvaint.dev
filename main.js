const canvas = document.getElementById('GradientCanvas');
const context = canvas ? canvas.getContext('2d') : null;
// Scripting page backdrop: static vector canvas + rotating Goku Black character art.
// motionReduced comes from common.js.
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

const characterBackdrop = document.getElementById('section-character');
const characterLayers = characterBackdrop ? [...characterBackdrop.querySelectorAll('.character-layer')] : [];
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
