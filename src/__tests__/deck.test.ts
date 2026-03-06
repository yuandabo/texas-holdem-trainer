import fc from 'fast-check';
import { createDeck, shuffle } from '@/engine/deck';
import { Card } from '@/engine/types';

/**
 * 将 Card 转为唯一字符串键，用于集合比较
 */
function cardKey(card: Card): string {
  return `${card.suit}${card.rank}`;
}

// Feature: texas-holdem-trainer, Property 1: 洗牌是一个排列
describe('Property 1: 洗牌是一个排列', () => {
  /**
   * Validates: Requirements 1.1, 1.2, 1.3
   *
   * 验证 shuffle() 后牌组包含与原始牌组完全相同的 52 张牌，无重复。
   * - 洗牌后恰好 52 张牌
   * - 洗牌后包含与原始牌组相同的牌（相同集合，可能不同顺序）
   * - 洗牌后无重复
   */
  test('shuffle produces a permutation of the original 52-card deck', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const original = createDeck();
        const shuffled = shuffle(original);

        // 1. 洗牌后恰好 52 张牌
        expect(shuffled).toHaveLength(52);

        // 2. 无重复：所有牌的 key 组成的 Set 大小应为 52
        const shuffledKeys = shuffled.map(cardKey);
        const uniqueKeys = new Set(shuffledKeys);
        expect(uniqueKeys.size).toBe(52);

        // 3. 洗牌后包含与原始牌组完全相同的牌
        const originalKeys = new Set(original.map(cardKey));
        for (const key of shuffledKeys) {
          expect(originalKeys.has(key)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });
});
