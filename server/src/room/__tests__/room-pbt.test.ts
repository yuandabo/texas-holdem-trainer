import * as fc from 'fast-check';
import { Room } from '../room.model';
import { RoomService } from '../room.service';

// Feature: pvp-mode, Property 1: 房间码格式与唯一性
// **Validates: Requirements 3.1, 3.2**

describe('Property 1: 房间码格式与唯一性', () => {
  it('Room.generateRoomCode() should produce a 6-char uppercase alphanumeric code that avoids existing codes', () => {
    fc.assert(
      fc.property(
        // Generate a random set of existing codes (0-20 codes, each 6-char uppercase alphanumeric)
        fc.array(
          fc.stringOf(
            fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')),
            { minLength: 6, maxLength: 6 },
          ),
          { minLength: 0, maxLength: 20 },
        ),
        (existingCodesArray) => {
          const existingCodes = new Set(existingCodesArray);
          const code = Room.generateRoomCode(existingCodes);

          // Property: code is exactly 6 characters
          expect(code).toHaveLength(6);

          // Property: code only contains uppercase letters (A-Z) and digits (0-9)
          expect(code).toMatch(/^[A-Z0-9]{6}$/);

          // Property: code is not in the existing codes set
          expect(existingCodes.has(code)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('RoomService.createRoom() should produce unique room codes across multiple rooms', () => {
    fc.assert(
      fc.property(
        // Generate a count of rooms to create (2-10)
        fc.integer({ min: 2, max: 10 }),
        (roomCount) => {
          const service = new RoomService();
          const codes = new Set<string>();

          for (let i = 0; i < roomCount; i++) {
            const room = service.createRoom();

            // Property: code is exactly 6 characters
            expect(room.roomCode).toHaveLength(6);

            // Property: code only contains uppercase letters and digits
            expect(room.roomCode).toMatch(/^[A-Z0-9]{6}$/);

            // Property: code is unique across all created rooms
            expect(codes.has(room.roomCode)).toBe(false);
            codes.add(room.roomCode);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});


// Feature: pvp-mode, Property 2: 房间人数上限
// **Validates: Requirements 3.6, 3.7**

describe('Property 2: 房间人数上限', () => {
  it('Room should never have more than 2 players, and addPlayer() should throw when full', () => {
    fc.assert(
      fc.property(
        // Generate a random sequence of socket IDs (1-10 unique IDs)
        fc.uniqueArray(fc.uuid(), { minLength: 1, maxLength: 10 }),
        (socketIds) => {
          const room = new Room();

          let addedCount = 0;
          for (const socketId of socketIds) {
            if (addedCount < 2) {
              // First two should succeed
              const playerInfo = room.addPlayer(socketId);
              addedCount++;
              expect(playerInfo).toBeDefined();
              expect(playerInfo.socketId).toBe(socketId);
              // First player gets 'player', second gets 'opponent'
              expect(playerInfo.role).toBe(addedCount === 1 ? 'player' : 'opponent');
            } else {
              // Any subsequent attempt should throw
              expect(() => room.addPlayer(socketId)).toThrow('房间已满');
            }

            // Invariant: player count never exceeds 2
            expect(room.playerCount).toBeLessThanOrEqual(2);
            expect(room.isFull).toBe(room.playerCount >= 2);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('RoomService.joinRoom() should reject joining a full room', () => {
    fc.assert(
      fc.property(
        // Generate 3+ unique socket IDs to test join rejection
        fc.uniqueArray(fc.uuid(), { minLength: 3, maxLength: 10 }),
        (socketIds) => {
          const service = new RoomService();
          const room = service.createRoom();
          const roomCode = room.roomCode;

          // First join should succeed
          const result1 = service.joinRoom(roomCode, socketIds[0]);
          expect(result1).not.toBeNull();
          expect(result1!.role).toBe('player');

          // Second join should succeed
          const result2 = service.joinRoom(roomCode, socketIds[1]);
          expect(result2).not.toBeNull();
          expect(result2!.role).toBe('opponent');

          // All subsequent joins should be rejected (return null)
          for (let i = 2; i < socketIds.length; i++) {
            const result = service.joinRoom(roomCode, socketIds[i]);
            expect(result).toBeNull();
          }

          // Room should still have exactly 2 players
          const foundRoom = service.findByCode(roomCode);
          expect(foundRoom!.playerCount).toBe(2);
          expect(foundRoom!.isFull).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
