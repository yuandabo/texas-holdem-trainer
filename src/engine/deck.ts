import { Card, Suit, Rank, DealError } from '@/engine/types';

/**
 * 创建一副完整的 52 张标准扑克牌（4 花色 × 13 点数）
 */
export function createDeck(): Card[] {
  const suits = [Suit.Spades, Suit.Hearts, Suit.Clubs, Suit.Diamonds];
  const ranks = [
    Rank.Two, Rank.Three, Rank.Four, Rank.Five, Rank.Six,
    Rank.Seven, Rank.Eight, Rank.Nine, Rank.Ten,
    Rank.Jack, Rank.Queen, Rank.King, Rank.Ace,
  ];

  const deck: Card[] = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

/**
 * 使用 Fisher-Yates 算法将牌组随机打乱
 * 返回一个新的打乱后的数组，不修改原数组
 */
export function shuffle(cards: Card[]): Card[] {
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * 从牌组顶部取出 n 张牌
 * @returns [drawn, remaining] - 取出的牌和剩余的牌
 * @throws DealError 当牌组剩余牌数不足时
 */
export function draw(cards: Card[], n: number): [Card[], Card[]] {
  if (n > cards.length) {
    throw new DealError('Not enough cards in deck');
  }
  const drawn = cards.slice(0, n);
  const remaining = cards.slice(n);
  return [drawn, remaining];
}
