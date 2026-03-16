import { View, Text, Switch } from '@tarojs/components';
import { useMemo, useState } from 'react';
import { useGameFlow } from '@/hooks/useGameFlow';
import CardDisplay from '@/components/CardDisplay';
import ChipDisplay from '@/components/ChipDisplay';
import BettingActionPanel from '@/components/BettingActionPanel';
import GameOverPanel from '@/components/GameOverPanel';
import HandRankHint from '@/components/HandRankHint';
import { getHandRankHint } from '@/components/HandRankHint/index';
import WinRateHint from '@/components/WinRateHint';
import ResultPanel from '@/components/ResultPanel';
import PvpPage from '@/pages/pvp/index';
import { getAvailableActions } from '@/engine/bettingEngine';
import { MIN_RAISE } from '@/engine/types';
import './index.scss';

export default function GamePage() {
  const [mode, setMode] = useState<'ai' | 'pvp'>('ai');
  const { state, toggleHandRankHint, toggleWinRateHint, placeBet, restartGame } = useGameFlow();

  // PVP 模式
  if (mode === 'pvp') {
    return <PvpPage onBack={() => setMode('ai')} />;
  }

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

  // 获取各自最新一条操作
  const lastOpponentAction = [...state.actionLog].reverse().find(e => e.actor === 'opponent');
  const lastPlayerAction = [...state.actionLog].reverse().find(e => e.actor === 'player');

  return (
    <View className='game-page'>
      {/* 主游戏区域 */}
      <View className='game-page__main'>
        {/* 对手区域 */}
        <View className='game-page__opponent-section'>
          <View className='game-page__avatar'>
            <Text className='game-page__avatar-emoji'>👩</Text>
          </View>
          {lastOpponentAction && (
            <View className='game-page__action-bubble game-page__action-bubble--opponent'>
              <Text className='game-page__action-bubble-text'>{lastOpponentAction.actionType}</Text>
            </View>
          )}
          <View className='game-page__opponent-info'>
            <Text className='game-page__opponent-name'>Luna</Text>
            <ChipDisplay label='筹码' amount={state.chipState.opponentChips} />
          </View>
          <CardDisplay
            cards={state.opponentHand}
            faceDown={!state.showdownResult}
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
          {lastPlayerAction && (
            <View className='game-page__action-bubble game-page__action-bubble--player'>
              <Text className='game-page__action-bubble-text'>{lastPlayerAction.actionType}</Text>
            </View>
          )}
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

        {/* 回合提示 + 自动发牌倒计时 */}
        <View className='game-page__status-bar'>
          {isBetting && state.bettingRound && !state.bettingRound.roundEnded && (
            <Text className='game-page__turn-text'>
              {state.bettingRound.currentActor === 'player' ? '💬 轮到你行动' : '⏳ 对手思考中...'}
            </Text>
          )}
          {state.phase === 'showdown' && !state.isGameOver && (
            <Text className='game-page__auto-deal-text'>⏳ 即将自动发牌...</Text>
          )}
        </View>

        {/* 下注操作面板 */}
        {isBetting && (
          <BettingActionPanel
            availableActions={availableActions}
            currentBetToCall={betToCall}
            minRaiseAmount={betToCall + MIN_RAISE}
            maxRaiseAmount={Math.min(state.chipState.playerChips, state.chipState.opponentChips)}
            potSize={state.bettingRound?.pot ?? 0}
            enabled={isPlayerTurn}
            onAction={placeBet}
          />
        )}

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
          <View className='game-page__toggle-item'>
            <Text
              className='game-page__toggle-label game-page__pvp-btn'
              onClick={() => setMode('pvp')}
            >🎮 PVP 对战</Text>
          </View>
        </View>
      </View>

    </View>
  );
}
