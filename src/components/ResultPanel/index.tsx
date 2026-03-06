import { View, Text } from '@tarojs/components';
import { ShowdownResult, GameResult } from '@/engine/types';
import './index.scss';

export interface ResultPanelProps {
  result: ShowdownResult;
}

function getResultText(result: GameResult): string {
  switch (result) {
    case GameResult.PlayerWin:
      return '你赢了';
    case GameResult.OpponentWin:
      return '对手赢了';
    case GameResult.Tie:
      return '平局';
  }
}

function getResultClass(result: GameResult): string {
  switch (result) {
    case GameResult.PlayerWin:
      return 'result-panel__result--win';
    case GameResult.OpponentWin:
      return 'result-panel__result--lose';
    case GameResult.Tie:
      return 'result-panel__result--tie';
  }
}

export default function ResultPanel({ result }: ResultPanelProps) {
  return (
    <View className='result-panel'>
      <Text className={`result-panel__result ${getResultClass(result.result)}`}>
        {getResultText(result.result)}
      </Text>
      <View className='result-panel__hands'>
        <Text className='result-panel__hand'>你的牌型: {result.playerEval.rankName}</Text>
        <Text className='result-panel__hand'>对手牌型: {result.opponentEval.rankName}</Text>
      </View>
    </View>
  );
}
