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
      {/* 对手手牌区域 */}
      <View className='game-page__player-row'>
        <CardDisplay
          cards={state.opponentHand}
          faceDown={state.phase !== 'showdown' || !state.showdownResult}
          label='对手'
        />
        <ChipDisplay label='对手筹码' amount={state.chipState.opponentChips} />
      </View>

      <View className='game-page__divider' />

      {/* 公共牌区域 */}
      <CardDisplay
        cards={state.communityCards}
        totalSlots={5}
        highlightCards={highlightCards}
      />

      {/* 底池筹码 */}
      <ChipDisplay label='底池' amount={state.bettingRound?.pot ?? 0} />

      <View className='game-page__divider' />

      {/* 玩家手牌区域 */}
      <View className='game-page__player-row'>
        <CardDisplay
          cards={state.playerHand}
          highlightCards={highlightCards}
          label='玩家'
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

      {/* 游戏结束面板 */}
      {state.isGameOver && state.gameOverWinner && (
        <GameOverPanel
          winner={state.gameOverWinner}
          playerChips={state.chipState.playerChips}
          opponentChips={state.chipState.opponentChips}
          onRestart={restartGame}
        />
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

      {/* 新一局按钮 */}
      {!state.isGameOver && (
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
