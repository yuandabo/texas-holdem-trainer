// Feature: pvp-mode, Property 14: 卡牌序列化往返一致性
import fc from 'fast-check';
import { serialize, deserialize, serializeMany, deserializeMany } from '@/engine/cardSerializer';
import { Card, Suit, Rank } from '@/engine/types';

const cardArb = fc.record({
  suit: fc.constantFrom(Suit.Spades, Suit.Hearts, Suit.Clubs, Suit.Diamonds),
  rank: fc.integer({ min: 2, max: 14 }).map(r => r as Rank),
});

const cardArrayArb = fc.array(cardArb, { minLength: 0, maxLength: 10 });

describe('Property 14: 卡牌序列化往返一致性', () => {
  /**
   * Validates: Requirements 13.3
   *
   * For any valid Card, serialize then deserialize should equal the original.
   */
  test('deserialize(serialize(card)) equals original card', () => {
    fc.assert(
      fc.property(cardArb, (card: Card) => {
        const restored = deserialize(serialize(card));
        expect(restored).toEqual(card);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 13.3
   *
   * For any array of valid Cards, serializeMany then deserializeMany should equal the original array.
   */
  test('deserializeMany(serializeMany(cards)) equals original array', () => {
    fc.assert(
      fc.property(cardArrayArb, (cards: Card[]) => {
        const restored = deserializeMany(serializeMany(cards));
        expect(restored).toEqual(cards);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 13.3
   *
   * For any valid Card, JSON.parse(JSON.stringify(card)) (Socket.IO mechanism) preserves the card.
   */
  test('JSON.parse(JSON.stringify(card)) round-trip preserves card (Socket.IO)', () => {
    fc.assert(
      fc.property(cardArb, (card: Card) => {
        const restored = JSON.parse(JSON.stringify(card)) as Card;
        expect(restored).toEqual(card);
      }),
      { numRuns: 100 },
    );
  });
});
