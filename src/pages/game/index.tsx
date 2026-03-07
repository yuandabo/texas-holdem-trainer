import { View, Text, Button, Switch } from '@tarojs/components';
import { useMemo } from 'react';
import { useGameFlow } from '@/hooks/useGameFlow';
import CardDisplay from '@/components/CardDisplay';
import ChipDisplay from '@/components/ChipDisplay';
import BettingActionPanel from '@/components/BettingActionPanel';
import GameOverPanel from '@/components/GameOverPanel';
import HandRankHint from '@/components/HandRankHint';
import { getHandRankHint } from '@/components/HandRankHint/index';
import WinRateHint from '@/components/WinRateHint';
import ResultPanel from '@/components/ResultPanel';
import { getAvailableActions } from '@/engine/bettingEngine';
import { MIN_RAISE } from '@/engine/types';
import './index.scss';

export default function GamePage() {
  const { state, nextStep, newGame, toggleHandRankHint, toggleWinRateHint, placeBet, restartGame } = useGameFlow();

  const highlightCards = useMemo(() => {
    if (!state.handRankHintEnabled) return undefined;
    const hint = getHandRankHint(state.playerHand, state.communityCards);
    return hint ? hint.bestCards : undefined;
  }, [state.handRankHintEnabled, state.playerHand, state.communityCards]);

  const isBetting = ['pre_flop_betting', 'flop_betting', 'turn_betting', 'river_betting'].includes(state.phase);
  const isPlayerTurn = isBetting && state.bettingRound?.currentActor === 'player' && !state.bettingRound?.roundEnded;
  const availableActions = isPlayerTurn && state.bettingRound
    ? getAvailableActions(state.bettingRound, state.chipState.playerChips, MIN_RAISE)
    : [];
  const betToCall = state.bettingRound
    ? Math.max(0, state.bettingRound.opponentRoundBet - state.bettingRound.playerRoundBet)
    : 0;

  return (
    <View className='game-page'>
      {/* 对手区域 */}
      <View className='game-page__opponent-section'>
        <View className='game-page__avatar'>
          <Text className='game-page__avatar-emoji'>👩</Text>
        </View>
        <View className='game-page__opponent-info'>
          <Text className='game-page__opponent-name'>Luna</Text>
          <ChipDisplay label='筹码' amount={state.chipState.opponentChips} />
        </View>
        <CardDisplay
          cards={state.opponentHand}
          faceDown={state.phase !== 'showdown' || !state.showdownResult}
        />
      </View>

      {/* 公共牌 + 底池 */}
      <View className='game-page__community-section'>
        <CardDisplay
          cards={state.communityCards}
          totalSlots={5}
          highlightCards={highlightCards}
          fullWidth
        />
        <ChipDisplay label='底池' amount={state.bettingRound?.pot ?? 0} />
      </View>

      {/* 玩家区域 */}
      <View className='game-page__player-row'>
        <CardDisplay
          cards={state.playerHand}
          highlightCards={highlightCards}
          label='玩家'
          size='large'
        />
        <ChipDisplay label='玩家筹码' amount={state.chipState.playerChips} />
      </View>

      {/* 提示区域 */}
      <View className='game-page__hints'>
        <HandRankHint
          hand={state.playerHand}
          communityCards={state.communityCards}
          enabled={state.handRankHintEnabled}
        />
        <WinRateHint
          hand={state.playerHand}
          communityCards={state.communityCards}
          enabled={state.winRateHintEnabled}
        />
      </View>

      {/* 结算面板 */}
      {state.phase === 'showdown' && state.showdownResult && (
        <ResultPanel result={state.showdownResult} />
      )}

      {/* 弃牌结算 */}
      {state.phase === 'showdown' && !state.showdownResult && state.bettingRound?.foldedBy && (
        <View className='game-page__fold-result'>
          <Text className={`game-page__fold-text ${state.bettingRound.foldedBy === 'player' ? 'game-page__fold-text--lose' : 'game-page__fold-text--win'}`}>
            {state.bettingRound.foldedBy === 'player' ? '你弃牌了，对手赢得底池' : '对手弃牌，你赢得底池'}
          </Text>
        </View>
      )}

      {/* 游戏结束面板 */}
      {state.isGameOver && state.gameOverWinner && (
        <GameOverPanel
          winner={state.gameOverWinner}
          playerChips={state.chipState.playerChips}
          opponentChips={state.chipState.opponentChips}
          onRestart={restartGame}
        />
      )}

      {/* 回合提示 */}
      {isBetting && state.bettingRound && !state.bettingRound.roundEnded && (
        <View className='game-page__turn-indicator'>
          <Text className='game-page__turn-text'>
            {state.bettingRound.currentActor === 'player' ? '💬 轮到你行动' : '⏳ 对手思考中...'}
          </Text>
        </View>
      )}

      {/* 下注操作面板 */}
      {isBetting && (
        <BettingActionPanel
          availableActions={availableActions}
          currentBetToCall={betToCall}
          minRaiseAmount={betToCall + MIN_RAISE}
          maxRaiseAmount={state.chipState.playerChips}
          enabled={isPlayerTurn}
          onAction={placeBet}
        />
      )}

      {/* 操作按钮 - 下一步 */}
      <View className='game-page__actions'>
        {!isBetting && !state.isGameOver && (
          <Button
            className='game-page__btn game-page__btn--next'
            disabled={state.phase === 'showdown'}
            onClick={nextStep}
          >
            下一步
          </Button>
        )}
      </View>

      {/* 提示开关 */}
      <View className='game-page__toggles'>
        <View className='game-page__toggle-item'>
          <Text className='game-page__toggle-label'>牌型提示</Text>
          <Switch
            checked={state.handRankHintEnabled}
            onChange={toggleHandRankHint}
          />
        </View>
        <View className='game-page__toggle-item'>
          <Text className='game-page__toggle-label'>胜率提示</Text>
          <Switch
            checked={state.winRateHintEnabled}
            onChange={toggleWinRateHint}
          />
        </View>
      </View>

      {/* 新一局按钮 - 仅在摊牌结束后可用 */}
      {!state.isGameOver && state.phase === 'showdown' && (
        <View className='game-page__actions'>
          <Button
            className='game-page__btn game-page__btn--new'
            onClick={newGame}
          >
            新一局
          </Button>
        </View>
      )}
    </View>
  );
}
