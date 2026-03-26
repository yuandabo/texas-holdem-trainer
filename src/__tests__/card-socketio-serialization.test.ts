import { Card, Suit, Rank } from '@/engine/types';

/**
 * Task 8.1: 验证 Card 对象通过 Socket.IO JSON 序列化正确传输
 *
 * Socket.IO uses JSON.stringify/JSON.parse for data transmission.
 * This test verifies that Card objects (with enum suit and rank fields)
 * survive this round-trip with suit and rank values preserved.
 */
describe('Card Socket.IO JSON serialization', () => {
  const allSuits = [Suit.Spades, Suit.Hearts, Suit.Clubs, Suit.Diamonds];
  const allRanks = [
    Rank.Two, Rank.Three, Rank.Four, Rank.Five, Rank.Six,
    Rank.Seven, Rank.Eight, Rank.Nine, Rank.Ten,
    Rank.Jack, Rank.Queen, Rank.King, Rank.Ace,
  ];

  test('single Card survives JSON.stringify/JSON.parse round-trip', () => {
    for (const suit of allSuits) {
      for (const rank of allRanks) {
        const card: Card = { suit, rank };
        const restored = JSON.parse(JSON.stringify(card)) as Card;
        expect(restored.suit).toBe(card.suit);
        expect(restored.rank).toBe(card.rank);
      }
    }
  });

  test('Card[] array survives JSON.stringify/JSON.parse round-trip', () => {
    const cards: Card[] = [
      { suit: Suit.Spades, rank: Rank.Ace },
      { suit: Suit.Hearts, rank: Rank.Two },
      { suit: Suit.Clubs, rank: Rank.King },
      { suit: Suit.Diamonds, rank: Rank.Ten },
    ];
    const restored = JSON.parse(JSON.stringify(cards)) as Card[];
    expect(restored).toHaveLength(cards.length);
    restored.forEach((card, i) => {
      expect(card.suit).toBe(cards[i].suit);
      expect(card.rank).toBe(cards[i].rank);
    });
  });

  test('nested Card objects in a gameState-like payload survive round-trip', () => {
    const payload = {
      myHand: [
        { suit: Suit.Spades, rank: Rank.Ace },
        { suit: Suit.Hearts, rank: Rank.King },
      ],
      communityCards: [
        { suit: Suit.Clubs, rank: Rank.Ten },
        { suit: Suit.Diamonds, rank: Rank.Jack },
        { suit: Suit.Spades, rank: Rank.Queen },
      ],
      opponentHand: null as Card[] | null,
    };

    const restored = JSON.parse(JSON.stringify(payload));

    expect(restored.myHand[0].suit).toBe(Suit.Spades);
    expect(restored.myHand[0].rank).toBe(Rank.Ace);
    expect(restored.myHand[1].suit).toBe(Suit.Hearts);
    expect(restored.myHand[1].rank).toBe(Rank.King);
    expect(restored.communityCards).toHaveLength(3);
    expect(restored.communityCards[0].suit).toBe(Suit.Clubs);
    expect(restored.communityCards[0].rank).toBe(Rank.Ten);
    expect(restored.opponentHand).toBeNull();
  });
});
