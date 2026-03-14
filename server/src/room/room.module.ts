import { Module } from '@nestjs/common';
import { RoomService } from './room.service';
import { GameGateway } from './game.gateway';

@Module({
  providers: [RoomService, GameGateway],
  exports: [RoomService],
})
export class RoomModule {}
