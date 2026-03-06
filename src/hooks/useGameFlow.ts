import { useReducer, useCallback } from 'react';
import { GameStateData, ShowdownResult } from '@/engine/types';
import { createDeck, shuffle } from '@/engine/deck';
import { dealHands, dealFlop, dealTurn, dealRiver } from '@/engine/dealEngine';
import { showdown } from '@/engine/showdownEngine';

// ===== Action Types =====
export const ACTION_NEW_GAME = 'NEW_GAME' as const;
export const ACTION_NEXT_STEP = 'NEXT_STEP' as const;
export const ACTION_TOGGLE_HAND_RANK_HINT = 'TOGGLE_HAND_RANK_HINT' as const;
export const ACTION_TOGGLE_WIN_RATE_HINT = 'TOGGLE_WIN_RATE_HINT' as const;

export type GameAction =
  | { type: typeof ACTION_NEW_GAME }
  | { type: typeof ACTION_NEXT_STEP }
  | { type: typeof ACTION_TOGGLE_HAND_RANK_HINT }
  | { type: typeof ACTION_TOGGLE_WIN_RATE_HINT };

// ===== Initial State Factory =====

/**
 * 创建一局新游戏的初始状态：创建牌组 → 洗牌 → 发手牌 → phase 设为 pre_flop
 */
export function createInitialState(): GameStateData {
  const deck = createDeck();
  const shuffled = shuffle(deck);
  const { playerHand, opponentHand, remainingDeck } = dealHands(shuffled);

  return {
    phase: 'pre_flop',
    playerHand,
    opponentHand,
    communityCards: [],
    remainingDeck,
    showdownResult: null,
    handRankHintEnabled: false,
    winRateHintEnabled: false,
  };
}

// ===== Reducer =====

/**
 * 纯函数 reducer，管理游戏状态转换。
 * 导出以便属性测试可以直接调用，无需 React 的 useReducer。
 */
export function gameFlowReducer(state: GameStateData, action: GameAction): GameStateData {
  switch (action.type) {
    case ACTION_NEW_GAME: {
      const newState = createInitialState();
      // 保留提示开关状态
      return {
        ...newState,
        handRankHintEnabled: state.handRankHintEnabled,
        winRateHintEnabled: state.winRateHintEnabled,
      };
    }

    case ACTION_NEXT_STEP: {
      return advancePhase(state);
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

/**
 * 根据当前阶段推进到下一阶段并触发对应发牌操作
 */
function advancePhase(state: GameStateData): GameStateData {
  switch (state.phase) {
    case 'pre_flop': {
      const [flopCards, remainingDeck] = dealFlop(state.remainingDeck);
      return {
        ...state,
        phase: 'flop',
        communityCards: [...state.communityCards, ...flopCards],
        remainingDeck,
      };
    }

    case 'flop': {
      const [turnCard, remainingDeck] = dealTurn(state.remainingDeck);
      return {
        ...state,
        phase: 'turn',
        communityCards: [...state.communityCards, turnCard],
        remainingDeck,
      };
    }

    case 'turn': {
      const [riverCard, remainingDeck] = dealRiver(state.remainingDeck);
      return {
        ...state,
        phase: 'river',
        communityCards: [...state.communityCards, riverCard],
        remainingDeck,
      };
    }

    case 'river': {
      const result: ShowdownResult = showdown(
        state.playerHand,
        state.opponentHand,
        state.communityCards,
      );
      return {
        ...state,
        phase: 'showdown',
        showdownResult: result,
      };
    }

    case 'showdown': {
      // showdown 阶段调用 nextStep 时忽略操作（no-op）
      return state;
    }

    default:
      return state;
  }
}

// ===== Hook =====

export interface UseGameFlowReturn {
  state: GameStateData;
  nextStep(): void;
  newGame(): void;
  toggleHandRankHint(): void;
  toggleWinRateHint(): void;
}

export function useGameFlow(): UseGameFlowReturn {
  const [state, dispatch] = useReducer(gameFlowReducer, undefined, createInitialState);

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

  return { state, nextStep, newGame, toggleHandRankHint, toggleWinRateHint };
}
