import { Injectable } from '@nestjs/common';
import { Room, PlayerInfo } from './room.model';

@Injectable()
export class RoomService {
  /** roomCode -> Room */
  private rooms = new Map<string, Room>();
  /** socketId -> roomCode */
  private socketToRoom = new Map<string, string>();

  createRoom(): Room {
    const room = new Room();
    this.rooms.set(room.roomCode, room);
    return room;
  }

  findByCode(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  joinRoom(roomCode: string, socketId: string): { room: Room; role: string } | null {
    const room = this.findByCode(roomCode);
    if (!room || room.isFull) return null;
    const role = room.addPlayer(socketId);
    if (!role) return null;
    this.socketToRoom.set(socketId, room.roomCode);
    return { room, role };
  }

  getRoomBySocket(socketId: string): Room | undefined {
    const code = this.socketToRoom.get(socketId);
    return code ? this.rooms.get(code) : undefined;
  }

  handleDisconnect(socketId: string): { room: Room; player: PlayerInfo } | null {
    const room = this.getRoomBySocket(socketId);
    if (!room) return null;
    const player = room.handleDisconnect(socketId);
    if (!player) return null;
    return { room, player };
  }

  handleReconnect(roomCode: string, oldSocketId: string, newSocketId: string): { room: Room; player: PlayerInfo } | null {
    const room = this.findByCode(roomCode);
    if (!room) return null;
    const player = room.handleReconnect(oldSocketId, newSocketId);
    if (!player) return null;
    this.socketToRoom.delete(oldSocketId);
    this.socketToRoom.set(newSocketId, room.roomCode);
    return { room, player };
  }

  removeRoom(roomCode: string): void {
    const room = this.rooms.get(roomCode);
    if (room) {
      room.clearActionTimer();
      for (const p of room.players.values()) {
        this.socketToRoom.delete(p.socketId);
      }
      this.rooms.delete(roomCode);
    }
  }

  /** 清理超时的空房间 */
  cleanupStaleRooms(): void {
    for (const [code, room] of this.rooms) {
      if (room.playerCount === 0 || room.hasAbandonedPlayers()) {
        this.removeRoom(code);
      }
    }
  }
}
