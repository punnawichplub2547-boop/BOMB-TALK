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
const sndTick = document.getElementById('snd-tick');
const sndStrike = document.getElementById('snd-strike');
const sndExplosion = document.getElementById('snd-explosion');
const sndDefused = document.getElementById('snd-defused');
const sndClick = document.getElementById('snd-click');

function playSound(audio) {
  if (audio) {
    audio.currentTime = 0;
    audio.play().catch(() => {});
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

    // Build 3D bomb
    initThreeJS();
    build3DBomb(bombConfig);
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
  playSound(sndTick);
});

socket.on('strike', ({ strikes }) => {
  playSound(sndStrike);
  updateStrikesDisplay(strikes);
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
  playSound(sndClick);
});

socket.on('game-defused', ({ timeLeft }) => {
  playSound(sndDefused);
  defusedTimeLeft.textContent = formatTime(timeLeft);
  gameDefusedModal.classList.add('active');
});

socket.on('game-over', ({ reason, strikes }) => {
  playSound(sndExplosion);
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
  controls.minDistance = 4;
  controls.maxDistance = 12;
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

  // 1. Briefcase Chassis (lightened color for detail visibility)
  const chassisGeom = new THREE.BoxGeometry(5.2, 3.6, 1.4);
  const chassisMat = new THREE.MeshStandardMaterial({
    color: 0x3e4452,
    roughness: 0.5,
    metalness: 0.8
  });
  const chassis = new THREE.Mesh(chassisGeom, chassisMat);
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  bombGroup.add(chassis);

  // Latches / Metal corner pads
  const cornerMat = new THREE.MeshStandardMaterial({ color: 0x6b7280, metalness: 0.9, roughness: 0.2 });
  const cornerPositions = [
    [-2.6, 1.8, 0], [2.6, 1.8, 0], [-2.6, -1.8, 0], [2.6, -1.8, 0]
  ];
  cornerPositions.forEach(([x, y, z]) => {
    const corner = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, 1.42), cornerMat);
    corner.position.set(x, y, z);
    bombGroup.add(corner);
  });

  // Handle on top
  const handleGeom = new THREE.BoxGeometry(1.6, 0.15, 0.15);
  const handle = new THREE.Mesh(handleGeom, cornerMat);
  handle.position.set(0, 1.9, 0);
  bombGroup.add(handle);

  // 2. Serial Number Stamp on Top Side
  const serialLabelGeom = new THREE.PlaneGeometry(1.2, 0.35);
  const serialTex = createTextTexture(bombConfig.serialNumber, '#d4c5a9', '#111827', 32);
  const serialMat = new THREE.MeshStandardMaterial({ map: serialTex });
  const serialMesh = new THREE.Mesh(serialLabelGeom, serialMat);
  serialMesh.position.set(-1.2, 1.81, 0);
  serialMesh.rotation.x = -Math.PI / 2; // place flat on top surface
  bombGroup.add(serialMesh);

  // 3. Batteries Compartment on Bottom Side
  const batteryBase = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.35, 0.4), chassisMat);
  batteryBase.position.set(1.2, -1.81, 0);
  batteryBase.rotation.x = Math.PI / 2;
  bombGroup.add(batteryBase);

  for (let i = 0; i < bombConfig.batteries; i++) {
    const battGeom = new THREE.CylinderGeometry(0.06, 0.06, 0.3);
    const battMat = new THREE.MeshStandardMaterial({ color: 0xb45309, metalness: 0.8 }); // golden copper look
    const batt = new THREE.Mesh(battGeom, battMat);
    batt.position.set(1.0 + (i * 0.15), -1.85, 0);
    batt.rotation.z = Math.PI / 2;
    bombGroup.add(batt);
  }

  // 4. Populate Modules
  // We place 3 modules at specific slots:
  // Slot 1 (Left): Wires module (x = -1.6)
  // Slot 2 (Center): Button module (x = 0)
  // Slot 3 (Right): Keypad module (x = 1.6)
  // z-coordinate of front face is 0.7. Modules sit at z = 0.71

  bombConfig.modules.forEach((mod) => {
    if (mod.type === 'wires') {
      assembleWiresModule(mod);
    } else if (mod.type === 'button') {
      assembleButtonModule(mod);
    } else if (mod.type === 'keypad') {
      assembleKeypadModule(mod);
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

// WIRES MODULE (Stacked top to bottom)
function assembleWiresModule(mod) {
  const group = new THREE.Group();
  group.position.set(-1.6, 0, 0.7);

  // Background module plate
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(1.3, 2.6, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.8 })
  );
  group.add(plate);

  addStatusLED(group, 0.45, 1.1, 'wires');

  // Draw wire rails (left and right vertical connectors)
  const railGeom = new THREE.BoxGeometry(0.15, 1.6, 0.08);
  const railMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.6 });
  const leftRail = new THREE.Mesh(railGeom, railMat);
  leftRail.position.set(-0.45, 0, 0.04);
  const rightRail = new THREE.Mesh(railGeom, railMat);
  rightRail.position.set(0.45, 0, 0.04);
  group.add(leftRail, rightRail);

  // Render individual wire cylinders (horizontal wires stacked vertically top-to-bottom)
  const totalWires = mod.colors.length;
  const startY = 0.6;
  const gap = 1.2 / (totalWires - 1 || 1);

  mod.colors.forEach((colorName, idx) => {
    const wireY = startY - (idx * gap);
    
    // Group to hold the split parts or single wire
    const wireGroup = new THREE.Group();
    wireGroup.position.set(0, wireY, 0.08);
    wireGroup.userData = { isWire: true, wireIndex: idx, cut: false };

    // Uncut single wire cylinder (rotated horizontally)
    const wireGeom = new THREE.CylinderGeometry(0.035, 0.035, 0.9);
    const wireMat = new THREE.MeshStandardMaterial({
      color: COLOR_HEX_MAP[colorName],
      roughness: 0.6,
      metalness: 0.2
    });
    const wireCylinder = new THREE.Mesh(wireGeom, wireMat);
    wireCylinder.name = "wire_uncut";
    wireCylinder.rotation.z = Math.PI / 2; // lie horizontally
    wireGroup.add(wireCylinder);

    // Prepare cut segments (initially hidden)
    const segmentGeom = new THREE.CylinderGeometry(0.035, 0.035, 0.4);
    
    const leftSegment = new THREE.Mesh(segmentGeom, wireMat);
    leftSegment.rotation.z = Math.PI / 2;
    leftSegment.position.set(-0.22, 0, 0);
    leftSegment.rotation.y = 0.25; // bend slightly forward/outward
    leftSegment.name = "wire_cut_left";
    leftSegment.visible = false;

    const rightSegment = new THREE.Mesh(segmentGeom, wireMat);
    rightSegment.rotation.z = Math.PI / 2;
    rightSegment.position.set(0.22, 0, 0);
    rightSegment.rotation.y = -0.25; // bend slightly forward/outward
    rightSegment.name = "wire_cut_right";
    rightSegment.visible = false;

    wireGroup.add(leftSegment, rightSegment);

    // Register with raycaster
    interactiveObjects.push(wireCylinder);
    // Bind wire index to the geometry mesh userData for lookup
    wireCylinder.userData = { parentGroup: wireGroup, wireIndex: idx };

    group.add(wireGroup);
  });

  bombGroup.add(group);
}

// BUTTON MODULE
function assembleButtonModule(mod) {
  const group = new THREE.Group();
  group.position.set(0, 0, 0.7);

  // Background module plate
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(1.3, 2.6, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.8 })
  );
  group.add(plate);

  addStatusLED(group, 0.45, 1.1, 'button');

  // Big Button cylinder mesh
  const buttonGroup = new THREE.Group();
  buttonGroup.position.set(0, 0, 0.03);
  buttonGroup.userData = { isButton: true };

  // Base ring
  const baseGeom = new THREE.CylinderGeometry(0.44, 0.44, 0.08, 32);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x52525b, metalness: 0.8 });
  const base = new THREE.Mesh(baseGeom, baseMat);
  base.rotation.x = Math.PI / 2;
  buttonGroup.add(base);

  // Colored Inner Button
  const innerGeom = new THREE.CylinderGeometry(0.38, 0.38, 0.12, 32);
  // Generate texture canvas for the text label
  const btnTex = createTextTexture(mod.text, COLOR_HEX_MAP[mod.color] || 0xffffff, '#ffffff', 32);
  const innerMat = new THREE.MeshStandardMaterial({
    color: COLOR_HEX_MAP[mod.color],
    roughness: 0.4,
    map: btnTex
  });
  
  // Rotate texture mapping to match top of cylinder face
  innerMat.map.center.set(0.5, 0.5);
  innerMat.map.rotation = Math.PI / 2;

  const innerButton = new THREE.Mesh(innerGeom, innerMat);
  innerButton.rotation.x = Math.PI / 2;
  innerButton.position.z = 0.06;
  innerButton.name = "the_button_mesh";
  buttonGroup.add(innerButton);

  // Store interactive mesh for raycast
  interactiveObjects.push(innerButton);
  innerButton.userData = { isButtonFace: true, parentGroup: buttonGroup };

  // Led Glow Strip on the side
  const stripGeom = new THREE.BoxGeometry(0.12, 0.6, 0.04);
  ledStripMaterial = new THREE.MeshStandardMaterial({
    color: 0x1c1917, // dark unlit
    roughness: 0.2
  });
  const ledStrip = new THREE.Mesh(stripGeom, ledStripMaterial);
  ledStrip.position.set(0.45, 0, 0.03);
  group.add(ledStrip);

  group.add(buttonGroup);
  bombGroup.add(group);
}

// KEYPAD MODULE
function assembleKeypadModule(mod) {
  const group = new THREE.Group();
  group.position.set(1.6, 0, 0.7);

  // Background module plate
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(1.3, 2.6, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.8 })
  );
  group.add(plate);

  addStatusLED(group, 0.45, 1.1, 'keypad');

  // 4 buttons in 2x2 grid
  // X positions: -0.3, 0.3
  // Y positions: 0.3, -0.3
  const buttonGrid = [
    [-0.32, 0.32], [0.32, 0.32],
    [-0.32, -0.32], [0.32, -0.32]
  ];

  mod.symbols.forEach((symbol, idx) => {
    const [x, y] = buttonGrid[idx];
    
    const keyGroup = new THREE.Group();
    keyGroup.position.set(x, y, 0.04);
    keyGroup.userData = { isKeypadKey: true, symbol };

    // Button body
    const bodyGeom = new THREE.BoxGeometry(0.48, 0.48, 0.08);
    const keyTex = createGlyphTexture(symbol);
    const keyMat = new THREE.MeshStandardMaterial({
      map: keyTex,
      roughness: 0.4
    });
    const keyMesh = new THREE.Mesh(bodyGeom, keyMat);
    keyMesh.name = `keypad_key_${idx}`;
    keyGroup.add(keyMesh);

    // Indicator light above key
    const indicatorGeom = new THREE.BoxGeometry(0.12, 0.04, 0.02);
    const indicatorMat = new THREE.MeshStandardMaterial({ color: 0x111827 });
    const indicator = new THREE.Mesh(indicatorGeom, indicatorMat);
    indicator.position.set(0, 0.22, 0.05);
    keyGroup.add(indicator);

    keyGroup.userData.indicator = indicator; // store reference to light up

    interactiveObjects.push(keyMesh);
    keyMesh.userData = { isKeypadFace: true, parentGroup: keyGroup, symbol };

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

  // Subtle overhead hanging light movement
  frameCount += 0.02;
  const alarmLight = scene.userData.alarmLight;
  if (alarmLight) {
    // If timer is short (e.g. < 60s, handled by checking text content)
    const minutesLeft = parseInt(ledTimer.textContent.split(':')[0], 10);
    if (minutesLeft === 0) {
      // Rapid pulsing red warning light!
      alarmLight.intensity = Math.sin(frameCount * 5) * 1.5 + 1.5;
    } else {
      alarmLight.intensity = 0;
    }
  }

  renderer.render(scene, camera);
}
