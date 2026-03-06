import fc from 'fast-check';
import { createDeck, shuffle } from '@/engine/deck';
import { dealHands, dealFlop, dealTurn, dealRiver } from '@/engine/dealEngine';
import { Card } from '@/engine/types';

/**
 * 将 Card 转为唯一字符串键，用于集合比较
 */
function cardKey(card: Card): string {
  return `${card.suit}${card.rank}`;
}

// Feature: texas-holdem-trainer, Property 2: 发牌保持牌组完整性
describe('Property 2: 发牌保持牌组完整性', () => {
  /**
   * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
   *
   * 验证完整发牌流程（dealHands → dealFlop → dealTurn → dealRiver）后，
   * 所有发出的牌 + 剩余牌组 = 原始 52 张牌（相同集合），且无重复。
   */
  test('deal flow preserves deck integrity: dealt cards + remaining = original 52 cards', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        // 1. 创建并洗牌
        const original = createDeck();
        const shuffled = shuffle(original);

        // 2. 完整发牌流程
        const { playerHand, opponentHand, remainingDeck: afterHands } = dealHands(shuffled);
        const [flop, afterFlop] = dealFlop(afterHands);
        const [turn, afterTurn] = dealTurn(afterFlop);
        const [river, afterRiver] = dealRiver(afterTurn);

        // 3. 收集所有发出的牌 (2 + 2 + 3 + 1 + 1 = 9)
        const allDealt: Card[] = [
          ...playerHand,
          ...opponentHand,
          ...flop,
          turn,
          river,
        ];
        expect(allDealt).toHaveLength(9);

        // 4. 所有发出的牌 + 剩余牌组 = 原始 52 张牌
        const allCards = [...allDealt, ...afterRiver];
        expect(allCards).toHaveLength(52);

        const allKeys = allCards.map(cardKey);
        const originalKeys = original.map(cardKey).sort();
        const sortedAllKeys = [...allKeys].sort();
        expect(sortedAllKeys).toEqual(originalKeys);

        // 5. 无重复
        const uniqueDealtKeys = new Set(allDealt.map(cardKey));
        expect(uniqueDealtKeys.size).toBe(9);
      }),
      { numRuns: 100 },
    );
  });
});
