import { Card, Suit, Rank, CardSerializationError } from './types';

const VALID_SUITS = new Set<string>([Suit.Spades, Suit.Hearts, Suit.Clubs, Suit.Diamonds]);
const VALID_RANKS = new Set<number>([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);

/** Card 对象序列化为 JSON 字符串 */
export function serialize(card: Card): string {
  return JSON.stringify({ suit: card.suit, rank: card.rank });
}

/** JSON 字符串反序列化为 Card 对象 */
export function deserialize(json: string): Card {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new CardSerializationError('Invalid JSON format');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new CardSerializationError('Invalid JSON format');
  }

  const obj = parsed as Record<string, unknown>;

  if (!('suit' in obj)) {
    throw new CardSerializationError('Missing required field: suit');
  }
  if (!('rank' in obj)) {
    throw new CardSerializationError('Missing required field: rank');
  }

  const suit = obj.suit;
  const rank = obj.rank;

  if (typeof suit !== 'string' || !VALID_SUITS.has(suit)) {
    throw new CardSerializationError(`Invalid suit value: ${suit}`);
  }

  const rankNum = typeof rank === 'number' ? rank : Number(rank);
  if (!Number.isInteger(rankNum) || !VALID_RANKS.has(rankNum)) {
    throw new CardSerializationError(`Invalid rank value: ${rank}`);
  }

  return { suit: suit as Suit, rank: rankNum as Rank };
}

/** 批量序列化 Card[] → JSON 字符串 */
export function serializeMany(cards: Card[]): string {
  return JSON.stringify(cards.map(c => ({ suit: c.suit, rank: c.rank })));
}

/** 批量反序列化 JSON 字符串 → Card[] */
export function deserializeMany(json: string): Card[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new CardSerializationError('Invalid JSON format');
  }

  if (!Array.isArray(parsed)) {
    throw new CardSerializationError('Invalid JSON format');
  }

  return parsed.map((item) => {
    const itemJson = JSON.stringify(item);
    try {
      return deserialize(itemJson);
    } catch (e) {
      if (e instanceof CardSerializationError) {
        throw e;
      }
      throw new CardSerializationError('Invalid JSON format');
    }
  });
}
