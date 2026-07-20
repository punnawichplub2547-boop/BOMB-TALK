import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// DOM elements
const lobbyScreen = document.getElementById('lobby-screen');
const gameplayScreen = document.getElementById('gameplay-screen');
const nameStep = document.getElementById('name-selection-step');
const roomStep = document.getElementById('room-lobby-step');
const usernameInput = document.getElementById('username');
const roomCodeInput = document.getElementById('room-code-input');
const codeText = document.getElementById('code-text');
const playersList = document.getElementById('players-list');
const btnCreateRoom = document.getElementById('btn-create-room');
const btnJoinRoom = document.getElementById('btn-join-room');
const btnStartGame = document.getElementById('btn-start-game');
const btnQuitGame = document.getElementById('btn-quit-game');
const ledTimer = document.getElementById('led-timer');
const strike1 = document.getElementById('strike-1');
const strike2 = document.getElementById('strike-2');
const metaSerial = document.getElementById('meta-serial');
const metaBatteries = document.getElementById('meta-batteries');
const canvasContainer = document.getElementById('canvas-container');
const defuserLayout = document.getElementById('defuser-layout');
const expertLayout = document.getElementById('expert-layout');
const expertTimer = document.getElementById('expert-timer');
const expStrike1 = document.getElementById('exp-strike-1');
const expStrike2 = document.getElementById('exp-strike-2');

// Modals
const gameOverModal = document.getElementById('game-over-modal');
const gameOverReason = document.getElementById('game-over-reason');
const gameDefusedModal = document.getElementById('game-defused-modal');
const defusedTimeLeft = document.getElementById('defused-time-left');
const btnRestarts = document.querySelectorAll('.btn-restart');
console.log('Debug: Found restart buttons in DOM:', btnRestarts.length);

// Sounds
// Web Audio Context setup for zero-latency offline sound synthesis fallback
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playSynthSound(type) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (type === 'tick') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.03);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.03);
    } else if (type === 'click') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.05);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'strike') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.setValueAtTime(110, now + 0.1);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'explosion') {
      const bufferSize = ctx.sampleRate * 0.8;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(300, now);
      filter.frequency.linearRampToValueAtTime(40, now + 0.8);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      whiteNoise.start(now);
    } else if (type === 'defused') {
      const freqs = [523.25, 659.25, 783.99, 1046.50];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const noteTime = now + idx * 0.08;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, noteTime);
        gain.gain.setValueAtTime(0.2, noteTime);
        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(noteTime);
        osc.stop(noteTime + 0.25);
      });
    }
  } catch (e) {
    console.warn('Synth sound fallback failed:', e);
  }
}

function playSound(audio, synthType) {
  if (audio) {
    audio.currentTime = 0;
    const promise = audio.play();
    if (promise !== undefined) {
      promise.catch(() => {
        playSynthSound(synthType);
      });
    }
  } else {
    playSynthSound(synthType);
  }
}

// Socket.io initialization
const socket = io();

let myId = '';
let currentRole = 'expert';
let roomPlayers = [];
let localRoomCode = '';

// Three.js variables
let scene, camera, renderer, controls;
let bombGroup;
let interactiveObjects = []; // raycast targets
let activeInteractiveObject = null;
let buttonPressStartTime = 0;

// Materials (global to change colors easily)
let ledStripMaterial;
const moduleStatusLights = []; // array of { mesh, type, index } to light up green on solve

// ----------------------------------------------------
// LOBBY / ROOM NAVIGATION
// ----------------------------------------------------

btnCreateRoom.addEventListener('click', () => {
  const name = usernameInput.value.trim() || 'OPERATOR_A';
  socket.emit('create-room', name);
});

btnJoinRoom.addEventListener('click', () => {
  const code = roomCodeInput.value.trim().toUpperCase();
  const name = usernameInput.value.trim() || 'OPERATOR_B';
  if (code.length === 4) {
    socket.emit('join-room', { code, name });
  } else {
    alert('Please enter a valid 4-character Room Code.');
  }
});

function updateLobbyUI(code, players) {
  codeText.textContent = code;
  playersList.innerHTML = '';
  
  roomPlayers = players;

  // Render player list
  players.forEach(p => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${p.name} ${p.id === socket.id ? '<strong>(You)</strong>' : ''}</span>
      <span class="player-role ${p.role === 'defuser' ? 'role-defuser' : 'role-expert'}">${p.role}</span>
    `;
    playersList.appendChild(li);
  });

  // Enable/Disable Start Game button: needs 1 defuser and 1 expert
  const hasDefuser = players.some(p => p.role === 'defuser');
  const hasExpert = players.some(p => p.role === 'expert');

  if (hasDefuser && hasExpert) {
    btnStartGame.classList.remove('disabled');
    btnStartGame.removeAttribute('disabled');
  } else {
    btnStartGame.classList.add('disabled');
    btnStartGame.setAttribute('disabled', 'true');
  }
}

window.selectRole = function(role) {
  socket.emit('select-role', role);
};

btnStartGame.addEventListener('click', () => {
  socket.emit('start-game');
});

btnQuitGame.addEventListener('click', () => {
  if (confirm('Are you sure you want to abort the mission?')) {
    window.location.reload();
  }
});

btnRestarts.forEach((btn, idx) => {
  btn.addEventListener('click', () => {
    console.log(`Debug: Return to Lobby button #${idx} clicked! Emitting restart-game...`);
    socket.emit('restart-game');
  });
});

// Socket Events
socket.on('room-created', ({ code, players }) => {
  localRoomCode = code;
  myId = socket.id;
  currentRole = 'expert'; // creator defaults to expert
  nameStep.classList.remove('active');
  roomStep.classList.add('active');
  updateLobbyUI(code, players);
});

socket.on('joined-successfully', ({ code, players, yourId }) => {
  localRoomCode = code;
  myId = yourId;
  
  const me = players.find(p => p.id === yourId);
  currentRole = me ? me.role : 'expert';

  nameStep.classList.remove('active');
  roomStep.classList.add('active');
  updateLobbyUI(code, players);
});

socket.on('room-updated', ({ code, players }) => {
  const me = players.find(p => p.id === socket.id);
  if (me) {
    currentRole = me.role;
    // Visually toggle role card selection in UI
    document.getElementById('role-defuser').classList.toggle('active', currentRole === 'defuser');
    document.getElementById('role-expert').classList.toggle('active', currentRole === 'expert');
  }
  updateLobbyUI(code, players);
});

socket.on('error-msg', (msg) => {
  alert(msg);
});

// ----------------------------------------------------
// GAME STATE SYNC
// ----------------------------------------------------

let currentSimonSequence = [];

socket.on('game-started', ({ bombConfig, timer }) => {
  lobbyScreen.classList.remove('active');
  gameplayScreen.classList.add('active');

  // Activate correct layout
  if (currentRole === 'defuser') {
    defuserLayout.classList.add('active');
    expertLayout.classList.remove('active');
    
    // Set metadata on screen
    metaSerial.textContent = bombConfig.serialNumber;
    metaBatteries.textContent = bombConfig.batteries;

    // Reset HUD
    ledTimer.textContent = formatTime(timer.timeLeft);
    strike1.classList.remove('active');
    strike2.classList.remove('active');

    // Store simon sequence
    const simonMod = bombConfig.modules.find(m => m.type === 'simon');
    if (simonMod) {
      currentSimonSequence = simonMod.sequence;
    }

    // Build 3D bomb
    initThreeJS();
    build3DBomb(bombConfig);

    // Initial stage 1 flash for Simon Says
    if (simonMod) {
      setTimeout(() => {
        triggerSimonFlash(currentSimonSequence, 1);
      }, 1000);
    }
  } else {
    expertLayout.classList.add('active');
    defuserLayout.classList.remove('active');
    
    expertTimer.textContent = formatTime(timer.timeLeft);
    expStrike1.classList.remove('active');
    expStrike2.classList.remove('active');
  }
});

socket.on('timer-update', ({ timeLeft, strikes }) => {
  const formatted = formatTime(timeLeft);
  if (currentRole === 'defuser') {
    ledTimer.textContent = formatted;
  } else {
    expertTimer.textContent = formatted;
  }
  
  // Tick sound
  playSound(sndTick, 'tick');
});

socket.on('strike', ({ strikes }) => {
  playSound(sndStrike, 'strike');
  updateStrikesDisplay(strikes);
  if (camera) {
    spawnSparkBurst(new THREE.Vector3(0, 0, 1.2), 30);
  }
});

function updateStrikesDisplay(strikes) {
  if (currentRole === 'defuser') {
    if (strikes >= 1) strike1.classList.add('active');
    if (strikes >= 2) strike2.classList.add('active');
  } else {
    if (strikes >= 1) expStrike1.classList.add('active');
    if (strikes >= 2) expStrike2.classList.add('active');
  }
}

socket.on('module-solved', ({ type }) => {
  // Turn status indicator light green
  const indicator = moduleStatusLights.find(l => l.type === type);
  if (indicator) {
    indicator.mesh.material.color.setHex(0x10b981); // green
    indicator.mesh.material.emissive.setHex(0x10b981);
  }
  playSound(sndClick, 'click');
});

socket.on('simon-stage-advance', ({ stage }) => {
  playSound(sndClick, 'click');
  setTimeout(() => {
    triggerSimonFlash(currentSimonSequence, stage);
  }, 400);
});

socket.on('simon-reset', ({ stage }) => {
  playSound(sndStrike, 'strike');
  setTimeout(() => {
    triggerSimonFlash(currentSimonSequence, stage);
  }, 600);
});

socket.on('game-defused', ({ timeLeft }) => {
  playSound(sndDefused, 'defused');
  defusedTimeLeft.textContent = formatTime(timeLeft);
  gameDefusedModal.classList.add('active');
});

socket.on('game-over', ({ reason, strikes }) => {
  playSound(sndExplosion, 'explosion');
  updateStrikesDisplay(strikes);
  
  if (reason === 'timeout') {
    gameOverReason.textContent = "The bomb exploded because time ran out.";
  } else {
    gameOverReason.textContent = "The bomb exploded because you accumulated 3 strikes.";
  }
  
  gameOverModal.classList.add('active');
});

socket.on('returned-to-lobby', ({ players }) => {
  gameOverModal.classList.remove('active');
  gameDefusedModal.classList.remove('active');
  
  gameplayScreen.classList.remove('active');
  lobbyScreen.classList.add('active');
  
  clearThreeJS();
  updateLobbyUI(localRoomCode, players);
});

// Helper: Format seconds to MM:SS
function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ----------------------------------------------------
// THREE.JS 3D ENGINE
// ----------------------------------------------------

function initThreeJS() {
  clearThreeJS(); // cleanup safety

  const width = canvasContainer.clientWidth;
  const height = canvasContainer.clientHeight;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f1115);
  scene.fog = new THREE.FogExp2(0x0f1115, 0.08);

  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 50);
  camera.position.set(0, 0, 8); // look straight at the front of the bomb

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  canvasContainer.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 3.5;
  controls.maxDistance = 8.5;
  controls.minPolarAngle = Math.PI / 6; // prevent flipping top
  controls.maxPolarAngle = Math.PI / 1.75; // prevent going under table
  controls.enablePan = false; // Don't let user pan away from bomb

  // Ambient Lighting (increased for visibility)
  const ambient = new THREE.AmbientLight(0xffffff, 0.35);
  scene.add(ambient);

  // SpotLight hanging above the bomb (the central light source)
  const spotlight = new THREE.SpotLight(0xfff5e6, 6.0);
  spotlight.position.set(0, 8, 4);
  spotlight.angle = Math.PI / 4;
  spotlight.penumbra = 0.8;
  spotlight.castShadow = true;
  spotlight.shadow.mapSize.width = 1024;
  spotlight.shadow.mapSize.height = 1024;
  scene.add(spotlight);

  // Fill light (increased to illuminate details)
  const fillLight = new THREE.DirectionalLight(0xa0b0c0, 0.65);
  fillLight.position.set(-5, -3, 4);
  scene.add(fillLight);

  // Red alert flickering light (adds extreme immersion!)
  const alarmLight = new THREE.PointLight(0xff0000, 0.0, 10);
  alarmLight.position.set(0, 3, 3);
  scene.add(alarmLight);
  scene.userData.alarmLight = alarmLight;

  window.addEventListener('resize', onWindowResize);
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointerup', onPointerUp);
  renderer.domElement.addEventListener('pointermove', onPointerMove);

  animate();
}

function clearThreeJS() {
  if (renderer) {
    renderer.domElement.removeEventListener('pointerdown', onPointerDown);
    renderer.domElement.removeEventListener('pointerup', onPointerUp);
    renderer.domElement.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('resize', onWindowResize);
    controls.dispose();
    renderer.dispose();
    canvasContainer.innerHTML = '';
  }
  scene = null;
  camera = null;
  renderer = null;
  controls = null;
  bombGroup = null;
  interactiveObjects = [];
  moduleStatusLights.length = 0;
}

function onWindowResize() {
  if (!camera || !renderer) return;
  const width = canvasContainer.clientWidth;
  const height = canvasContainer.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

// ----------------------------------------------------
// PROCEDURAL 3D BOMB ASSEMBLY
// ----------------------------------------------------

function createHazardStripeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#eab308'; // bright yellow
  ctx.fillRect(0, 0, 128, 128);

  ctx.fillStyle = '#18181b'; // dark black
  for (let i = -128; i < 256; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 16, 0);
    ctx.lineTo(i - 16, 128);
    ctx.lineTo(i - 32, 128);
    ctx.closePath();
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 1);
  return texture;
}

// Spark Particle System
let sparkParticles = [];
let sparkGroup = null;

function initSparkSystem() {
  sparkParticles = [];
  if (sparkGroup && scene) {
    scene.remove(sparkGroup);
  }
  sparkGroup = new THREE.Group();
  if (scene) scene.add(sparkGroup);
}

function spawnSparkBurst(positionVec3, count = 25) {
  if (!scene || !sparkGroup) return;
  
  for (let i = 0; i < count; i++) {
    const geom = new THREE.SphereGeometry(0.025, 4, 4);
    const mat = new THREE.MeshBasicMaterial({
      color: Math.random() > 0.3 ? 0xffaa00 : 0xff3300
    });
    const p = new THREE.Mesh(geom, mat);
    p.position.copy(positionVec3);
    
    const velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 3.0,
      (Math.random() - 0.2) * 3.0 + 1.2,
      (Math.random() - 0.5) * 3.0
    );
    
    sparkGroup.add(p);
    sparkParticles.push({
      mesh: p,
      velocity,
      life: 1.0,
      decay: 0.03 + Math.random() * 0.03
    });
  }
}

function updateSparkSystem() {
  for (let i = sparkParticles.length - 1; i >= 0; i--) {
    const p = sparkParticles[i];
    p.mesh.position.addScaledVector(p.velocity, 0.016);
    p.velocity.y -= 0.08; // gravity
    p.life -= p.decay;
    p.mesh.scale.setScalar(Math.max(0.01, p.life));
    
    if (p.life <= 0) {
      if (sparkGroup) sparkGroup.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      sparkParticles.splice(i, 1);
    }
  }
}

function createGlyphTexture(symbol) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  
  // Button backing style
  ctx.fillStyle = '#232730';
  ctx.fillRect(0, 0, 128, 128);
  
  // Border
  ctx.strokeStyle = '#4b5563';
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, 120, 120);

  // Symbol
  ctx.fillStyle = '#f3f4f6';
  ctx.font = '68px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(symbol, 64, 64);
  
  return new THREE.CanvasTexture(canvas);
}

function createTextTexture(text, bgColor, textColor, fontSize = 28) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, 256, 128);
  
  ctx.fillStyle = textColor;
  ctx.font = `bold ${fontSize}px Courier New`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 64);
  
  return new THREE.CanvasTexture(canvas);
}

function build3DBomb(bombConfig) {
  bombGroup = new THREE.Group();
  initSparkSystem();

  // 1. Briefcase Chassis (metallic industrial texture with chamfered bevels)
  const chassisGeom = new THREE.BoxGeometry(5.4, 3.6, 1.4);
  const chassisMat = new THREE.MeshStandardMaterial({
    color: 0x333842,
    roughness: 0.4,
    metalness: 0.85
  });
  const chassis = new THREE.Mesh(chassisGeom, chassisMat);
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  bombGroup.add(chassis);

  // Hazard warning tape on top & bottom chassis edges
  const hazardTex = createHazardStripeTexture();
  const hazardMat = new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.5 });
  
  const topHazard = new THREE.Mesh(new THREE.PlaneGeometry(5.38, 0.18), hazardMat);
  topHazard.position.set(0, 1.71, 0.71);
  const bottomHazard = new THREE.Mesh(new THREE.PlaneGeometry(5.38, 0.18), hazardMat);
  bottomHazard.position.set(0, -1.71, 0.71);
  bombGroup.add(topHazard, bottomHazard);

  // Latches & Metal corner pads with rivets
  const cornerMat = new THREE.MeshStandardMaterial({ color: 0x71717a, metalness: 0.95, roughness: 0.15 });
  const rivetGeom = new THREE.CylinderGeometry(0.03, 0.03, 0.04, 12);
  const rivetMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.9 });

  const cornerPositions = [
    [-2.7, 1.8, 0], [2.7, 1.8, 0], [-2.7, -1.8, 0], [2.7, -1.8, 0]
  ];
  cornerPositions.forEach(([x, y, z]) => {
    const corner = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.45, 1.42), cornerMat);
    corner.position.set(x, y, z);
    bombGroup.add(corner);

    // Corner rivet
    const rivet = new THREE.Mesh(rivetGeom, rivetMat);
    rivet.rotation.x = Math.PI / 2;
    rivet.position.set(x > 0 ? x - 0.2 : x + 0.2, y > 0 ? y - 0.2 : y + 0.2, 0.72);
    bombGroup.add(rivet);
  });

  // Handle on top
  const handleGeom = new THREE.BoxGeometry(1.8, 0.16, 0.16);
  const handle = new THREE.Mesh(handleGeom, cornerMat);
  handle.position.set(0, 1.9, 0);
  bombGroup.add(handle);

  // 2. Serial Number Stamp on Top Side
  const serialLabelGeom = new THREE.PlaneGeometry(1.4, 0.38);
  const serialTex = createTextTexture(bombConfig.serialNumber, '#d4c5a9', '#111827', 32);
  const serialMat = new THREE.MeshStandardMaterial({ map: serialTex });
  const serialMesh = new THREE.Mesh(serialLabelGeom, serialMat);
  serialMesh.position.set(-1.2, 1.81, 0);
  serialMesh.rotation.x = -Math.PI / 2;
  bombGroup.add(serialMesh);

  // 3. Batteries Compartment on Bottom Side
  const batteryBase = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 0.4), chassisMat);
  batteryBase.position.set(1.2, -1.81, 0);
  batteryBase.rotation.x = Math.PI / 2;
  bombGroup.add(batteryBase);

  for (let i = 0; i < bombConfig.batteries; i++) {
    const battGeom = new THREE.CylinderGeometry(0.065, 0.065, 0.32);
    const battMat = new THREE.MeshStandardMaterial({ color: 0xb45309, metalness: 0.85 });
    const batt = new THREE.Mesh(battGeom, battMat);
    batt.position.set(0.95 + (i * 0.16), -1.85, 0);
    batt.rotation.z = Math.PI / 2;
    bombGroup.add(batt);
  }

  // 4. Side Indicators (CAR, FRK, SND, CLR)
  if (bombConfig.indicators && bombConfig.indicators.length > 0) {
    const indGroup = new THREE.Group();
    indGroup.position.set(-2.71, 0.2, 0);
    indGroup.rotation.y = -Math.PI / 2;

    bombConfig.indicators.forEach((ind, idx) => {
      const indY = -idx * 0.45;
      
      // Label plate
      const labelTex = createTextTexture(ind.label, '#1f2937', '#f9fafb', 24);
      const labelMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.7, 0.3),
        new THREE.MeshStandardMaterial({ map: labelTex })
      );
      labelMesh.position.set(0, indY, 0);

      // Light LED
      const ledGeom = new THREE.CylinderGeometry(0.05, 0.05, 0.04);
      const ledMat = new THREE.MeshStandardMaterial({
        color: ind.lit ? 0x10b981 : 0x450a0a,
        emissive: ind.lit ? 0x10b981 : 0x000000
      });
      const ledMesh = new THREE.Mesh(ledGeom, ledMat);
      ledMesh.rotation.x = Math.PI / 2;
      ledMesh.position.set(0.48, indY, 0.01);

      indGroup.add(labelMesh, ledMesh);
    });

    bombGroup.add(indGroup);
  }

  // 5. Recessed Module Bays & Modules (2x2 Grid)
  const moduleSlotPositions = [
    [-1.3, 0.75], [1.3, 0.75],
    [-1.3, -0.75], [1.3, -0.75]
  ];

  moduleSlotPositions.forEach(([slotX, slotY]) => {
    // Recessed Frame
    const frameGeom = new THREE.BoxGeometry(2.24, 1.48, 0.04);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.8, roughness: 0.3 });
    const frame = new THREE.Mesh(frameGeom, frameMat);
    frame.position.set(slotX, slotY, 0.69);
    bombGroup.add(frame);

    // 4 Corner Rivets per bay
    const bayRivets = [
      [slotX - 1.05, slotY + 0.68], [slotX + 1.05, slotY + 0.68],
      [slotX - 1.05, slotY - 0.68], [slotX + 1.05, slotY - 0.68]
    ];
    bayRivets.forEach(([rx, ry]) => {
      const r = new THREE.Mesh(rivetGeom, rivetMat);
      r.rotation.x = Math.PI / 2;
      r.position.set(rx, ry, 0.71);
      bombGroup.add(r);
    });
  });

  bombConfig.modules.forEach((mod) => {
    if (mod.type === 'wires') {
      assembleWiresModule(mod);
    } else if (mod.type === 'button') {
      assembleButtonModule(mod);
    } else if (mod.type === 'keypad') {
      assembleKeypadModule(mod);
    } else if (mod.type === 'simon') {
      assembleSimonModule(mod);
    }
  });

  scene.add(bombGroup);
}

// ----------------------------------------------------
// MODULE MODULE ASSEMBLY
// ----------------------------------------------------

// Wire color hex map
const COLOR_HEX_MAP = {
  red: 0xef4444,
  blue: 0x3b82f6,
  yellow: 0xeab308,
  white: 0xfafafa,
  black: 0x18181b
};

// Module status LED helper
function addStatusLED(parent, x, y, type) {
  const ledGeom = new THREE.BoxGeometry(0.12, 0.12, 0.05);
  const ledMat = new THREE.MeshStandardMaterial({
    color: 0x3f0a0a, // dark red unlit
    emissive: 0x1e0303,
    roughness: 0.1
  });
  const led = new THREE.Mesh(ledGeom, ledMat);
  led.position.set(x, y, 0.03);
  parent.add(led);
  moduleStatusLights.push({ mesh: led, type });
}

// WIRES MODULE
function assembleWiresModule(mod) {
  const group = new THREE.Group();
  group.position.set(-1.3, 0.75, 0.7);

  // Background module plate
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 1.35, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.8 })
  );
  group.add(plate);

  addStatusLED(group, 0.85, 0.5, 'wires');

  // Draw wire rails
  const railGeom = new THREE.BoxGeometry(0.15, 1.0, 0.08);
  const railMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.6 });
  const leftRail = new THREE.Mesh(railGeom, railMat);
  leftRail.position.set(-0.75, 0, 0.04);
  const rightRail = new THREE.Mesh(railGeom, railMat);
  rightRail.position.set(0.75, 0, 0.04);
  group.add(leftRail, rightRail);

  const totalWires = mod.colors.length;
  const startY = 0.35;
  const gap = 0.7 / (totalWires - 1 || 1);

  mod.colors.forEach((colorName, idx) => {
    const wireY = startY - (idx * gap);
    
    const wireGroup = new THREE.Group();
    wireGroup.position.set(0, wireY, 0.08);
    wireGroup.userData = { isWire: true, wireIndex: idx, cut: false };

    // Curved 3D wire tube geometry (sags realistically)
    const sagY = (idx % 2 === 0) ? -0.06 : -0.12;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.75, 0, 0),
      new THREE.Vector3(0, sagY, 0.08),
      new THREE.Vector3(0.75, 0, 0)
    ]);
    const wireGeom = new THREE.TubeGeometry(curve, 20, 0.035, 8, false);
    const wireMat = new THREE.MeshStandardMaterial({
      color: COLOR_HEX_MAP[colorName],
      roughness: 0.4,
      metalness: 0.2
    });
    const wireCylinder = new THREE.Mesh(wireGeom, wireMat);
    wireCylinder.name = "wire_uncut";
    wireGroup.add(wireCylinder);

    const segmentGeom = new THREE.CylinderGeometry(0.035, 0.035, 0.7);
    
    const leftSegment = new THREE.Mesh(segmentGeom, wireMat);
    leftSegment.rotation.z = Math.PI / 2;
    leftSegment.position.set(-0.35, 0, 0);
    leftSegment.rotation.y = 0.25;
    leftSegment.name = "wire_cut_left";
    leftSegment.visible = false;

    const rightSegment = new THREE.Mesh(segmentGeom, wireMat);
    rightSegment.rotation.z = Math.PI / 2;
    rightSegment.position.set(0.35, 0, 0);
    rightSegment.rotation.y = -0.25;
    rightSegment.name = "wire_cut_right";
    rightSegment.visible = false;

    wireGroup.add(leftSegment, rightSegment);

    interactiveObjects.push(wireCylinder);
    wireCylinder.userData = { parentGroup: wireGroup, wireIndex: idx };

    group.add(wireGroup);
  });

  bombGroup.add(group);
}

// BUTTON MODULE
function assembleButtonModule(mod) {
  const group = new THREE.Group();
  group.position.set(1.3, 0.75, 0.7);

  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 1.35, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.8 })
  );
  group.add(plate);

  addStatusLED(group, 0.85, 0.5, 'button');

  const buttonGroup = new THREE.Group();
  buttonGroup.position.set(-0.25, 0, 0.03);
  buttonGroup.userData = { isButton: true };

  const baseGeom = new THREE.CylinderGeometry(0.42, 0.42, 0.08, 32);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x52525b, metalness: 0.8 });
  const base = new THREE.Mesh(baseGeom, baseMat);
  base.rotation.x = Math.PI / 2;
  buttonGroup.add(base);

  const innerGeom = new THREE.CylinderGeometry(0.36, 0.36, 0.12, 32);
  const btnTex = createTextTexture(mod.text, COLOR_HEX_MAP[mod.color] || 0xffffff, '#ffffff', 32);
  const innerMat = new THREE.MeshStandardMaterial({
    color: COLOR_HEX_MAP[mod.color],
    roughness: 0.4,
    map: btnTex
  });
  
  innerMat.map.center.set(0.5, 0.5);
  innerMat.map.rotation = Math.PI / 2;

  const innerButton = new THREE.Mesh(innerGeom, innerMat);
  innerButton.rotation.x = Math.PI / 2;
  innerButton.position.z = 0.06;
  innerButton.name = "the_button_mesh";
  buttonGroup.add(innerButton);

  interactiveObjects.push(innerButton);
  innerButton.userData = { isButtonFace: true, parentGroup: buttonGroup };

  const stripGeom = new THREE.BoxGeometry(0.12, 0.8, 0.04);
  ledStripMaterial = new THREE.MeshStandardMaterial({
    color: 0x1c1917,
    roughness: 0.2
  });
  const ledStrip = new THREE.Mesh(stripGeom, ledStripMaterial);
  ledStrip.position.set(0.65, 0, 0.03);
  group.add(ledStrip);

  group.add(buttonGroup);
  bombGroup.add(group);
}

// KEYPAD MODULE
function assembleKeypadModule(mod) {
  const group = new THREE.Group();
  group.position.set(-1.3, -0.75, 0.7);

  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 1.35, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.8 })
  );
  group.add(plate);

  addStatusLED(group, 0.85, 0.5, 'keypad');

  const buttonGrid = [
    [-0.45, 0.22], [0.2, 0.22],
    [-0.45, -0.28], [0.2, -0.28]
  ];

  mod.symbols.forEach((symbol, idx) => {
    const [x, y] = buttonGrid[idx];
    
    const keyGroup = new THREE.Group();
    keyGroup.position.set(x, y, 0.04);
    keyGroup.userData = { isKeypadKey: true, symbol };

    const bodyGeom = new THREE.BoxGeometry(0.55, 0.42, 0.08);
    const keyTex = createGlyphTexture(symbol);
    const keyMat = new THREE.MeshStandardMaterial({
      map: keyTex,
      roughness: 0.4
    });
    const keyMesh = new THREE.Mesh(bodyGeom, keyMat);
    keyMesh.name = `keypad_key_${idx}`;
    keyGroup.add(keyMesh);

    const indicatorGeom = new THREE.BoxGeometry(0.12, 0.04, 0.02);
    const indicatorMat = new THREE.MeshStandardMaterial({ color: 0x111827 });
    const indicator = new THREE.Mesh(indicatorGeom, indicatorMat);
    indicator.position.set(0, 0.24, 0.05);
    keyGroup.add(indicator);

    keyGroup.userData.indicator = indicator;

    interactiveObjects.push(keyMesh);
    keyMesh.userData = { isKeypadFace: true, parentGroup: keyGroup, symbol };

    group.add(keyGroup);
  });

  bombGroup.add(group);
}

// SIMON SAYS MODULE
let simonButtons = [];

function triggerSimonFlash(sequence, stage) {
  let delay = 0;
  for (let i = 0; i < stage; i++) {
    const color = sequence[i];
    setTimeout(() => {
      flashSimonButton(color, 350);
    }, delay);
    delay += 550;
  }
}

function flashSimonButton(colorName, durationMs = 350) {
  const btnObj = simonButtons.find(b => b.color === colorName);
  if (!btnObj) return;

  btnObj.mesh.material.emissive.setHex(btnObj.flashHex);
  btnObj.mesh.material.color.setHex(btnObj.flashHex);
  playSound(sndClick, 'click');

  setTimeout(() => {
    btnObj.mesh.material.emissive.setHex(0x000000);
    btnObj.mesh.material.color.setHex(btnObj.defaultHex);
  }, durationMs);
}

function assembleSimonModule(mod) {
  simonButtons = [];
  const group = new THREE.Group();
  group.position.set(1.3, -0.75, 0.7);

  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 1.35, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.8 })
  );
  group.add(plate);

  addStatusLED(group, 0.85, 0.5, 'simon');

  const buttonConfigs = [
    { color: 'red', x: -0.45, y: 0.22, defaultHex: 0x991b1b, flashHex: 0xef4444 },
    { color: 'blue', x: 0.2, y: 0.22, defaultHex: 0x1e40af, flashHex: 0x3b82f6 },
    { color: 'green', x: -0.45, y: -0.28, defaultHex: 0x166534, flashHex: 0x22c55e },
    { color: 'yellow', x: 0.2, y: -0.28, defaultHex: 0x854d0e, flashHex: 0xeab308 }
  ];

  buttonConfigs.forEach(cfg => {
    const keyGroup = new THREE.Group();
    keyGroup.position.set(cfg.x, cfg.y, 0.04);

    const bodyGeom = new THREE.BoxGeometry(0.55, 0.42, 0.08);
    const keyMat = new THREE.MeshStandardMaterial({
      color: cfg.defaultHex,
      emissive: 0x000000,
      roughness: 0.3
    });
    const keyMesh = new THREE.Mesh(bodyGeom, keyMat);
    keyGroup.add(keyMesh);

    interactiveObjects.push(keyMesh);
    keyMesh.userData = { isSimonFace: true, color: cfg.color };

    simonButtons.push({
      mesh: keyMesh,
      color: cfg.color,
      defaultHex: cfg.defaultHex,
      flashHex: cfg.flashHex
    });

    group.add(keyGroup);
  });

  bombGroup.add(group);
}

// ----------------------------------------------------
// RAYCASTING & INTERACTION LOGIC
// ----------------------------------------------------

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function getCanvasPointer(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
}

function onPointerDown(e) {
  if (currentRole !== 'defuser') return;
  getCanvasPointer(e);

  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObjects(interactiveObjects);

  if (intersects.length > 0) {
    const hitObject = intersects[0].object;
    
    // Disable orbit controls while interacting to prevent spinning the bomb case
    controls.enabled = false;

    // 1. Wires click
    if (hitObject.userData.parentGroup && hitObject.userData.parentGroup.userData.isWire) {
      const wireGroup = hitObject.userData.parentGroup;
      if (!wireGroup.userData.cut) {
        wireGroup.userData.cut = true;
        
        // Hide uncut wire mesh, show cut segments
        const uncut = wireGroup.getObjectByName("wire_uncut");
        const cutLeft = wireGroup.getObjectByName("wire_cut_left");
        const cutRight = wireGroup.getObjectByName("wire_cut_right");
        
        if (uncut) uncut.visible = false;
        if (cutLeft) cutLeft.visible = true;
        if (cutRight) cutRight.visible = true;

        socket.emit('cut-wire', wireGroup.userData.wireIndex);
      }
    }
    
    // 2. The Button click/hold
    else if (hitObject.userData.isButtonFace) {
      activeInteractiveObject = hitObject;
      buttonPressStartTime = Date.now();

      // Press down animation
      const innerMesh = hitObject;
      innerMesh.position.z = 0.02; // pressed in

      socket.emit('button-action', { type: 'down' });
    }

    // 3. Keypad click
    else if (hitObject.userData.isKeypadFace) {
      activeInteractiveObject = hitObject;
      const keyMesh = hitObject;
      
      // Press down anim
      keyMesh.position.z = -0.02;
      setTimeout(() => {
        keyMesh.position.z = 0; // return
      }, 100);

      socket.emit('press-keypad', hitObject.userData.symbol);
    }

    // 4. Simon Says click
    else if (hitObject.userData.isSimonFace) {
      activeInteractiveObject = hitObject;
      const color = hitObject.userData.color;
      flashSimonButton(color, 250);
      socket.emit('press-simon', color);
    }
  }
}

// Receive the strip color from server when held down
socket.on('button-strip-color', ({ stripColor }) => {
  if (ledStripMaterial) {
    ledStripMaterial.color.setHex(COLOR_HEX_MAP[stripColor] || 0xffffff);
    ledStripMaterial.emissive.setHex(COLOR_HEX_MAP[stripColor] || 0xffffff);
  }
});

function onPointerUp(e) {
  controls.enabled = true; // Restore orbit rotation

  if (activeInteractiveObject) {
    // If it was the Big Button
    if (activeInteractiveObject.userData.isButtonFace) {
      const innerMesh = activeInteractiveObject;
      innerMesh.position.z = 0.06; // return to normal height

      // Reset LED strip light
      if (ledStripMaterial) {
        ledStripMaterial.color.setHex(0x1c1917);
        ledStripMaterial.emissive.setHex(0x000000);
      }

      const durationHeld = Date.now() - buttonPressStartTime;
      
      // Read current LED timer seconds digit for releasing logic
      const timerText = ledTimer.textContent; // e.g. "04:32"
      const lastDigit = parseInt(timerText[timerText.length - 1], 10) || 0;

      socket.emit('button-action', {
        type: 'up',
        duration: durationHeld,
        releaseDigit: lastDigit
      });
    }

    activeInteractiveObject = null;
  }
}

function onPointerMove(e) {
  // Can add custom hover highlights here if wanted
}

// Keypad callbacks
socket.on('keypad-correct-press', ({ symbol, index }) => {
  // Light up the small green LEDs above the corresponding keypad buttons
  if (!bombGroup) return;

  bombGroup.traverse(node => {
    if (node.userData && node.userData.isKeypadKey && node.userData.symbol === symbol) {
      const indicator = node.userData.indicator;
      if (indicator) {
        indicator.material.color.setHex(0x10b981); // green
      }
    }
  });
});

socket.on('keypad-reset', () => {
  // Reset all keypad key green indicators back to black
  if (!bombGroup) return;

  bombGroup.traverse(node => {
    if (node.userData && node.userData.isKeypadKey) {
      const indicator = node.userData.indicator;
      if (indicator) {
        indicator.material.color.setHex(0x111827); // black/unlit
      }
    }
  });
});

// ----------------------------------------------------
// RENDERING LOOP
// ----------------------------------------------------

let frameCount = 0;
function animate() {
  if (!scene || !renderer) return;

  requestAnimationFrame(animate);

  controls.update();
  updateSparkSystem();

  // Subtle overhead hanging light movement
  frameCount += 0.02;
  const alarmLight = scene.userData.alarmLight;
  if (alarmLight) {
    const minutesLeft = parseInt(ledTimer.textContent.split(':')[0], 10);
    if (minutesLeft === 0) {
      alarmLight.intensity = Math.sin(frameCount * 5) * 1.5 + 1.5;
    } else {
      alarmLight.intensity = 0;
    }
  }

  renderer.render(scene, camera);
}
