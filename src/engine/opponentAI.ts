import type { BettingAction, BettingRoundState } from './types';

/** 随机数生成器类型（返回 0-1 之间的浮点数） */
export type RandomGenerator = () => number;

/** AI 决策结果 */
export interface AIDecision {
  action: BettingAction;
}

/**
 * 根据当前下注回合状态和概率策略做出对手 AI 的下注决策。
 *
 * 决策逻辑：
 * - 无未匹配下注时：70% Check，30% Raise（minRaise 金额）
 * - 存在未匹配下注且筹码不足 Call 时：70% All-In，30% Fold
 * - 存在未匹配下注且筹码充足时：60% Call，20% Raise，20% Fold
 */
export function makeDecision(
  roundState: BettingRoundState,
  opponentChips: number,
  minRaise: number,
  rng: RandomGenerator,
): AIDecision {
  const betToCall = roundState.playerRoundBet - roundState.opponentRoundBet;
  const r = rng();

  if (betToCall <= 0) {
    // No unmatched bet
    if (r < 0.7) {
      return { action: { type: 'check', amount: 0 } };
    }
    return { action: { type: 'raise', amount: minRaise } };
  }

  // Unmatched bet exists
  if (opponentChips < betToCall) {
    // Can't afford to call
    if (r < 0.7) {
      return { action: { type: 'all_in', amount: opponentChips } };
    }
    return { action: { type: 'fold', amount: 0 } };
  }

  // Can afford to call
  if (r < 0.6) {
    return { action: { type: 'call', amount: betToCall } };
  }
  if (r < 0.8) {
    return { action: { type: 'raise', amount: betToCall + minRaise } };
  }
  return { action: { type: 'fold', amount: 0 } };
}
