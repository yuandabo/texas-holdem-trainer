import { View, Text } from '@tarojs/components';
import { useMemo } from 'react';
import { Card, HandEvalResult } from '@/engine/types';
import { evaluate, evaluateFiveCards, combinations } from '@/engine/handEvaluator';
import './index.scss';

export interface HandRankHintProps {
  hand: Card[];
  communityCards: Card[];
  enabled: boolean;
}

/**
 * 从手牌和公共牌中获取当前最佳牌型提示
 * - communityCards.length < 3: 返回 null
 * - communityCards.length === 5: 直接调用 evaluate(hand, communityCards)
 * - communityCards.length === 3 或 4: 从所有可用牌中生成 C(n,5) 组合，取最佳
 */
export function getHandRankHint(
  hand: Card[],
  communityCards: Card[],
): { rankName: string; bestCards: Card[] } | null {
  if (communityCards.length < 3) return null;

  if (communityCards.length === 5) {
    const result = evaluate(hand, communityCards);
    return { rankName: result.rankName, bestCards: result.bestCards };
  }

  // For 3 or 4 community cards (5 or 6 total cards), evaluate all C(n,5) combos
  const allCards = [...hand, ...communityCards];
  const combos = combinations(allCards, 5);

  let best: HandEvalResult | null = null;
  for (const combo of combos) {
    const result = evaluateFiveCards(combo);
    if (best === null || compareCVs(result.compareValues, best.compareValues) > 0) {
      best = result;
    }
  }

  return best ? { rankName: best.rankName, bestCards: best.bestCards } : null;
}

/** Compare two compareValues arrays */
function compareCVs(a: number[], b: number[]): number {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const va = a[i] ?? 0;
    const vb = b[i] ?? 0;
    if (va !== vb) return va - vb;
  }
  return 0;
}

export default function HandRankHint({ hand, communityCards, enabled }: HandRankHintProps) {
  const hint = useMemo(
    () => (enabled ? getHandRankHint(hand, communityCards) : null),
    [hand, communityCards, enabled],
  );

  if (!hint) return null;

  return (
    <View className='hand-rank-hint'>
      <Text className='hand-rank-hint__label'>当前牌型</Text>
      <Text className='hand-rank-hint__rank'>{hint.rankName}</Text>
    </View>
  );
}
