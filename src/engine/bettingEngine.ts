import {
  BettingAction,
  BettingActionType,
  BettingError,
  BettingRoundState,
  ChipState,
} from './types';
import { deductChips } from './chipManager';

/** 创建新的下注回合状态 */
export function createBettingRound(
  pot: number,
  firstActor: 'player' | 'opponent',
): BettingRoundState {
  return {
    pot,
    playerRoundBet: 0,
    opponentRoundBet: 0,
    currentActor: firstActor,
    playerActed: false,
    opponentActed: false,
    roundEnded: false,
    foldedBy: null,
    lastRaiseAmount: 0,
  };
}

/** 检查下注回合是否应该结束 */
export function isRoundComplete(roundState: BettingRoundState): boolean {
  if (roundState.foldedBy !== null) {
    return true;
  }
  if (
    roundState.playerActed &&
    roundState.opponentActed &&
    roundState.playerRoundBet === roundState.opponentRoundBet
  ) {
    return true;
  }
  return false;
}

/** 获取当前行动方可用的操作列表 */
export function getAvailableActions(
  roundState: BettingRoundState,
  actorChips: number,
  minRaise: number,
): BettingActionType[] {
  if (roundState.roundEnded) {
    return [];
  }

  const actor = roundState.currentActor;
  const actorBet = actor === 'player' ? roundState.playerRoundBet : roundState.opponentRoundBet;
  const otherBet = actor === 'player' ? roundState.opponentRoundBet : roundState.playerRoundBet;
  const betToCall = otherBet - actorBet;

  if (betToCall > 0) {
    if (actorChips <= betToCall) {
      return ['all_in', 'fold'];
    } else if (actorChips < betToCall + minRaise) {
      return ['call', 'all_in', 'fold'];
    } else {
      return ['call', 'raise', 'fold'];
    }
  } else {
    if (actorChips <= minRaise) {
      return ['check', 'all_in'];
    } else {
      return ['check', 'raise'];
    }
  }
}


/** 切换行动方 */
function switchActor(actor: 'player' | 'opponent'): 'player' | 'opponent' {
  return actor === 'player' ? 'opponent' : 'player';
}

/** 验证并执行下注操作，返回新的回合状态和筹码变动 */
export function executeBettingAction(
  roundState: BettingRoundState,
  chipState: ChipState,
  action: BettingAction,
  minRaise: number,
): { roundState: BettingRoundState; chipState: ChipState } {
  const actor = roundState.currentActor;
  const actorBet = actor === 'player' ? roundState.playerRoundBet : roundState.opponentRoundBet;
  const otherBet = actor === 'player' ? roundState.opponentRoundBet : roundState.playerRoundBet;
  const betToCall = otherBet - actorBet;

  let newRoundState = { ...roundState };
  let newChipState = chipState;

  switch (action.type) {
    case 'check': {
      // No chip change, mark actor as acted, switch actor
      if (actor === 'player') {
        newRoundState.playerActed = true;
      } else {
        newRoundState.opponentActed = true;
      }
      newRoundState.currentActor = switchActor(actor);
      break;
    }

    case 'call': {
      // Deduct betToCall from actor, add to pot
      newChipState = deductChips(newChipState, actor, betToCall);
      newRoundState.pot += betToCall;
      if (actor === 'player') {
        newRoundState.playerRoundBet += betToCall;
        newRoundState.playerActed = true;
      } else {
        newRoundState.opponentRoundBet += betToCall;
        newRoundState.opponentActed = true;
      }
      newRoundState.currentActor = switchActor(actor);
      break;
    }

    case 'raise': {
      // action.amount is the TOTAL amount the player puts into the pot this action
      const raiseTotal = action.amount;
      const raiseIncrement = raiseTotal - betToCall;

      if (raiseIncrement < minRaise) {
        throw new BettingError('Raise amount below minimum');
      }

      newChipState = deductChips(newChipState, actor, raiseTotal);
      newRoundState.pot += raiseTotal;
      if (actor === 'player') {
        newRoundState.playerRoundBet += raiseTotal;
        newRoundState.playerActed = true;
        // Reset opponent's acted flag on raise
        newRoundState.opponentActed = false;
      } else {
        newRoundState.opponentRoundBet += raiseTotal;
        newRoundState.opponentActed = true;
        // Reset player's acted flag on raise
        newRoundState.playerActed = false;
      }
      newRoundState.lastRaiseAmount = raiseIncrement;
      newRoundState.currentActor = switchActor(actor);
      break;
    }

    case 'fold': {
      newRoundState.foldedBy = actor;
      newRoundState.roundEnded = true;
      return { roundState: newRoundState, chipState: newChipState };
    }

    case 'all_in': {
      // Deduct all remaining chips
      const actorChips = actor === 'player' ? newChipState.playerChips : newChipState.opponentChips;
      newChipState = deductChips(newChipState, actor, actorChips);
      newRoundState.pot += actorChips;
      if (actor === 'player') {
        newRoundState.playerRoundBet += actorChips;
        newRoundState.playerActed = true;
      } else {
        newRoundState.opponentRoundBet += actorChips;
        newRoundState.opponentActed = true;
      }
      newRoundState.currentActor = switchActor(actor);
      break;
    }
  }

  // After any non-fold action, check if round is complete
  if (isRoundComplete(newRoundState)) {
    newRoundState.roundEnded = true;
  }

  return { roundState: newRoundState, chipState: newChipState };
}

/** 发放盲注，返回更新后的筹码状态和底池金额 */
export function postBlinds(
  chipState: ChipState,
  smallBlind: 'player' | 'opponent',
  smallBlindAmount: number,
  bigBlindAmount: number,
): { chipState: ChipState; pot: number; playerRoundBet: number; opponentRoundBet: number } {
  const bigBlind = smallBlind === 'player' ? 'opponent' : 'player';

  // Small blind: deduct min(smallBlindAmount, smallBlind's chips)
  const smallBlindChips = smallBlind === 'player' ? chipState.playerChips : chipState.opponentChips;
  const actualSmallBlind = Math.min(smallBlindAmount, smallBlindChips);
  let newChipState = deductChips(chipState, smallBlind, actualSmallBlind);

  // Big blind: deduct min(bigBlindAmount, bigBlind's chips)
  const bigBlindChips = bigBlind === 'player' ? newChipState.playerChips : newChipState.opponentChips;
  const actualBigBlind = Math.min(bigBlindAmount, bigBlindChips);
  newChipState = deductChips(newChipState, bigBlind, actualBigBlind);

  const pot = actualSmallBlind + actualBigBlind;

  const playerRoundBet = smallBlind === 'player' ? actualSmallBlind : actualBigBlind;
  const opponentRoundBet = smallBlind === 'opponent' ? actualSmallBlind : actualBigBlind;

  return {
    chipState: newChipState,
    pot,
    playerRoundBet,
    opponentRoundBet,
  };
}

/** 根据牌局序号确定小盲注方：奇数时玩家为小盲注方，偶数时对手为小盲注方 */
export function getSmallBlind(handNumber: number): 'player' | 'opponent' {
  return handNumber % 2 === 1 ? 'player' : 'opponent';
}
