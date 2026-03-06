// ===== 花色枚举 =====
export enum Suit {
  Spades = 'S',    // 黑桃
  Hearts = 'H',    // 红心
  Clubs = 'C',     // 梅花
  Diamonds = 'D',  // 方块
}

// ===== 点数枚举 (2-14, 14=A) =====
export enum Rank {
  Two = 2,
  Three = 3,
  Four = 4,
  Five = 5,
  Six = 6,
  Seven = 7,
  Eight = 8,
  Nine = 9,
  Ten = 10,
  Jack = 11,
  Queen = 12,
  King = 13,
  Ace = 14,
}

// ===== Card 接口 =====
export interface Card {
  suit: Suit;
  rank: Rank;
}

// ===== 牌型等级枚举 (值越大等级越高) =====
export enum HandRankType {
  HighCard = 1,
  OnePair = 2,
  TwoPair = 3,
  ThreeOfAKind = 4,
  Straight = 5,
  Flush = 6,
  FullHouse = 7,
  FourOfAKind = 8,
  StraightFlush = 9,
  RoyalFlush = 10,
}

// ===== 牌型判定结果 =====
export interface HandEvalResult {
  rankType: HandRankType;
  rankName: string;
  bestCards: Card[];
  /** 用于同等级比较的排序值数组 (包含踢脚牌) */
  compareValues: number[];
}

// ===== 对局结果枚举 =====
export enum GameResult {
  PlayerWin = 'player_win',
  OpponentWin = 'opponent_win',
  Tie = 'tie',
}

// ===== 摊牌结果 =====
export interface ShowdownResult {
  result: GameResult;
  playerEval: HandEvalResult;
  opponentEval: HandEvalResult;
}

// ===== 牌局阶段 =====
export type GamePhase = 'pre_flop' | 'flop' | 'turn' | 'river' | 'showdown';

// ===== 游戏状态 =====
export interface GameStateData {
  phase: GamePhase;
  playerHand: Card[];
  opponentHand: Card[];
  communityCards: Card[];
  remainingDeck: Card[];
  showdownResult: ShowdownResult | null;
  handRankHintEnabled: boolean;
  winRateHintEnabled: boolean;
}

// ===== 发牌结果 =====
export interface DealResult {
  playerHand: Card[];
  opponentHand: Card[];
  remainingDeck: Card[];
}

// ===== 自定义错误类 =====
export class CardSerializationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CardSerializationError';
  }
}

export class DealError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DealError';
  }
}

export class EvaluationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EvaluationError';
  }
}
