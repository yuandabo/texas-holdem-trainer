import { RoomService } from '../room.service';
import { Room } from '../room.model';

describe('RoomService.removeRoom', () => {
  let service: RoomService;

  beforeEach(() => {
    service = new RoomService();
  });

  it('should remove the room from the rooms Map', () => {
    const room = service.createRoom();
    service.joinRoom(room.roomCode, 'socket-1');

    service.removeRoom(room.roomCode);

    expect(service.findByCode(room.roomCode)).toBeUndefined();
  });

  it('should clean up socket-to-room mappings for all players', () => {
    const room = service.createRoom();
    service.joinRoom(room.roomCode, 'socket-1');
    service.joinRoom(room.roomCode, 'socket-2');

    service.removeRoom(room.roomCode);

    expect(service.getRoomBySocket('socket-1')).toBeUndefined();
    expect(service.getRoomBySocket('socket-2')).toBeUndefined();
  });

  it('should clear action timers', () => {
    const room = service.createRoom();
    service.joinRoom(room.roomCode, 'socket-1');
    service.joinRoom(room.roomCode, 'socket-2');

    const clearSpy = jest.spyOn(room, 'clearActionTimer');
    service.removeRoom(room.roomCode);

    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('should be a no-op for a non-existent room code', () => {
    // Should not throw
    expect(() => service.removeRoom('ZZZZZZ')).not.toThrow();
  });

  it('should not affect other rooms', () => {
    const room1 = service.createRoom();
    const room2 = service.createRoom();
    service.joinRoom(room1.roomCode, 'socket-1');
    service.joinRoom(room2.roomCode, 'socket-2');

    service.removeRoom(room1.roomCode);

    expect(service.findByCode(room1.roomCode)).toBeUndefined();
    expect(service.findByCode(room2.roomCode)).toBe(room2);
    expect(service.getRoomBySocket('socket-2')).toBe(room2);
  });
});

describe('Room.hasAbandonedPlayers', () => {
  it('should return false when all players are connected', () => {
    const room = new Room();
    room.addPlayer('socket-1');
    room.addPlayer('socket-2');

    expect(room.hasAbandonedPlayers()).toBe(false);
  });

  it('should return false when a player just disconnected (within 30s)', () => {
    const room = new Room();
    room.addPlayer('socket-1');
    room.addPlayer('socket-2');
    room.handleDisconnect('socket-1');

    expect(room.hasAbandonedPlayers()).toBe(false);
  });

  it('should return true when disconnect timeout (30s) is exceeded', () => {
    const room = new Room();
    room.addPlayer('socket-1');
    room.addPlayer('socket-2');
    room.handleDisconnect('socket-1');

    // Simulate 31 seconds passing
    const player = room.players.get('socket-1')!;
    player.disconnectedAt = Date.now() - 31_000;

    expect(room.hasAbandonedPlayers()).toBe(true);
  });

  it('should return false when disconnect is exactly at 30s boundary', () => {
    const room = new Room();
    room.addPlayer('socket-1');
    room.addPlayer('socket-2');
    room.handleDisconnect('socket-1');

    // Exactly 30 seconds — not exceeded yet (uses > not >=)
    const player = room.players.get('socket-1')!;
    player.disconnectedAt = Date.now() - 30_000;

    expect(room.hasAbandonedPlayers()).toBe(false);
  });
});

describe('RoomService.cleanupStaleRooms', () => {
  let service: RoomService;

  beforeEach(() => {
    service = new RoomService();
  });

  it('should remove rooms with abandoned players', () => {
    const room = service.createRoom();
    service.joinRoom(room.roomCode, 'socket-1');
    service.joinRoom(room.roomCode, 'socket-2');

    // Simulate disconnect + timeout
    room.handleDisconnect('socket-1');
    const player = room.players.get('socket-1')!;
    player.disconnectedAt = Date.now() - 31_000;

    service.cleanupStaleRooms();

    expect(service.findByCode(room.roomCode)).toBeUndefined();
    expect(service.getRoomBySocket('socket-1')).toBeUndefined();
    expect(service.getRoomBySocket('socket-2')).toBeUndefined();
  });

  it('should not remove rooms where all players are connected', () => {
    const room = service.createRoom();
    service.joinRoom(room.roomCode, 'socket-1');
    service.joinRoom(room.roomCode, 'socket-2');

    service.cleanupStaleRooms();

    expect(service.findByCode(room.roomCode)).toBe(room);
  });

  it('should not remove rooms with recently disconnected players (within 30s)', () => {
    const room = service.createRoom();
    service.joinRoom(room.roomCode, 'socket-1');
    service.joinRoom(room.roomCode, 'socket-2');
    room.handleDisconnect('socket-1');

    service.cleanupStaleRooms();

    expect(service.findByCode(room.roomCode)).toBe(room);
  });

  it('should remove empty rooms (0 players)', () => {
    const room = service.createRoom();
    // Room has 0 players — should be cleaned up
    service.cleanupStaleRooms();

    expect(service.findByCode(room.roomCode)).toBeUndefined();
  });
});

describe('After removeRoom, getRoomBySocket returns undefined for former members', () => {
  it('should return undefined for all former member sockets', () => {
    const service = new RoomService();
    const room = service.createRoom();
    service.joinRoom(room.roomCode, 'socket-1');
    service.joinRoom(room.roomCode, 'socket-2');

    // Verify sockets are mapped before removal
    expect(service.getRoomBySocket('socket-1')).toBe(room);
    expect(service.getRoomBySocket('socket-2')).toBe(room);

    service.removeRoom(room.roomCode);

    expect(service.getRoomBySocket('socket-1')).toBeUndefined();
    expect(service.getRoomBySocket('socket-2')).toBeUndefined();
  });
});
