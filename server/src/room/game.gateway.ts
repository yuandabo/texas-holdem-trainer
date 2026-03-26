import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RoomService } from './room.service';
import { Room } from './room.model';

@WebSocketGateway({ cors: { origin: '*' } })
export class GameGateway implements OnGatewayDisconnect {
  @WebSocketServer() server!: Server;

  constructor(private readonly roomService: RoomService) {}

  /** 创建房间 */
  @SubscribeMessage('createRoom')
  handleCreateRoom(@ConnectedSocket() client: Socket) {
    const room = this.roomService.createRoom();
    const playerInfo = room.addPlayer(client.id);
    this.roomService['socketToRoom'].set(client.id, room.roomCode);
    client.join(room.roomCode);
    client.emit('roomCreated', { roomCode: room.roomCode, role: playerInfo.role });
  }

  /** 加入房间 */
  @SubscribeMessage('joinRoom')
  handleJoinRoom(@ConnectedSocket() client: Socket, @MessageBody() data: { roomCode: string }) {
    const result = this.roomService.joinRoom(data.roomCode, client.id);
    if (!result) {
      client.emit('error', { message: '房间不存在或已满' });
      return;
    }
    client.join(result.room.roomCode);
    client.emit('roomJoined', { roomCode: result.room.roomCode, role: result.role });

    // 房间满了，开始游戏
    if (result.room.isFull) {
      result.room.startNewHand();
      this.broadcastState(result.room);
      this.startActionTimer(result.room);
    }
  }

  /** 玩家下注 */
  @SubscribeMessage('placeBet')
  handlePlaceBet(@ConnectedSocket() client: Socket, @MessageBody() data: { type: string; amount: number }) {
    const room = this.roomService.getRoomBySocket(client.id);
    if (!room) return;
    const player = room.getPlayerBySocket(client.id);
    if (!player) return;

    const success = room.placeBet(player.role, { type: data.type as any, amount: data.amount });
    if (!success) {
      console.log('[placeBet] FAILED:', {
        role: player.role,
        action: data,
        currentActor: room.state.bettingRound?.currentActor,
        phase: room.state.phase,
        roundEnded: room.state.bettingRound?.roundEnded,
        availableActions: room.getAvailableActionsForCurrentActor(),
      });
      client.emit('error', { message: '无效操作' });
      return;
    }

    room.clearActionTimer();
    this.broadcastState(room);

    // 如果是 showdown，延迟后自动下一手
    if (room.state.phase === 'showdown') {
      setTimeout(() => {
        room.nextHand();
        this.broadcastState(room);
        this.startActionTimer(room);
      }, 3000);
    } else if (room.state.phase !== 'game_over') {
      this.startActionTimer(room);
    }
  }

  /** 重新开始游戏 */
  @SubscribeMessage('restartGame')
  handleRestartGame(@ConnectedSocket() client: Socket) {
    const room = this.roomService.getRoomBySocket(client.id);
    if (!room) return;
    room.restartGame();
    this.broadcastState(room);
    this.startActionTimer(room);
  }

  /** 断线重连 */
  @SubscribeMessage('reconnect')
  handleReconnect(@ConnectedSocket() client: Socket, @MessageBody() data: { roomCode: string; oldSocketId: string }) {
    const result = this.roomService.handleReconnect(data.roomCode, data.oldSocketId, client.id);
    if (!result) {
      client.emit('error', { message: '重连失败，房间不存在或已超时' });
      return;
    }
    client.join(result.room.roomCode);
    client.emit('reconnected', { role: result.player.role });
    this.broadcastState(result.room);
  }

  /** 断线处理 */
  handleDisconnect(client: Socket) {
    const result = this.roomService.handleDisconnect(client.id);
    if (!result) return;

    // 通知对手
    const opponentRole = result.player.role === 'player' ? 'opponent' : 'player';
    const opponent = result.room.getPlayerByRole(opponentRole);
    if (opponent?.connected) {
      this.server.to(opponent.socketId).emit('opponentDisconnected');
    }

    // 30秒后检查是否需要清理
    setTimeout(() => {
      if (result.room.hasAbandonedPlayers()) {
        // 对手赢（断线方判负）
        if (opponent?.connected) {
          this.server.to(opponent.socketId).emit('opponentAbandoned');
        }
        this.roomService.removeRoom(result.room.roomCode);
      }
    }, 30_000);
  }

  /** 向房间内每个玩家发送各自视角的状态 */
  private broadcastState(room: Room) {
    for (const player of room.players.values()) {
      if (player.connected) {
        this.server.to(player.socketId).emit('gameState', room.getStateForRole(player.role));
      }
    }
  }

  /** 操作超时计时器：超时自动 check 或 fold */
  private startActionTimer(room: Room) {
    const actor = room.getCurrentActor();
    if (!actor) return;

    room.setActionTimer(() => {
      // 超时：如果可以 check 就 check，否则 fold
      const actions = room.getAvailableActionsForCurrentActor();
      if (actions.includes('check')) {
        room.placeBet(actor, { type: 'check', amount: 0 });
      } else {
        room.placeBet(actor, { type: 'fold', amount: 0 });
      }
      this.broadcastState(room);

      if (room.state.phase === 'showdown') {
        setTimeout(() => {
          room.nextHand();
          this.broadcastState(room);
          this.startActionTimer(room);
        }, 3000);
      } else if (room.state.phase !== 'game_over') {
        this.startActionTimer(room);
      }
    });
  }
}
