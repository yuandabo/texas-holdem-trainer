import {
  Card,
  Rank,
  HandRankType,
  HandEvalResult,
  EvaluationError,
} from '@/engine/types';

/** 牌型中文名称映射 */
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

/**
 * 生成从 arr 中选 k 个元素的所有组合
 */
export function combinations<T>(arr: T[], k: number): T[][] {
  const result: T[][] = [];
  function backtrack(start: number, current: T[]) {
    if (current.length === k) {
      result.push([...current]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      current.push(arr[i]);
      backtrack(i + 1, current);
      current.pop();
    }
  }
  backtrack(0, []);
  return result;
}

/**
 * 检查 5 张牌是否为同花
 */
function isFlush(cards: Card[]): boolean {
  return cards.every((c) => c.suit === cards[0].suit);
}

/**
 * 检查 5 张牌是否为顺子，返回顺子最高牌的 rank 值，非顺子返回 0。
 * 处理 A 的双重角色：A-2-3-4-5 (低顺，最高牌为 5) 和 10-J-Q-K-A (高顺)
 */
function getStraightHighRank(cards: Card[]): number {
  const ranks = cards.map((c) => c.rank).sort((a, b) => a - b);

  // 检查普通顺子：5 张连续
  const isConsecutive =
    ranks[4] - ranks[0] === 4 &&
    new Set(ranks).size === 5;

  if (isConsecutive) {
    return ranks[4];
  }

  // 检查 A-low 顺子: A-2-3-4-5 (ranks sorted: [2,3,4,5,14])
  if (
    ranks[0] === Rank.Two &&
    ranks[1] === Rank.Three &&
    ranks[2] === Rank.Four &&
    ranks[3] === Rank.Five &&
    ranks[4] === Rank.Ace
  ) {
    return Rank.Five; // A-low 顺子最高牌为 5
  }

  return 0;
}

/**
 * 统计各点数出现的频率，返回 Map<rank, count>
 */
function getRankCounts(cards: Card[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const card of cards) {
    counts.set(card.rank, (counts.get(card.rank) || 0) + 1);
  }
  return counts;
}

/**
 * 评估一手 5 张牌的牌型
 */
export function evaluateFiveCards(cards: Card[]): HandEvalResult {
  const flush = isFlush(cards);
  const straightHigh = getStraightHighRank(cards);
  const straight = straightHigh > 0;
  const rankCounts = getRankCounts(cards);

  // 按频率降序、同频率按 rank 降序排列
  const entries = Array.from(rankCounts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]; // 频率降序
    return b[0] - a[0]; // rank 降序
  });

  const counts = entries.map((e) => e[1]);
  const ranksOrdered = entries.map((e) => e[0]);

  // 判定牌型
  if (flush && straight) {
    if (straightHigh === Rank.Ace && cards.every((c) => c.rank >= Rank.Ten)) {
      // 皇家同花顺: 10-J-Q-K-A 同花
      return {
        rankType: HandRankType.RoyalFlush,
        rankName: RANK_NAMES[HandRankType.RoyalFlush],
        bestCards: cards,
        compareValues: [HandRankType.RoyalFlush],
      };
    }
    // 同花顺
    return {
      rankType: HandRankType.StraightFlush,
      rankName: RANK_NAMES[HandRankType.StraightFlush],
      bestCards: cards,
      compareValues: [HandRankType.StraightFlush, straightHigh],
    };
  }

  if (counts[0] === 4) {
    // 四条: [rankType, 四条rank, 踢脚牌rank]
    return {
      rankType: HandRankType.FourOfAKind,
      rankName: RANK_NAMES[HandRankType.FourOfAKind],
      bestCards: cards,
      compareValues: [HandRankType.FourOfAKind, ranksOrdered[0], ranksOrdered[1]],
    };
  }

  if (counts[0] === 3 && counts[1] === 2) {
    // 葫芦: [rankType, 三条rank, 对子rank]
    return {
      rankType: HandRankType.FullHouse,
      rankName: RANK_NAMES[HandRankType.FullHouse],
      bestCards: cards,
      compareValues: [HandRankType.FullHouse, ranksOrdered[0], ranksOrdered[1]],
    };
  }

  if (flush) {
    // 同花: [rankType, 5张牌rank降序]
    const sortedRanks = cards.map((c) => c.rank).sort((a, b) => b - a);
    return {
      rankType: HandRankType.Flush,
      rankName: RANK_NAMES[HandRankType.Flush],
      bestCards: cards,
      compareValues: [HandRankType.Flush, ...sortedRanks],
    };
  }

  if (straight) {
    // 顺子: [rankType, 最高牌rank]
    return {
      rankType: HandRankType.Straight,
      rankName: RANK_NAMES[HandRankType.Straight],
      bestCards: cards,
      compareValues: [HandRankType.Straight, straightHigh],
    };
  }

  if (counts[0] === 3) {
    // 三条: [rankType, 三条rank, 踢脚牌1, 踢脚牌2]
    return {
      rankType: HandRankType.ThreeOfAKind,
      rankName: RANK_NAMES[HandRankType.ThreeOfAKind],
      bestCards: cards,
      compareValues: [HandRankType.ThreeOfAKind, ranksOrdered[0], ranksOrdered[1], ranksOrdered[2]],
    };
  }

  if (counts[0] === 2 && counts[1] === 2) {
    // 两对: [rankType, 高对rank, 低对rank, 踢脚牌rank]
    return {
      rankType: HandRankType.TwoPair,
      rankName: RANK_NAMES[HandRankType.TwoPair],
      bestCards: cards,
      compareValues: [HandRankType.TwoPair, ranksOrdered[0], ranksOrdered[1], ranksOrdered[2]],
    };
  }

  if (counts[0] === 2) {
    // 一对: [rankType, 对子rank, 踢脚牌1, 踢脚牌2, 踢脚牌3]
    return {
      rankType: HandRankType.OnePair,
      rankName: RANK_NAMES[HandRankType.OnePair],
      bestCards: cards,
      compareValues: [HandRankType.OnePair, ranksOrdered[0], ranksOrdered[1], ranksOrdered[2], ranksOrdered[3]],
    };
  }

  // 高牌: [rankType, 5张牌rank降序]
  return {
    rankType: HandRankType.HighCard,
    rankName: RANK_NAMES[HandRankType.HighCard],
    bestCards: cards,
    compareValues: [HandRankType.HighCard, ...ranksOrdered],
  };
}

/**
 * 比较两个 compareValues 数组，从左到右逐元素比较
 * 返回 >0 表示 a 更大，<0 表示 b 更大，0 表示相等
 */
function compareValues(a: number[], b: number[]): number {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const va = a[i] ?? 0;
    const vb = b[i] ?? 0;
    if (va !== vb) return va - vb;
  }
  return 0;
}

/**
 * 检查 7 张牌中是否有重复
 */
function hasDuplicates(cards: Card[]): boolean {
  const seen = new Set<string>();
  for (const card of cards) {
    const key = `${card.suit}${card.rank}`;
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

/**
 * 从 7 张牌（2 手牌 + 5 公共牌）中选出最佳 5 张组合并判定牌型
 * @throws EvaluationError 当输入不足 7 张或有重复时
 */
export function evaluate(hand: Card[], communityCards: Card[]): HandEvalResult {
  const allCards = [...hand, ...communityCards];

  if (allCards.length < 7) {
    throw new EvaluationError(`Expected 7 cards, got ${allCards.length}`);
  }

  if (hasDuplicates(allCards)) {
    throw new EvaluationError('Duplicate cards detected');
  }

  // 生成所有 C(7,5) = 21 种 5 张牌组合
  const combos = combinations(allCards, 5);

  let best: HandEvalResult | null = null;

  for (const combo of combos) {
    const result = evaluateFiveCards(combo);
    if (best === null || compareValues(result.compareValues, best.compareValues) > 0) {
      best = result;
    }
  }

  return best!;
}

/**
 * 比较两个牌型结果
 * @returns >0 表示 a 更大，<0 表示 b 更大，0 表示相等
 */
export function compare(a: HandEvalResult, b: HandEvalResult): number {
  return compareValues(a.compareValues, b.compareValues);
}
