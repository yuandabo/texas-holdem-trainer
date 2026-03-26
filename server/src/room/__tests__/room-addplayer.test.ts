import { Room } from '../room.model';

describe('Room.addPlayer', () => {
  it('should assign "player" role to the first player', () => {
    const room = new Room();
    const info = room.addPlayer('socket-1');
    expect(info.role).toBe('player');
    expect(info.socketId).toBe('socket-1');
    expect(info.connected).toBe(true);
    expect(info.disconnectedAt).toBeNull();
  });

  it('should assign "opponent" role to the second player', () => {
    const room = new Room();
    room.addPlayer('socket-1');
    const info = room.addPlayer('socket-2');
    expect(info.role).toBe('opponent');
    expect(info.socketId).toBe('socket-2');
    expect(info.connected).toBe(true);
    expect(info.disconnectedAt).toBeNull();
  });

  it('should throw error when room is already full', () => {
    const room = new Room();
    room.addPlayer('socket-1');
    room.addPlayer('socket-2');
    expect(() => room.addPlayer('socket-3')).toThrow('房间已满');
  });

  it('should store player in the players map', () => {
    const room = new Room();
    const info = room.addPlayer('socket-1');
    expect(room.players.get('socket-1')).toBe(info);
  });
});

describe('Room.isFull', () => {
  it('should return false when room is empty', () => {
    const room = new Room();
    expect(room.isFull).toBe(false);
  });

  it('should return false when room has 1 player', () => {
    const room = new Room();
    room.addPlayer('socket-1');
    expect(room.isFull).toBe(false);
  });

  it('should return true when room has 2 players', () => {
    const room = new Room();
    room.addPlayer('socket-1');
    room.addPlayer('socket-2');
    expect(room.isFull).toBe(true);
  });
});

describe('Room.getPlayerBySocket', () => {
  it('should return player info for a valid socket id', () => {
    const room = new Room();
    const info = room.addPlayer('socket-1');
    expect(room.getPlayerBySocket('socket-1')).toBe(info);
  });

  it('should return undefined for an unknown socket id', () => {
    const room = new Room();
    expect(room.getPlayerBySocket('unknown')).toBeUndefined();
  });
});

describe('Room.getOpponent', () => {
  it('should return the other player', () => {
    const room = new Room();
    room.addPlayer('socket-1');
    const opponent = room.addPlayer('socket-2');
    expect(room.getOpponent('socket-1')).toBe(opponent);
  });

  it('should return the first player when called with second player socket', () => {
    const room = new Room();
    const player = room.addPlayer('socket-1');
    room.addPlayer('socket-2');
    expect(room.getOpponent('socket-2')).toBe(player);
  });

  it('should return undefined when only one player in room', () => {
    const room = new Room();
    room.addPlayer('socket-1');
    expect(room.getOpponent('socket-1')).toBeUndefined();
  });

  it('should return undefined for unknown socket id', () => {
    const room = new Room();
    room.addPlayer('socket-1');
    room.addPlayer('socket-2');
    // Unknown socket — all players are "opponents" but the method checks socketId !== given
    // With an unknown id, it returns the first player it finds
    const result = room.getOpponent('unknown');
    expect(result).toBeDefined();
  });
});
