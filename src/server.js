import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const PORT = process.env.PORT || 3020;

app.use(express.static(path.join(__dirname, '../public')));

// Global state for rooms
const rooms = new Map();

// Helper to generate room code
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // Ensure uniqueness
  if (rooms.has(code)) return generateRoomCode();
  return code;
}

// Generate serial number ending with a digit
function generateSerialNumber() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  let sn = '';
  // e.g. 3 letters, 2 digits, ends in digit
  for (let i = 0; i < 3; i++) sn += letters.charAt(Math.floor(Math.random() * letters.length));
  for (let i = 0; i < 2; i++) sn += digits.charAt(Math.floor(Math.random() * digits.length));
  sn += digits.charAt(Math.floor(Math.random() * digits.length)); // ends in digit
  return sn;
}

// Keypad Columns for modules (3 distinct columns matching KTANE mechanics)
const KEYPAD_COLUMNS = [
  ["Ϙ", "Ψ", "λ", "★", "Ҩ", "Ω", "☺"], // Column 1
  ["Ϡ", "Ϙ", "϶", "Ҁ", "★", "Ͽ", "¶"], // Column 2
  ["©", "Ѭ", "Ҁ", "Җ", "Ѯ", "λ", "϶"]  // Column 3
];

// Generate Wires Module logic
function generateWiresModule(serialNumber) {
  const colors = ["red", "blue", "yellow", "white", "black"];
  const wireCount = Math.floor(Math.random() * 3) + 3; // 3 to 5 wires
  const wireColors = [];
  for (let i = 0; i < wireCount; i++) {
    wireColors.push(colors[Math.floor(Math.random() * colors.length)]);
  }

  const lastDigit = parseInt(serialNumber[serialNumber.length - 1], 10);
  const isSerialOdd = lastDigit % 2 !== 0;

  let correctCutIndex = 0;

  if (wireCount === 3) {
    const redCount = wireColors.filter(c => c === 'red').length;
    const blueCount = wireColors.filter(c => c === 'blue').length;
    if (redCount === 0) {
      correctCutIndex = 1; // 2nd wire
    } else if (wireColors[2] === 'white') {
      correctCutIndex = 2; // last wire
    } else if (blueCount > 1) {
      // Last blue wire
      correctCutIndex = wireColors.lastIndexOf('blue');
    } else {
      correctCutIndex = 2; // last wire
    }
  } else if (wireCount === 4) {
    const redCount = wireColors.filter(c => c === 'red').length;
    const blueCount = wireColors.filter(c => c === 'blue').length;
    const yellowCount = wireColors.filter(c => c === 'yellow').length;

    if (redCount > 1 && isSerialOdd) {
      correctCutIndex = wireColors.lastIndexOf('red');
    } else if (wireColors[3] === 'yellow' && redCount === 0) {
      correctCutIndex = 0; // first wire
    } else if (blueCount === 1) {
      correctCutIndex = 0; // first wire
    } else if (yellowCount > 1) {
      correctCutIndex = 3; // last wire
    } else {
      correctCutIndex = 1; // second wire
    }
  } else if (wireCount === 5) {
    const redCount = wireColors.filter(c => c === 'red').length;
    const yellowCount = wireColors.filter(c => c === 'yellow').length;
    const blackCount = wireColors.filter(c => c === 'black').length;

    if (wireColors[4] === 'black' && isSerialOdd) {
      correctCutIndex = 3; // fourth wire
    } else if (redCount === 1 && yellowCount > 1) {
      correctCutIndex = 0; // first wire
    } else if (blackCount === 0) {
      correctCutIndex = 1; // second wire
    } else {
      correctCutIndex = 0; // first wire
    }
  }

  return {
    type: 'wires',
    colors: wireColors,
    correctCutIndex,
    solved: false
  };
}

// Generate Button Module logic
function generateButtonModule(batteries) {
  const texts = ["Abort", "Detonate", "Hold", "Press"];
  const colors = ["blue", "white", "yellow", "red"];
  const text = texts[Math.floor(Math.random() * texts.length)];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const stripColor = colors[Math.floor(Math.random() * colors.length)];

  // Determine correct action: 'tap' or 'hold'
  let correctAction = 'hold';
  if (color === 'blue' && text === 'Abort') {
    correctAction = 'hold';
  } else if (text === 'Detonate') {
    correctAction = 'tap';
  } else if (color === 'white' && batteries >= 2) {
    correctAction = 'tap';
  } else {
    correctAction = 'hold';
  }

  return {
    type: 'button',
    text,
    color,
    stripColor,
    correctAction,
    solved: false
  };
}

// Generate Keypad Module logic
function generateKeypadModule() {
  // 1. Pick a random column from the available columns
  const colIndex = Math.floor(Math.random() * KEYPAD_COLUMNS.length);
  const column = KEYPAD_COLUMNS[colIndex];

  // 2. Select 4 random unique glyphs from this column
  const chosenIndices = [];
  while (chosenIndices.length < 4) {
    const idx = Math.floor(Math.random() * column.length);
    if (!chosenIndices.includes(idx)) {
      chosenIndices.push(idx);
    }
  }

  // 3. Correct order is top-to-bottom in column (sorted ascending index)
  chosenIndices.sort((a, b) => a - b);
  const correctOrderSymbols = chosenIndices.map(idx => column[idx]);

  // 4. Scramble display order on keypad buttons
  const displaySymbols = [...correctOrderSymbols].sort(() => Math.random() - 0.5);

  return {
    type: 'keypad',
    symbols: displaySymbols, // layout on the keypad
    correctOrder: correctOrderSymbols, // the order they should be pressed
    pressed: [], // symbols pressed correctly so far
    solved: false
  };
}

// Check if Serial Number contains vowels (A, E, I, O, U)
function hasVowel(serialNumber) {
  return /[AEIOU]/i.test(serialNumber);
}

// Simon Says mapping table
function getSimonMappedColor(flashColor, strikes, vowel) {
  const s = Math.min(strikes, 2);
  if (vowel) {
    if (s === 0) {
      if (flashColor === 'red') return 'blue';
      if (flashColor === 'blue') return 'red';
      if (flashColor === 'green') return 'yellow';
      if (flashColor === 'yellow') return 'green';
    } else if (s === 1) {
      if (flashColor === 'red') return 'yellow';
      if (flashColor === 'blue') return 'green';
      if (flashColor === 'green') return 'blue';
      if (flashColor === 'yellow') return 'red';
    } else {
      if (flashColor === 'red') return 'green';
      if (flashColor === 'blue') return 'red';
      if (flashColor === 'green') return 'yellow';
      if (flashColor === 'yellow') return 'blue';
    }
  } else {
    if (s === 0) {
      if (flashColor === 'red') return 'blue';
      if (flashColor === 'blue') return 'yellow';
      if (flashColor === 'green') return 'green';
      if (flashColor === 'yellow') return 'red';
    } else if (s === 1) {
      if (flashColor === 'red') return 'red';
      if (flashColor === 'blue') return 'blue';
      if (flashColor === 'green') return 'yellow';
      if (flashColor === 'yellow') return 'green';
    } else {
      if (flashColor === 'red') return 'yellow';
      if (flashColor === 'blue') return 'green';
      if (flashColor === 'green') return 'blue';
      if (flashColor === 'yellow') return 'red';
    }
  }
  return flashColor;
}

// Generate Simon Says Module logic
function generateSimonModule() {
  const colors = ['red', 'blue', 'green', 'yellow'];
  const sequence = [];
  for (let i = 0; i < 3; i++) {
    sequence.push(colors[Math.floor(Math.random() * colors.length)]);
  }

  return {
    type: 'simon',
    sequence,
    stage: 1,
    stepInput: [],
    solved: false
  };
}

// Generate Bomb configuration
function generateBombConfig() {
  const serialNumber = generateSerialNumber();
  const batteries = Math.floor(Math.random() * 4); // 0 to 3 batteries
  
  const wires = generateWiresModule(serialNumber);
  const button = generateButtonModule(batteries);
  const keypad = generateKeypadModule();
  const simon = generateSimonModule();

  return {
    serialNumber,
    batteries,
    modules: [wires, button, keypad, simon]
  };
}

// Start Timer room loop
function startTimer(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  if (room.timerTimeout) clearTimeout(room.timerTimeout);

  const tick = () => {
    const currentRoom = rooms.get(roomCode);
    if (!currentRoom || currentRoom.gameStatus !== 'playing') return;

    currentRoom.timer.timeLeft = Math.max(0, currentRoom.timer.timeLeft - 1);

    if (currentRoom.timer.timeLeft <= 0) {
      currentRoom.gameStatus = 'exploded';
      io.to(roomCode).emit('game-over', { reason: 'timeout', strikes: currentRoom.timer.strikes });
      return;
    }

    io.to(roomCode).emit('timer-update', {
      timeLeft: currentRoom.timer.timeLeft,
      strikes: currentRoom.timer.strikes
    });

    // Speed up timer tick when strikes occur
    let delay = 1000;
    if (currentRoom.timer.strikes === 1) delay = 750; // 1.33x speed
    else if (currentRoom.timer.strikes >= 2) delay = 500; // 2x speed

    currentRoom.timerTimeout = setTimeout(tick, delay);
  };

  let delay = 1000;
  if (room.timer.strikes === 1) delay = 750;
  else if (room.timer.strikes >= 2) delay = 500;
  room.timerTimeout = setTimeout(tick, delay);
}

// Check if all modules are solved
function checkBombStatus(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  const allSolved = room.bombConfig.modules.every(m => m.solved);
  if (allSolved) {
    room.gameStatus = 'defused';
    if (room.timerTimeout) clearTimeout(room.timerTimeout);
    io.to(roomCode).emit('game-defused', { timeLeft: room.timer.timeLeft });
  }
}

// Handle strike increment
function registerStrike(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  room.timer.strikes += 1;
  io.to(roomCode).emit('strike', { strikes: room.timer.strikes });

  if (room.timer.strikes >= room.timer.maxStrikes) {
    room.gameStatus = 'exploded';
    if (room.timerTimeout) clearTimeout(room.timerTimeout);
    io.to(roomCode).emit('game-over', { reason: 'strikes', strikes: room.timer.strikes });
  } else {
    // Restart timer tick to apply speed-up immediately
    startTimer(roomCode);
  }
}

// Socket Connection
io.on('connection', (socket) => {
  let currentRoomCode = null;
  let username = '';

  // Create room
  socket.on('create-room', (name) => {
    username = name;
    const code = generateRoomCode();
    currentRoomCode = code;

    const room = {
      code,
      players: [{ id: socket.id, name, role: 'expert' }], // Creator defaults to expert
      gameStatus: 'lobby',
      bombConfig: null,
      timer: {
        duration: 300, // 5 minutes
        timeLeft: 300,
        strikes: 0,
        maxStrikes: 3
      },
      timerTimeout: null
    };

    rooms.set(code, room);
    socket.join(code);
    socket.emit('room-created', { code, players: room.players });
  });

  // Join room
  socket.on('join-room', ({ code, name }) => {
    const room = rooms.get(code.toUpperCase());
    if (!room) {
      socket.emit('error-msg', 'Room not found.');
      return;
    }

    if (room.gameStatus !== 'lobby') {
      socket.emit('error-msg', 'Game has already started in this room.');
      return;
    }

    username = name;
    currentRoomCode = room.code;
    
    // Assign role automatically to maintain balance: first joiner is expert, second defuser, etc.
    const hasDefuser = room.players.some(p => p.role === 'defuser');
    const role = hasDefuser ? 'expert' : 'defuser';

    room.players.push({ id: socket.id, name, role });
    socket.join(room.code);

    io.to(room.code).emit('room-updated', { code: room.code, players: room.players });
    socket.emit('joined-successfully', { code: room.code, players: room.players, yourId: socket.id });
  });

  // Select Role
  socket.on('select-role', (role) => {
    const room = rooms.get(currentRoomCode);
    if (!room || room.gameStatus !== 'lobby') return;

    const player = room.players.find(p => p.id === socket.id);
    if (player) {
      player.role = role;
      io.to(currentRoomCode).emit('room-updated', { code: room.code, players: room.players });
    }
  });

  // Start Game
  socket.on('start-game', () => {
    const room = rooms.get(currentRoomCode);
    if (!room || room.gameStatus !== 'lobby') return;

    // Must have at least one defuser and one expert
    const hasDefuser = room.players.some(p => p.role === 'defuser');
    const hasExpert = room.players.some(p => p.role === 'expert');

    if (!hasDefuser || !hasExpert) {
      socket.emit('error-msg', 'Need at least 1 Defuser and 1 Expert to start.');
      return;
    }

    // Init Bomb
    room.bombConfig = generateBombConfig();
    room.gameStatus = 'playing';
    room.timer.timeLeft = room.timer.duration;
    room.timer.strikes = 0;

    io.to(currentRoomCode).emit('game-started', {
      bombConfig: {
        // Send full config to Defuser, but filter answers for safety
        serialNumber: room.bombConfig.serialNumber,
        batteries: room.bombConfig.batteries,
        modules: room.bombConfig.modules.map((m, idx) => {
          if (m.type === 'wires') {
            return { type: 'wires', colors: m.colors, solved: false, index: idx };
          } else if (m.type === 'button') {
            return { type: 'button', text: m.text, color: m.color, solved: false, index: idx };
          } else if (m.type === 'keypad') {
            return { type: 'keypad', symbols: m.symbols, solved: false, index: idx };
          } else if (m.type === 'simon') {
            return { type: 'simon', sequence: m.sequence, stage: m.stage, solved: false, index: idx };
          }
        })
      },
      timer: { timeLeft: room.timer.timeLeft, strikes: room.timer.strikes }
    });

    startTimer(currentRoomCode);
  });

  // Cut Wire
  socket.on('cut-wire', (wireIndex) => {
    const room = rooms.get(currentRoomCode);
    if (!room || room.gameStatus !== 'playing') return;

    const wiresModule = room.bombConfig.modules.find(m => m.type === 'wires');
    if (!wiresModule || wiresModule.solved) return;

    if (wireIndex === wiresModule.correctCutIndex) {
      wiresModule.solved = true;
      io.to(currentRoomCode).emit('module-solved', { type: 'wires' });
      checkBombStatus(currentRoomCode);
    } else {
      registerStrike(currentRoomCode);
    }
  });

  // Press / Release Button
  socket.on('button-action', (action) => {
    // action: { type: 'down' } or { type: 'up', releaseDigit: N }
    const room = rooms.get(currentRoomCode);
    if (!room || room.gameStatus !== 'playing') return;

    const buttonModule = room.bombConfig.modules.find(m => m.type === 'button');
    if (!buttonModule || buttonModule.solved) return;

    if (action.type === 'down') {
      // Return the strip color when held
      socket.emit('button-strip-color', { stripColor: buttonModule.stripColor });
    } else if (action.type === 'up') {
      const durationHeld = action.duration || 0;

      if (buttonModule.correctAction === 'tap') {
        // Tapping should be quick (< 400ms)
        if (durationHeld < 400) {
          buttonModule.solved = true;
          io.to(currentRoomCode).emit('module-solved', { type: 'button' });
          checkBombStatus(currentRoomCode);
        } else {
          registerStrike(currentRoomCode);
        }
      } else {
        // Hold action: check if released on the correct digit
        const digit = action.releaseDigit; // e.g. 4, 1, 5
        let expectedDigit = 1;
        if (buttonModule.stripColor === 'blue') expectedDigit = 4;
        else if (buttonModule.stripColor === 'white') expectedDigit = 1;
        else if (buttonModule.stripColor === 'yellow') expectedDigit = 5;
        else expectedDigit = 1;

        if (digit === expectedDigit && durationHeld >= 400) {
          buttonModule.solved = true;
          io.to(currentRoomCode).emit('module-solved', { type: 'button' });
          checkBombStatus(currentRoomCode);
        } else {
          registerStrike(currentRoomCode);
        }
      }
    }
  });

  // Press Keypad symbol
  socket.on('press-keypad', (symbol) => {
    const room = rooms.get(currentRoomCode);
    if (!room || room.gameStatus !== 'playing') return;

    const keypadModule = room.bombConfig.modules.find(m => m.type === 'keypad');
    if (!keypadModule || keypadModule.solved) return;

    const currentExpectedIndex = keypadModule.pressed.length;
    const expectedSymbol = keypadModule.correctOrder[currentExpectedIndex];

    if (symbol === expectedSymbol) {
      keypadModule.pressed.push(symbol);
      socket.emit('keypad-correct-press', { symbol, index: keypadModule.pressed.length });
      
      if (keypadModule.pressed.length === 4) {
        keypadModule.solved = true;
        io.to(currentRoomCode).emit('module-solved', { type: 'keypad' });
        checkBombStatus(currentRoomCode);
      }
    } else {
      // Wrong press: Reset pressed keys and cause a strike
      keypadModule.pressed = [];
      socket.emit('keypad-reset');
      registerStrike(currentRoomCode);
    }
  });

  // Press Simon Says color button
  socket.on('press-simon', (color) => {
    const room = rooms.get(currentRoomCode);
    if (!room || room.gameStatus !== 'playing') return;

    const simonModule = room.bombConfig.modules.find(m => m.type === 'simon');
    if (!simonModule || simonModule.solved) return;

    const vowel = hasVowel(room.bombConfig.serialNumber);
    const strikes = room.timer.strikes;
    const stepIdx = simonModule.stepInput.length;
    const flashColor = simonModule.sequence[stepIdx];
    const expectedColor = getSimonMappedColor(flashColor, strikes, vowel);

    if (color === expectedColor) {
      simonModule.stepInput.push(color);
      
      if (simonModule.stepInput.length === simonModule.stage) {
        if (simonModule.stage === 3) {
          simonModule.solved = true;
          io.to(currentRoomCode).emit('module-solved', { type: 'simon' });
          checkBombStatus(currentRoomCode);
        } else {
          simonModule.stage += 1;
          simonModule.stepInput = [];
          io.to(currentRoomCode).emit('simon-stage-advance', { stage: simonModule.stage });
        }
      }
    } else {
      // Wrong press: Reset current stage inputs and cause a strike
      simonModule.stepInput = [];
      registerStrike(currentRoomCode);
      io.to(currentRoomCode).emit('simon-reset', { stage: simonModule.stage });
    }
  });

  // Restart Game / Return to lobby
  socket.on('restart-game', () => {
    console.log(`Server: restart-game event received from socket ${socket.id} for room code ${currentRoomCode}`);
    const room = rooms.get(currentRoomCode);
    if (!room) {
      console.log(`Server: Room not found for code ${currentRoomCode}`);
      return;
    }

    room.gameStatus = 'lobby';
    room.bombConfig = null;
    if (room.timerTimeout) {
      clearTimeout(room.timerTimeout);
      room.timerTimeout = null;
    }
    room.timer = {
      duration: 300,
      timeLeft: 300,
      strikes: 0,
      maxStrikes: 3
    };

    console.log(`Server: Room ${currentRoomCode} reset to lobby. Emitting returned-to-lobby...`);
    io.to(currentRoomCode).emit('returned-to-lobby', { players: room.players });
  });

  // Disconnect / Left room
  socket.on('disconnect', () => {
    if (currentRoomCode) {
      const room = rooms.get(currentRoomCode);
      if (room) {
        // Remove player from room
        room.players = room.players.filter(p => p.id !== socket.id);
        
        if (room.players.length === 0) {
          if (room.timerTimeout) clearTimeout(room.timerTimeout);
          rooms.delete(currentRoomCode);
        } else {
          io.to(currentRoomCode).emit('room-updated', { code: room.code, players: room.players });
          if (room.gameStatus === 'playing') {
            io.to(currentRoomCode).emit('player-left', { name: username || 'A player' });
          }
        }
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Keep Talking 3D server running on port ${PORT}`);
});
