import { BettingAction, BettingActionType, BettingError, BettingRoundState, ChipState } from './types';
import { deductChips } from './chipManager';

export function createBettingRound(pot: number, firstActor: 'player' | 'opponent'): BettingRoundState {
  return { pot, playerRoundBet: 0, opponentRoundBet: 0, currentActor: firstActor, playerActed: false, opponentActed: false, roundEnded: false, foldedBy: null, lastRaiseAmount: 0 };
}

export function isRoundComplete(roundState: BettingRoundState, chipState?: ChipState): boolean {
  if (roundState.foldedBy !== null) return true;
  if (roundState.playerActed && roundState.opponentActed && roundState.playerRoundBet === roundState.opponentRoundBet) return true;
  if (chipState && roundState.playerActed && roundState.opponentActed && (chipState.playerChips === 0 || chipState.opponentChips === 0)) return true;
  return false;
}

export function getAvailableActions(roundState: BettingRoundState, actorChips: number, minRaise: number): BettingActionType[] {
  if (roundState.roundEnded) return [];
  const actor = roundState.currentActor;
  const actorBet = actor === 'player' ? roundState.playerRoundBet : roundState.opponentRoundBet;
  const otherBet = actor === 'player' ? roundState.opponentRoundBet : roundState.playerRoundBet;
  const betToCall = otherBet - actorBet;
  if (betToCall > 0) {
    if (actorChips <= betToCall) return ['all_in', 'fold'];
    if (actorChips < betToCall + minRaise) return ['call', 'all_in', 'fold'];
    return ['call', 'raise', 'fold'];
  }
  if (actorChips <= minRaise) return ['check', 'all_in', 'fold'];
  return ['check', 'raise', 'fold'];
}

function switchActor(actor: 'player' | 'opponent'): 'player' | 'opponent' {
  return actor === 'player' ? 'opponent' : 'player';
}

export function executeBettingAction(roundState: BettingRoundState, chipState: ChipState, action: BettingAction, minRaise: number): { roundState: BettingRoundState; chipState: ChipState } {
  const actor = roundState.currentActor;
  const otherBet = actor === 'player' ? roundState.opponentRoundBet : roundState.playerRoundBet;
  const actorBet = actor === 'player' ? roundState.playerRoundBet : roundState.opponentRoundBet;
  const betToCall = otherBet - actorBet;
  let newRoundState = { ...roundState };
  let newChipState = chipState;

  switch (action.type) {
    case 'check':
      if (actor === 'player') newRoundState.playerActed = true; else newRoundState.opponentActed = true;
      newRoundState.currentActor = switchActor(actor);
      break;
    case 'call':
      newChipState = deductChips(newChipState, actor, betToCall);
      newRoundState.pot += betToCall;
      if (actor === 'player') { newRoundState.playerRoundBet += betToCall; newRoundState.playerActed = true; }
      else { newRoundState.opponentRoundBet += betToCall; newRoundState.opponentActed = true; }
      newRoundState.currentActor = switchActor(actor);
      break;
    case 'raise': {
      const raiseTotal = action.amount;
      const raiseIncrement = raiseTotal - betToCall;
      if (raiseIncrement < minRaise) throw new BettingError('Raise amount below minimum');
      newChipState = deductChips(newChipState, actor, raiseTotal);
      newRoundState.pot += raiseTotal;
      if (actor === 'player') { newRoundState.playerRoundBet += raiseTotal; newRoundState.playerActed = true; newRoundState.opponentActed = false; }
      else { newRoundState.opponentRoundBet += raiseTotal; newRoundState.opponentActed = true; newRoundState.playerActed = false; }
      newRoundState.lastRaiseAmount = raiseIncrement;
      newRoundState.currentActor = switchActor(actor);
      break;
    }
    case 'fold':
      newRoundState.foldedBy = actor;
      newRoundState.roundEnded = true;
      return { roundState: newRoundState, chipState: newChipState };
    case 'all_in': {
      const actorChips = actor === 'player' ? newChipState.playerChips : newChipState.opponentChips;
      newChipState = deductChips(newChipState, actor, actorChips);
      newRoundState.pot += actorChips;
      if (actor === 'player') { newRoundState.playerRoundBet += actorChips; newRoundState.playerActed = true; if (newRoundState.playerRoundBet > newRoundState.opponentRoundBet) newRoundState.opponentActed = false; }
      else { newRoundState.opponentRoundBet += actorChips; newRoundState.opponentActed = true; if (newRoundState.opponentRoundBet > newRoundState.playerRoundBet) newRoundState.playerActed = false; }
      newRoundState.currentActor = switchActor(actor);
      break;
    }
  }
  if (isRoundComplete(newRoundState, newChipState)) newRoundState.roundEnded = true;
  return { roundState: newRoundState, chipState: newChipState };
}

export function postBlinds(chipState: ChipState, smallBlind: 'player' | 'opponent', smallBlindAmount: number, bigBlindAmount: number) {
  const bigBlind = smallBlind === 'player' ? 'opponent' : 'player';
  const sbChips = smallBlind === 'player' ? chipState.playerChips : chipState.opponentChips;
  const actualSB = Math.min(smallBlindAmount, sbChips);
  let newChipState = deductChips(chipState, smallBlind, actualSB);
  const bbChips = bigBlind === 'player' ? newChipState.playerChips : newChipState.opponentChips;
  const actualBB = Math.min(bigBlindAmount, bbChips);
  newChipState = deductChips(newChipState, bigBlind, actualBB);
  return {
    chipState: newChipState,
    pot: actualSB + actualBB,
    playerRoundBet: smallBlind === 'player' ? actualSB : actualBB,
    opponentRoundBet: smallBlind === 'opponent' ? actualSB : actualBB,
  };
}

export function getSmallBlind(handNumber: number): 'player' | 'opponent' {
  return handNumber % 2 === 1 ? 'player' : 'opponent';
}
