import { RoomService } from '../room.service';

describe('RoomService', () => {
  let service: RoomService;

  beforeEach(() => {
    service = new RoomService();
  });

  describe('createRoom', () => {
    it('should create a room with a valid 6-character alphanumeric code', () => {
      const room = service.createRoom();
      expect(room).toBeDefined();
      expect(room.roomCode).toMatch(/^[A-Z0-9]{6}$/);
    });

    it('should store the room so it can be found by code', () => {
      const room = service.createRoom();
      const found = service.findByCode(room.roomCode);
      expect(found).toBe(room);
    });

    it('should create multiple rooms with unique codes', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 20; i++) {
        const room = service.createRoom();
        expect(codes.has(room.roomCode)).toBe(false);
        codes.add(room.roomCode);
      }
    });
  });

  describe('joinRoom', () => {
    it('should join a room with a valid code and return room and role', () => {
      const room = service.createRoom();
      const result = service.joinRoom(room.roomCode, 'socket-1');
      expect(result).not.toBeNull();
      expect(result!.room).toBe(room);
      expect(result!.role).toBe('player');
    });

    it('should assign opponent role to the second player', () => {
      const room = service.createRoom();
      service.joinRoom(room.roomCode, 'socket-1');
      const result = service.joinRoom(room.roomCode, 'socket-2');
      expect(result).not.toBeNull();
      expect(result!.role).toBe('opponent');
    });

    it('should return null when room code does not exist', () => {
      const result = service.joinRoom('ZZZZZZ', 'socket-1');
      expect(result).toBeNull();
    });

    it('should return null when room is full', () => {
      const room = service.createRoom();
      service.joinRoom(room.roomCode, 'socket-1');
      service.joinRoom(room.roomCode, 'socket-2');
      const result = service.joinRoom(room.roomCode, 'socket-3');
      expect(result).toBeNull();
    });

    it('should register socket-to-room mapping after joining', () => {
      const room = service.createRoom();
      service.joinRoom(room.roomCode, 'socket-1');
      const found = service.getRoomBySocket('socket-1');
      expect(found).toBe(room);
    });

    it('should handle case-insensitive room codes', () => {
      const room = service.createRoom();
      const lowerCode = room.roomCode.toLowerCase();
      const result = service.joinRoom(lowerCode, 'socket-1');
      expect(result).not.toBeNull();
      expect(result!.room).toBe(room);
    });
  });

  describe('getRoomBySocket', () => {
    it('should return the correct room for a joined socket', () => {
      const room = service.createRoom();
      service.joinRoom(room.roomCode, 'socket-1');
      expect(service.getRoomBySocket('socket-1')).toBe(room);
    });

    it('should return undefined for an unknown socket', () => {
      expect(service.getRoomBySocket('unknown-socket')).toBeUndefined();
    });

    it('should return correct rooms for different sockets in different rooms', () => {
      const room1 = service.createRoom();
      const room2 = service.createRoom();
      service.joinRoom(room1.roomCode, 'socket-1');
      service.joinRoom(room2.roomCode, 'socket-2');
      expect(service.getRoomBySocket('socket-1')).toBe(room1);
      expect(service.getRoomBySocket('socket-2')).toBe(room2);
    });
  });
});
