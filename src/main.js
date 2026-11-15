import {
  FilesetResolver,
  PoseLandmarker
} from '@mediapipe/tasks-vision';
import './style.css';

const container = document.querySelector('#eye-canvas');
const video = document.querySelector('#webcam');
const cameraButton = document.querySelector('#camera-button');
const terminalMessage = document.querySelector('#terminal-message');
const systemStatus = document.querySelector('#system-status');

let cameraStream = null;
let poseLandmarker = null;
let trackingActive = false;
let lastPosePosition = null;
let lastVideoTime = -1;

const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

container.innerHTML = '';
container.appendChild(canvas);

let width = 0;
let height = 0;
let columns = 0;
let rows = 0;
let cellWidth = 7;
let cellHeight = 13;

function resizeCanvas() {
  const rect = container.getBoundingClientRect();
  width = rect.width;
  height = rect.height;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  columns = Math.floor(width / cellWidth);
  rows = Math.floor(height / cellHeight);
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

let eyeOpenness = 0;
let targetOpenness = 0;
let targetLookX = 0;
let targetLookY = 0;
let smoothLookX = 0;
let smoothLookY = 0;
let lastMotionTime = 0;

const CLOSE_DELAY = 1600;
let currentState = 'DORMANT';

const characters = [
  ' ',
  '.',
  ':',
  ';',
  '!',
  '|',
  '/',
  '\\',
  'i',
  'l',
  'c',
  'o',
  'x',
  'z',
  'u',
  'n',
  'v',
  'k',
  'h',
  'm',
  'w',
  '0',
  'O',
  'X',
  '%',
  '#',
  '@'
];

function noise(x, y) {
  const value = Math.sin(
    x * 127.1 + y * 311.7
  ) * 43758.5453;
  return value - Math.floor(value);

}

function smoothNoise(x, y) {
  const a = noise(x, y);
  const b = noise(x + 1, y);
  const c = noise(x, y + 1);
  const d = noise(x + 1, y + 1);
  const fx = x - Math.floor(x);
  const fy = y - Math.floor(y);
  const top = THREELESS_LERP(a, b, fx);
  const bottom = THREELESS_LERP(c, d, fx);

  return THREELESS_LERP(top, bottom, fy);

}

function THREELESS_LERP(a, b, t) {
  return a + (b - a) * t;
}

const particles = [];
const PARTICLE_COUNT = 4000;

function initializeParticles() {
  particles.length = 0;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 0.42 + Math.random() * 0.72;

    particles.push({

      angle,
      radius,
      speed: 0.03 + Math.random() * 0.13,
      driftX: (Math.random() - 0.5) * 0.12,
      driftY: (Math.random() - 0.5) * 0.12,
      size: Math.random() * 1.5 + 0.3,
      brightness: 0.15 + Math.random() * 0.65,
      phase: Math.random() * Math.PI * 2,
      depth: Math.random()

    });

  }

}

initializeParticles();

function drawParticleCloud(time) {
  if (!trackingActive) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();

  const centerX = width / 2;
  const centerY = height / 2;
  const eyeWidth = Math.min(width * 0.92, 900);
  const eyeHeight = Math.min(height * 0.72, 370);
  const movementEnergy =
    lastMotionTime > 0 &&
    performance.now() - lastMotionTime < CLOSE_DELAY
      ? 1
      : 0.35;

  const openness = eyeOpenness;
  const cloudRotation = time * 0.035;

  for (const p of particles) {
    const angle =
      p.angle +
      cloudRotation * p.speed * 5;
    const floating =
      Math.sin(time * 0.7 + p.phase) * 0.035;
    const breathing =
      Math.sin(time * 0.35 + p.phase) * 0.025;
    const radius =
      p.radius + floating + breathing;
    const x =
      centerX +
      Math.cos(angle) * radius * eyeWidth * 0.58 +
      Math.sin(time * 0.4 + p.phase) * 9 +
      p.driftX * Math.sin(time + p.phase) * 12;
    const y =
      centerY +
      Math.sin(angle) * radius * eyeHeight * 0.75 +
      Math.cos(time * 0.5 + p.phase) * 9 +
      p.driftY * Math.cos(time + p.phase) * 12;
    const size =
      p.size * (0.8 + openness * 0.35);
    const flicker =
      0.65 + Math.sin(time * 2 + p.phase) * 0.25;
    const alpha =
      p.brightness *
      flicker *
      movementEnergy * 0.3;
    if (
      x < 0 || x > width ||
      y < 0 || y > height
    ) continue;

    ctx.beginPath();
    ctx.arc(
      x,
      y,
      size,
      0,
      Math.PI * 2
    );

    ctx.fillStyle =
      `rgba(235, 240, 245, ${alpha})`;

    ctx.fill();

    if (p.depth > 0.94) {
      ctx.beginPath();
      ctx.arc(
        x,
        y,
        size * 2.8,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        `rgba(220, 230, 240, ${alpha * 0.12})`;

      ctx.fill();

    }

  }

  ctx.restore();

}

function renderEye(time) {

  ctx.fillStyle = '#000000';
ctx.fillRect(0, 0, width, height);
drawParticleCloud(time);

  const openness = Math.max(0.015, eyeOpenness);
  const eyeWidth = Math.min(width * 0.88, 850);
const eyeHeight = Math.min(height * 0.83, 410);
  const centerX = width / 2;
  const centerY = height / 2;

  smoothLookX += (targetLookX - smoothLookX) * 0.09;
  smoothLookY += (targetLookY - smoothLookY) * 0.09;

  const irisX = centerX + smoothLookX * eyeWidth * 0.34;
  const irisY = centerY + smoothLookY * eyeHeight * 0.27;
  const irisRadius = eyeHeight * 0.34 * openness + 0.001;
  const pupilRadius = irisRadius * 0.42;

  if (openness < 0.025) {

    ctx.font = '11px monospace';

    for (let x = -eyeWidth * 0.44; x <= eyeWidth * 0.44; x += cellWidth) {

      const normalizedX = x / (eyeWidth * 0.44);
      const curve = Math.sqrt(
        Math.max(0, 1 - normalizedX * normalizedX)
      );

      const flicker = noise(x * 0.1, time * 0.1);
      const brightness = 0.15 + curve * 0.65;

      if (flicker > 0.25) {

        ctx.fillStyle = `rgba(220,220,220,${brightness})`;
        const char = flicker > 0.75 ? ':' : '.';

        ctx.fillText(
          char,
          centerX + x,
          centerY
        );

      }

    }

    return;

  }


  ctx.font = '11px monospace';

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const px = col * cellWidth + cellWidth / 2;
      const py = row * cellHeight + cellHeight / 2;
      const x = (px - centerX) / (eyeWidth * 0.5);
      const y = (py - centerY) / (eyeHeight * 0.5);

if (Math.abs(x) > 1) continue;

const eyeCurve = Math.pow(
  Math.max(0, Math.sin((x + 1) * Math.PI / 2)),
  0.72
);

const upperCurve = -eyeCurve * 0.78 * openness;
const lowerCurve = eyeCurve * 0.58 * openness;

if (y < upperCurve || y > lowerCurve) continue;

const eyeCenter = (upperCurve + lowerCurve) / 2;
const eyeRadius = Math.max(
  0.001,
  (lowerCurve - upperCurve) / 2
);

const localY = (y - eyeCenter) / eyeRadius;
      const distanceX = px - irisX;
      const distanceY = (py - irisY) * 1.08;
      const radius = Math.sqrt(
        distanceX * distanceX +
        distanceY * distanceY
      );

      const angle = Math.atan2(
        distanceY,
        distanceX
      );

      let brightness = 0;
      brightness = 0.48;
      brightness +=
        smoothNoise(col * 0.16, row * 0.2) * 0.12;
      brightness +=
        Math.sin(angle * 8 + time * 0.15) * 0.015;
      brightness *= 0.7 + eyeCurve * 0.3;

      if (radius < irisRadius) {

        const radialPosition = radius / irisRadius;
        const radialFibres =
          Math.sin(
            angle * 83 +
            radialPosition * 22 +
            Math.sin(angle * 13) * 3
          );

        const fineFibres =
          Math.sin(angle * 173 + radialPosition * 48);
        const irregularity =
          smoothNoise(
            col * 0.25,
            row * 0.25
          );

        const irisTexture =
          0.45 +
          radialFibres * 0.18 +
          fineFibres * 0.07 +
          irregularity * 0.18;
        brightness = 0.35 + irisTexture * 0.55;

        if (radialPosition > 0.88) {
          brightness *= 0.65;
        }

        if (
          radialPosition > 0.39 &&
          radialPosition < 0.46
        ) {
          brightness = 0.82;
        }

        const crypt =
          Math.sin(angle * 19 + radialPosition * 14);

        if (crypt > 0.86) {
          brightness *= 0.45;
        }

      }
      if (radius < pupilRadius) {
        brightness = 0.015;

      }
      if (
        radius > pupilRadius &&
        radius < pupilRadius * 1.09
      ) {
        brightness = 0.8;

      }
      const edgeDistance = Math.abs(localY);

      if (edgeDistance > 0.91) {

        brightness = 0.85 + noise(col, row) * 0.15;

      }
      brightness +=
        (noise(col * 0.8, row * 0.8) - 0.5) * 0.13;

      brightness +=
        Math.sin(time * 1.8 + col * 0.12) * 0.012;

      brightness = Math.max(
        0,
        Math.min(1, brightness)
      );

      const characterIndex = Math.floor(
        brightness * (characters.length - 1)
      );

      const character = characters[characterIndex];
      if (character === ' ') continue;

      const grey = Math.floor(
        95 + brightness * 160
      );

      ctx.fillStyle = `rgb(${grey},${grey},${grey})`;

      ctx.fillText(character, px, py);

    }

  }

}

function updateTerminal(state) {

  if (state === currentState) return;

  currentState = state;

  const messages = {

    DORMANT: {
      text: '> AWAITING MOVEMENT. SYSTEM DORMANT.',
      status: 'STANDBY'
    },

    OPENING: {
      text: '> MOVEMENT DETECTED.',
      status: 'ACTIVATING'
    },

    TRACKING: {
      text: '> SUBJECT DETECTED. MOVEMENT TRACKING ACTIVE.',
      status: 'TRACKING'
    },

    CLOSING: {
      text: '> SUBJECT INACTIVE. VISUAL SYSTEM ENTERING SLEEP MODE.',
      status: 'INACTIVE'
    }

  };

  terminalMessage.textContent = messages[state].text;
  systemStatus.textContent = messages[state].status;

}

async function initializeTracking() {

  try {

    cameraButton.textContent = 'INITIALIZING...';

    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
    );

    poseLandmarker = await PoseLandmarker.createFromOptions(
      vision,
      {
        baseOptions: {

          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',

          delegate: 'GPU'

        },

        runningMode: 'VIDEO',

        numPoses: 1,

        minPoseDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
        minPosePresenceConfidence: 0.5

      }
    );

    cameraStream = await navigator.mediaDevices.getUserMedia({

      video: {
        width: 640,
        height: 480,
        facingMode: 'user'
      },

      audio: false

    });

    video.srcObject = cameraStream;

    await video.play();

    trackingActive = true;
    lastPosePosition = null;
    lastVideoTime = -1;
    lastMotionTime = 0;

    cameraButton.textContent = 'DISABLE CAMERA';
    updateTerminal('DORMANT');
    cameraLoop();
  } catch (error) {
    console.error('Camera error:', error);
    cameraButton.textContent = 'ENABLE CAMERA';
    systemStatus.textContent = 'ERROR';
    terminalMessage.textContent =
      '> CAMERA INITIALIZATION FAILED. CHECK PERMISSIONS.';
  }

}

function cameraLoop() {

  if (!trackingActive) return;

  if (
    video.readyState >= 2 &&
    poseLandmarker &&
    video.currentTime !== lastVideoTime
  ) {
    lastVideoTime = video.currentTime;
    const results = poseLandmarker.detectForVideo(
      video,
      performance.now()
    );

    if (
      results.landmarks &&
      results.landmarks.length > 0
    ) {

      const landmarks = results.landmarks[0];
      const indices = [11, 12, 23, 24];
      const validPoints = indices
        .map(index => landmarks[index])
        .filter(
          point => point && point.visibility > 0.4
        );

      if (validPoints.length >= 2) {

        const x = validPoints.reduce(
          (sum, point) => sum + point.x,
          0
        ) / validPoints.length;

        const y = validPoints.reduce(
          (sum, point) => sum + point.y,
          0
        ) / validPoints.length;

        processBodyMovement(x, y);

      }

    }

  }

  requestAnimationFrame(cameraLoop);

}

function processBodyMovement(x, y) {

  if (!lastPosePosition) {

    lastPosePosition = { x, y };

    return;

  }

  const dx = x - lastPosePosition.x;
  const dy = y - lastPosePosition.y;
  const movement = Math.sqrt(
    dx * dx + dy * dy
  );

  const MOVEMENT_THRESHOLD = 0.008;

  if (movement > MOVEMENT_THRESHOLD) {

    lastMotionTime = performance.now();
    targetLookX = THREELESS_LERP(
      targetLookX,
      THREELESS_LERP(0, 1, 0.5 - x) * 1.8,
      1
    );

    targetLookY = THREELESS_LERP(
      0,
      0.5 - y,
      1
    ) * 1.2;

    targetLookX = Math.max(-0.65, Math.min(0.65, targetLookX));
    targetLookY = Math.max(-0.45, Math.min(0.45, targetLookY));

  }

  lastPosePosition = { x, y };

}

cameraButton.addEventListener('click', async () => {

  if (trackingActive) {
    trackingActive = false;
    if (cameraStream) {
      cameraStream.getTracks().forEach(
        track => track.stop()
      );

      cameraStream = null;

    }

    video.srcObject = null;
    if (poseLandmarker) {
      poseLandmarker.close();
      poseLandmarker = null;

    }

    targetOpenness = 0;
    targetLookX = 0;
    targetLookY = 0;
    lastPosePosition = null;
    lastMotionTime = 0;

    cameraButton.textContent = 'ENABLE CAMERA';
    updateTerminal('DORMANT');

  } else {

    await initializeTracking();

  }

});

function animate() {

  requestAnimationFrame(animate);
  const now = performance.now();
  const moving =
    trackingActive &&
    lastMotionTime > 0 &&
    now - lastMotionTime < CLOSE_DELAY;

  if (moving) {

    targetOpenness = 1;
    if (eyeOpenness < 0.95) {
      updateTerminal('OPENING');
    } else {
      updateTerminal('TRACKING');
    }

  } else {

    targetOpenness = 0;
    if (eyeOpenness > 0.05) {
      updateTerminal('CLOSING');
    } else {
      updateTerminal('DORMANT');
    }

  }

  eyeOpenness +=
    (targetOpenness - eyeOpenness) * 0.045;
  renderEye(now * 0.001);
}

animate();

window.addEventListener('beforeunload', () => {
  if (cameraStream) {
    cameraStream.getTracks().forEach(
      track => track.stop()
    );
  }
  if (poseLandmarker) {
    poseLandmarker.close();
  }
});
