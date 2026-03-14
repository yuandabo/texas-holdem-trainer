import { View, Text, Input, Button } from '@tarojs/components';
import { useState } from 'react';
import { usePvpGame } from '@/hooks/usePvpGame';
import CardDisplay from '@/components/CardDisplay';
import ChipDisplay from '@/components/ChipDisplay';
import BettingActionPanel from '@/components/BettingActionPanel';
import GameOverPanel from '@/components/GameOverPanel';
import ResultPanel from '@/components/ResultPanel';
import { MIN_RAISE } from '@/engine/types';
import './index.scss';

export default function PvpPage({ onBack }: { onBack?: () => void }) {
  const { status, roomCode, gameState, errorMsg, createRoom, joinRoom, placeBet, restartGame } = usePvpGame();
  const [inputCode, setInputCode] = useState('');

  // 大厅界面
  if (status === 'idle' || status === 'creating' || status === 'joining') {
    return (
      <View className='pvp-page'>
        <View className='pvp-page__lobby'>
          <Text className='pvp-page__title'>🃏 PVP 对战</Text>
          <Button className='pvp-page__btn' onClick={createRoom}>创建房间</Button>
          <View className='pvp-page__join'>
            <Input
              className='pvp-page__input'
              placeholder='输入房间号'
              value={inputCode}
              onInput={(e) => setInputCode(e.detail.value)}
            />
            <Button className='pvp-page__btn' onClick={() => joinRoom(inputCode)}>加入房间</Button>
          </View>
          {onBack && <Button className='pvp-page__btn pvp-page__btn--back' onClick={onBack}>返回训练模式</Button>}
          {errorMsg && <Text className='pvp-page__error'>{errorMsg}</Text>}
        </View>
      </View>
    );
  }

  // 等待对手
  if (status === 'waiting') {
    return (
      <View className='pvp-page'>
        <View className='pvp-page__lobby'>
          <Text className='pvp-page__title'>等待对手加入...</Text>
          <Text className='pvp-page__room-code'>房间号: {roomCode}</Text>
          <Text className='pvp-page__hint'>将房间号分享给好友即可开始对战</Text>
        </View>
      </View>
    );
  }

  // 断线
  if (status === 'disconnected') {
    return (
      <View className='pvp-page'>
        <View className='pvp-page__lobby'>
          <Text className='pvp-page__title'>连接断开</Text>
          <Text className='pvp-page__hint'>正在尝试重连...</Text>
        </View>
      </View>
    );
  }

  // 游戏中
  if (!gameState) return null;

  const gs = gameState;
  const isBetting = ['pre_flop_betting', 'flop_betting', 'turn_betting', 'river_betting'].includes(gs.phase);
  const isMyTurn = gs.currentActor === gs.myRole;
  const myChips = gs.myRole === 'player' ? gs.chipState.playerChips : gs.chipState.opponentChips;
  const opChips = gs.myRole === 'player' ? gs.chipState.opponentChips : gs.chipState.playerChips;
  const myRoundBet = gs.bettingRound ? (gs.myRole === 'player' ? gs.bettingRound.playerRoundBet : gs.bettingRound.opponentRoundBet) : 0;
  const opRoundBet = gs.bettingRound ? (gs.myRole === 'player' ? gs.bettingRound.opponentRoundBet : gs.bettingRound.playerRoundBet) : 0;
  const betToCall = Math.max(0, opRoundBet - myRoundBet);
  const lastOpAction = [...gs.actionLog].reverse().find(e => e.actor !== gs.myRole);
  const lastMyAction = [...gs.actionLog].reverse().find(e => e.actor === gs.myRole);

  // 判断游戏结果是否是我赢
  const didIWin = gs.gameOverWinner === gs.myRole;
  const gameOverWinnerLabel = gs.gameOverWinner ? (didIWin ? 'player' : 'opponent') : null;

  return (
    <View className='pvp-page game-page'>
      <View className='game-page__main'>
        {/* 对手区域 */}
        <View className='game-page__opponent-section'>
          <View className='game-page__avatar'>
            <Text className='game-page__avatar-emoji'>👤</Text>
          </View>
          {!gs.opponentConnected && (
            <Text className='pvp-page__disconnect-hint'>对手已断线</Text>
          )}
          {lastOpAction && (
            <View className='game-page__action-bubble game-page__action-bubble--opponent'>
              <Text className='game-page__action-bubble-text'>{lastOpAction.actionType}</Text>
            </View>
          )}
          <View className='game-page__opponent-info'>
            <Text className='game-page__opponent-name'>对手</Text>
            <ChipDisplay label='筹码' amount={opChips} />
          </View>
          <CardDisplay cards={gs.opponentHand || []} faceDown={!gs.opponentHand} />
        </View>

        {/* 公共牌 + 底池 */}
        <View className='game-page__community-section'>
          <CardDisplay cards={gs.communityCards} totalSlots={5} fullWidth />
          <ChipDisplay label='底池' amount={gs.bettingRound?.pot ?? 0} />
        </View>

        {/* 我的区域 */}
        <View className='game-page__player-row'>
          <CardDisplay cards={gs.myHand} label='我' size='large' />
          <ChipDisplay label='我的筹码' amount={myChips} />
          {lastMyAction && (
            <View className='game-page__action-bubble game-page__action-bubble--player'>
              <Text className='game-page__action-bubble-text'>{lastMyAction.actionType}</Text>
            </View>
          )}
        </View>

        {/* 结算面板 */}
        {gs.phase === 'showdown' && gs.showdownResult && (
          <ResultPanel result={gs.showdownResult} />
        )}

        {/* 弃牌结算 */}
        {gs.phase === 'showdown' && !gs.showdownResult && gs.bettingRound?.foldedBy && (
          <View className='game-page__fold-result'>
            <Text className={`game-page__fold-text ${gs.bettingRound.foldedBy === gs.myRole ? 'game-page__fold-text--lose' : 'game-page__fold-text--win'}`}>
              {gs.bettingRound.foldedBy === gs.myRole ? '你弃牌了，对手赢得底池' : '对手弃牌，你赢得底池'}
            </Text>
          </View>
        )}

        {/* 游戏结束 */}
        {gs.isGameOver && gameOverWinnerLabel && (
          <GameOverPanel
            winner={gameOverWinnerLabel}
            playerChips={myChips}
            opponentChips={opChips}
            onRestart={restartGame}
          />
        )}

        {/* 状态栏 */}
        <View className='game-page__status-bar'>
          <Text className='pvp-page__room-info'>房间: {gs.roomCode}</Text>
          {isBetting && gs.bettingRound && !gs.bettingRound.roundEnded && (
            <Text className='game-page__turn-text'>
              {isMyTurn ? '💬 轮到你行动' : '⏳ 等待对手...'}
            </Text>
          )}
          {gs.phase === 'showdown' && !gs.isGameOver && (
            <Text className='game-page__auto-deal-text'>⏳ 即将自动发牌...</Text>
          )}
        </View>

        {/* 下注面板 */}
        {isBetting && (
          <BettingActionPanel
            availableActions={isMyTurn ? gs.availableActions as any : []}
            currentBetToCall={betToCall}
            minRaiseAmount={betToCall + MIN_RAISE}
            maxRaiseAmount={Math.min(myChips, opChips)}
            potSize={gs.bettingRound?.pot ?? 0}
            enabled={isMyTurn}
            onAction={placeBet}
          />
        )}
      </View>
    </View>
  );
}
