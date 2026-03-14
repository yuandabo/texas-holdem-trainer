// ===== 花色枚举 =====
export enum Suit {
  Spades = 'S',
  Hearts = 'H',
  Clubs = 'C',
  Diamonds = 'D',
}

// ===== 点数枚举 =====
export enum Rank {
  Two = 2, Three = 3, Four = 4, Five = 5, Six = 6,
  Seven = 7, Eight = 8, Nine = 9, Ten = 10,
  Jack = 11, Queen = 12, King = 13, Ace = 14,
}

export interface Card { suit: Suit; rank: Rank; }

export enum HandRankType {
  HighCard = 1, OnePair = 2, TwoPair = 3, ThreeOfAKind = 4,
  Straight = 5, Flush = 6, FullHouse = 7, FourOfAKind = 8,
  StraightFlush = 9, RoyalFlush = 10,
}

export interface HandEvalResult {
  rankType: HandRankType;
  rankName: string;
  bestCards: Card[];
  compareValues: number[];
}

export enum GameResult {
  PlayerWin = 'player_win',
  OpponentWin = 'opponent_win',
  Tie = 'tie',
}

export interface ShowdownResult {
  result: GameResult;
  playerEval: HandEvalResult;
  opponentEval: HandEvalResult;
}

export type BettingPhase = 'pre_flop_betting' | 'flop_betting' | 'turn_betting' | 'river_betting';
export type ExtendedGamePhase = 'pre_flop' | 'flop' | 'turn' | 'river' | 'showdown' | BettingPhase | 'game_over';

export type BettingActionType = 'check' | 'call' | 'raise' | 'fold' | 'all_in';
export interface BettingAction { type: BettingActionType; amount: number; }

export interface ChipState { playerChips: number; opponentChips: number; }

export interface BettingRoundState {
  pot: number;
  playerRoundBet: number;
  opponentRoundBet: number;
  currentActor: 'player' | 'opponent';
  playerActed: boolean;
  opponentActed: boolean;
  roundEnded: boolean;
  foldedBy: 'player' | 'opponent' | null;
  lastRaiseAmount: number;
}

export interface DealResult {
  playerHand: Card[];
  opponentHand: Card[];
  remainingDeck: Card[];
}

export interface ActionLogEntry {
  actor: 'player' | 'opponent';
  phase: string;
  actionType: string;
  amount: number;
}

export const INITIAL_CHIPS = 2000;
export const SMALL_BLIND_AMOUNT = 10;
export const BIG_BLIND_AMOUNT = 20;
export const MIN_RAISE = 20;

export class BettingError extends Error { constructor(msg: string) { super(msg); this.name = 'BettingError'; } }
export class ChipError extends Error { constructor(msg: string) { super(msg); this.name = 'ChipError'; } }
export class DealError extends Error { constructor(msg: string) { super(msg); this.name = 'DealError'; } }
export class EvaluationError extends Error { constructor(msg: string) { super(msg); this.name = 'EvaluationError'; } }
