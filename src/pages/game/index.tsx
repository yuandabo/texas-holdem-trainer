import { View, Text, Button, Switch } from '@tarojs/components';
import { useMemo } from 'react';
import { useGameFlow } from '@/hooks/useGameFlow';
import CardDisplay from '@/components/CardDisplay';
import HandRankHint from '@/components/HandRankHint';
import { getHandRankHint } from '@/components/HandRankHint/index';
import WinRateHint from '@/components/WinRateHint';
import ResultPanel from '@/components/ResultPanel';
import './index.scss';

export default function GamePage() {
  const { state, nextStep, newGame, toggleHandRankHint, toggleWinRateHint } = useGameFlow();

  const highlightCards = useMemo(() => {
    if (!state.handRankHintEnabled) return undefined;
    const hint = getHandRankHint(state.playerHand, state.communityCards);
    return hint ? hint.bestCards : undefined;
  }, [state.handRankHintEnabled, state.playerHand, state.communityCards]);

  return (
    <View className='game-page'>
      {/* 对手手牌区域 */}
      <CardDisplay
        cards={state.opponentHand}
        faceDown={state.phase !== 'showdown'}
        label='对手'
      />

      <View className='game-page__divider' />

      {/* 公共牌区域 */}
      <CardDisplay
        cards={state.communityCards}
        totalSlots={5}
        highlightCards={highlightCards}
      />

      <View className='game-page__divider' />

      {/* 玩家手牌区域 */}
      <CardDisplay
        cards={state.playerHand}
        highlightCards={highlightCards}
        label='玩家'
      />

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

      {/* 操作按钮 */}
      <View className='game-page__actions'>
        <Button
          className='game-page__btn game-page__btn--next'
          disabled={state.phase === 'showdown'}
          onClick={nextStep}
        >
          下一步
        </Button>
        <Button
          className='game-page__btn game-page__btn--new'
          onClick={newGame}
        >
          新一局
        </Button>
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
    </View>
  );
}
