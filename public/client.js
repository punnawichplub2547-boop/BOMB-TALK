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

// Sounds DOM elements
const sndTick = document.getElementById('snd-tick');
const sndStrike = document.getElementById('snd-strike');
const sndExplosion = document.getElementById('snd-explosion');
const sndDefused = document.getElementById('snd-defused');
const sndClick = document.getElementById('snd-click');

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

function playTerminalKeyClick(isEnterKey = false) {
  if (isMuted) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. High-frequency crisp mechanical switch snap (noise transient)
    const bufferSize = Math.floor(ctx.sampleRate * 0.015);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.22));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    const centerFreq = isEnterKey ? 2200 : 3400;
    noiseFilter.frequency.setValueAtTime(centerFreq, now);
    noiseFilter.Q.setValueAtTime(2.5, now);

    const noiseGain = ctx.createGain();
    const vol = isEnterKey ? 0.45 : 0.32;
    noiseGain.gain.setValueAtTime(vol, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.018);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);

    // 2. Low resonant keycap body thock (pitch drop)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isEnterKey ? 'sawtooth' : 'triangle';
    const startFreq = isEnterKey ? 500 : 780;
    const endFreq = isEnterKey ? 120 : 180;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.028);

    gain.gain.setValueAtTime(isEnterKey ? 0.35 : 0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.028);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.028);

  } catch (e) {
    console.warn('Terminal click sound error:', e);
  }
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
      playTerminalKeyClick(false);
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
      // 1. Sub-bass punch oscillator
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(180, now);
      subOsc.frequency.exponentialRampToValueAtTime(25, now + 1.2);
      subGain.gain.setValueAtTime(0.9, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
      subOsc.connect(subGain);
      subGain.connect(ctx.destination);
      subOsc.start(now);
      subOsc.stop(now + 1.4);

      // 2. Crunchy noise burst with lowpass sweep
      const bufferSize = Math.floor(ctx.sampleRate * 1.5);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1200, now);
      filter.frequency.exponentialRampToValueAtTime(50, now + 1.5);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.8, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start(now);

      // 3. Delayed echo impact
      setTimeout(() => {
        try {
          const now2 = ctx.currentTime;
          const sub2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          sub2.type = 'triangle';
          sub2.frequency.setValueAtTime(90, now2);
          sub2.frequency.exponentialRampToValueAtTime(30, now2 + 0.8);
          gain2.gain.setValueAtTime(0.5, now2);
          gain2.gain.exponentialRampToValueAtTime(0.001, now2 + 0.8);
          sub2.connect(gain2);
          gain2.connect(ctx.destination);
          sub2.start(now2);
          sub2.stop(now2 + 0.8);
        } catch (e) {}
      }, 120);
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

let isMuted = false;

const btnSoundToggle = document.getElementById('btn-sound-toggle');
if (btnSoundToggle) {
  btnSoundToggle.addEventListener('click', () => {
    isMuted = !isMuted;
    btnSoundToggle.textContent = isMuted ? '[ 🔇 AUDIO: OFF ]' : '[ 🔊 AUDIO: ON ]';
    btnSoundToggle.classList.toggle('muted', isMuted);
  });
}

function playSound(audio, synthType) {
  if (isMuted) return;
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

// Auto-fill room code from URL query string (?room=ABCD or ?code=ABCD)
window.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const roomParam = urlParams.get('room') || urlParams.get('code');
  if (roomParam && roomCodeInput) {
    const cleanCode = roomParam.trim().toUpperCase().slice(0, 4);
    roomCodeInput.value = cleanCode;
    const msgEl = document.getElementById('lobby-status-msg');
    if (msgEl) msgEl.textContent = `> ROOM CODE [${cleanCode}] PRE-FILLED FROM LINK`;
  }
});

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
let sparkParticles = [];
let cameraShakeIntensity = 0;
let explosionLight = null;
let shockwaveRing = null;

// Materials (global to change colors easily)
let ledStripMaterial;
const moduleStatusLights = []; // array of { mesh, type, index } to light up green on solve

// ----------------------------------------------------
// LOBBY / ROOM NAVIGATION
// ----------------------------------------------------

btnCreateRoom.addEventListener('click', () => {
  playSound(sndClick, 'click');
  const name = usernameInput.value.trim() || 'OPERATOR_A';
  socket.emit('create-room', name);
});

btnJoinRoom.addEventListener('click', () => {
  playSound(sndClick, 'click');
  const code = roomCodeInput.value.trim().toUpperCase();
  const name = usernameInput.value.trim() || 'OPERATOR_B';
  if (code.length === 4) {
    socket.emit('join-room', { code, name });
  } else {
    alert('Please enter a valid 4-character Room Code.');
  }
});

if (roomCodeInput) {
  roomCodeInput.addEventListener('input', () => {
    roomCodeInput.value = roomCodeInput.value.toUpperCase();
  });
  roomCodeInput.addEventListener('keydown', (e) => {
    playTerminalKeyClick(e.key === 'Enter');
    if (e.key === 'Enter') {
      btnJoinRoom.click();
    }
  });
}

if (usernameInput) {
  usernameInput.addEventListener('keydown', (e) => {
    playTerminalKeyClick(e.key === 'Enter');
    if (e.key === 'Enter') {
      const code = roomCodeInput.value.trim();
      if (code.length === 4) {
        btnJoinRoom.click();
      } else {
        btnCreateRoom.click();
      }
    }
  });
}

let currentDifficulty = 'medium';

const btnCopyRoomLink = document.getElementById('btn-copy-room-link');
if (btnCopyRoomLink) {
  btnCopyRoomLink.addEventListener('click', () => {
    playSound(sndClick, 'click');
    const code = document.getElementById('code-text').textContent.trim();
    if (code && code !== '----') {
      const directUrl = `${window.location.origin}${window.location.pathname}?room=${code}`;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(directUrl);
      }
      btnCopyRoomLink.textContent = '[ COPIED DIRECT LINK! ]';
      setTimeout(() => {
        btnCopyRoomLink.textContent = '[ COPY DIRECT ROOM LINK ]';
      }, 2500);
    }
  });
}

window.selectDifficulty = function(diff) {
  playSound(sndClick, 'click');
  socket.emit('select-difficulty', diff);
};

function updateLobbyUI(code, players, difficulty = 'medium') {
  codeText.textContent = code;
  playersList.innerHTML = '';
  currentDifficulty = difficulty || 'medium';
  
  roomPlayers = players;

  // Render player list
  players.forEach(p => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${p.name} ${p.id === socket.id ? '<strong>(You)</strong>' : ''}</span>
      <span class="player-role ${p.role === 'defuser' ? 'role-defuser' : 'role-expert'}">[${p.role.toUpperCase()}]</span>
    `;
    playersList.appendChild(li);
  });

  // Highlight active role card for current player
  const me = players.find(p => p.id === socket.id);
  if (me) {
    currentRole = me.role;
  }
  const defEl = document.getElementById('role-defuser');
  const expEl = document.getElementById('role-expert');
  if (defEl) defEl.classList.toggle('active', currentRole === 'defuser');
  if (expEl) expEl.classList.toggle('active', currentRole === 'expert');

  // Highlight active difficulty card
  ['easy', 'medium', 'hard', 'hardcore'].forEach(d => {
    const el = document.getElementById(`diff-${d}`);
    if (el) el.classList.toggle('active', d === currentDifficulty);
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
  playSound(sndClick, 'click');
  socket.emit('select-role', role);
};

btnStartGame.addEventListener('click', () => {
  playSound(sndClick, 'click');
  socket.emit('start-game');
});

document.querySelectorAll('.btn-quit-game').forEach(btn => {
  btn.addEventListener('click', () => {
    playSound(sndClick, 'click');
    if (confirm('Are you sure you want to abort the mission?')) {
      window.location.reload();
    }
  });
});

btnRestarts.forEach((btn, idx) => {
  btn.addEventListener('click', () => {
    console.log(`Debug: Return to Lobby button #${idx} clicked! Emitting restart-game...`);
    socket.emit('restart-game');
  });
});

// Socket Events
socket.on('room-created', ({ code, players, difficulty }) => {
  localRoomCode = code;
  myId = socket.id;
  currentRole = 'expert'; // creator defaults to expert
  nameStep.classList.remove('active');
  roomStep.classList.add('active');
  updateLobbyUI(code, players, difficulty);
});

socket.on('joined-successfully', ({ code, players, difficulty, yourId }) => {
  localRoomCode = code;
  myId = yourId;
  
  const me = players.find(p => p.id === yourId);
  currentRole = me ? me.role : 'expert';

  nameStep.classList.remove('active');
  roomStep.classList.add('active');
  updateLobbyUI(code, players, difficulty);
});

socket.on('room-updated', ({ code, players, difficulty }) => {
  const me = players.find(p => p.id === socket.id);
  if (me) {
    currentRole = me.role;
    document.getElementById('role-defuser').classList.toggle('active', currentRole === 'defuser');
    document.getElementById('role-expert').classList.toggle('active', currentRole === 'expert');
  }
  updateLobbyUI(code, players, difficulty);
});

socket.on('error-msg', (msg) => {
  alert(msg);
});

// ----------------------------------------------------
// GAME STATE SYNC
// ----------------------------------------------------

let currentSimonSequence = [];
let simonSequences = {};
let simonIntervals = {};

function clearAllSimonLoops() {
  Object.keys(simonIntervals).forEach(modIdx => {
    clearInterval(simonIntervals[modIdx]);
  });
  simonIntervals = {};
}

function startSimonLoop(moduleIndex, stage) {
  if (simonIntervals[moduleIndex]) {
    clearInterval(simonIntervals[moduleIndex]);
    delete simonIntervals[moduleIndex];
  }

  const seq = simonSequences[moduleIndex] || currentSimonSequence;
  if (!seq || seq.length === 0) return;

  triggerSimonFlash(seq, stage, moduleIndex);

  const loopTime = (stage * 550) + 3000;
  simonIntervals[moduleIndex] = setInterval(() => {
    const indicator = moduleStatusLights.find(l => l.moduleIndex === moduleIndex && l.type === 'simon');
    if (indicator && indicator.mesh.material.color.getHex() === 0x10b981) {
      clearInterval(simonIntervals[moduleIndex]);
      delete simonIntervals[moduleIndex];
      return;
    }
    triggerSimonFlash(seq, stage, moduleIndex);
  }, loopTime);
}

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

    // Store simon sequences per moduleIndex
    simonSequences = {};
    clearAllSimonLoops();
    bombConfig.modules.forEach((m, idx) => {
      if (m.type === 'simon') {
        simonSequences[idx] = m.sequence;
      }
    });

    // Build 3D bomb
    initThreeJS();
    build3DBomb(bombConfig);

    // Initial stage 1 flash for all Simon Says modules with repeating loop
    Object.keys(simonSequences).forEach(modIdx => {
      setTimeout(() => {
        startSimonLoop(Number(modIdx), 1);
      }, 1000);
    });
  } else {
    expertLayout.classList.add('active');
    defuserLayout.classList.remove('active');
    
    expertTimer.textContent = formatTime(timer.timeLeft);
    expStrike1.classList.remove('active');
    expStrike2.classList.remove('active');
  }
});

let winStreak = parseInt(localStorage.getItem('bomb_talk_streak') || '0', 10);

socket.on('timer-update', ({ timeLeft, strikes }) => {
  const formatted = formatTime(timeLeft);
  if (currentRole === 'defuser') {
    ledTimer.textContent = formatted;
  } else {
    expertTimer.textContent = formatted;
  }
  
  // Tick sound
  playSound(sndTick, 'tick');

  // Low-timer emergency red alert (< 60s or 1+ strikes)
  const redOverlay = document.getElementById('emergency-red-overlay');
  if (redOverlay) {
    if (timeLeft <= 60 || strikes >= 1) {
      redOverlay.classList.add('active');
    } else {
      redOverlay.classList.remove('active');
    }
  }

  if (scene && scene.userData && scene.userData.alarmLight) {
    if (timeLeft <= 60 || strikes >= 1) {
      scene.userData.alarmLight.intensity = Math.sin(Date.now() * 0.01) * 3.0 + 3.0;
    } else {
      scene.userData.alarmLight.intensity = 0;
    }
  }
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

socket.on('module-solved', ({ type, moduleIndex }) => {
  // Turn status indicator light green for specific module
  const indicator = moduleStatusLights.find(l => l.type === type && (moduleIndex === undefined || l.moduleIndex === moduleIndex));
  if (indicator) {
    indicator.mesh.material.color.setHex(0x10b981); // green
    indicator.mesh.material.emissive.setHex(0x10b981);
  }

  if (type === 'simon' && simonIntervals[moduleIndex]) {
    clearInterval(simonIntervals[moduleIndex]);
    delete simonIntervals[moduleIndex];
  }
  if (type === 'morse' && morseIntervals[moduleIndex]) {
    clearInterval(morseIntervals[moduleIndex]);
    delete morseIntervals[moduleIndex];
  }
  playSound(sndClick, 'click');
});

socket.on('simon-stage-advance', ({ moduleIndex, stage }) => {
  playSound(sndClick, 'click');
  startSimonLoop(moduleIndex, stage);
});

socket.on('simon-reset', ({ moduleIndex, stage }) => {
  playSound(sndStrike, 'strike');
  startSimonLoop(moduleIndex, stage);
});

socket.on('memory-stage-advance', ({ moduleIndex, stage, displayDigit, labels }) => {
  playSound(sndClick, 'click');
  const state = memoryState[moduleIndex];
  if (state && state.group) {
    state.stage = stage;
    state.displayDigit = displayDigit;
    state.labels = labels;
    updateMemoryModuleVisuals(state.group, stage, displayDigit, labels);
  }
});

socket.on('memory-reset', ({ moduleIndex, stage, displayDigit, labels }) => {
  playSound(sndStrike, 'strike');
  const state = memoryState[moduleIndex];
  if (state && state.group) {
    state.stage = stage;
    state.displayDigit = displayDigit;
    state.labels = labels;
    updateMemoryModuleVisuals(state.group, stage, displayDigit, labels);
  }
});

socket.on('game-defused', ({ timeLeft, debrief }) => {
  playSound(sndDefused, 'defused');
  defusedTimeLeft.textContent = formatTime(timeLeft);
  
  winStreak++;
  localStorage.setItem('bomb_talk_streak', winStreak.toString());

  const rankEl = document.getElementById('defused-rank-badge');
  if (rankEl && debrief) {
    rankEl.textContent = debrief.rank || 'S';
    rankEl.className = `rank-badge rank-${debrief.rank || 'S'}`;
  }
  const takenEl = document.getElementById('defused-time-taken');
  if (takenEl && debrief) {
    takenEl.textContent = formatTime(debrief.timeTaken || 0);
  }
  const streakEl = document.getElementById('defused-streak');
  if (streakEl) {
    streakEl.textContent = winStreak.toString();
  }

  const redOverlay = document.getElementById('emergency-red-overlay');
  if (redOverlay) redOverlay.classList.remove('active');

  gameDefusedModal.classList.add('active');
});

socket.on('game-over', ({ reason, strikes, debrief }) => {
  playSound(sndExplosion, 'explosion');
  updateStrikesDisplay(strikes);

  winStreak = 0;
  localStorage.setItem('bomb_talk_streak', '0');

  const overStreakEl = document.getElementById('over-streak');
  if (overStreakEl) overStreakEl.textContent = '0';

  const overStrikesEl = document.getElementById('over-strikes');
  if (overStrikesEl) overStrikesEl.textContent = `${strikes} / 3`;

  if (currentRole === 'defuser') {
    triggerMassiveExplosion();
  }

  if (reason === 'timeout') {
    gameOverReason.textContent = "The bomb exploded because time ran out.";
  } else {
    gameOverReason.textContent = "The bomb exploded because maximum strikes were reached.";
  }

  const redOverlay = document.getElementById('emergency-red-overlay');
  if (redOverlay) redOverlay.classList.remove('active');
  
  setTimeout(() => {
    gameOverModal.classList.add('active');
  }, 1250);
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
  scene.background = new THREE.Color(0x1e2430);
  scene.fog = new THREE.FogExp2(0x1e2430, 0.03);

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

  // Ambient Lighting (boosted for clear high-visibility)
  const ambient = new THREE.AmbientLight(0xffffff, 0.85);
  scene.add(ambient);

  // SpotLight hanging above the bomb (the central bright light source)
  const spotlight = new THREE.SpotLight(0xfff8f0, 10.0);
  spotlight.position.set(0, 9, 5);
  spotlight.angle = Math.PI / 3;
  spotlight.penumbra = 0.6;
  spotlight.castShadow = true;
  spotlight.shadow.mapSize.width = 1024;
  spotlight.shadow.mapSize.height = 1024;
  scene.add(spotlight);

  // Key fill light (front-left)
  const fillLight1 = new THREE.DirectionalLight(0xc8d8e8, 1.2);
  fillLight1.position.set(-5, 4, 5);
  scene.add(fillLight1);

  // Secondary fill light (front-right)
  const fillLight2 = new THREE.DirectionalLight(0xffffff, 0.8);
  fillLight2.position.set(5, 3, 5);
  scene.add(fillLight2);

  // Rim Light Left (Cold Cyber Blue Specular Highlight)
  const rimLightBlue = new THREE.DirectionalLight(0x38bdf8, 1.8);
  rimLightBlue.position.set(-6, 5, -5);
  scene.add(rimLightBlue);

  // Rim Light Right (Warm Amber Glow Specular Highlight)
  const rimLightAmber = new THREE.DirectionalLight(0xfbbf24, 1.4);
  rimLightAmber.position.set(6, -4, -4);
  scene.add(rimLightAmber);

  // Red alert flickering light
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
  clearAllSimonLoops();
  clearAllMorseLoops();
  scene = null;
  camera = null;
  renderer = null;
  controls = null;
  bombGroup = null;
  interactiveObjects = [];
  moduleStatusLights.length = 0;
  sparkParticles = [];
  explosionLight = null;
  shockwaveRing = null;
  cameraShakeIntensity = 0;
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
// PROCEDURAL 3D BOMB ASSEMBLY & TEXTURES
// ----------------------------------------------------

function createCarbonFiberTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#0f141c';
  ctx.fillRect(0, 0, 128, 128);

  ctx.fillStyle = '#1e2633';
  for (let y = 0; y < 128; y += 8) {
    for (let x = 0; x < 128; x += 8) {
      if ((x + y) % 16 === 0) {
        ctx.fillRect(x, y, 8, 8);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 6);
  return texture;
}

function createBrushedMetalTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#333b4d';
  ctx.fillRect(0, 0, 256, 256);

  // Micro metallic streaks
  for (let i = 0; i < 600; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const len = 10 + Math.random() * 30;
    const alpha = 0.03 + Math.random() * 0.07;
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  return texture;
}

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

function getModuleSlotPositions(count) {
  if (count <= 2) {
    return [[-1.3, 0], [1.3, 0]];
  } else if (count <= 4) {
    return [
      [-1.3, 0.75], [1.3, 0.75],
      [-1.3, -0.75], [1.3, -0.75]
    ];
  } else if (count <= 6) {
    return [
      [-2.6, 0.75], [0, 0.75], [2.6, 0.75],
      [-2.6, -0.75], [0, -0.75], [2.6, -0.75]
    ];
  } else {
    return [
      [-3.9, 0.75], [-1.3, 0.75], [1.3, 0.75], [3.9, 0.75],
      [-3.9, -0.75], [-1.3, -0.75], [1.3, -0.75], [3.9, -0.75]
    ];
  }
}

function getChassisWidth(count) {
  if (count <= 2) return 5.4;
  if (count <= 4) return 5.4;
  if (count <= 6) return 8.0;
  return 10.6;
}

function build3DBomb(bombConfig) {
  bombGroup = new THREE.Group();
  sparkParticles = [];
  simonButtons = [];

  const count = bombConfig.modules ? bombConfig.modules.length : 4;
  const chassisWidth = getChassisWidth(count);

  // Dynamically set camera distance based on chassis width
  const camDist = count <= 4 ? 8 : (count <= 6 ? 10.5 : 12.5);
  if (camera) camera.position.set(0, 0, camDist);
  if (controls) controls.maxDistance = camDist + 4.0;

  // 1. Briefcase Chassis (metallic brushed industrial texture)
  const chassisGeom = new THREE.BoxGeometry(chassisWidth, 3.6, 1.4);
  const brushedTex = createBrushedMetalTexture();
  const chassisMat = new THREE.MeshStandardMaterial({
    color: 0x3d4756,
    map: brushedTex,
    roughness: 0.35,
    metalness: 0.8
  });
  const chassis = new THREE.Mesh(chassisGeom, chassisMat);
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  bombGroup.add(chassis);

  // Interior Carbon Fiber Bay Plate
  const carbonTex = createCarbonFiberTexture();
  const trayMat = new THREE.MeshStandardMaterial({ map: carbonTex, roughness: 0.8 });
  const trayMesh = new THREE.Mesh(new THREE.PlaneGeometry(chassisWidth - 0.2, 3.2), trayMat);
  trayMesh.position.set(0, 0, 0.68);
  bombGroup.add(trayMesh);

  // Chrome Toggle Latches on Top Edge
  const latchMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.1 });
  [-chassisWidth * 0.3, chassisWidth * 0.3].forEach(latchX => {
    const latchBase = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, 0.12), latchMat);
    latchBase.position.set(latchX, 1.82, 0.4);
    const latchHandle = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.35, 0.08), latchMat);
    latchHandle.position.set(latchX, 1.88, 0.44);
    bombGroup.add(latchBase, latchHandle);
  });

  // Hazard warning tape on top & bottom chassis edges
  const hazardTex = createHazardStripeTexture();
  const hazardMat = new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.5 });
  
  const topHazard = new THREE.Mesh(new THREE.PlaneGeometry(chassisWidth - 0.02, 0.18), hazardMat);
  topHazard.position.set(0, 1.71, 0.71);
  const bottomHazard = new THREE.Mesh(new THREE.PlaneGeometry(chassisWidth - 0.02, 0.18), hazardMat);
  bottomHazard.position.set(0, -1.71, 0.71);
  bombGroup.add(topHazard, bottomHazard);

  // Latches & Metal corner pads with rivets
  const cornerMat = new THREE.MeshStandardMaterial({ color: 0x71717a, metalness: 0.95, roughness: 0.15 });
  const rivetGeom = new THREE.CylinderGeometry(0.03, 0.03, 0.04, 12);
  const rivetMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.9 });
  const halfW = chassisWidth / 2;

  const cornerPositions = [
    [-halfW, 1.8, 0], [halfW, 1.8, 0], [-halfW, -1.8, 0], [halfW, -1.8, 0]
  ];
  cornerPositions.forEach(([x, y, z]) => {
    const corner = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.45, 1.42), cornerMat);
    corner.position.set(x, y, z);
    bombGroup.add(corner);

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

  // Internal Ribbon Cable Running Behind Bays
  const ribbonGeom = new THREE.BoxGeometry(chassisWidth - 0.8, 0.08, 0.02);
  const ribbonMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.6 });
  const ribbon = new THREE.Mesh(ribbonGeom, ribbonMat);
  ribbon.position.set(0, 0, 0.65);
  bombGroup.add(ribbon);

  // 2. Serial Number Stamp on Top Side
  const serialLabelGeom = new THREE.PlaneGeometry(1.4, 0.38);
  const serialTex = createTextTexture(bombConfig.serialNumber, '#d4c5a9', '#111827', 32);
  const serialMat = new THREE.MeshStandardMaterial({ map: serialTex });
  const serialMesh = new THREE.Mesh(serialLabelGeom, serialMat);
  serialMesh.position.set(-1.2, 1.81, 0);
  serialMesh.rotation.x = -Math.PI / 2;
  bombGroup.add(serialMesh);

  // 3. Batteries Compartment on Right Side Panel
  const batteryGroup = new THREE.Group();
  batteryGroup.position.set(halfW + 0.01, 0.2, 0);
  batteryGroup.rotation.y = Math.PI / 2;

  // Battery Pack Housing Base Plate
  const battHousingMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.8, roughness: 0.3 });
  const battHolder = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 0.12), battHousingMat);
  batteryGroup.add(battHolder);

  // Label tag on top of battery pack
  const battCountStr = String(bombConfig.batteries || 0);
  const battLabelTex = createTextTexture(`BATT CELL: ${battCountStr}`, '#1f2937', '#facc15', 22);
  const battLabelMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 0.25),
    new THREE.MeshStandardMaterial({ map: battLabelTex })
  );
  battLabelMesh.position.set(0, 0.42, 0.07);
  batteryGroup.add(battLabelMesh);

  // Render battery cells inside holder
  if (bombConfig.batteries > 0) {
    for (let i = 0; i < bombConfig.batteries; i++) {
      const cellY = (bombConfig.batteries === 1) ? 0 : (0.18 - (i * 0.36));

      // Black/Copper AA Battery Cylinder Body
      const battBodyGeom = new THREE.CylinderGeometry(0.09, 0.09, 0.68, 24);
      const battBodyMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.85, roughness: 0.2 });
      const battBody = new THREE.Mesh(battBodyGeom, battBodyMat);
      battBody.rotation.z = Math.PI / 2;
      battBody.position.set(0, cellY, 0.08);

      // Shiny Silver (+) Cap Nipple
      const capGeom = new THREE.CylinderGeometry(0.04, 0.04, 0.06, 16);
      const capMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.95, roughness: 0.1 });
      const cap = new THREE.Mesh(capGeom, capMat);
      cap.rotation.z = Math.PI / 2;
      cap.position.set(0.36, cellY, 0.08);

      // Silver (-) Spring Terminal
      const springGeom = new THREE.CylinderGeometry(0.06, 0.06, 0.05, 12);
      const springMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9 });
      const spring = new THREE.Mesh(springGeom, springMat);
      spring.rotation.z = Math.PI / 2;
      spring.position.set(-0.35, cellY, 0.08);

      batteryGroup.add(battBody, cap, spring);
    }
  } else {
    // Empty battery compartment label
    const emptyTex = createTextTexture('EMPTY HOLDER', '#374151', '#9ca3af', 20);
    const emptyMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.0, 0.4),
      new THREE.MeshStandardMaterial({ map: emptyTex })
    );
    emptyMesh.position.set(0, -0.05, 0.07);
    batteryGroup.add(emptyMesh);
  }

  bombGroup.add(batteryGroup);

  // 4. Side Indicators (CAR, FRK, SND, CLR)
  if (bombConfig.indicators && bombConfig.indicators.length > 0) {
    const indGroup = new THREE.Group();
    indGroup.position.set(-halfW - 0.01, 0.2, 0);
    indGroup.rotation.y = -Math.PI / 2;

    bombConfig.indicators.forEach((ind, idx) => {
      const indY = -idx * 0.45;
      
      const labelTex = createTextTexture(ind.label, '#1f2937', '#f9fafb', 24);
      const labelMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.7, 0.3),
        new THREE.MeshStandardMaterial({ map: labelTex })
      );
      labelMesh.position.set(0, indY, 0);

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

  // 5. Recessed Module Bays & Modules (Dynamic Grid)
  const moduleSlotPositions = getModuleSlotPositions(count);

  moduleSlotPositions.forEach(([slotX, slotY]) => {
    const frameGeom = new THREE.BoxGeometry(2.24, 1.48, 0.04);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.8, roughness: 0.3 });
    const frame = new THREE.Mesh(frameGeom, frameMat);
    frame.position.set(slotX, slotY, 0.69);
    bombGroup.add(frame);

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

    // 4 Corner Screws per bay
    const screwGeom = new THREE.CylinderGeometry(0.04, 0.04, 0.03, 12);
    const screwMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.95, roughness: 0.1 });
    const screwOffsets = [
      [-0.98, 0.58], [0.98, 0.58],
      [-0.98, -0.58], [0.98, -0.58]
    ];
    screwOffsets.forEach(([sx, sy]) => {
      const screw = new THREE.Mesh(screwGeom, screwMat);
      screw.rotation.x = Math.PI / 2;
      screw.rotation.z = Math.random() * Math.PI;
      screw.position.set(slotX + sx, slotY + sy, 0.72);
      bombGroup.add(screw);
    });
  });

  bombConfig.modules.forEach((mod, idx) => {
    const [slotX, slotY] = moduleSlotPositions[idx] || [0, 0];
    if (mod.type === 'wires') {
      assembleWiresModule(mod, slotX, slotY, idx);
    } else if (mod.type === 'button') {
      assembleButtonModule(mod, slotX, slotY, idx);
    } else if (mod.type === 'keypad') {
      assembleKeypadModule(mod, slotX, slotY, idx);
    } else if (mod.type === 'simon') {
      assembleSimonModule(mod, slotX, slotY, idx);
    } else if (mod.type === 'morse') {
      assembleMorseModule(mod, slotX, slotY, idx);
    } else if (mod.type === 'memory') {
      assembleMemoryModule(mod, slotX, slotY, idx);
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
function addStatusLED(parent, x, y, type, moduleIndex = 0) {
  const ledGeom = new THREE.BoxGeometry(0.12, 0.12, 0.05);
  const ledMat = new THREE.MeshStandardMaterial({
    color: 0x3f0a0a, // dark red unlit
    emissive: 0x1e0303,
    roughness: 0.1
  });
  const led = new THREE.Mesh(ledGeom, ledMat);
  led.position.set(x, y, 0.03);
  parent.add(led);
  moduleStatusLights.push({ mesh: led, type, moduleIndex });
}

// WIRES MODULE
function assembleWiresModule(mod, posX = -1.3, posY = 0.75, moduleIndex = 0) {
  const group = new THREE.Group();
  group.position.set(posX, posY, 0.7);

  // Background module plate
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 1.35, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.8 })
  );
  group.add(plate);

  addStatusLED(group, 0.85, 0.5, 'wires', moduleIndex);

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
    wireGroup.userData = { isWire: true, wireIndex: idx, moduleIndex, cut: false };

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
    wireCylinder.userData = { parentGroup: wireGroup, wireIndex: idx, moduleIndex };

    group.add(wireGroup);
  });

  bombGroup.add(group);
}

// BUTTON MODULE
function assembleButtonModule(mod, posX = 1.3, posY = 0.75, moduleIndex = 0) {
  const group = new THREE.Group();
  group.position.set(posX, posY, 0.7);

  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 1.35, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.8 })
  );
  group.add(plate);

  addStatusLED(group, 0.85, 0.5, 'button', moduleIndex);

  const stripGeom = new THREE.BoxGeometry(0.12, 0.8, 0.04);
  const btnLedStripMat = new THREE.MeshStandardMaterial({
    color: 0x1c1917,
    roughness: 0.2
  });
  const ledStrip = new THREE.Mesh(stripGeom, btnLedStripMat);
  ledStrip.position.set(0.65, 0, 0.03);
  group.add(ledStrip);

  const buttonGroup = new THREE.Group();
  buttonGroup.position.set(-0.25, 0, 0.03);
  buttonGroup.userData = { isButton: true, moduleIndex, ledStripMat: btnLedStripMat };

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
  innerButton.userData = { isButtonFace: true, parentGroup: buttonGroup, moduleIndex };

  group.add(buttonGroup);
  bombGroup.add(group);
}

// KEYPAD MODULE
function assembleKeypadModule(mod, posX = -1.3, posY = -0.75, moduleIndex = 0) {
  const group = new THREE.Group();
  group.position.set(posX, posY, 0.7);

  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 1.35, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.8 })
  );
  group.add(plate);

  addStatusLED(group, 0.85, 0.5, 'keypad', moduleIndex);

  const buttonGrid = [
    [-0.45, 0.22], [0.2, 0.22],
    [-0.45, -0.28], [0.2, -0.28]
  ];

  mod.symbols.forEach((symbol, idx) => {
    const [x, y] = buttonGrid[idx];
    
    const keyGroup = new THREE.Group();
    keyGroup.position.set(x, y, 0.04);
    keyGroup.userData = { isKeypadKey: true, symbol, moduleIndex };

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
    keyMesh.userData = { isKeypadFace: true, parentGroup: keyGroup, symbol, moduleIndex };

    group.add(keyGroup);
  });

  bombGroup.add(group);
}

// SIMON SAYS MODULE
let simonButtons = [];

function triggerSimonFlash(sequence, stage, moduleIndex = 0) {
  let delay = 0;
  for (let i = 0; i < stage; i++) {
    const color = sequence[i];
    setTimeout(() => {
      flashSimonButton(color, moduleIndex, 350);
    }, delay);
    delay += 550;
  }
}

function flashSimonButton(colorName, moduleIndex = 0, durationMs = 350) {
  const btnObj = simonButtons.find(b => b.color === colorName && b.moduleIndex === moduleIndex);
  if (!btnObj) return;

  btnObj.mesh.material.emissive.setHex(btnObj.flashHex);
  btnObj.mesh.material.color.setHex(btnObj.flashHex);
  playSound(sndClick, 'click');

  setTimeout(() => {
    btnObj.mesh.material.emissive.setHex(0x000000);
    btnObj.mesh.material.color.setHex(btnObj.defaultHex);
  }, durationMs);
}

function assembleSimonModule(mod, posX = 1.3, posY = -0.75, moduleIndex = 0) {
  const group = new THREE.Group();
  group.position.set(posX, posY, 0.7);

  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 1.35, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.8 })
  );
  group.add(plate);

  addStatusLED(group, 0.85, 0.5, 'simon', moduleIndex);

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
    keyMesh.userData = { isSimonFace: true, color: cfg.color, moduleIndex };

    simonButtons.push({
      mesh: keyMesh,
      color: cfg.color,
      defaultHex: cfg.defaultHex,
      flashHex: cfg.flashHex,
      moduleIndex
    });

    group.add(keyGroup);
  });

  bombGroup.add(group);
}

// MORSE CODE MODULE
const VALID_MORSE_FREQS = [
  '3.505', '3.515', '3.522', '3.532', '3.535', '3.542', '3.545', '3.552',
  '3.555', '3.565', '3.572', '3.575', '3.582', '3.592', '3.595', '3.600'
];

let morseLeds = {};
let morseIntervals = {};
let morseState = {};

function clearAllMorseLoops() {
  Object.keys(morseIntervals).forEach(modIdx => {
    clearInterval(morseIntervals[modIdx]);
  });
  morseIntervals = {};
  morseLeds = {};
}

function startMorseLoop(moduleIndex, morsePattern) {
  if (morseIntervals[moduleIndex]) clearInterval(morseIntervals[moduleIndex]);
  const units = [];
  morsePattern.split('').forEach(ch => {
    if (ch === '.') { units.push(true); }
    else if (ch === '-') { units.push(true, true, true); }
    else if (ch === ' ') { units.push(false, false, false); }
    units.push(false);
  });
  units.push(false, false, false, false, false, false, false);

  let step = 0;
  morseIntervals[moduleIndex] = setInterval(() => {
    const isLit = units[step % units.length];
    const ledMesh = morseLeds[moduleIndex];
    if (ledMesh && ledMesh.material) {
      ledMesh.material.color.setHex(isLit ? 0xffd166 : 0x111827);
      ledMesh.material.emissive.setHex(isLit ? 0xf0b429 : 0x000000);
    }
    step++;
  }, 220);
}

function updateMorseLcdMesh(group, freqStr) {
  const lcdMesh = group.getObjectByName('morse_lcd_mesh');
  if (lcdMesh) {
    const tex = createTextTexture(freqStr + ' MHz', '#0b0d0a', '#f0b429', 24);
    lcdMesh.material.map = tex;
    lcdMesh.material.needsUpdate = true;
  }
}

function assembleMorseModule(mod, posX = 0, posY = 0.75, moduleIndex = 0) {
  const group = new THREE.Group();
  group.position.set(posX, posY, 0.7);

  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 1.35, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.8 })
  );
  group.add(plate);

  addStatusLED(group, 0.85, 0.5, 'morse', moduleIndex);

  const morseLedGeom = new THREE.CylinderGeometry(0.1, 0.1, 0.06, 24);
  const morseLedMat = new THREE.MeshStandardMaterial({ color: 0x111827, emissive: 0x000000, roughness: 0.2 });
  const morseLed = new THREE.Mesh(morseLedGeom, morseLedMat);
  morseLed.rotation.x = Math.PI / 2;
  morseLed.position.set(-0.7, 0.35, 0.04);
  group.add(morseLed);
  morseLeds[moduleIndex] = morseLed;

  morseState[moduleIndex] = { freqIdx: 0 };
  const lcdTex = createTextTexture('3.505 MHz', '#0b0d0a', '#f0b429', 24);
  const lcdGeom = new THREE.PlaneGeometry(1.0, 0.35);
  const lcdMat = new THREE.MeshStandardMaterial({ map: lcdTex, roughness: 0.3 });
  const lcdMesh = new THREE.Mesh(lcdGeom, lcdMat);
  lcdMesh.name = 'morse_lcd_mesh';
  lcdMesh.position.set(0.1, 0.35, 0.04);
  group.add(lcdMesh);

  const btnGeom = new THREE.BoxGeometry(0.35, 0.3, 0.06);
  const txMinusTex = createTextTexture('TX-', '#374151', '#f9fafb', 26);
  const txMinusMesh = new THREE.Mesh(btnGeom, new THREE.MeshStandardMaterial({ map: txMinusTex }));
  txMinusMesh.position.set(-0.5, -0.2, 0.04);
  txMinusMesh.userData = { isMorseTxMinus: true, moduleIndex, parentGroup: group };
  group.add(txMinusMesh);
  interactiveObjects.push(txMinusMesh);

  const txPlusTex = createTextTexture('TX+', '#374151', '#f9fafb', 26);
  const txPlusMesh = new THREE.Mesh(btnGeom, new THREE.MeshStandardMaterial({ map: txPlusTex }));
  txPlusMesh.position.set(-0.1, -0.2, 0.04);
  txPlusMesh.userData = { isMorseTxPlus: true, moduleIndex, parentGroup: group };
  group.add(txPlusMesh);
  interactiveObjects.push(txPlusMesh);

  const submitGeom = new THREE.BoxGeometry(0.7, 0.3, 0.06);
  const submitTex = createTextTexture('SUBMIT', '#065f46', '#ffffff', 22);
  const submitMesh = new THREE.Mesh(submitGeom, new THREE.MeshStandardMaterial({ map: submitTex }));
  submitMesh.position.set(0.5, -0.2, 0.04);
  submitMesh.userData = { isMorseSubmit: true, moduleIndex, parentGroup: group };
  group.add(submitMesh);
  interactiveObjects.push(submitMesh);

  bombGroup.add(group);

  startMorseLoop(moduleIndex, mod.morsePattern);
}

// MEMORY MODULE
let memoryState = {};

function updateMemoryModuleVisuals(group, stage, displayDigit, labels) {
  for (let i = 1; i <= 5; i++) {
    const stageLed = group.getObjectByName(`mem_stage_led_${i}`);
    if (stageLed) {
      const isLit = i < stage;
      stageLed.material.color.setHex(isLit ? 0x10b981 : 0x18181b);
      stageLed.material.emissive.setHex(isLit ? 0x10b981 : 0x000000);
    }
  }

  const displayMesh = group.getObjectByName('mem_display_mesh');
  if (displayMesh) {
    const tex = createTextTexture(String(displayDigit), '#080a08', '#f0b429', 42);
    displayMesh.material.map = tex;
    displayMesh.material.needsUpdate = true;
  }

  labels.forEach((label, idx) => {
    const btnMesh = group.getObjectByName(`mem_btn_mesh_${idx + 1}`);
    if (btnMesh) {
      const tex = createTextTexture(String(label), '#1f2937', '#f9fafb', 32);
      btnMesh.material.map = tex;
      btnMesh.material.needsUpdate = true;
      btnMesh.userData.label = label;
    }
  });
}

function assembleMemoryModule(mod, posX = 0, posY = -0.75, moduleIndex = 0) {
  const group = new THREE.Group();
  group.position.set(posX, posY, 0.7);

  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 1.35, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.8 })
  );
  group.add(plate);

  addStatusLED(group, 0.85, 0.5, 'memory', moduleIndex);

  for (let i = 1; i <= 5; i++) {
    const sLedGeom = new THREE.BoxGeometry(0.1, 0.08, 0.04);
    const sLedMat = new THREE.MeshStandardMaterial({ color: i < mod.stage ? 0x10b981 : 0x18181b, emissive: i < mod.stage ? 0x10b981 : 0x000000 });
    const sLed = new THREE.Mesh(sLedGeom, sLedMat);
    sLed.name = `mem_stage_led_${i}`;
    sLed.position.set(-0.75 + (i * 0.18), 0.5, 0.04);
    group.add(sLed);
  }

  const dispTex = createTextTexture(String(mod.displayDigit || '1'), '#080a08', '#f0b429', 42);
  const dispGeom = new THREE.PlaneGeometry(0.65, 0.45);
  const dispMat = new THREE.MeshStandardMaterial({ map: dispTex, roughness: 0.3 });
  const dispMesh = new THREE.Mesh(dispGeom, dispMat);
  dispMesh.name = 'mem_display_mesh';
  dispMesh.position.set(-0.4, 0.1, 0.04);
  group.add(dispMesh);

  const buttonGridX = [-0.6, -0.2, 0.2, 0.6];
  const initialLabels = mod.labels || [1, 2, 3, 4];

  initialLabels.forEach((label, idx) => {
    const x = buttonGridX[idx];
    const btnGeom = new THREE.BoxGeometry(0.35, 0.35, 0.06);
    const btnTex = createTextTexture(String(label), '#1f2937', '#f9fafb', 32);
    const btnMesh = new THREE.Mesh(btnGeom, new THREE.MeshStandardMaterial({ map: btnTex }));
    btnMesh.name = `mem_btn_mesh_${idx + 1}`;
    btnMesh.position.set(x, -0.32, 0.04);
    btnMesh.userData = {
      isMemoryButton: true,
      buttonPos: idx + 1,
      label,
      moduleIndex,
      parentGroup: group
    };
    group.add(btnMesh);
    interactiveObjects.push(btnMesh);
  });

  memoryState[moduleIndex] = {
    group,
    stage: mod.stage || 1,
    displayDigit: mod.displayDigit || 1,
    labels: initialLabels
  };

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

        socket.emit('cut-wire', {
          moduleIndex: wireGroup.userData.moduleIndex,
          wireIndex: wireGroup.userData.wireIndex
        });
      }
    }
    
    // 2. The Button click/hold
    else if (hitObject.userData.isButtonFace) {
      activeInteractiveObject = hitObject;
      buttonPressStartTime = Date.now();

      // Press down animation
      const innerMesh = hitObject;
      innerMesh.position.z = 0.02; // pressed in

      socket.emit('button-action', {
        type: 'down',
        moduleIndex: hitObject.userData.moduleIndex
      });
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

      socket.emit('press-keypad', {
        moduleIndex: hitObject.userData.moduleIndex,
        symbol: hitObject.userData.symbol
      });
    }

    // 4. Simon Says click
    else if (hitObject.userData.isSimonFace) {
      activeInteractiveObject = hitObject;
      const color = hitObject.userData.color;
      flashSimonButton(color, hitObject.userData.moduleIndex, 250);
      socket.emit('press-simon', {
        moduleIndex: hitObject.userData.moduleIndex,
        color: hitObject.userData.color
      });
    }

    // 5. Morse Code TX- / TX+ / SUBMIT click
    else if (hitObject.userData.isMorseTxMinus) {
      playSound(sndClick, 'click');
      const modIdx = hitObject.userData.moduleIndex;
      const state = morseState[modIdx] || { freqIdx: 0 };
      state.freqIdx = (state.freqIdx - 1 + VALID_MORSE_FREQS.length) % VALID_MORSE_FREQS.length;
      updateMorseLcdMesh(hitObject.userData.parentGroup, VALID_MORSE_FREQS[state.freqIdx]);
    }
    else if (hitObject.userData.isMorseTxPlus) {
      playSound(sndClick, 'click');
      const modIdx = hitObject.userData.moduleIndex;
      const state = morseState[modIdx] || { freqIdx: 0 };
      state.freqIdx = (state.freqIdx + 1) % VALID_MORSE_FREQS.length;
      updateMorseLcdMesh(hitObject.userData.parentGroup, VALID_MORSE_FREQS[state.freqIdx]);
    }
    else if (hitObject.userData.isMorseSubmit) {
      playSound(sndClick, 'click');
      const modIdx = hitObject.userData.moduleIndex;
      const state = morseState[modIdx] || { freqIdx: 0 };
      const freq = VALID_MORSE_FREQS[state.freqIdx];
      socket.emit('submit-morse', { moduleIndex: modIdx, frequency: freq });
    }

    // 6. Memory Button click
    else if (hitObject.userData.isMemoryButton) {
      playSound(sndClick, 'click');
      const modIdx = hitObject.userData.moduleIndex;
      const pos = hitObject.userData.buttonPos;
      
      hitObject.position.z = 0.02;
      setTimeout(() => { hitObject.position.z = 0.04; }, 100);

      socket.emit('press-memory', { moduleIndex: modIdx, buttonPos: pos });
    }
  }
}

// Receive the strip color from server when held down
socket.on('button-strip-color', ({ moduleIndex, stripColor }) => {
  const btnObj = interactiveObjects.find(obj => obj.userData.isButtonFace && obj.userData.moduleIndex === moduleIndex);
  if (btnObj && btnObj.userData.parentGroup && btnObj.userData.parentGroup.userData.ledStripMat) {
    const mat = btnObj.userData.parentGroup.userData.ledStripMat;
    mat.color.setHex(COLOR_HEX_MAP[stripColor] || 0xffffff);
    mat.emissive.setHex(COLOR_HEX_MAP[stripColor] || 0xffffff);
  }
});

function onPointerUp(e) {
  controls.enabled = true; // Restore orbit rotation

  if (activeInteractiveObject) {
    // If it was the Big Button
    if (activeInteractiveObject.userData.isButtonFace) {
      const innerMesh = activeInteractiveObject;
      innerMesh.position.z = 0.06; // return to normal height

      // Reset LED strip light for this specific button module
      if (innerMesh.userData.parentGroup && innerMesh.userData.parentGroup.userData.ledStripMat) {
        const mat = innerMesh.userData.parentGroup.userData.ledStripMat;
        mat.color.setHex(0x1c1917);
        mat.emissive.setHex(0x000000);
      }

      const durationHeld = Date.now() - buttonPressStartTime;
      
      // Read current LED timer text for releasing logic (checks digit in ANY position)
      const timerText = ledTimer.textContent; // e.g. "04:32"

      socket.emit('button-action', {
        type: 'up',
        moduleIndex: innerMesh.userData.moduleIndex,
        duration: durationHeld,
        timerText: timerText
      });
    }

    activeInteractiveObject = null;
  }
}

function onPointerMove(e) {
  // Can add custom hover highlights here if wanted
}

// Keypad callbacks
socket.on('keypad-correct-press', ({ moduleIndex, symbol, index }) => {
  // Light up the small green LEDs above the corresponding keypad buttons
  if (!bombGroup) return;

  bombGroup.traverse(node => {
    if (node.userData && node.userData.isKeypadKey && node.userData.moduleIndex === moduleIndex && node.userData.symbol === symbol) {
      const indicator = node.userData.indicator;
      if (indicator) {
        indicator.material.color.setHex(0x10b981); // green
      }
    }
  });
});

socket.on('keypad-reset', ({ moduleIndex }) => {
  // Reset all keypad key green indicators back to black for this module
  if (!bombGroup) return;

  bombGroup.traverse(node => {
    if (node.userData && node.userData.isKeypadKey && (moduleIndex === undefined || node.userData.moduleIndex === moduleIndex)) {
      const indicator = node.userData.indicator;
      if (indicator) {
        indicator.material.color.setHex(0x111827); // black/unlit
      }
    }
  });
});

// ----------------------------------------------------
// DYNAMIC EXPLOSION & PARTICLE SYSTEM
// ----------------------------------------------------

function triggerMassiveExplosion() {
  if (!scene) return;

  // 1. Camera Shake Initial Impulse
  cameraShakeIntensity = 0.6;

  // 2. Trigger Screen Flash Overlay
  const flashEl = document.getElementById('explosion-flash');
  if (flashEl) {
    flashEl.classList.remove('active');
    void flashEl.offsetWidth; // trigger reflow
    flashEl.classList.add('active');
  }

  // 3. Trigger Screen Shake Class on App Container
  const appContainer = document.getElementById('app');
  if (appContainer) {
    appContainer.classList.remove('shake-screen');
    void appContainer.offsetWidth;
    appContainer.classList.add('shake-screen');
    setTimeout(() => {
      appContainer.classList.remove('shake-screen');
    }, 1300);
  }

  // 4. Blinding Point Light Burst at Bomb Origin
  if (!explosionLight) {
    explosionLight = new THREE.PointLight(0xff6600, 100, 25);
    explosionLight.position.set(0, 0, 0);
    scene.add(explosionLight);
  } else {
    explosionLight.intensity = 100;
    explosionLight.color.setHex(0xff6600);
  }

  // 5. Create 3D Shockwave Ring expanding outward
  const ringGeom = new THREE.RingGeometry(0.1, 0.4, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffaa44,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 1.0,
    blending: THREE.AdditiveBlending
  });
  shockwaveRing = new THREE.Mesh(ringGeom, ringMat);
  shockwaveRing.position.set(0, 0, 0.5);
  scene.add(shockwaveRing);

  // 6. Spawn 280+ Debris, Fire & Spark Particles
  const colors = [0xffffff, 0xffea00, 0xff6600, 0xef4444, 0x991b1b, 0x333333];
  for (let i = 0; i < 280; i++) {
    const geom = new THREE.SphereGeometry(0.04 + Math.random() * 0.08, 6, 6);
    const color = colors[Math.floor(Math.random() * colors.length)];
    const mat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 1.0,
      blending: color === 0x333333 ? THREE.NormalBlending : THREE.AdditiveBlending
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(
      (Math.random() - 0.5) * 0.5,
      (Math.random() - 0.5) * 0.5,
      (Math.random() - 0.5) * 0.5
    );

    // Random outward velocity vector
    const speed = 5 + Math.random() * 10;
    const phi = Math.random() * Math.PI * 2;
    const theta = Math.random() * Math.PI;
    const velocity = new THREE.Vector3(
      Math.sin(theta) * Math.cos(phi) * speed,
      Math.sin(theta) * Math.sin(phi) * speed,
      Math.cos(theta) * speed
    );

    scene.add(mesh);
    sparkParticles.push({
      mesh,
      velocity,
      life: 1.0,
      decay: 0.35 + Math.random() * 0.5
    });
  }

  // 7. Scatter/kick bomb casing
  if (bombGroup) {
    bombGroup.rotation.x += (Math.random() - 0.5) * 0.6;
    bombGroup.rotation.y += (Math.random() - 0.5) * 0.8;
  }
}

function spawnSparkBurst(pos, count = 25) {
  if (!scene) return;
  for (let i = 0; i < count; i++) {
    const geom = new THREE.SphereGeometry(0.03, 4, 4);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffcc00,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(pos);

    const speed = 2 + Math.random() * 4;
    const velocity = new THREE.Vector3(
      (Math.random() - 0.5) * speed,
      (Math.random() - 0.5) * speed,
      (Math.random() - 0.5) * speed
    );

    scene.add(mesh);
    sparkParticles.push({
      mesh,
      velocity,
      life: 1.0,
      decay: 1.5 + Math.random()
    });
  }
}

function updateSparkSystem() {
  if (!scene) return;
  const delta = 0.016;

  // Update particles
  for (let i = sparkParticles.length - 1; i >= 0; i--) {
    const p = sparkParticles[i];
    p.life -= p.decay * delta;
    
    if (p.life <= 0) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      sparkParticles.splice(i, 1);
    } else {
      p.mesh.position.addScaledVector(p.velocity, delta);
      p.mesh.material.opacity = p.life;
      p.velocity.y -= 2.0 * delta;
      p.velocity.multiplyScalar(0.96);
    }
  }

  // Update Shockwave
  if (shockwaveRing) {
    shockwaveRing.scale.addScalar(14 * delta);
    shockwaveRing.material.opacity -= 0.7 * delta;
    if (shockwaveRing.material.opacity <= 0) {
      scene.remove(shockwaveRing);
      shockwaveRing.geometry.dispose();
      shockwaveRing.material.dispose();
      shockwaveRing = null;
    }
  }

  // Update explosion light decay
  if (explosionLight && explosionLight.intensity > 0) {
    explosionLight.intensity = Math.max(0, explosionLight.intensity - 50 * delta);
  }

  // Camera Shake Decay
  if (cameraShakeIntensity > 0) {
    if (camera) {
      camera.position.x += (Math.random() - 0.5) * cameraShakeIntensity;
      camera.position.y += (Math.random() - 0.5) * cameraShakeIntensity;
      camera.position.z += (Math.random() - 0.5) * cameraShakeIntensity;
    }
    cameraShakeIntensity *= 0.91;
    if (cameraShakeIntensity < 0.005) {
      cameraShakeIntensity = 0;
    }
  }
}

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
