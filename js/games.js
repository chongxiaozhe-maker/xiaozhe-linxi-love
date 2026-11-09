(function () {
  const sb = window.loveSupabase;
  if (sb === undefined) return;

  const data = window.GAME_DATA || { truth: [], dare: [] };
  const modal = document.getElementById('gameModal');
  const modalTitle = document.getElementById('gameModalTitle');
  const closeButton = document.getElementById('closeGameModal');
  const views = Array.from(document.querySelectorAll('.game-view'));
  const toast = document.getElementById('gameToast');
  const logoutButton = document.getElementById('logoutButton');
  let toastTimer = 0;
  let truthMode = 'truth';
  let wheelBuilt = false;
  let wheelRotation = 0;
  let wheelSpinning = false;
  let wheelCards = [];
  let wheelMode = 'truth';
  let wheelSelected = -1;
  let currentUser = null;
  let currentRoom = null;
  let roomPollTimer = 0;
  let currentFlightRoom = null;
  let flightPollTimer = 0;
  let flightRolling = false;

  function text(key) {
    const node = document.querySelector('#gameMessages [data-msg="' + key + '"]');
    return node ? node.textContent : key;
  }

  function showToast(message) {
    if (toast === null) return;
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toast.classList.remove('is-visible');
    }, 2600);
  }

  function openModal(game, title) {
    modalTitle.textContent = title;
    views.forEach(function (view) {
      view.hidden = view.dataset.view !== game;
    });
    modal.classList.add('is-visible');
    modal.setAttribute('aria-hidden', 'false');
    if (game === 'truth') {
      buildWheel();
      prepareWheelDeck();
    }
    if (game === 'grid') {
      resetGrid();
    }
    if (game === 'tic') {
      openTicRoom();
    } else {
      stopRoomPolling();
    }
    if (game === 'flight') {
      openFlightRoom();
    } else {
      stopFlightPolling();
    }
  }

  function closeModal() {
    modal.classList.remove('is-visible');
    modal.setAttribute('aria-hidden', 'true');
    stopRoomPolling();
    stopFlightPolling();
  }

  document.querySelectorAll('[data-open-game]').forEach(function (button) {
    button.addEventListener('click', function () {
      const card = button.closest('.game-card');
      openModal(button.dataset.openGame, card ? card.dataset.title : '');
    });
  });

  closeButton.addEventListener('click', closeModal);
  modal.addEventListener('click', function (event) {
    if (event.target === modal) closeModal();
  });

  document.querySelectorAll('[data-truth-mode]').forEach(function (button) {
    button.addEventListener('click', function () {
      truthMode = button.dataset.truthMode;
      document.querySelectorAll('[data-truth-mode]').forEach(function (item) {
        item.classList.toggle('is-active', item === button);
      });
      if (wheelSpinning) return;
      prepareWheelDeck();
    });
  });

  function buildWheel() {
    const wheel = document.getElementById('ferrisWheel');
    if (wheel === null) return;
    if (wheelBuilt) return;
    const size = wheel.clientWidth || 340;
    const radius = size / 2 - 32;
    wheel.querySelectorAll('.wheel-spoke, .wheel-light, .wheel-cabin').forEach(function (node) {
      node.remove();
    });
    for (let i = 0; i < 8; i += 1) {
      const angle = i * 45;
      const spoke = document.createElement('span');
      spoke.className = 'wheel-spoke';
      spoke.style.width = (radius - 22) + 'px';
      spoke.style.transform = 'rotate(' + angle + 'deg)';
      wheel.appendChild(spoke);

      const light = document.createElement('span');
      light.className = 'wheel-light';
      light.style.left = '50%';
      light.style.top = '50%';
      light.style.transform = 'translate(-50%, -50%) rotate(' + angle + 'deg) translateY(-' + (size / 2 - 8) + 'px)';
      wheel.appendChild(light);

      const cabin = document.createElement('button');
      cabin.type = 'button';
      cabin.className = 'wheel-cabin';
      cabin.dataset.index = String(i);
      cabin.dataset.angle = String(angle);
      cabin.textContent = String(i + 1).padStart(2, '0');
      wheel.appendChild(cabin);
    }
    wheelBuilt = true;
    positionWheelCabins();
  }

  function positionWheelCabins() {
    const wheel = document.getElementById('ferrisWheel');
    if (wheel === null) return;
    const size = wheel.clientWidth || 340;
    const radius = size / 2 - 32;
    wheel.style.transform = 'rotate(' + wheelRotation + 'deg)';
    wheel.querySelectorAll('.wheel-cabin').forEach(function (cabin) {
      const angle = Number(cabin.dataset.angle);
      cabin.style.transform = 'rotate(' + angle + 'deg) translateY(-' + radius + 'px) rotate(' + (-angle - wheelRotation) + 'deg)';
    });
  }

  function prepareWheelDeck() {
    if (wheelSpinning) return;
    const resolved = truthMode === 'random' ? (Math.random() < 0.5 ? 'truth' : 'dare') : truthMode;
    wheelMode = resolved;
    const source = resolved === 'truth' ? (data.truth || []) : (data.dare || []);
    const deck = shuffled(source);
    wheelCards = [];
    for (let i = 0; i < 8; i += 1) {
      wheelCards.push(deck[i % deck.length] || '');
    }
    wheelSelected = -1;
    const tag = document.getElementById('truthCardTag');
    const output = document.getElementById('truthCardText');
    const button = document.getElementById('drawTruthButton');
    tag.textContent = resolved === 'truth' ? text('truth_badge') : text('dare_badge');
    output.textContent = text('wheel_ready');
    button.textContent = text('spin_wheel');
    button.disabled = false;
    document.querySelectorAll('.wheel-cabin').forEach(function (cabin) {
      cabin.classList.remove('is-selected');
    });
  }

  function spinWheel() {
    if (wheelSpinning) return;
    buildWheel();
    wheelSpinning = true;
    const button = document.getElementById('drawTruthButton');
    const output = document.getElementById('truthCardText');
    const wheel = document.getElementById('ferrisWheel');
    button.disabled = true;
    button.textContent = text('spin_wheel');
    output.textContent = text('spinning');
    wheelSelected = Math.floor(Math.random() * 8);
    const targetMod = (360 - wheelSelected * 45) % 360;
    const base = wheelRotation + 360 * 5;
    const delta = ((targetMod - (base % 360)) + 360) % 360;
    const targetRotation = base + delta;
    const startRotation = wheelRotation;
    const startTime = performance.now();
    const duration = 4400;

    function frame(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      wheelRotation = startRotation + (targetRotation - startRotation) * eased;
      positionWheelCabins();
      if (progress < 1) {
        window.requestAnimationFrame(frame);
      } else {
        wheelRotation = targetRotation;
        positionWheelCabins();
        document.querySelectorAll('.wheel-cabin').forEach(function (cabin) {
          cabin.classList.toggle('is-selected', Number(cabin.dataset.index) === wheelSelected);
        });
        output.textContent = wheelCards[wheelSelected] || '';
        button.textContent = text('spin_again');
        button.disabled = false;
        wheelSpinning = false;
      }
    }

    if (wheel === null) {
      wheelSpinning = false;
      return;
    }
    window.requestAnimationFrame(frame);
  }

  document.getElementById('drawTruthButton').addEventListener('click', spinWheel);

  function shuffled(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = copy[i];
      copy[i] = copy[j];
      copy[j] = temp;
    }
    return copy;
  }

  function resetGrid() {
    const grid = document.getElementById('nineGrid');
    grid.textContent = '';
    const truthList = shuffled(data.truth || []);
    const dareList = shuffled(data.dare || []);
    const items = [];
    for (let i = 0; i < 9; i += 1) {
      const kind = i % 2 === 0 ? 'truth' : 'dare';
      const source = kind === 'truth' ? truthList : dareList;
      items.push({ kind: kind, content: source[Math.floor(i / 2) % source.length] || '' });
    }
    items.forEach(function (item, index) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'grid-cell';
      cell.dataset.kind = item.kind;
      cell.textContent = '?';
      cell.addEventListener('click', function () {
        if (cell.classList.contains('is-open')) return;
        cell.classList.add('is-open');
        cell.textContent = '';
        const label = document.createElement('small');
        label.textContent = item.kind === 'truth' ? text('truth_badge') : text('dare_badge');
        cell.appendChild(document.createTextNode(item.content));
        cell.appendChild(label);
      });
      grid.appendChild(cell);
    });
  }

  document.getElementById('resetGridButton').addEventListener('click', resetGrid);

  function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i += 1) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  function stopRoomPolling() {
    if (roomPollTimer) {
      window.clearInterval(roomPollTimer);
      roomPollTimer = 0;
    }
  }

  function showTicLobby() {
    currentRoom = null;
    stopRoomPolling();
    const lobby = document.getElementById('ticLobby');
    const room = document.getElementById('ticRoom');
    if (lobby) lobby.hidden = false;
    if (room) room.hidden = true;
  }

  function applyRoom(room) {
    currentRoom = room;
    const lobby = document.getElementById('ticLobby');
    const roomView = document.getElementById('ticRoom');
    if (lobby) lobby.hidden = true;
    if (roomView) roomView.hidden = false;
    renderOnlineTic();
  }

  async function refreshRoom() {
    if (currentRoom === null) return;
    const result = await sb.from('game_rooms').select('*').eq('id', currentRoom.id).maybeSingle();
    if (result.error || result.data === null) {
      showToast(text('room_not_found'));
      showTicLobby();
      return;
    }
    applyRoom(result.data);
  }

  function startRoomPolling() {
    stopRoomPolling();
    refreshRoom();
    roomPollTimer = window.setInterval(refreshRoom, 1400);
  }

  function checkOnlineWinner(board) {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (board[line[0]] && board[line[0]] === board[line[1]] && board[line[0]] === board[line[2]]) {
        return board[line[0]];
      }
    }
    return '';
  }

  function renderOnlineTic() {
    if (currentRoom === null || currentUser === null) return;
    const state = currentRoom.state || {};
    const board = Array.isArray(state.board) ? state.board : Array(9).fill('');
    const role = currentRoom.host_id === currentUser.id ? 'host' : 'guest';
    const myTurn = currentRoom.status === 'playing' && state.winner === '' && (state.turn || 'host') === role;
    const boardEl = document.getElementById('ticBoard');
    const status = document.getElementById('ticStatus');
    document.getElementById('ticRoomCode').textContent = currentRoom.code;
    if (currentRoom.status === 'waiting') {
      status.textContent = text('waiting_partner');
    } else if (state.winner === 'X') {
      status.textContent = role === 'host' ? text('you_win') : text('partner_win');
    } else if (state.winner === 'O') {
      status.textContent = role === 'guest' ? text('you_win') : text('partner_win');
    } else if (state.winner === 'draw') {
      status.textContent = text('ttt_draw');
    } else if (myTurn) {
      status.textContent = text('your_turn');
    } else {
      status.textContent = text('partner_turn');
    }
    boardEl.textContent = '';
    board.forEach(function (value, index) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'tic-cell' + (value ? ' is-filled' : '') + (value === 'O' ? ' is-o' : '');
      cell.textContent = value;
      cell.addEventListener('click', function () {
        if (myTurn && value === '') onlineMove(index);
      });
      boardEl.appendChild(cell);
    });
  }

  async function onlineMove(index) {
    if (currentRoom === null || currentUser === null) return;
    const state = currentRoom.state || {};
    const role = currentRoom.host_id === currentUser.id ? 'host' : 'guest';
    const board = Array.isArray(state.board) ? state.board.slice() : Array(9).fill('');
    if (board[index] !== '') return;
    board[index] = role === 'host' ? 'X' : 'O';
    const winner = checkOnlineWinner(board);
    const draw = winner === '' && board.every(function (item) { return item !== ''; });
    const nextState = {
      board: board,
      turn: role === 'host' ? 'guest' : 'host',
      winner: winner || (draw ? 'draw' : '')
    };
    const result = await sb.from('game_rooms').update({
      state: nextState,
      status: winner || draw ? 'finished' : 'playing'
    }).eq('id', currentRoom.id).select().single();
    if (result.error) {
      showToast(text('join_room_fail'));
      return;
    }
    applyRoom(result.data);
  }

  async function resetOnlineGame() {
    if (currentRoom === null) return;
    const nextState = { board: Array(9).fill(''), turn: 'host', winner: '' };
    const result = await sb.from('game_rooms').update({
      state: nextState,
      status: currentRoom.guest_id ? 'playing' : 'waiting'
    }).eq('id', currentRoom.id).select().single();
    if (result.error) {
      showToast(text('join_room_fail'));
      return;
    }
    applyRoom(result.data);
  }

  async function createOnlineRoom() {
    if (currentUser === null) return;
    const lobby = document.getElementById('ticLobby');
    lobby.hidden = false;
    const result = await sb.from('game_rooms').insert({
      code: generateRoomCode(),
      game_type: 'tic_tac_toe',
      status: 'waiting',
      host_id: currentUser.id,
      state: { board: Array(9).fill(''), turn: 'host', winner: '' }
    }).select().single();
    if (result.error) {
      showToast(text('create_room_fail'));
      return;
    }
    applyRoom(result.data);
    startRoomPolling();
  }

  async function joinOnlineRoom() {
    if (currentUser === null) return;
    const input = document.getElementById('roomCodeInput');
    const code = input.value.trim().toUpperCase();
    if (code.length !== 6) {
      showToast(text('room_not_found'));
      return;
    }
    const found = await sb.from('game_rooms').select('*').eq('code', code).eq('game_type', 'tic_tac_toe').maybeSingle();
    if (found.error || found.data === null) {
      showToast(text('room_not_found'));
      return;
    }
    if (found.data.status === 'waiting' && found.data.host_id !== currentUser.id) {
      const joined = await sb.from('game_rooms').update({
        guest_id: currentUser.id,
        status: 'playing',
        state: { board: Array(9).fill(''), turn: 'host', winner: '' }
      }).eq('id', found.data.id).select().single();
      if (joined.error) {
        showToast(text('join_room_fail'));
        return;
      }
      applyRoom(joined.data);
      startRoomPolling();
      return;
    }
    if (found.data.host_id === currentUser.id || found.data.guest_id === currentUser.id) {
      applyRoom(found.data);
      startRoomPolling();
      return;
    }
    showToast(text('room_full'));
  }

  async function findActiveRoom() {
    if (currentUser === null) return;
    const result = await sb.from('game_rooms')
      .select('*')
      .eq('game_type', 'tic_tac_toe')
      .or('host_id.eq.' + currentUser.id + ',guest_id.eq.' + currentUser.id)
      .in('status', ['waiting', 'playing'])
      .order('created_at', { ascending: false })
      .limit(1);
    if (result.error === null && result.data.length > 0) {
      applyRoom(result.data[0]);
      startRoomPolling();
    }
  }

  async function leaveOnlineRoom() {
    if (currentRoom === null || currentUser === null) return;
    const room = currentRoom;
    if (room.host_id === currentUser.id) {
      await sb.from('game_rooms').delete().eq('id', room.id);
    } else {
      await sb.from('game_rooms').update({
        guest_id: null,
        status: 'waiting',
        state: { board: Array(9).fill(''), turn: 'host', winner: '' }
      }).eq('id', room.id);
    }
    showTicLobby();
  }

  async function copyRoomCode() {
    if (currentRoom === null) return;
    try {
      await navigator.clipboard.writeText(currentRoom.code);
      showToast(text('code_copied'));
    } catch (error) {
      showToast(currentRoom.code);
    }
  }

  function openTicRoom() {
    if (currentUser === null) return;
    if (currentRoom !== null) {
      applyRoom(currentRoom);
      startRoomPolling();
      return;
    }
    showTicLobby();
    findActiveRoom();
  }

  document.getElementById('createRoomButton').addEventListener('click', createOnlineRoom);
  document.getElementById('joinRoomButton').addEventListener('click', joinOnlineRoom);
  document.getElementById('resetTicButton').addEventListener('click', resetOnlineGame);
  document.getElementById('leaveRoomButton').addEventListener('click', leaveOnlineRoom);
  document.getElementById('copyRoomCodeButton').addEventListener('click', copyRoomCode);
  document.getElementById('roomCodeInput').addEventListener('keydown', function (event) {
    if (event.key === 'Enter') joinOnlineRoom();
  });

  function stopFlightPolling() {
    if (flightPollTimer) {
      window.clearInterval(flightPollTimer);
      flightPollTimer = 0;
    }
  }

  function flightInitialState() {
    return {
      positions: { host: 0, guest: 0 },
      turn: 'host',
      dice: 0,
      winner: '',
      skip: { host: false, guest: false },
      event: { kind: 'none', text: '' }
    };
  }

  function flightTileKind(index) {
    if (index === 0) return 'start';
    if (index === 27) return 'finish';
    const map = {
      3: 'truth', 4: 'boost', 5: 'dare', 6: 'rest', 7: 'sweet',
      9: 'back', 11: 'truth', 12: 'boost', 13: 'rest', 14: 'sweet',
      15: 'truth', 16: 'back', 18: 'dare', 19: 'boost', 20: 'rest',
      21: 'truth', 22: 'sweet', 24: 'dare', 25: 'back'
    };
    return map[index] || 'normal';
  }

  function flightTileText(kind) {
    if (kind === 'normal') return '';
    return text('flight_tile_' + kind);
  }

  function renderFlightBoard(state, role) {
    const board = document.getElementById('flightBoard');
    if (board === null) return;
    board.textContent = '';
    const order = [0, 1, 2, 3, 4, 5, 6, 13, 12, 11, 10, 9, 8, 7, 14, 15, 16, 17, 18, 19, 20, 27, 26, 25, 24, 23, 22, 21];
    const positions = state.positions || { host: 0, guest: 0 };
    const hostLabel = role === 'host' ? text('flight_you') : text('flight_partner');
    const guestLabel = role === 'guest' ? text('flight_you') : text('flight_partner');
    order.forEach(function (index) {
      const kind = flightTileKind(index);
      const tile = document.createElement('div');
      tile.className = 'flight-tile';
      tile.dataset.kind = kind;
      const number = document.createElement('span');
      number.className = 'tile-number';
      number.textContent = String(index + 1).padStart(2, '0');
      const label = document.createElement('span');
      label.className = 'tile-label';
      label.textContent = flightTileText(kind);
      tile.appendChild(number);
      tile.appendChild(label);
      const tokens = document.createElement('div');
      tokens.className = 'tile-tokens';
      if (positions.host === index) {
        const token = document.createElement('span');
        token.className = 'tile-token';
        token.textContent = hostLabel;
        tokens.appendChild(token);
      }
      if (positions.guest === index) {
        const token = document.createElement('span');
        token.className = 'tile-token guest';
        token.textContent = guestLabel;
        tokens.appendChild(token);
      }
      tile.appendChild(tokens);
      board.appendChild(tile);
    });
  }

  function renderFlightRoom() {
    if (currentFlightRoom === null || currentUser === null) return;
    const state = currentFlightRoom.state || flightInitialState();
    const role = currentFlightRoom.host_id === currentUser.id ? 'host' : 'guest';
    const myTurn = currentFlightRoom.status === 'playing' && state.winner === '' && (state.turn || 'host') === role;
    const status = document.getElementById('flightStatus');
    const roomCode = document.getElementById('flightRoomCode');
    const dice = document.getElementById('flightDice');
    const rollButton = document.getElementById('rollFlightButton');
    const eventBox = document.getElementById('flightEvent');
    if (roomCode) roomCode.textContent = currentFlightRoom.code;
    if (currentFlightRoom.status === 'waiting') {
      status.textContent = text('waiting_partner');
    } else if (state.winner === 'host') {
      status.textContent = role === 'host' ? text('flight_you_win') : text('flight_partner_win');
    } else if (state.winner === 'guest') {
      status.textContent = role === 'guest' ? text('flight_you_win') : text('flight_partner_win');
    } else if (myTurn) {
      status.textContent = text('flight_you_roll');
    } else {
      status.textContent = text('flight_wait_turn');
    }
    if (dice) dice.textContent = state.dice ? String(state.dice) : '?';
    if (rollButton) rollButton.disabled = myTurn === false || flightRolling;
    if (eventBox) {
      eventBox.textContent = '';
      const event = state.event || { kind: 'none', text: '' };
      const title = document.createElement('strong');
      title.textContent = event.kind === 'none' ? text('flight_event_none') : text('flight_event_' + event.kind);
      eventBox.appendChild(title);
      if (event.text) {
        const detail = document.createElement('span');
        detail.textContent = event.text;
        eventBox.appendChild(detail);
      }
    }
    renderFlightBoard(state, role);
  }

  function showFlightLobby() {
    currentFlightRoom = null;
    stopFlightPolling();
    const lobby = document.getElementById('flightLobby');
    const room = document.getElementById('flightRoom');
    if (lobby) lobby.hidden = false;
    if (room) room.hidden = true;
  }

  function applyFlightRoom(room) {
    currentFlightRoom = room;
    const lobby = document.getElementById('flightLobby');
    const roomView = document.getElementById('flightRoom');
    if (lobby) lobby.hidden = true;
    if (roomView) roomView.hidden = false;
    renderFlightRoom();
  }

  async function refreshFlightRoom() {
    if (currentFlightRoom === null || flightRolling) return;
    const result = await sb.from('game_rooms').select('*').eq('id', currentFlightRoom.id).maybeSingle();
    if (result.error || result.data === null) {
      showToast(text('room_not_found'));
      showFlightLobby();
      return;
    }
    applyFlightRoom(result.data);
  }

  function startFlightPolling() {
    stopFlightPolling();
    refreshFlightRoom();
    flightPollTimer = window.setInterval(refreshFlightRoom, 1400);
  }

  function computeFlightState(previous, role, dice) {
    const state = {
      positions: { host: previous.positions ? previous.positions.host : 0, guest: previous.positions ? previous.positions.guest : 0 },
      turn: previous.turn || 'host',
      dice: dice,
      winner: '',
      skip: { host: previous.skip ? previous.skip.host : false, guest: previous.skip ? previous.skip.guest : false },
      event: { kind: 'none', text: '' }
    };
    let position = Math.min(27, state.positions[role] + dice);
    const kind = flightTileKind(position);
    let event = { kind: 'none', text: '' };
    if (kind === 'truth' || kind === 'dare' || kind === 'sweet') {
      let source = data.truth || [];
      if (kind === 'dare') source = data.dare || [];
      if (kind === 'sweet') source = data.sweet || [];
      const card = source.length > 0 ? source[Math.floor(Math.random() * source.length)] : '';
      event = { kind: kind, text: card };
    } else if (kind === 'boost') {
      position = Math.min(27, position + 2);
      event = { kind: 'boost', text: '' };
    } else if (kind === 'back') {
      position = Math.max(0, position - 2);
      event = { kind: 'back', text: '' };
    } else if (kind === 'rest') {
      state.skip[role] = true;
      event = { kind: 'rest', text: '' };
    }
    state.positions[role] = position;
    state.event = event;
    if (position === 27) {
      state.winner = role;
      state.turn = role;
      return state;
    }
    let nextTurn = role === 'host' ? 'guest' : 'host';
    if (state.skip[nextTurn]) {
      state.skip[nextTurn] = false;
      nextTurn = role;
    }
    state.turn = nextTurn;
    return state;
  }

  function flightDelay(ms) {
    return new Promise(function (resolve) { window.setTimeout(resolve, ms); });
  }

  async function rollFlightDice() {
    if (currentFlightRoom === null || currentUser === null || flightRolling) return;
    const state = currentFlightRoom.state || flightInitialState();
    const role = currentFlightRoom.host_id === currentUser.id ? 'host' : 'guest';
    if (currentFlightRoom.status !== 'playing' || state.turn !== role || state.winner !== '') return;
    flightRolling = true;
    const diceBox = document.getElementById('flightDice').parentElement;
    const rollButton = document.getElementById('rollFlightButton');
    rollButton.disabled = true;
    diceBox.classList.add('is-rolling');
    const ticker = window.setInterval(function () {
      document.getElementById('flightDice').textContent = String(1 + Math.floor(Math.random() * 6));
    }, 80);
    await flightDelay(820);
    window.clearInterval(ticker);
    diceBox.classList.remove('is-rolling');
    const dice = 1 + Math.floor(Math.random() * 6);
    const nextState = computeFlightState(state, role, dice);
    const result = await sb.from('game_rooms').update({
      state: nextState,
      status: nextState.winner === '' ? 'playing' : 'finished'
    }).eq('id', currentFlightRoom.id).select().single();
    flightRolling = false;
    if (result.error) {
      showToast(text('join_room_fail'));
      renderFlightRoom();
      return;
    }
    applyFlightRoom(result.data);
  }

  async function createFlightRoom() {
    if (currentUser === null) return;
    const result = await sb.from('game_rooms').insert({
      code: generateRoomCode(),
      game_type: 'flight',
      status: 'waiting',
      host_id: currentUser.id,
      state: flightInitialState()
    }).select().single();
    if (result.error) {
      showToast(text('create_room_fail'));
      return;
    }
    applyFlightRoom(result.data);
    startFlightPolling();
  }

  async function joinFlightRoom() {
    if (currentUser === null) return;
    const input = document.getElementById('flightCodeInput');
    const code = input.value.trim().toUpperCase();
    if (code.length !== 6) {
      showToast(text('room_not_found'));
      return;
    }
    const found = await sb.from('game_rooms').select('*').eq('code', code).eq('game_type', 'flight').maybeSingle();
    if (found.error || found.data === null) {
      showToast(text('room_not_found'));
      return;
    }
    if (found.data.status === 'waiting' && found.data.host_id !== currentUser.id) {
      const joined = await sb.from('game_rooms').update({
        guest_id: currentUser.id,
        status: 'playing',
        state: flightInitialState()
      }).eq('id', found.data.id).select().single();
      if (joined.error) {
        showToast(text('join_room_fail'));
        return;
      }
      applyFlightRoom(joined.data);
      startFlightPolling();
      return;
    }
    if (found.data.host_id === currentUser.id || found.data.guest_id === currentUser.id) {
      applyFlightRoom(found.data);
      startFlightPolling();
      return;
    }
    showToast(text('room_full'));
  }

  async function resetFlightGame() {
    if (currentFlightRoom === null) return;
    const result = await sb.from('game_rooms').update({
      state: flightInitialState(),
      status: currentFlightRoom.guest_id ? 'playing' : 'waiting'
    }).eq('id', currentFlightRoom.id).select().single();
    if (result.error) {
      showToast(text('join_room_fail'));
      return;
    }
    applyFlightRoom(result.data);
  }

  async function leaveFlightRoom() {
    if (currentFlightRoom === null || currentUser === null) return;
    const room = currentFlightRoom;
    if (room.host_id === currentUser.id) {
      await sb.from('game_rooms').delete().eq('id', room.id);
    } else {
      await sb.from('game_rooms').update({
        guest_id: null,
        status: 'waiting',
        state: flightInitialState()
      }).eq('id', room.id);
    }
    showFlightLobby();
  }

  async function copyFlightCode() {
    if (currentFlightRoom === null) return;
    try {
      await navigator.clipboard.writeText(currentFlightRoom.code);
      showToast(text('code_copied'));
    } catch (error) {
      showToast(currentFlightRoom.code);
    }
  }

  async function findActiveFlightRoom() {
    if (currentUser === null) return;
    const result = await sb.from('game_rooms')
      .select('*')
      .eq('game_type', 'flight')
      .or('host_id.eq.' + currentUser.id + ',guest_id.eq.' + currentUser.id)
      .in('status', ['waiting', 'playing'])
      .order('created_at', { ascending: false })
      .limit(1);
    if (result.error === null && result.data.length > 0) {
      applyFlightRoom(result.data[0]);
      startFlightPolling();
    }
  }

  function openFlightRoom() {
    if (currentUser === null) return;
    if (currentFlightRoom !== null) {
      applyFlightRoom(currentFlightRoom);
      startFlightPolling();
      return;
    }
    showFlightLobby();
    findActiveFlightRoom();
  }

  document.getElementById('createFlightButton').addEventListener('click', createFlightRoom);
  document.getElementById('joinFlightButton').addEventListener('click', joinFlightRoom);
  document.getElementById('rollFlightButton').addEventListener('click', rollFlightDice);
  document.getElementById('resetFlightButton').addEventListener('click', resetFlightGame);
  document.getElementById('leaveFlightButton').addEventListener('click', leaveFlightRoom);
  document.getElementById('copyFlightCodeButton').addEventListener('click', copyFlightCode);
  document.getElementById('flightCodeInput').addEventListener('keydown', function (event) {
    if (event.key === 'Enter') joinFlightRoom();
  });

  if (logoutButton) {
    logoutButton.addEventListener('click', async function () {
      logoutButton.disabled = true;
      await sb.auth.signOut();
      window.location.href = 'login.html';
    });
  }

  sb.auth.getSession().then(function (result) {
    if (result.data.session === null) {
      showToast(text('login'));
      window.setTimeout(function () { window.location.replace('login.html'); }, 500);
      return;
    }
    currentUser = result.data.session.user;
    showToast(text('loading'));
  });
})();
