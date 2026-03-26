/**
 * 验证 server/src/engine/ 下的引擎模块可正常导入和使用
 * Task 1.3: 确认 deck、dealEngine、bettingEngine、handEvaluator、showdownEngine、chipManager、types 模块的关键导出存在且可用
 */

import { createDeck, shuffle, draw } from '../deck';
import { dealHands, dealFlop, dealTurn, dealRiver } from '../dealEngine';
import {
  createBettingRound,
  isRoundComplete,
  getAvailableActions,
  executeBettingAction,
  postBlinds,
  getSmallBlind,
} from '../bettingEngine';
import { evaluate, compare, combinations, evaluateFiveCards } from '../handEvaluator';
import { showdown } from '../showdownEngine';
import { createChipState, deductChips, awardPot, splitPot, isGameOver } from '../chipManager';
import {
  Suit,
  Rank,
  HandRankType,
  GameResult,
  INITIAL_CHIPS,
  SMALL_BLIND_AMOUNT,
  BIG_BLIND_AMOUNT,
  MIN_RAISE,
  BettingError,
  ChipError,
  DealError,
  EvaluationError,
} from '../types';
import type {
  Card,
  ChipState,
  BettingRoundState,
  BettingAction,
  BettingActionType,
  HandEvalResult,
  ShowdownResult,
  DealResult,
  ActionLogEntry,
  ExtendedGamePhase,
  BettingPhase,
} from '../types';

describe('Engine modules import verification', () => {
  // ===== deck module =====
  describe('deck', () => {
    it('should export createDeck that returns 52 cards', () => {
      const deck = createDeck();
      expect(deck).toHaveLength(52);
      expect(deck[0]).toHaveProperty('suit');
      expect(deck[0]).toHaveProperty('rank');
    });

    it('should export shuffle that returns a shuffled copy', () => {
      const deck = createDeck();
      const shuffled = shuffle(deck);
      expect(shuffled).toHaveLength(52);
      // Original should be unchanged
      expect(deck).toEqual(createDeck());
    });

    it('should export draw that splits the deck', () => {
      const deck = createDeck();
      const [drawn, remaining] = draw(deck, 5);
      expect(drawn).toHaveLength(5);
      expect(remaining).toHaveLength(47);
    });
  });

  // ===== dealEngine module =====
  describe('dealEngine', () => {
    it('should export dealHands that deals 2 cards to each player', () => {
      const deck = shuffle(createDeck());
      const result: DealResult = dealHands(deck);
      expect(result.playerHand).toHaveLength(2);
      expect(result.opponentHand).toHaveLength(2);
      expect(result.remainingDeck).toHaveLength(48);
    });

    it('should export dealFlop that deals 3 community cards', () => {
      const deck = shuffle(createDeck());
      const { remainingDeck } = dealHands(deck);
      const [flop, after] = dealFlop(remainingDeck);
      expect(flop).toHaveLength(3);
      expect(after).toHaveLength(45);
    });

    it('should export dealTurn that deals 1 card', () => {
      const deck = shuffle(createDeck());
      const { remainingDeck } = dealHands(deck);
      const [flop, afterFlop] = dealFlop(remainingDeck);
      const [turnCard, afterTurn] = dealTurn(afterFlop);
      expect(turnCard).toHaveProperty('suit');
      expect(turnCard).toHaveProperty('rank');
      expect(afterTurn).toHaveLength(44);
    });

    it('should export dealRiver that deals 1 card', () => {
      const deck = shuffle(createDeck());
      const { remainingDeck } = dealHands(deck);
      const [, afterFlop] = dealFlop(remainingDeck);
      const [, afterTurn] = dealTurn(afterFlop);
      const [riverCard, afterRiver] = dealRiver(afterTurn);
      expect(riverCard).toHaveProperty('suit');
      expect(afterRiver).toHaveLength(43);
    });
  });

  // ===== bettingEngine module =====
  describe('bettingEngine', () => {
    it('should export createBettingRound', () => {
      const round = createBettingRound(30, 'player');
      expect(round.pot).toBe(30);
      expect(round.currentActor).toBe('player');
      expect(round.roundEnded).toBe(false);
    });

    it('should export isRoundComplete', () => {
      const round = createBettingRound(30, 'player');
      expect(isRoundComplete(round)).toBe(false);
    });

    it('should export getAvailableActions', () => {
      const round = createBettingRound(30, 'player');
      const actions = getAvailableActions(round, 1000, MIN_RAISE);
      expect(Array.isArray(actions)).toBe(true);
      expect(actions.length).toBeGreaterThan(0);
    });

    it('should export executeBettingAction', () => {
      const round = createBettingRound(30, 'player');
      const chips: ChipState = { playerChips: 1000, opponentChips: 1000 };
      const action: BettingAction = { type: 'check', amount: 0 };
      const result = executeBettingAction(round, chips, action, MIN_RAISE);
      expect(result).toHaveProperty('roundState');
      expect(result).toHaveProperty('chipState');
    });

    it('should export postBlinds', () => {
      const chips = createChipState();
      const result = postBlinds(chips, 'player', SMALL_BLIND_AMOUNT, BIG_BLIND_AMOUNT);
      expect(result.pot).toBe(30);
      expect(result.chipState.playerChips).toBe(INITIAL_CHIPS - SMALL_BLIND_AMOUNT);
      expect(result.chipState.opponentChips).toBe(INITIAL_CHIPS - BIG_BLIND_AMOUNT);
    });

    it('should export getSmallBlind', () => {
      expect(getSmallBlind(1)).toBe('player');
      expect(getSmallBlind(2)).toBe('opponent');
    });
  });

  // ===== handEvaluator module =====
  describe('handEvaluator', () => {
    it('should export evaluate and compare', () => {
      const hand: Card[] = [
        { suit: Suit.Spades, rank: Rank.Ace },
        { suit: Suit.Hearts, rank: Rank.King },
      ];
      const community: Card[] = [
        { suit: Suit.Clubs, rank: Rank.Queen },
        { suit: Suit.Diamonds, rank: Rank.Jack },
        { suit: Suit.Spades, rank: Rank.Ten },
        { suit: Suit.Hearts, rank: Rank.Two },
        { suit: Suit.Clubs, rank: Rank.Three },
      ];
      const result: HandEvalResult = evaluate(hand, community);
      expect(result).toHaveProperty('rankType');
      expect(result).toHaveProperty('rankName');
      expect(result).toHaveProperty('bestCards');
      expect(result).toHaveProperty('compareValues');
      expect(result.rankType).toBe(HandRankType.Straight);
    });

    it('should export combinations', () => {
      const combos = combinations([1, 2, 3, 4], 2);
      expect(combos).toHaveLength(6);
    });

    it('should export evaluateFiveCards', () => {
      const cards: Card[] = [
        { suit: Suit.Spades, rank: Rank.Ace },
        { suit: Suit.Spades, rank: Rank.King },
        { suit: Suit.Spades, rank: Rank.Queen },
        { suit: Suit.Spades, rank: Rank.Jack },
        { suit: Suit.Spades, rank: Rank.Ten },
      ];
      const result = evaluateFiveCards(cards);
      expect(result.rankType).toBe(HandRankType.RoyalFlush);
    });

    it('should export compare for hand comparison', () => {
      const hand1: Card[] = [
        { suit: Suit.Spades, rank: Rank.Ace },
        { suit: Suit.Hearts, rank: Rank.Ace },
      ];
      const hand2: Card[] = [
        { suit: Suit.Clubs, rank: Rank.Two },
        { suit: Suit.Diamonds, rank: Rank.Three },
      ];
      const community: Card[] = [
        { suit: Suit.Spades, rank: Rank.King },
        { suit: Suit.Hearts, rank: Rank.Queen },
        { suit: Suit.Clubs, rank: Rank.Jack },
        { suit: Suit.Diamonds, rank: Rank.Nine },
        { suit: Suit.Spades, rank: Rank.Eight },
      ];
      const eval1 = evaluate(hand1, community);
      const eval2 = evaluate(hand2, community);
      const cmp = compare(eval1, eval2);
      expect(cmp).toBeGreaterThan(0); // Pair of Aces beats high card
    });
  });

  // ===== showdownEngine module =====
  describe('showdownEngine', () => {
    it('should export showdown that returns a ShowdownResult', () => {
      const playerHand: Card[] = [
        { suit: Suit.Spades, rank: Rank.Ace },
        { suit: Suit.Hearts, rank: Rank.King },
      ];
      const opponentHand: Card[] = [
        { suit: Suit.Clubs, rank: Rank.Two },
        { suit: Suit.Diamonds, rank: Rank.Three },
      ];
      const community: Card[] = [
        { suit: Suit.Spades, rank: Rank.Queen },
        { suit: Suit.Hearts, rank: Rank.Jack },
        { suit: Suit.Clubs, rank: Rank.Ten },
        { suit: Suit.Diamonds, rank: Rank.Nine },
        { suit: Suit.Spades, rank: Rank.Eight },
      ];
      const result: ShowdownResult = showdown(playerHand, opponentHand, community);
      expect(result).toHaveProperty('result');
      expect(result).toHaveProperty('playerEval');
      expect(result).toHaveProperty('opponentEval');
      expect(Object.values(GameResult)).toContain(result.result);
    });
  });

  // ===== chipManager module =====
  describe('chipManager', () => {
    it('should export createChipState', () => {
      const chips = createChipState();
      expect(chips.playerChips).toBe(INITIAL_CHIPS);
      expect(chips.opponentChips).toBe(INITIAL_CHIPS);
    });

    it('should export deductChips', () => {
      const chips = createChipState();
      const after = deductChips(chips, 'player', 100);
      expect(after.playerChips).toBe(INITIAL_CHIPS - 100);
      expect(after.opponentChips).toBe(INITIAL_CHIPS);
    });

    it('should export awardPot', () => {
      const chips: ChipState = { playerChips: 900, opponentChips: 1000 };
      const after = awardPot(chips, 'player', 200);
      expect(after.playerChips).toBe(1100);
    });

    it('should export splitPot', () => {
      const chips: ChipState = { playerChips: 900, opponentChips: 900 };
      const after = splitPot(chips, 200, 'player');
      expect(after.playerChips).toBe(1000);
      expect(after.opponentChips).toBe(1000);
    });

    it('should export isGameOver', () => {
      expect(isGameOver({ playerChips: 0, opponentChips: 2000 })).toBe(true);
      expect(isGameOver({ playerChips: 1000, opponentChips: 1000 })).toBe(false);
    });
  });

  // ===== types module =====
  describe('types', () => {
    it('should export Suit enum', () => {
      expect(Suit.Spades).toBe('S');
      expect(Suit.Hearts).toBe('H');
      expect(Suit.Clubs).toBe('C');
      expect(Suit.Diamonds).toBe('D');
    });

    it('should export Rank enum', () => {
      expect(Rank.Two).toBe(2);
      expect(Rank.Ace).toBe(14);
    });

    it('should export HandRankType enum', () => {
      expect(HandRankType.HighCard).toBe(1);
      expect(HandRankType.RoyalFlush).toBe(10);
    });

    it('should export GameResult enum', () => {
      expect(GameResult.PlayerWin).toBe('player_win');
      expect(GameResult.OpponentWin).toBe('opponent_win');
      expect(GameResult.Tie).toBe('tie');
    });

    it('should export constants', () => {
      expect(INITIAL_CHIPS).toBe(2000);
      expect(SMALL_BLIND_AMOUNT).toBe(10);
      expect(BIG_BLIND_AMOUNT).toBe(20);
      expect(MIN_RAISE).toBe(20);
    });

    it('should export error classes', () => {
      expect(new BettingError('test')).toBeInstanceOf(Error);
      expect(new ChipError('test')).toBeInstanceOf(Error);
      expect(new DealError('test')).toBeInstanceOf(Error);
      expect(new EvaluationError('test')).toBeInstanceOf(Error);
    });
  });
});
