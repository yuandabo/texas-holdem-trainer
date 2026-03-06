import { Card } from '@/engine/types';
import { evaluate, compare } from '@/engine/handEvaluator';
import { createDeck, shuffle } from '@/engine/deck';

/**
 * 从完整牌组中移除已知牌，得到剩余牌
 */
function getRemainingCards(hand: Card[], communityCards: Card[]): Card[] {
  const known = [...hand, ...communityCards];
  return createDeck().filter(
    (card) => !known.some((k) => k.suit === card.suit && k.rank === card.rank)
  );
}

/**
 * 蒙特卡洛模拟计算胜率
 * @param hand 玩家手牌 (2张)
 * @param communityCards 已发出的公共牌 (0-5张)
 * @param simulations 模拟次数 (默认 1000)
 * @returns 胜率百分比 (整数, 0-100)
 */
export function calculate(
  hand: Card[],
  communityCards: Card[],
  simulations: number = 1000
): number {
  const remaining = getRemainingCards(hand, communityCards);
  const communityNeeded = 5 - communityCards.length;
  let wins = 0;

  for (let i = 0; i < simulations; i++) {
    const shuffled = shuffle(remaining);

    // Draw 2 cards for opponent
    const opponentHand = shuffled.slice(0, 2);
    // Draw remaining community cards
    const extraCommunity = shuffled.slice(2, 2 + communityNeeded);
    const fullCommunity = [...communityCards, ...extraCommunity];

    // Evaluate both hands
    const playerResult = evaluate(hand, fullCommunity);
    const opponentResult = evaluate(opponentHand, fullCommunity);

    // Compare
    const cmp = compare(playerResult, opponentResult);
    if (cmp > 0) {
      wins++;
    }
  }

  return Math.round((wins / simulations) * 100);
}
