import { GameGateway } from '../game.gateway';
import { RoomService } from '../room.service';
import { Room } from '../room.model';

// ============================================================
// Mock helpers for Socket.IO Server and Socket
// ============================================================

function createMockSocket(id: string): any {
  return {
    id,
    join: jest.fn(),
    emit: jest.fn(),
  };
}

function createMockServer(): any {
  const toEmit = jest.fn();
  return {
    to: jest.fn().mockReturnValue({ emit: toEmit }),
    _toEmit: toEmit,
  };
}

function createGateway(): { gateway: GameGateway; roomService: RoomService; server: any } {
  const roomService = new RoomService();
  const gateway = new GameGateway(roomService);
  const server = createMockServer();
  gateway.server = server;
  return { gateway, roomService, server };
}

// ============================================================
// 4.1 handleCreateRoom
// ============================================================

describe('4.1 GameGateway.handleCreateRoom()', () => {
  it('should create a room, join the Socket.IO room, and emit roomCreated', () => {
    const { gateway, roomService } = createGateway();
    const client = createMockSocket('socket-1');

    gateway.handleCreateRoom(client);

    // Room was created in the service
    const room = roomService.getRoomBySocket('socket-1');
    expect(room).toBeDefined();
    expect(room!.roomCode).toMatch(/^[A-Z0-9]{6}$/);

    // Client joined the Socket.IO room
    expect(client.join).toHaveBeenCalledWith(room!.roomCode);

    // Client received roomCreated event
    expect(client.emit).toHaveBeenCalledWith('roomCreated', {
      roomCode: room!.roomCode,
      role: 'player',
    });
  });

  it('should assign "player" role to the room creator', () => {
    const { gateway } = createGateway();
    const client = createMockSocket('socket-1');

    gateway.handleCreateRoom(client);

    expect(client.emit).toHaveBeenCalledWith(
      'roomCreated',
      expect.objectContaining({ role: 'player' }),
    );
  });
});

// ============================================================
// 4.2 handleJoinRoom
// ============================================================

describe('4.2 GameGateway.handleJoinRoom()', () => {
  it('should emit error when room code does not exist', () => {
    const { gateway } = createGateway();
    const client = createMockSocket('socket-2');

    gateway.handleJoinRoom(client, { roomCode: 'ZZZZZZ' });

    expect(client.emit).toHaveBeenCalledWith('error', { message: '房间不存在或已满' });
  });

  it('should join room and emit roomJoined with opponent role', () => {
    const { gateway, roomService } = createGateway();
    const creator = createMockSocket('socket-1');
    gateway.handleCreateRoom(creator);
    const room = roomService.getRoomBySocket('socket-1')!;

    const joiner = createMockSocket('socket-2');
    gateway.handleJoinRoom(joiner, { roomCode: room.roomCode });

    expect(joiner.join).toHaveBeenCalledWith(room.roomCode);
    expect(joiner.emit).toHaveBeenCalledWith('roomJoined', {
      roomCode: room.roomCode,
      role: 'opponent',
    });
  });

  it('should trigger game init and broadcast gameState when room is full', () => {
    const { gateway, roomService, server } = createGateway();
    const creator = createMockSocket('socket-1');
    gateway.handleCreateRoom(creator);
    const room = roomService.getRoomBySocket('socket-1')!;

    const joiner = createMockSocket('socket-2');
    gateway.handleJoinRoom(joiner, { roomCode: room.roomCode });

    // Game should have started
    expect(room.state.phase).toBe('pre_flop_betting');
    expect(room.getHandForRole('player')).toHaveLength(2);
    expect(room.getHandForRole('opponent')).toHaveLength(2);

    // broadcastState should have been called — server.to() called for each connected player
    expect(server.to).toHaveBeenCalled();
  });

  it('should emit error when room is already full', () => {
    const { gateway, roomService } = createGateway();
    const creator = createMockSocket('socket-1');
    gateway.handleCreateRoom(creator);
    const room = roomService.getRoomBySocket('socket-1')!;

    const joiner = createMockSocket('socket-2');
    gateway.handleJoinRoom(joiner, { roomCode: room.roomCode });

    const third = createMockSocket('socket-3');
    gateway.handleJoinRoom(third, { roomCode: room.roomCode });

    expect(third.emit).toHaveBeenCalledWith('error', { message: '房间不存在或已满' });
  });
});

// ============================================================
// 4.3 handlePlaceBet
// ============================================================

describe('4.3 GameGateway.handlePlaceBet()', () => {
  let gateway: GameGateway;
  let roomService: RoomService;
  let server: any;
  let room: Room;

  beforeEach(() => {
    ({ gateway, roomService, server } = createGateway());
    const creator = createMockSocket('socket-1');
    gateway.handleCreateRoom(creator);
    room = roomService.getRoomBySocket('socket-1')!;
    const joiner = createMockSocket('socket-2');
    gateway.handleJoinRoom(joiner, { roomCode: room.roomCode });
    // Clear mocks after setup
    server.to.mockClear();
    server._toEmit.mockClear();
  });

  afterEach(() => {
    room.clearActionTimer();
  });

  it('should return silently if socket is not in a room', () => {
    const stranger = createMockSocket('socket-unknown');
    gateway.handlePlaceBet(stranger, { type: 'check', amount: 0 });
    expect(stranger.emit).not.toHaveBeenCalled();
  });

  it('should emit error for invalid action (wrong actor)', () => {
    const currentActor = room.getCurrentActor()!;
    const wrongSocketId = currentActor === 'player' ? 'socket-2' : 'socket-1';
    const wrongClient = createMockSocket(wrongSocketId);

    gateway.handlePlaceBet(wrongClient, { type: 'check', amount: 0 });

    expect(wrongClient.emit).toHaveBeenCalledWith('error', { message: '无效操作' });
  });

  it('should execute valid bet and broadcast state', () => {
    const currentActor = room.getCurrentActor()!;
    const socketId = currentActor === 'player' ? 'socket-1' : 'socket-2';
    const client = createMockSocket(socketId);

    gateway.handlePlaceBet(client, { type: 'call', amount: 10 });

    // State should have changed (actor should have switched)
    expect(room.getCurrentActor()).not.toBe(currentActor);

    // broadcastState should have been called
    expect(server.to).toHaveBeenCalled();
  });

  it('should auto-start next hand after showdown with delay', () => {
    jest.useFakeTimers();
    try {
      // Play to showdown: SB calls, BB checks, then check through all rounds
      const sb = room.getCurrentActor()!;
      const sbSocket = sb === 'player' ? 'socket-1' : 'socket-2';
      gateway.handlePlaceBet(createMockSocket(sbSocket), { type: 'call', amount: 10 });

      const bb = room.getCurrentActor()!;
      const bbSocket = bb === 'player' ? 'socket-1' : 'socket-2';
      gateway.handlePlaceBet(createMockSocket(bbSocket), { type: 'check', amount: 0 });

      // flop, turn, river: both check
      for (let i = 0; i < 3; i++) {
        const a1 = room.getCurrentActor()!;
        const s1 = a1 === 'player' ? 'socket-1' : 'socket-2';
        gateway.handlePlaceBet(createMockSocket(s1), { type: 'check', amount: 0 });
        const a2 = room.getCurrentActor()!;
        const s2 = a2 === 'player' ? 'socket-1' : 'socket-2';
        gateway.handlePlaceBet(createMockSocket(s2), { type: 'check', amount: 0 });
      }

      if (room.state.phase === 'showdown') {
        const handBefore = room.state.handNumber;
        jest.advanceTimersByTime(3000);
        expect(room.state.handNumber).toBe(handBefore + 1);
        expect(room.state.phase).toBe('pre_flop_betting');
      }
    } finally {
      jest.useRealTimers();
    }
  });
});

// ============================================================
// 4.4 handleRestartGame
// ============================================================

describe('4.4 GameGateway.handleRestartGame()', () => {
  it('should restart game and broadcast state', () => {
    const { gateway, roomService, server } = createGateway();
    const creator = createMockSocket('socket-1');
    gateway.handleCreateRoom(creator);
    const room = roomService.getRoomBySocket('socket-1')!;
    const joiner = createMockSocket('socket-2');
    gateway.handleJoinRoom(joiner, { roomCode: room.roomCode });

    // Force game_over state
    room.state.phase = 'game_over';
    room.state.isGameOver = true;
    room.state.gameOverWinner = 'player';

    server.to.mockClear();
    server._toEmit.mockClear();

    gateway.handleRestartGame(createMockSocket('socket-1'));

    // Game should be restarted — new hand starts, so blinds are deducted
    expect(room.state.phase).toBe('pre_flop_betting');
    expect(room.state.isGameOver).toBe(false);
    // After restart + startNewHand, total chips = 4000 (blinds deducted but conserved)
    expect(room.state.chipState.playerChips + room.state.chipState.opponentChips)
      .toBe(4000 - 10 - 20); // minus blinds in pot
    expect(room.state.bettingRound!.pot).toBe(30);

    // broadcastState should have been called
    expect(server.to).toHaveBeenCalled();

    room.clearActionTimer();
  });

  it('should do nothing if socket is not in a room', () => {
    const { gateway, server } = createGateway();
    const stranger = createMockSocket('socket-unknown');

    server.to.mockClear();
    gateway.handleRestartGame(stranger);

    expect(server.to).not.toHaveBeenCalled();
  });
});

// ============================================================
// 4.5 handleReconnect
// ============================================================

describe('4.5 GameGateway.handleReconnect()', () => {
  it('should emit error when reconnect fails (room does not exist)', () => {
    const { gateway } = createGateway();
    const client = createMockSocket('socket-new');

    gateway.handleReconnect(client, { roomCode: 'ZZZZZZ', oldSocketId: 'socket-old' });

    expect(client.emit).toHaveBeenCalledWith('error', {
      message: '重连失败，房间不存在或已超时',
    });
  });

  it('should rebind socket, emit reconnected and broadcast gameState on success', () => {
    const { gateway, roomService, server } = createGateway();
    const creator = createMockSocket('socket-1');
    gateway.handleCreateRoom(creator);
    const room = roomService.getRoomBySocket('socket-1')!;
    const joiner = createMockSocket('socket-2');
    gateway.handleJoinRoom(joiner, { roomCode: room.roomCode });

    // Simulate disconnect
    room.handleDisconnect('socket-1');
    roomService['socketToRoom'].delete('socket-1');

    server.to.mockClear();
    server._toEmit.mockClear();

    const newClient = createMockSocket('socket-1-new');
    gateway.handleReconnect(newClient, { roomCode: room.roomCode, oldSocketId: 'socket-1' });

    // Should join the Socket.IO room
    expect(newClient.join).toHaveBeenCalledWith(room.roomCode);

    // Should emit reconnected
    expect(newClient.emit).toHaveBeenCalledWith('reconnected', { role: 'player' });

    // Should broadcast state
    expect(server.to).toHaveBeenCalled();

    room.clearActionTimer();
  });
});

// ============================================================
// 4.6 handleDisconnect
// ============================================================

describe('4.6 GameGateway.handleDisconnect()', () => {
  it('should do nothing for unknown socket', () => {
    const { gateway, server } = createGateway();
    const stranger = createMockSocket('socket-unknown');

    server.to.mockClear();
    gateway.handleDisconnect(stranger);

    expect(server.to).not.toHaveBeenCalled();
  });

  it('should notify opponent of disconnect', () => {
    const { gateway, roomService, server } = createGateway();
    const creator = createMockSocket('socket-1');
    gateway.handleCreateRoom(creator);
    const room = roomService.getRoomBySocket('socket-1')!;
    const joiner = createMockSocket('socket-2');
    gateway.handleJoinRoom(joiner, { roomCode: room.roomCode });

    server.to.mockClear();
    server._toEmit.mockClear();

    gateway.handleDisconnect(createMockSocket('socket-1'));

    // Should notify opponent (socket-2)
    expect(server.to).toHaveBeenCalledWith('socket-2');
    expect(server._toEmit).toHaveBeenCalledWith('opponentDisconnected');

    room.clearActionTimer();
  });

  it('should destroy room after 30s timeout if player does not reconnect', () => {
    jest.useFakeTimers();
    try {
      const { gateway, roomService, server } = createGateway();
      const creator = createMockSocket('socket-1');
      gateway.handleCreateRoom(creator);
      const room = roomService.getRoomBySocket('socket-1')!;
      const roomCode = room.roomCode;
      const joiner = createMockSocket('socket-2');
      gateway.handleJoinRoom(joiner, { roomCode });

      const now = Date.now();
      gateway.handleDisconnect(createMockSocket('socket-1'));

      // Room should still exist before timeout
      expect(roomService.findByCode(roomCode)).toBeDefined();

      // Mock Date.now to simulate 31 seconds passing (for hasAbandonedPlayers check)
      jest.spyOn(Date, 'now').mockReturnValue(now + 31_000);

      // Advance past 30s timeout
      jest.advanceTimersByTime(30_000);

      // Room should be destroyed
      expect(roomService.findByCode(roomCode)).toBeUndefined();

      (Date.now as jest.Mock).mockRestore();
    } finally {
      jest.useRealTimers();
    }
  });
});

// ============================================================
// 4.7 broadcastState
// ============================================================

describe('4.7 broadcastState()', () => {
  it('should send each player their own ClientView via server.to(socketId).emit', () => {
    const { gateway, roomService, server } = createGateway();
    const creator = createMockSocket('socket-1');
    gateway.handleCreateRoom(creator);
    const room = roomService.getRoomBySocket('socket-1')!;
    const joiner = createMockSocket('socket-2');
    gateway.handleJoinRoom(joiner, { roomCode: room.roomCode });

    // After join, broadcastState is called. Check that server.to was called for both players.
    const toCalls = server.to.mock.calls.map((c: any[]) => c[0]);
    expect(toCalls).toContain('socket-1');
    expect(toCalls).toContain('socket-2');

    // Each emit should be 'gameState' with a ClientView containing myRole
    const emitCalls = server._toEmit.mock.calls;
    const gameStateCalls = emitCalls.filter((c: any[]) => c[0] === 'gameState');
    expect(gameStateCalls.length).toBeGreaterThanOrEqual(2);

    // Verify the views have different myRole values
    const roles = gameStateCalls.map((c: any[]) => c[1].myRole);
    expect(roles).toContain('player');
    expect(roles).toContain('opponent');

    room.clearActionTimer();
  });

  it('should not send state to disconnected players', () => {
    const { gateway, roomService, server } = createGateway();
    const creator = createMockSocket('socket-1');
    gateway.handleCreateRoom(creator);
    const room = roomService.getRoomBySocket('socket-1')!;
    const joiner = createMockSocket('socket-2');
    gateway.handleJoinRoom(joiner, { roomCode: room.roomCode });

    // Disconnect player 1
    room.handleDisconnect('socket-1');

    server.to.mockClear();
    server._toEmit.mockClear();

    // Trigger a bet from player 2 (if it's their turn) to cause broadcastState
    const actor = room.getCurrentActor()!;
    const actorSocket = actor === 'player' ? 'socket-1' : 'socket-2';
    if (actorSocket === 'socket-2') {
      gateway.handlePlaceBet(createMockSocket('socket-2'), { type: 'call', amount: 10 });
      // server.to should only be called for socket-2 (connected), not socket-1 (disconnected)
      const toCalls = server.to.mock.calls.map((c: any[]) => c[0]);
      expect(toCalls).not.toContain('socket-1');
    }

    room.clearActionTimer();
  });
});

// ============================================================
// 4.8 startActionTimer
// ============================================================

describe('4.8 startActionTimer()', () => {
  it('should auto-check after 60s timeout when check is available', () => {
    jest.useFakeTimers();
    try {
      const { gateway, roomService, server } = createGateway();
      const creator = createMockSocket('socket-1');
      gateway.handleCreateRoom(creator);
      const room = roomService.getRoomBySocket('socket-1')!;
      const joiner = createMockSocket('socket-2');
      gateway.handleJoinRoom(joiner, { roomCode: room.roomCode });

      // Advance to flop where check is available: SB calls, BB checks
      const sb = room.getCurrentActor()!;
      const sbSocket = sb === 'player' ? 'socket-1' : 'socket-2';
      gateway.handlePlaceBet(createMockSocket(sbSocket), { type: 'call', amount: 10 });
      const bb = room.getCurrentActor()!;
      const bbSocket = bb === 'player' ? 'socket-1' : 'socket-2';
      gateway.handlePlaceBet(createMockSocket(bbSocket), { type: 'check', amount: 0 });

      // Now in flop_betting, check should be available
      expect(room.state.phase).toBe('flop_betting');
      const actorBefore = room.getCurrentActor()!;
      const actions = room.getAvailableActionsForCurrentActor();
      expect(actions).toContain('check');

      server.to.mockClear();
      server._toEmit.mockClear();

      // Advance 60s — timer should fire and auto-check
      jest.advanceTimersByTime(60_000);

      // Actor should have changed (auto-check executed)
      expect(room.getCurrentActor()).not.toBe(actorBefore);

      // broadcastState should have been called
      expect(server.to).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('should auto-fold after 60s timeout when check is not available', () => {
    jest.useFakeTimers();
    try {
      const { gateway, roomService, server } = createGateway();
      const creator = createMockSocket('socket-1');
      gateway.handleCreateRoom(creator);
      const room = roomService.getRoomBySocket('socket-1')!;
      const joiner = createMockSocket('socket-2');
      gateway.handleJoinRoom(joiner, { roomCode: room.roomCode });

      // In pre_flop_betting, SB (current actor) has call/raise/fold available (not check)
      const actor = room.getCurrentActor()!;
      const actions = room.getAvailableActionsForCurrentActor();
      // Pre-flop SB faces a bet (BB already posted), so check is not available
      // SB can call, raise, or fold
      expect(actions).not.toContain('check');

      const phaseBefore = room.state.phase;

      server.to.mockClear();
      server._toEmit.mockClear();

      // Advance 60s — timer should fire and auto-fold
      jest.advanceTimersByTime(60_000);

      // After fold, phase should be showdown (fold settlement)
      expect(room.state.phase).toBe('showdown');

      // broadcastState should have been called
      expect(server.to).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('should clear previous timer when a new bet is placed', () => {
    jest.useFakeTimers();
    try {
      const { gateway, roomService } = createGateway();
      const creator = createMockSocket('socket-1');
      gateway.handleCreateRoom(creator);
      const room = roomService.getRoomBySocket('socket-1')!;
      const joiner = createMockSocket('socket-2');
      gateway.handleJoinRoom(joiner, { roomCode: room.roomCode });

      // Place a bet before timeout
      const actor = room.getCurrentActor()!;
      const socketId = actor === 'player' ? 'socket-1' : 'socket-2';
      gateway.handlePlaceBet(createMockSocket(socketId), { type: 'call', amount: 10 });

      // The old timer should have been cleared, new timer started
      // Advance 59s — should not trigger timeout
      const actorAfterBet = room.getCurrentActor()!;
      jest.advanceTimersByTime(59_000);
      // Actor should still be the same (no timeout yet)
      expect(room.getCurrentActor()).toBe(actorAfterBet);
    } finally {
      jest.useRealTimers();
    }
  });
});
