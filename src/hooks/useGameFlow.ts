import { useReducer, useCallback, useEffect, useRef } from 'react';
import {
  ShowdownResult,
  ExtendedGameStateData,
  ExtendedGamePhase,
  BettingAction,
  BettingRoundState,
  ChipState,
  GameResult,
  INITIAL_CHIPS,
  SMALL_BLIND_AMOUNT,
  BIG_BLIND_AMOUNT,
  MIN_RAISE,
  AI_DELAY_MS,
} from '@/engine/types';
import { createDeck, shuffle } from '@/engine/deck';
import { dealHands, dealFlop, dealTurn, dealRiver } from '@/engine/dealEngine';
import { showdown } from '@/engine/showdownEngine';
import { createChipState, awardPot, splitPot, isGameOver } from '@/engine/chipManager';
import {
  createBettingRound,
  executeBettingAction,
  postBlinds,
  getSmallBlind,
} from '@/engine/bettingEngine';
import { makeDecision } from '@/engine/opponentAI';

// ===== Action Types =====
export const ACTION_NEW_GAME = 'NEW_GAME' as const;
export const ACTION_NEXT_STEP = 'NEXT_STEP' as const;
export const ACTION_TOGGLE_HAND_RANK_HINT = 'TOGGLE_HAND_RANK_HINT' as const;
export const ACTION_TOGGLE_WIN_RATE_HINT = 'TOGGLE_WIN_RATE_HINT' as const;
export const ACTION_PLAYER_BET = 'PLAYER_BET' as const;
export const ACTION_OPPONENT_BET = 'OPPONENT_BET' as const;
export const ACTION_START_BETTING_ROUND = 'START_BETTING_ROUND' as const;
export const ACTION_RESTART_GAME = 'RESTART_GAME' as const;

export type GameAction =
  | { type: typeof ACTION_NEW_GAME }
  | { type: typeof ACTION_NEXT_STEP }
  | { type: typeof ACTION_TOGGLE_HAND_RANK_HINT }
  | { type: typeof ACTION_TOGGLE_WIN_RATE_HINT };

export type BettingGameAction =
  | GameAction
  | { type: typeof ACTION_PLAYER_BET; action: BettingAction }
  | { type: typeof ACTION_OPPONENT_BET; decision: BettingAction }
  | { type: typeof ACTION_START_BETTING_ROUND }
  | { type: typeof ACTION_RESTART_GAME };

// ===== Helper: check if a phase is a betting phase =====
function isBettingPhase(phase: ExtendedGamePhase): boolean {
  return (
    phase === 'pre_flop_betting' ||
    phase === 'flop_betting' ||
    phase === 'turn_betting' ||
    phase === 'river_betting'
  );
}

// ===== Initial State Factory =====

/**
 * 创建一局新游戏的初始状态：创建牌组 → 洗牌 → 发手牌 → 发盲注 → phase 设为 pre_flop_betting
 */
export function createExtendedInitialState(handNumber: number = 1, chipState?: ChipState): ExtendedGameStateData {
  const deck = createDeck();
  const shuffled = shuffle(deck);
  const { playerHand, opponentHand, remainingDeck } = dealHands(shuffled);

  const chips = chipState ?? createChipState(INITIAL_CHIPS);
  const smallBlind = getSmallBlind(handNumber);

  // Post blinds
  const blindResult = postBlinds(chips, smallBlind, SMALL_BLIND_AMOUNT, BIG_BLIND_AMOUNT);

  // Create pre-flop betting round. In pre-flop, small blind acts first.
  const bettingRound: BettingRoundState = {
    ...createBettingRound(blindResult.pot, smallBlind),
    playerRoundBet: blindResult.playerRoundBet,
    opponentRoundBet: blindResult.opponentRoundBet,
  };

  return {
    phase: 'pre_flop_betting',
    playerHand,
    opponentHand,
    communityCards: [],
    remainingDeck,
    showdownResult: null,
    handRankHintEnabled: false,
    winRateHintEnabled: false,
    chipState: blindResult.chipState,
    bettingRound,
    handNumber,
    isGameOver: false,
    gameOverWinner: null,
  };
}

/**
 * 保留旧的 createInitialState 用于向后兼容。
 * 返回 ExtendedGameStateData（是 GameStateData 的超集）。
 */
export function createInitialState(): ExtendedGameStateData {
  return createExtendedInitialState();
}

// ===== Settlement helpers =====

/**
 * 处理弃牌结算：将底池分配给未弃牌方
 */
function handleFoldSettlement(state: ExtendedGameStateData): ExtendedGameStateData {
  const bettingRound = state.bettingRound!;
  const winner = bettingRound.foldedBy === 'player' ? 'opponent' : 'player';
  const newChipState = awardPot(state.chipState, winner, bettingRound.pot);

  const gameOver = isGameOver(newChipState);
  const gameOverWinner = gameOver
    ? (newChipState.playerChips === 0 ? 'opponent' : 'player')
    : null;

  return {
    ...state,
    phase: gameOver ? 'game_over' : 'showdown',
    chipState: newChipState,
    bettingRound: { ...bettingRound, pot: 0 },
    isGameOver: gameOver,
    gameOverWinner,
    showdownResult: null,
  };
}

/**
 * 处理摊牌结算：判定胜负并分配底池
 */
function handleShowdownSettlement(state: ExtendedGameStateData): ExtendedGameStateData {
  const result: ShowdownResult = showdown(
    state.playerHand,
    state.opponentHand,
    state.communityCards,
  );

  const pot = state.bettingRound?.pot ?? 0;
  let newChipState = state.chipState;
  const smallBlind = getSmallBlind(state.handNumber);

  if (result.result === GameResult.PlayerWin) {
    newChipState = awardPot(newChipState, 'player', pot);
  } else if (result.result === GameResult.OpponentWin) {
    newChipState = awardPot(newChipState, 'opponent', pot);
  } else {
    newChipState = splitPot(newChipState, pot, smallBlind);
  }

  const gameOver = isGameOver(newChipState);
  const gameOverWinner = gameOver
    ? (newChipState.playerChips === 0 ? 'opponent' : 'player')
    : null;

  return {
    ...state,
    phase: gameOver ? 'game_over' : 'showdown',
    chipState: newChipState,
    bettingRound: state.bettingRound ? { ...state.bettingRound, pot: 0 } : null,
    showdownResult: result,
    isGameOver: gameOver,
    gameOverWinner,
  };
}

/**
 * 当下注回合结束后，推进到下一个阶段（发牌 + 进入下一个下注回合，或摊牌）
 */
function advanceAfterBettingComplete(state: ExtendedGameStateData): ExtendedGameStateData {
  const currentPot = state.bettingRound?.pot ?? 0;
  const smallBlind = getSmallBlind(state.handNumber);

  // If either player is all-in (0 chips), skip remaining betting rounds:
  // deal all remaining community cards and go straight to showdown.
  const anyAllIn = state.chipState.playerChips === 0 || state.chipState.opponentChips === 0;

  if (anyAllIn) {
    let communityCards = [...state.communityCards];
    let deck = state.remainingDeck;

    // Deal remaining community cards based on current phase
    if (state.phase === 'pre_flop_betting' || state.phase === 'flop_betting' || state.phase === 'turn_betting') {
      if (communityCards.length < 3) {
        const [flopCards, deckAfterFlop] = dealFlop(deck);
        communityCards = [...communityCards, ...flopCards];
        deck = deckAfterFlop;
      }
      if (communityCards.length < 4) {
        const [turnCard, deckAfterTurn] = dealTurn(deck);
        communityCards = [...communityCards, turnCard];
        deck = deckAfterTurn;
      }
      if (communityCards.length < 5) {
        const [riverCard, deckAfterRiver] = dealRiver(deck);
        communityCards = [...communityCards, riverCard];
        deck = deckAfterRiver;
      }
    }

    return handleShowdownSettlement({
      ...state,
      communityCards,
      remainingDeck: deck,
      bettingRound: state.bettingRound ? { ...state.bettingRound, pot: currentPot } : state.bettingRound,
    });
  }

  switch (state.phase) {
    case 'pre_flop_betting': {
      // Deal flop → enter flop_betting
      const [flopCards, remainingDeck] = dealFlop(state.remainingDeck);
      const newBettingRound = createBettingRound(currentPot, smallBlind);
      return {
        ...state,
        phase: 'flop_betting',
        communityCards: [...state.communityCards, ...flopCards],
        remainingDeck,
        bettingRound: newBettingRound,
      };
    }

    case 'flop_betting': {
      // Deal turn → enter turn_betting
      const [turnCard, remainingDeck] = dealTurn(state.remainingDeck);
      const newBettingRound = createBettingRound(currentPot, smallBlind);
      return {
        ...state,
        phase: 'turn_betting',
        communityCards: [...state.communityCards, turnCard],
        remainingDeck,
        bettingRound: newBettingRound,
      };
    }

    case 'turn_betting': {
      // Deal river → enter river_betting
      const [riverCard, remainingDeck] = dealRiver(state.remainingDeck);
      const newBettingRound = createBettingRound(currentPot, smallBlind);
      return {
        ...state,
        phase: 'river_betting',
        communityCards: [...state.communityCards, riverCard],
        remainingDeck,
        bettingRound: newBettingRound,
      };
    }

    case 'river_betting': {
      // All betting done → showdown settlement
      return handleShowdownSettlement(state);
    }

    default:
      return state;
  }
}


/**
 * 处理下注操作（玩家或对手），返回更新后的状态。
 * 如果下注回合结束，自动推进到下一阶段。
 */
function processBetAction(state: ExtendedGameStateData, action: BettingAction): ExtendedGameStateData {
  if (!state.bettingRound || state.bettingRound.roundEnded) {
    return state;
  }

  const result = executeBettingAction(
    state.bettingRound,
    state.chipState,
    action,
    MIN_RAISE,
  );

  const newState: ExtendedGameStateData = {
    ...state,
    bettingRound: result.roundState,
    chipState: result.chipState,
  };

  // Check if someone folded
  if (result.roundState.foldedBy !== null) {
    return handleFoldSettlement(newState);
  }

  // Check if round is complete
  if (result.roundState.roundEnded) {
    return advanceAfterBettingComplete(newState);
  }

  return newState;
}

// ===== Reducer =====

/**
 * 扩展后的 reducer，管理包含下注流程的游戏状态转换。
 * 导出以便属性测试可以直接调用。
 */
export function gameFlowReducer(state: ExtendedGameStateData, action: BettingGameAction): ExtendedGameStateData {
  switch (action.type) {
    case ACTION_NEW_GAME: {
      // Start a new hand, increment handNumber, preserve chips and hints
      if (state.isGameOver) {
        // Game is over, ignore NEW_GAME (must use RESTART_GAME)
        return state;
      }
      const newHandNumber = state.handNumber + 1;
      const newState = createExtendedInitialState(newHandNumber, state.chipState);
      return {
        ...newState,
        handRankHintEnabled: state.handRankHintEnabled,
        winRateHintEnabled: state.winRateHintEnabled,
      };
    }

    case ACTION_NEXT_STEP: {
      // Disabled during betting phases and game over
      if (isBettingPhase(state.phase) || state.phase === 'game_over') {
        return state;
      }
      // showdown phase: no-op (use NEW_GAME to start next hand)
      if (state.phase === 'showdown') {
        return state;
      }
      // For deal phases (pre_flop, flop, turn, river) - these shouldn't normally
      // be reached in the extended flow since we go directly to betting phases,
      // but handle them for robustness
      return state;
    }

    case ACTION_PLAYER_BET: {
      if (!isBettingPhase(state.phase)) {
        return state;
      }
      if (!state.bettingRound || state.bettingRound.currentActor !== 'player') {
        return state;
      }
      return processBetAction(state, action.action);
    }

    case ACTION_OPPONENT_BET: {
      if (!isBettingPhase(state.phase)) {
        return state;
      }
      if (!state.bettingRound || state.bettingRound.currentActor !== 'opponent') {
        return state;
      }
      return processBetAction(state, action.decision);
    }

    case ACTION_START_BETTING_ROUND: {
      // This is used to transition from a deal phase to its betting phase
      // In the extended flow, this is handled automatically, but kept for explicit control
      return state;
    }

    case ACTION_RESTART_GAME: {
      // Reset everything including chips
      const newState = createExtendedInitialState(1);
      return {
        ...newState,
        handRankHintEnabled: state.handRankHintEnabled,
        winRateHintEnabled: state.winRateHintEnabled,
      };
    }

    case ACTION_TOGGLE_HAND_RANK_HINT: {
      return { ...state, handRankHintEnabled: !state.handRankHintEnabled };
    }

    case ACTION_TOGGLE_WIN_RATE_HINT: {
      return { ...state, winRateHintEnabled: !state.winRateHintEnabled };
    }

    default:
      return state;
  }
}

// ===== Hook =====

export interface UseGameFlowReturn {
  state: ExtendedGameStateData;
  nextStep(): void;
  newGame(): void;
  toggleHandRankHint(): void;
  toggleWinRateHint(): void;
}

export interface ExtendedUseGameFlowReturn extends UseGameFlowReturn {
  state: ExtendedGameStateData;
  placeBet(action: BettingAction): void;
  restartGame(): void;
}

export function useGameFlow(): ExtendedUseGameFlowReturn {
  const [state, dispatch] = useReducer(gameFlowReducer, undefined, createInitialState);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const newGame = useCallback(() => {
    dispatch({ type: ACTION_NEW_GAME });
  }, []);

  const nextStep = useCallback(() => {
    dispatch({ type: ACTION_NEXT_STEP });
  }, []);

  const toggleHandRankHint = useCallback(() => {
    dispatch({ type: ACTION_TOGGLE_HAND_RANK_HINT });
  }, []);

  const toggleWinRateHint = useCallback(() => {
    dispatch({ type: ACTION_TOGGLE_WIN_RATE_HINT });
  }, []);

  const placeBet = useCallback((action: BettingAction) => {
    dispatch({ type: ACTION_PLAYER_BET, action });
  }, []);

  const restartGame = useCallback(() => {
    dispatch({ type: ACTION_RESTART_GAME });
  }, []);

  // Auto-trigger opponent AI when it's opponent's turn during a betting phase
  useEffect(() => {
    if (
      isBettingPhase(state.phase) &&
      state.bettingRound &&
      !state.bettingRound.roundEnded &&
      state.bettingRound.currentActor === 'opponent'
    ) {
      timerRef.current = setTimeout(() => {
        const decision = makeDecision(
          state.bettingRound!,
          state.chipState.opponentChips,
          MIN_RAISE,
          Math.random,
        );
        dispatch({ type: ACTION_OPPONENT_BET, decision: decision.action });
      }, AI_DELAY_MS);

      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      };
    }
  }, [state.phase, state.bettingRound, state.chipState.opponentChips]);

  return {
    state,
    nextStep,
    newGame,
    toggleHandRankHint,
    toggleWinRateHint,
    placeBet,
    restartGame,
  };
}
