import { Card, Rank, HandRankType, HandEvalResult, EvaluationError } from './types';

const RANK_NAMES: Record<HandRankType, string> = {
  [HandRankType.RoyalFlush]: '皇家同花顺',
  [HandRankType.StraightFlush]: '同花顺',
  [HandRankType.FourOfAKind]: '四条',
  [HandRankType.FullHouse]: '葫芦',
  [HandRankType.Flush]: '同花',
  [HandRankType.Straight]: '顺子',
  [HandRankType.ThreeOfAKind]: '三条',
  [HandRankType.TwoPair]: '两对',
  [HandRankType.OnePair]: '一对',
  [HandRankType.HighCard]: '高牌',
};

export function combinations<T>(arr: T[], k: number): T[][] {
  const result: T[][] = [];
  function backtrack(start: number, current: T[]) {
    if (current.length === k) { result.push([...current]); return; }
    for (let i = start; i < arr.length; i++) {
      current.push(arr[i]);
      backtrack(i + 1, current);
      current.pop();
    }
  }
  backtrack(0, []);
  return result;
}

function isFlush(cards: Card[]): boolean {
  return cards.every(c => c.suit === cards[0].suit);
}

function getStraightHighRank(cards: Card[]): number {
  const ranks = cards.map(c => c.rank).sort((a, b) => a - b);
  const isConsecutive = ranks[4] - ranks[0] === 4 && new Set(ranks).size === 5;
  if (isConsecutive) return ranks[4];
  if (ranks[0] === Rank.Two && ranks[1] === Rank.Three && ranks[2] === Rank.Four && ranks[3] === Rank.Five && ranks[4] === Rank.Ace) return Rank.Five;
  return 0;
}

function getRankCounts(cards: Card[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const card of cards) counts.set(card.rank, (counts.get(card.rank) || 0) + 1);
  return counts;
}

export function evaluateFiveCards(cards: Card[]): HandEvalResult {
  const flush = isFlush(cards);
  const straightHigh = getStraightHighRank(cards);
  const straight = straightHigh > 0;
  const rankCounts = getRankCounts(cards);
  const entries = Array.from(rankCounts.entries()).sort((a, b) => b[1] !== a[1] ? b[1] - a[1] : b[0] - a[0]);
  const counts = entries.map(e => e[1]);
  const ranksOrdered = entries.map(e => e[0]);

  if (flush && straight) {
    if (straightHigh === Rank.Ace && cards.every(c => c.rank >= Rank.Ten))
      return { rankType: HandRankType.RoyalFlush, rankName: RANK_NAMES[HandRankType.RoyalFlush], bestCards: cards, compareValues: [HandRankType.RoyalFlush] };
    return { rankType: HandRankType.StraightFlush, rankName: RANK_NAMES[HandRankType.StraightFlush], bestCards: cards, compareValues: [HandRankType.StraightFlush, straightHigh] };
  }
  if (counts[0] === 4) return { rankType: HandRankType.FourOfAKind, rankName: RANK_NAMES[HandRankType.FourOfAKind], bestCards: cards, compareValues: [HandRankType.FourOfAKind, ranksOrdered[0], ranksOrdered[1]] };
  if (counts[0] === 3 && counts[1] === 2) return { rankType: HandRankType.FullHouse, rankName: RANK_NAMES[HandRankType.FullHouse], bestCards: cards, compareValues: [HandRankType.FullHouse, ranksOrdered[0], ranksOrdered[1]] };
  if (flush) { const sr = cards.map(c => c.rank).sort((a, b) => b - a); return { rankType: HandRankType.Flush, rankName: RANK_NAMES[HandRankType.Flush], bestCards: cards, compareValues: [HandRankType.Flush, ...sr] }; }
  if (straight) return { rankType: HandRankType.Straight, rankName: RANK_NAMES[HandRankType.Straight], bestCards: cards, compareValues: [HandRankType.Straight, straightHigh] };
  if (counts[0] === 3) return { rankType: HandRankType.ThreeOfAKind, rankName: RANK_NAMES[HandRankType.ThreeOfAKind], bestCards: cards, compareValues: [HandRankType.ThreeOfAKind, ranksOrdered[0], ranksOrdered[1], ranksOrdered[2]] };
  if (counts[0] === 2 && counts[1] === 2) return { rankType: HandRankType.TwoPair, rankName: RANK_NAMES[HandRankType.TwoPair], bestCards: cards, compareValues: [HandRankType.TwoPair, ranksOrdered[0], ranksOrdered[1], ranksOrdered[2]] };
  if (counts[0] === 2) return { rankType: HandRankType.OnePair, rankName: RANK_NAMES[HandRankType.OnePair], bestCards: cards, compareValues: [HandRankType.OnePair, ranksOrdered[0], ranksOrdered[1], ranksOrdered[2], ranksOrdered[3]] };
  return { rankType: HandRankType.HighCard, rankName: RANK_NAMES[HandRankType.HighCard], bestCards: cards, compareValues: [HandRankType.HighCard, ...ranksOrdered] };
}

function compareValues(a: number[], b: number[]): number {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) { const va = a[i] ?? 0; const vb = b[i] ?? 0; if (va !== vb) return va - vb; }
  return 0;
}

function hasDuplicates(cards: Card[]): boolean {
  const seen = new Set<string>();
  for (const card of cards) { const key = `${card.suit}${card.rank}`; if (seen.has(key)) return true; seen.add(key); }
  return false;
}

export function evaluate(hand: Card[], communityCards: Card[]): HandEvalResult {
  const allCards = [...hand, ...communityCards];
  if (allCards.length < 7) throw new EvaluationError(`Expected 7 cards, got ${allCards.length}`);
  if (hasDuplicates(allCards)) throw new EvaluationError('Duplicate cards detected');
  const combos = combinations(allCards, 5);
  let best: HandEvalResult | null = null;
  for (const combo of combos) {
    const result = evaluateFiveCards(combo);
    if (best === null || compareValues(result.compareValues, best.compareValues) > 0) best = result;
  }
  return best!;
}

export function compare(a: HandEvalResult, b: HandEvalResult): number {
  return compareValues(a.compareValues, b.compareValues);
}
