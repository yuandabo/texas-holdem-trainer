import {
  Suit, Rank, Card, HandRankType,
  GameResult,
  CardSerializationError, DealError, EvaluationError,
} from '../engine/types';

describe('Core types and enums', () => {
  test('Suit enum has 4 values', () => {
    expect(Suit.Spades).toBe('S');
    expect(Suit.Hearts).toBe('H');
    expect(Suit.Clubs).toBe('C');
    expect(Suit.Diamonds).toBe('D');
  });

  test('Rank enum ranges from 2 to 14', () => {
    expect(Rank.Two).toBe(2);
    expect(Rank.Ace).toBe(14);
  });

  test('HandRankType enum ranges from 1 to 10', () => {
    expect(HandRankType.HighCard).toBe(1);
    expect(HandRankType.RoyalFlush).toBe(10);
  });

  test('GameResult enum values', () => {
    expect(GameResult.PlayerWin).toBe('player_win');
    expect(GameResult.OpponentWin).toBe('opponent_win');
    expect(GameResult.Tie).toBe('tie');
  });

  test('Card interface works correctly', () => {
    const card: Card = { suit: Suit.Spades, rank: Rank.Ace };
    expect(card.suit).toBe('S');
    expect(card.rank).toBe(14);
  });

  test('CardSerializationError', () => {
    const err = new CardSerializationError('test error');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('CardSerializationError');
    expect(err.message).toBe('test error');
  });

  test('DealError', () => {
    const err = new DealError('not enough cards');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('DealError');
    expect(err.message).toBe('not enough cards');
  });

  test('EvaluationError', () => {
    const err = new EvaluationError('duplicate cards');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('EvaluationError');
    expect(err.message).toBe('duplicate cards');
  });
});
