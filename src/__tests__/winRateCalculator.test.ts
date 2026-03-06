import fc from 'fast-check';
import { calculate } from '@/engine/winRateCalculator';
import { Suit, Rank } from '@/engine/types';

/** Card 生成器 */
const cardArb = fc.record({
  suit: fc.constantFrom(Suit.Spades, Suit.Hearts, Suit.Clubs, Suit.Diamonds),
  rank: fc.integer({ min: 2, max: 14 }).map((r) => r as Rank),
});

/** 7 张不重复牌生成器 */
const sevenUniqueCardsArb = fc.uniqueArray(cardArb, {
  minLength: 7,
  maxLength: 7,
  comparator: (a, b) => a.suit === b.suit && a.rank === b.rank,
});

/** 生成手牌 + 公共牌（公共牌数量为 0, 3, 4, 或 5） */
const handAndCommunityArb = fc
  .tuple(sevenUniqueCardsArb, fc.constantFrom(0, 3, 4, 5))
  .map(([cards, communitySize]) => ({
    hand: cards.slice(0, 2),
    communityCards: cards.slice(2, 2 + communitySize),
  }));

// Feature: texas-holdem-trainer, Property 10: 胜率计算范围不变量
describe('Property 10: 胜率计算范围不变量', () => {
  /**
   * Validates: Requirements 7.1, 7.3
   *
   * 验证 calculate() 返回值为 0 到 100 之间的整数：
   * - 结果 >= 0
   * - 结果 <= 100
   * - 结果为整数 (Number.isInteger)
   */
  test('calculate returns an integer between 0 and 100', () => {
    fc.assert(
      fc.property(handAndCommunityArb, ({ hand, communityCards }) => {
        const result = calculate(hand, communityCards, 100);

        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(100);
        expect(Number.isInteger(result)).toBe(true);
      }),
      { numRuns: 100 },
    );
  }, 60000);
});
