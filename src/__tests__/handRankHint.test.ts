jest.mock('@tarojs/components', () => ({
  View: 'View',
  Text: 'Text',
}));

import fc from 'fast-check';
import { Card, Suit, Rank } from '@/engine/types';
import { evaluate } from '@/engine/handEvaluator';
import { getHandRankHint } from '@/components/HandRankHint/index';

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

function cardKey(card: Card): string {
  return `${card.suit}${card.rank}`;
}

// Feature: texas-holdem-trainer, Property 13: 牌型提示与判定器一致
describe('Property 13: 牌型提示与判定器一致', () => {
  /**
   * Validates: Requirements 6.1
   *
   * 验证当公共牌为 5 张时，getHandRankHint 返回的 rankName 和 bestCards
   * 与 HandEvaluator.evaluate() 的结果完全一致。
   */
  test('hand rank hint returns same rankName and bestCards as evaluate() with full board', () => {
    fc.assert(
      fc.property(sevenUniqueCardsArb, (cards) => {
        const hand = cards.slice(0, 2);
        const communityCards = cards.slice(2, 7);

        const hint = getHandRankHint(hand, communityCards);
        const evalResult = evaluate(hand, communityCards);

        // hint should not be null with 5 community cards
        expect(hint).not.toBeNull();

        // rankName must match
        expect(hint!.rankName).toBe(evalResult.rankName);

        // bestCards must be the same set of cards
        expect(hint!.bestCards).toHaveLength(5);
        const hintKeys = new Set(hint!.bestCards.map(cardKey));
        const evalKeys = new Set(evalResult.bestCards.map(cardKey));
        expect(hintKeys).toEqual(evalKeys);
      }),
      { numRuns: 100 },
    );
  });
});
