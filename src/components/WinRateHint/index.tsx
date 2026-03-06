import { View, Text } from '@tarojs/components';
import { useMemo } from 'react';
import { Card } from '@/engine/types';
import { calculate } from '@/engine/winRateCalculator';
import './index.scss';

export interface WinRateHintProps {
  hand: Card[];
  communityCards: Card[];
  enabled: boolean;
}

export default function WinRateHint({ hand, communityCards, enabled }: WinRateHintProps) {
  const winRate = useMemo(
    () => (enabled ? calculate(hand, communityCards) : null),
    [hand, communityCards, enabled],
  );

  if (winRate === null) return null;

  return (
    <View className='win-rate-hint'>
      <Text className='win-rate-hint__label'>胜率:</Text>
      <Text className='win-rate-hint__value'>{winRate}%</Text>
    </View>
  );
}
