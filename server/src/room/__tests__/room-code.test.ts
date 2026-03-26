import { Room } from '../room.model';

describe('Room.generateRoomCode', () => {
  it('should generate a 6-character string', () => {
    const code = Room.generateRoomCode();
    expect(code).toHaveLength(6);
  });

  it('should only contain uppercase letters and digits', () => {
    const code = Room.generateRoomCode();
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
  });

  it('should not collide with existing codes', () => {
    const existing = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const code = Room.generateRoomCode(existing);
      expect(existing.has(code)).toBe(false);
      existing.add(code);
    }
  });

  it('should avoid a specific existing code', () => {
    // Generate many codes with a small existing set to verify uniqueness
    const existingCodes = new Set(['ABC123', 'XYZ789']);
    for (let i = 0; i < 100; i++) {
      const code = Room.generateRoomCode(existingCodes);
      expect(code).not.toBe('ABC123');
      expect(code).not.toBe('XYZ789');
      expect(code).toMatch(/^[A-Z0-9]{6}$/);
    }
  });

  it('should work with an empty set', () => {
    const code = Room.generateRoomCode(new Set());
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
  });

  it('should work with no arguments (default empty set)', () => {
    const code = Room.generateRoomCode();
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
  });
});
