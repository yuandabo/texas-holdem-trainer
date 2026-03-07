import { View, Text } from '@tarojs/components';
import './index.scss';

export interface GameOverPanelProps {
  winner: 'player' | 'opponent';
  playerChips: number;
  opponentChips: number;
  onRestart: () => void;
}

export default function GameOverPanel({
  winner,
  playerChips,
  opponentChips,
  onRestart,
}: GameOverPanelProps) {
  const isPlayerWin = winner === 'player';

  return (
    <View className='game-over-panel'>
      <Text className='game-over-panel__title'>游戏结束</Text>
      <Text
        className={`game-over-panel__winner ${isPlayerWin ? 'game-over-panel__winner--win' : 'game-over-panel__winner--lose'}`}
      >
        {isPlayerWin ? '你赢了!' : '对手赢了!'}
      </Text>
      <View className='game-over-panel__chips'>
        <Text className='game-over-panel__chip-line'>你的筹码: {playerChips}</Text>
        <Text className='game-over-panel__chip-line'>对手筹码: {opponentChips}</Text>
      </View>
      <View className='game-over-panel__btn' onClick={onRestart}>
        <Text className='game-over-panel__btn-text'>重新开始</Text>
      </View>
    </View>
  );
}
