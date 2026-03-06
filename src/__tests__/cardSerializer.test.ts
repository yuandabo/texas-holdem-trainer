import fc from 'fast-check';
import { serialize, deserialize } from '@/engine/cardSerializer';
import { Card, Suit, Rank, CardSerializationError } from '@/engine/types';

const cardArb = fc.record({
  suit: fc.constantFrom(Suit.Spades, Suit.Hearts, Suit.Clubs, Suit.Diamonds),
  rank: fc.integer({ min: 2, max: 14 }).map(r => r as Rank),
});

// Feature: texas-holdem-trainer, Property 8: Card 序列化往返一致性
describe('Property 8: Card 序列化往返一致性', () => {
  /**
   * Validates: Requirements 8.1, 8.2, 8.3
   *
   * 对于任意有效的 Card 对象，deserialize(serialize(card)) 应产生与原始 card 等价的对象。
   */
  test('deserialize(serialize(card)) produces an equivalent card', () => {
    fc.assert(
      fc.property(cardArb, (card: Card) => {
        const json = serialize(card);
        const restored = deserialize(json);

        expect(restored.suit).toBe(card.suit);
        expect(restored.rank).toBe(card.rank);
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: texas-holdem-trainer, Property 9: 无效 JSON 反序列化产生错误
describe('Property 9: 无效 JSON 反序列化产生错误', () => {
  /**
   * Validates: Requirements 8.4
   *
   * 对于任意无效的 JSON 字符串，deserialize() 应抛出 CardSerializationError。
   */
  test('deserialize() throws CardSerializationError for arbitrary strings', () => {
    fc.assert(
      fc.property(fc.string(), (input: string) => {
        // Filter out strings that happen to be valid Card JSON
        // A valid Card JSON must parse to an object with valid suit (S/H/C/D) and rank (2-14)
        try {
          const parsed = JSON.parse(input);
          if (
            typeof parsed === 'object' &&
            parsed !== null &&
            !Array.isArray(parsed) &&
            ['S', 'H', 'C', 'D'].includes(parsed.suit) &&
            typeof parsed.rank === 'number' &&
            Number.isInteger(parsed.rank) &&
            parsed.rank >= 2 &&
            parsed.rank <= 14
          ) {
            // This is actually a valid Card JSON, skip it
            return;
          }
        } catch {
          // Not valid JSON at all — good, it should throw
        }

        expect(() => deserialize(input)).toThrow(CardSerializationError);
      }),
      { numRuns: 100 },
    );
  });
});
