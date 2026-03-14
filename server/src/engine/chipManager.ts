import { ChipState, ChipError, INITIAL_CHIPS } from './types';

export function createChipState(initialChips: number = INITIAL_CHIPS): ChipState {
  return { playerChips: initialChips, opponentChips: initialChips };
}

export function deductChips(state: ChipState, who: 'player' | 'opponent', amount: number): ChipState {
  if (amount < 0) throw new ChipError('Invalid deduction amount');
  if (who === 'player') {
    const deducted = Math.min(amount, state.playerChips);
    return { ...state, playerChips: state.playerChips - deducted };
  } else {
    const deducted = Math.min(amount, state.opponentChips);
    return { ...state, opponentChips: state.opponentChips - deducted };
  }
}

export function awardPot(state: ChipState, winner: 'player' | 'opponent', potAmount: number): ChipState {
  if (winner === 'player') return { ...state, playerChips: state.playerChips + potAmount };
  return { ...state, opponentChips: state.opponentChips + potAmount };
}

export function splitPot(state: ChipState, potAmount: number, smallBlind: 'player' | 'opponent'): ChipState {
  const half = Math.floor(potAmount / 2);
  const remainder = potAmount % 2;
  let playerShare = half, opponentShare = half;
  if (remainder === 1) { if (smallBlind === 'player') playerShare += 1; else opponentShare += 1; }
  return { playerChips: state.playerChips + playerShare, opponentChips: state.opponentChips + opponentShare };
}

export function isGameOver(state: ChipState): boolean {
  return state.playerChips === 0 || state.opponentChips === 0;
}
