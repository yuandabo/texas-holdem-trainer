import fc from 'fast-check';
import { Card, Suit, Rank, HandRankType } from '@/engine/types';
import { evaluate, compare } from '@/engine/handEvaluator';

/**
 * 将 Card 转为唯一字符串键，用于集合比较
 */
function cardKey(card: Card): string {
  return `${card.suit}${card.rank}`;
}

/** Card 生成器 */
const cardArb = fc.record({
  suit: fc.constantFrom(Suit.Spades, Suit.Hearts, Suit.Clubs, Suit.Diamonds),
  rank: fc.integer({ min: 2, max: 14 }).map((r) => r as Rank),
});

/** 7 张不重复牌生成器 */
const sevenUniqueCardsArb = fc.uniqueArray(cardArb, {
  minLength: 7,
  maxLength: 7,
  comparator: (a, b) => a.suit === b.suit && a.rank === b.rank,
});

// Feature: texas-holdem-trainer, Property 5: 牌型判定输出不变量
describe('Property 5: 牌型判定输出不变量', () => {
  /**
   * Validates: Requirements 4.1, 4.2, 4.3
   *
   * 验证 evaluate() 返回：
   * - rankType 在 1-10 范围内
   * - rankName 非空
   * - bestCards 恰好 5 张且为输入 7 张牌的子集
   */
  test('evaluate returns valid rankType, non-empty rankName, and 5 bestCards that are a subset of input', () => {
    fc.assert(
      fc.property(sevenUniqueCardsArb, (cards) => {
        const hand = cards.slice(0, 2);
        const communityCards = cards.slice(2, 7);

        const result = evaluate(hand, communityCards);

        // 1. rankType 在 1-10 范围内
        expect(result.rankType).toBeGreaterThanOrEqual(HandRankType.HighCard);
        expect(result.rankType).toBeLessThanOrEqual(HandRankType.RoyalFlush);

        // 2. rankName 非空字符串
        expect(typeof result.rankName).toBe('string');
        expect(result.rankName.length).toBeGreaterThan(0);

        // 3. bestCards 恰好 5 张
        expect(result.bestCards).toHaveLength(5);

        // 4. bestCards 中的每张牌都来自输入的 7 张牌（子集检查）
        const inputKeys = new Set(cards.map(cardKey));
        for (const card of result.bestCards) {
          expect(inputKeys.has(cardKey(card))).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * 生成从 arr 中选 k 个元素的所有组合
 */
function combinations<T>(arr: T[], k: number): T[][] {
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
 * 独立的 5 张牌牌型评估函数（用于测试验证，不依赖 handEvaluator 内部实现）
 * 返回 compareValues 数组，用于与 evaluate() 结果比较
 */
function evaluateFiveCardsIndependent(cards: Card[]): { rankType: HandRankType; compareValues: number[] } {
  const ranks = cards.map((c) => c.rank).sort((a, b) => a - b);
  const suits = cards.map((c) => c.suit);
  const isFlush = suits.every((s) => s === suits[0]);

  // 检查顺子
  let straightHigh = 0;
  const isConsecutive = ranks[4] - ranks[0] === 4 && new Set(ranks).size === 5;
  if (isConsecutive) {
    straightHigh = ranks[4];
  } else if (
    ranks[0] === Rank.Two &&
    ranks[1] === Rank.Three &&
    ranks[2] === Rank.Four &&
    ranks[3] === Rank.Five &&
    ranks[4] === Rank.Ace
  ) {
    straightHigh = Rank.Five; // A-low straight
  }
  const isStraight = straightHigh > 0;

  // 统计频率
  const countMap = new Map<number, number>();
  for (const r of ranks) {
    countMap.set(r, (countMap.get(r) || 0) + 1);
  }
  const entries = Array.from(countMap.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });
  const counts = entries.map((e) => e[1]);
  const ranksOrdered = entries.map((e) => e[0]);

  if (isFlush && isStraight) {
    if (straightHigh === Rank.Ace && ranks[0] === Rank.Ten) {
      return { rankType: HandRankType.RoyalFlush, compareValues: [HandRankType.RoyalFlush] };
    }
    return { rankType: HandRankType.StraightFlush, compareValues: [HandRankType.StraightFlush, straightHigh] };
  }
  if (counts[0] === 4) {
    return { rankType: HandRankType.FourOfAKind, compareValues: [HandRankType.FourOfAKind, ranksOrdered[0], ranksOrdered[1]] };
  }
  if (counts[0] === 3 && counts[1] === 2) {
    return { rankType: HandRankType.FullHouse, compareValues: [HandRankType.FullHouse, ranksOrdered[0], ranksOrdered[1]] };
  }
  if (isFlush) {
    const sortedDesc = [...ranks].sort((a, b) => b - a);
    return { rankType: HandRankType.Flush, compareValues: [HandRankType.Flush, ...sortedDesc] };
  }
  if (isStraight) {
    return { rankType: HandRankType.Straight, compareValues: [HandRankType.Straight, straightHigh] };
  }
  if (counts[0] === 3) {
    return { rankType: HandRankType.ThreeOfAKind, compareValues: [HandRankType.ThreeOfAKind, ranksOrdered[0], ranksOrdered[1], ranksOrdered[2]] };
  }
  if (counts[0] === 2 && counts[1] === 2) {
    return { rankType: HandRankType.TwoPair, compareValues: [HandRankType.TwoPair, ranksOrdered[0], ranksOrdered[1], ranksOrdered[2]] };
  }
  if (counts[0] === 2) {
    return { rankType: HandRankType.OnePair, compareValues: [HandRankType.OnePair, ranksOrdered[0], ranksOrdered[1], ranksOrdered[2], ranksOrdered[3]] };
  }
  return { rankType: HandRankType.HighCard, compareValues: [HandRankType.HighCard, ...ranksOrdered] };
}

/**
 * 比较两个 compareValues 数组
 */
function compareValuesArrays(a: number[], b: number[]): number {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const va = a[i] ?? 0;
    const vb = b[i] ?? 0;
    if (va !== vb) return va - vb;
  }
  return 0;
}

// Feature: texas-holdem-trainer, Property 6: 最佳牌型选择的最优性
describe('Property 6: 最佳牌型选择的最优性', () => {
  /**
   * Validates: Requirements 4.2
   *
   * 验证 evaluate() 返回的 5 张牌组合的牌型等级 >= 从 7 张牌中任意其他 5 张组合的牌型等级。
   * 若牌型等级相同，则 compareValues 比较结果 >= 0。
   */
  test('evaluate returns the optimal 5-card combination from 7 cards', () => {
    fc.assert(
      fc.property(sevenUniqueCardsArb, (cards) => {
        const hand = cards.slice(0, 2);
        const communityCards = cards.slice(2, 7);

        // 获取 evaluate 返回的最佳结果
        const bestResult = evaluate(hand, communityCards);

        // 生成所有 C(7,5) = 21 种 5 张牌组合
        const allCombos = combinations(cards, 5);
        expect(allCombos).toHaveLength(21);

        // 对每个 5 张组合独立评估，验证 bestResult >= 该组合
        for (const combo of allCombos) {
          const comboEval = evaluateFiveCardsIndependent(combo);

          // bestResult 的 rankType 应 >= 该组合的 rankType
          if (bestResult.rankType !== comboEval.rankType) {
            expect(bestResult.rankType).toBeGreaterThanOrEqual(comboEval.rankType);
          } else {
            // rankType 相同时，compareValues 比较应 >= 0
            const cmp = compareValuesArrays(bestResult.compareValues, comboEval.compareValues);
            expect(cmp).toBeGreaterThanOrEqual(0);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: texas-holdem-trainer, Property 7: 牌型比较的传递性和反对称性
describe('Property 7: 牌型比较的传递性和反对称性', () => {
  /**
   * Validates: Requirements 4.4, 11.2, 11.3
   *
   * 验证 compare() 满足反对称性：sign(compare(a,b)) === -sign(compare(b,a))
   */
  test('compare satisfies antisymmetry', () => {
    fc.assert(
      fc.property(sevenUniqueCardsArb, sevenUniqueCardsArb, (cardsA, cardsB) => {
        const evalA = evaluate(cardsA.slice(0, 2), cardsA.slice(2, 7));
        const evalB = evaluate(cardsB.slice(0, 2), cardsB.slice(2, 7));

        const ab = compare(evalA, evalB);
        const ba = compare(evalB, evalA);

        if (ab === 0) {
          expect(ba).toBe(0);
        } else {
          expect(Math.sign(ab)).toBe(-Math.sign(ba));
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 4.4, 11.2, 11.3
   *
   * 验证 compare() 满足传递性：
   * 若 compare(a,b) > 0 且 compare(b,c) > 0，则 compare(a,c) > 0
   * 若 compare(a,b) < 0 且 compare(b,c) < 0，则 compare(a,c) < 0
   */
  test('compare satisfies transitivity', () => {
    fc.assert(
      fc.property(sevenUniqueCardsArb, sevenUniqueCardsArb, sevenUniqueCardsArb, (cardsA, cardsB, cardsC) => {
        const evalA = evaluate(cardsA.slice(0, 2), cardsA.slice(2, 7));
        const evalB = evaluate(cardsB.slice(0, 2), cardsB.slice(2, 7));
        const evalC = evaluate(cardsC.slice(0, 2), cardsC.slice(2, 7));

        const ab = compare(evalA, evalB);
        const bc = compare(evalB, evalC);
        const ac = compare(evalA, evalC);

        if (ab > 0 && bc > 0) {
          expect(ac).toBeGreaterThan(0);
        }
        if (ab < 0 && bc < 0) {
          expect(ac).toBeLessThan(0);
        }
      }),
      { numRuns: 100 },
    );
  });
});
