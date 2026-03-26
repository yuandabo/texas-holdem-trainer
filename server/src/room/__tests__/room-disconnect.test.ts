import { Room } from '../room.model';

describe('Room.handleDisconnect', () => {
  let room: Room;

  beforeEach(() => {
    room = new Room();
    room.addPlayer('socket-1');
    room.addPlayer('socket-2');
  });

  it('should mark player as disconnected with a timestamp', () => {
    const before = Date.now();
    const player = room.handleDisconnect('socket-1');
    const after = Date.now();

    expect(player).toBeDefined();
    expect(player!.connected).toBe(false);
    expect(player!.disconnectedAt).toBeGreaterThanOrEqual(before);
    expect(player!.disconnectedAt).toBeLessThanOrEqual(after);
  });

  it('should preserve player session (role, socketId)', () => {
    const player = room.handleDisconnect('socket-1');

    expect(player!.role).toBe('player');
    expect(player!.socketId).toBe('socket-1');
    // Player still exists in the map
    expect(room.players.get('socket-1')).toBe(player);
    expect(room.players.size).toBe(2);
  });

  it('should return undefined for unknown socketId', () => {
    const result = room.handleDisconnect('unknown-socket');
    expect(result).toBeUndefined();
  });

  it('should not affect the other player', () => {
    room.handleDisconnect('socket-1');
    const opponent = room.players.get('socket-2');

    expect(opponent!.connected).toBe(true);
    expect(opponent!.disconnectedAt).toBeNull();
  });
});

describe('Room.handleReconnect', () => {
  let room: Room;

  beforeEach(() => {
    room = new Room();
    room.addPlayer('socket-1');
    room.addPlayer('socket-2');
  });

  it('should succeed with valid oldSocketId and update to new socketId', () => {
    room.handleDisconnect('socket-1');
    const player = room.handleReconnect('socket-1', 'socket-1-new');

    expect(player).not.toBeNull();
    expect(player!.socketId).toBe('socket-1-new');
    expect(player!.connected).toBe(true);
    expect(player!.disconnectedAt).toBeNull();
  });

  it('should update the players Map key to new socketId', () => {
    room.handleDisconnect('socket-1');
    room.handleReconnect('socket-1', 'socket-1-new');

    expect(room.players.has('socket-1')).toBe(false);
    expect(room.players.has('socket-1-new')).toBe(true);
    expect(room.players.size).toBe(2);
  });

  it('should preserve the player role after reconnect', () => {
    room.handleDisconnect('socket-1');
    const player = room.handleReconnect('socket-1', 'socket-1-new');

    expect(player!.role).toBe('player');
  });

  it('should return null if oldSocketId is not found', () => {
    const result = room.handleReconnect('unknown-socket', 'new-socket');
    expect(result).toBeNull();
  });

  it('should return null if reconnect timeout (30s) exceeded', () => {
    room.handleDisconnect('socket-1');

    // Simulate timeout by manually setting disconnectedAt to 31 seconds ago
    const player = room.players.get('socket-1')!;
    player.disconnectedAt = Date.now() - 31_000;

    const result = room.handleReconnect('socket-1', 'socket-1-new');
    expect(result).toBeNull();
    // Player should still be in the map with old socketId (not removed)
    expect(room.players.has('socket-1')).toBe(true);
  });

  it('should succeed if reconnect is within 30s timeout', () => {
    room.handleDisconnect('socket-1');

    // Simulate reconnect at 29 seconds (within timeout)
    const player = room.players.get('socket-1')!;
    player.disconnectedAt = Date.now() - 29_000;

    const result = room.handleReconnect('socket-1', 'socket-1-new');
    expect(result).not.toBeNull();
    expect(result!.connected).toBe(true);
  });
});

describe('Game state during disconnect/reconnect', () => {
  it('should not change game state when a player disconnects', () => {
    const room = new Room();
    room.addPlayer('socket-1');
    room.addPlayer('socket-2');
    room.startNewHand();

    const stateBefore = { ...room.state };

    room.handleDisconnect('socket-1');

    expect(room.state.phase).toBe(stateBefore.phase);
    expect(room.state.handNumber).toBe(stateBefore.handNumber);
    expect(room.state.chipState).toEqual(stateBefore.chipState);
    expect(room.state.communityCards).toEqual(stateBefore.communityCards);
    expect(room.state.isGameOver).toBe(stateBefore.isGameOver);
  });

  it('should not change game state when a player reconnects', () => {
    const room = new Room();
    room.addPlayer('socket-1');
    room.addPlayer('socket-2');
    room.startNewHand();

    room.handleDisconnect('socket-1');
    const stateBefore = { ...room.state };

    room.handleReconnect('socket-1', 'socket-1-new');

    expect(room.state.phase).toBe(stateBefore.phase);
    expect(room.state.handNumber).toBe(stateBefore.handNumber);
    expect(room.state.chipState).toEqual(stateBefore.chipState);
    expect(room.state.communityCards).toEqual(stateBefore.communityCards);
    expect(room.state.isGameOver).toBe(stateBefore.isGameOver);
  });
});
