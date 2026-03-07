import { ChipState, ChipError, INITIAL_CHIPS } from './types';

/** 创建初始筹码状态 */
export function createChipState(initialChips: number = INITIAL_CHIPS): ChipState {
  return {
    playerChips: initialChips,
    opponentChips: initialChips,
  };
}

/** 从指定方扣减筹码，扣减金额不超过当前余额。负数金额抛出 ChipError */
export function deductChips(
  state: ChipState,
  who: 'player' | 'opponent',
  amount: number,
): ChipState {
  if (amount < 0) {
    throw new ChipError('Invalid deduction amount');
  }

  if (who === 'player') {
    const deducted = Math.min(amount, state.playerChips);
    return { ...state, playerChips: state.playerChips - deducted };
  } else {
    const deducted = Math.min(amount, state.opponentChips);
    return { ...state, opponentChips: state.opponentChips - deducted };
  }
}

/** 将底池筹码分配给获胜方 */
export function awardPot(
  state: ChipState,
  winner: 'player' | 'opponent',
  potAmount: number,
): ChipState {
  if (winner === 'player') {
    return { ...state, playerChips: state.playerChips + potAmount };
  } else {
    return { ...state, opponentChips: state.opponentChips + potAmount };
  }
}

/** 平局分配底池：各得 floor(pot/2)，奇数时多余 1 个给小盲注方 */
export function splitPot(
  state: ChipState,
  potAmount: number,
  smallBlind: 'player' | 'opponent',
): ChipState {
  const half = Math.floor(potAmount / 2);
  const remainder = potAmount % 2;

  let playerShare = half;
  let opponentShare = half;

  if (remainder === 1) {
    if (smallBlind === 'player') {
      playerShare += 1;
    } else {
      opponentShare += 1;
    }
  }

  return {
    playerChips: state.playerChips + playerShare,
    opponentChips: state.opponentChips + opponentShare,
  };
}

/** 检查是否有一方筹码归零 */
export function isGameOver(state: ChipState): boolean {
  return state.playerChips === 0 || state.opponentChips === 0;
}
