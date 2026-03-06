import fc from 'fast-check';
import { showdown } from '@/engine/showdownEngine';
import { evaluate, compare } from '@/engine/handEvaluator';
import { Suit, Rank, GameResult } from '@/engine/types';

/** Card 生成器 */
const cardArb = fc.record({
  suit: fc.constantFrom(Suit.Spades, Suit.Hearts, Suit.Clubs, Suit.Diamonds),
  rank: fc.integer({ min: 2, max: 14 }).map((r) => r as Rank),
});

/** 9 张不重复牌生成器 (2 player + 2 opponent + 5 community) */
const nineUniqueCardsArb = fc.uniqueArray(cardArb, {
  minLength: 9,
  maxLength: 9,
  comparator: (a, b) => a.suit === b.suit && a.rank === b.rank,
});

// Feature: texas-holdem-trainer, Property 11: 摊牌结果一致性
describe('Property 11: 摊牌结果一致性', () => {
  /**
   * Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5
   *
   * 验证 showdown() 结果与分别调用 evaluate() + compare() 的结果一致：
   * - 若玩家牌型更大 → result 为 player_win
   * - 若对手牌型更大 → result 为 opponent_win
   * - 若相等 → result 为 tie
   */
  test('showdown result is consistent with evaluate + compare', () => {
    fc.assert(
      fc.property(nineUniqueCardsArb, (cards) => {
        const playerHand = cards.slice(0, 2);
        const opponentHand = cards.slice(2, 4);
        const communityCards = cards.slice(4, 9);

        // 调用 showdown
        const showdownResult = showdown(playerHand, opponentHand, communityCards);

        // 独立调用 evaluate + compare
        const playerEval = evaluate(playerHand, communityCards);
        const opponentEval = evaluate(opponentHand, communityCards);
        const cmp = compare(playerEval, opponentEval);

        // 验证结果一致性
        if (cmp > 0) {
          expect(showdownResult.result).toBe(GameResult.PlayerWin);
        } else if (cmp < 0) {
          expect(showdownResult.result).toBe(GameResult.OpponentWin);
        } else {
          expect(showdownResult.result).toBe(GameResult.Tie);
        }

        // 验证 showdown 返回的牌型评估与独立评估一致
        expect(showdownResult.playerEval.rankType).toBe(playerEval.rankType);
        expect(showdownResult.playerEval.compareValues).toEqual(playerEval.compareValues);
        expect(showdownResult.opponentEval.rankType).toBe(opponentEval.rankType);
        expect(showdownResult.opponentEval.compareValues).toEqual(opponentEval.compareValues);
      }),
      { numRuns: 100 },
    );
  });
});
