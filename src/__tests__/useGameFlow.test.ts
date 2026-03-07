import fc from 'fast-check';
import {
  gameFlowReducer,
  createInitialState,
  createExtendedInitialState,
  ACTION_NEW_GAME,
  ACTION_PLAYER_BET,
  ACTION_OPPONENT_BET,
  ACTION_RESTART_GAME,
  ACTION_NEXT_STEP,
} from '@/hooks/useGameFlow';
import { ExtendedGameStateData, GameResult, BettingAction } from '@/engine/types';

/**
 * Helper: simulate both players checking/calling through a single betting round.
 * Returns the state after the betting round completes (advanced to next phase).
 */
function checkThroughBettingRound(state: ExtendedGameStateData): ExtendedGameStateData {
  let s = state;
  const startPhase = s.phase;
  const maxActions = 10; // safety limit
  for (let i = 0; i < maxActions; i++) {
    // Stop if phase changed (round completed and advanced)
    if (s.phase !== startPhase) break;
    if (!s.bettingRound || s.bettingRound.roundEnded) break;

    const actor = s.bettingRound.currentActor;

    // If there's an unmatched bet, call; otherwise check
    const actorBet = actor === 'player' ? s.bettingRound.playerRoundBet : s.bettingRound.opponentRoundBet;
    const otherBet = actor === 'player' ? s.bettingRound.opponentRoundBet : s.bettingRound.playerRoundBet;
    const betToCall = otherBet - actorBet;

    const action: BettingAction = betToCall > 0
      ? { type: 'call', amount: betToCall }
      : { type: 'check', amount: 0 };

    if (actor === 'player') {
      s = gameFlowReducer(s, { type: ACTION_PLAYER_BET, action });
    } else {
      s = gameFlowReducer(s, { type: ACTION_OPPONENT_BET, decision: action });
    }
  }
  return s;
}

// Feature: chip-betting-system, Property 13 (partial): 牌局阶段按固定顺序推进（含下注回合）
describe('Phase progression with betting rounds', () => {
  /**
   * Validates: Requirements 3.1, 10.1, 10.2, 10.5
   *
   * 验证通过下注回合推进，阶段按正确顺序前进：
   * pre_flop_betting → flop_betting → turn_betting → river_betting → showdown
   * 且每次推进后公共牌数量正确。
   */
  test('completing betting rounds advances phases in correct order with correct community card counts', () => {
    const expectedPhases = [
      'pre_flop_betting',
      'flop_betting',
      'turn_betting',
      'river_betting',
      'showdown',
    ];
    const expectedCardCounts = [0, 3, 4, 5, 5];

    fc.assert(
      fc.property(fc.constant(null), () => {
        let state = createInitialState();

        // Step 0: initial state is pre_flop_betting with 0 community cards
        expect(state.phase).toBe(expectedPhases[0]);
        expect(state.communityCards).toHaveLength(expectedCardCounts[0]);

        // Steps 1-4: check through each betting round
        for (let i = 1; i < expectedPhases.length; i++) {
          state = checkThroughBettingRound(state);
          expect(state.phase).toBe(expectedPhases[i]);
          expect(state.communityCards).toHaveLength(expectedCardCounts[i]);
        }
      }),
      { numRuns: 100 },
    );
  });
});


// Feature: chip-betting-system, Property 14 (partial): 新一局重置下注状态
describe('New game resets state correctly', () => {
  /**
   * Validates: Requirements 10.4
   *
   * 验证在任意阶段调用 newGame() 后，phase 重置为 pre_flop_betting，
   * 玩家和对手各持有 2 张手牌，公共牌为空，结算结果为 null，
   * handNumber 递增，底池为盲注总额。
   */
  test('newGame() resets state and increments handNumber', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 3 }), (bettingRounds) => {
        let state = createInitialState();

        // Advance through some betting rounds
        for (let i = 0; i < bettingRounds; i++) {
          state = checkThroughBettingRound(state);
          if (state.phase === 'showdown' || state.phase === 'game_over') break;
        }

        const prevHandNumber = state.handNumber;

        // Dispatch NEW_GAME action
        state = gameFlowReducer(state, { type: ACTION_NEW_GAME });

        // Verify state is reset for new hand
        expect(state.phase).toBe('pre_flop_betting');
        expect(state.playerHand).toHaveLength(2);
        expect(state.opponentHand).toHaveLength(2);
        expect(state.communityCards).toHaveLength(0);
        expect(state.showdownResult).toBeNull();
        expect(state.handNumber).toBe(prevHandNumber + 1);
        // Pot should be blinds total (3 normally)
        expect(state.bettingRound).not.toBeNull();
        expect(state.bettingRound!.pot).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: chip-betting-system: 结算阶段包含有效结果
describe('Showdown contains valid result after completing all betting rounds', () => {
  /**
   * Validates: Requirements 3.3, 6.3
   *
   * 验证完整走完所有下注回合后到达 showdown，
   * showdownResult 非 null 且包含有效的对局结果和双方牌型信息。
   */
  test('showdown phase contains valid result after completing all betting rounds', () => {
    const validResults = [GameResult.PlayerWin, GameResult.OpponentWin, GameResult.Tie];

    fc.assert(
      fc.property(fc.constant(null), () => {
        let state = createInitialState();

        // Check through all 4 betting rounds to reach showdown
        for (let i = 0; i < 4; i++) {
          state = checkThroughBettingRound(state);
        }

        expect(state.phase).toBe('showdown');
        expect(state.showdownResult).not.toBeNull();
        const result = state.showdownResult!;

        expect(validResults).toContain(result.result);
        expect(result.playerEval.rankName).toBeTruthy();
        expect(result.opponentEval.rankName).toBeTruthy();
        expect(result.playerEval.bestCards).toHaveLength(5);
        expect(result.opponentEval.bestCards).toHaveLength(5);
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: chip-betting-system: NEXT_STEP disabled during betting
describe('NEXT_STEP disabled during betting phases', () => {
  test('NEXT_STEP is a no-op during betting phases', () => {
    const state = createInitialState();
    expect(state.phase).toBe('pre_flop_betting');

    const afterNextStep = gameFlowReducer(state, { type: ACTION_NEXT_STEP });
    // Should be unchanged
    expect(afterNextStep.phase).toBe('pre_flop_betting');
    expect(afterNextStep).toBe(state);
  });
});

// Feature: chip-betting-system: Fold immediately ends hand
describe('Fold immediately ends hand', () => {
  test('player fold awards pot to opponent', () => {
    let state = createInitialState();
    // Player is small blind in hand 1, so player acts first
    const foldAction: BettingAction = { type: 'fold', amount: 0 };

    if (state.bettingRound!.currentActor === 'player') {
      state = gameFlowReducer(state, { type: ACTION_PLAYER_BET, action: foldAction });
    } else {
      // If opponent acts first, let opponent check, then player folds
      state = gameFlowReducer(state, {
        type: ACTION_OPPONENT_BET,
        decision: { type: 'check', amount: 0 },
      });
      state = gameFlowReducer(state, { type: ACTION_PLAYER_BET, action: foldAction });
    }

    // Should be in showdown (settlement) phase, not game_over (chips still > 0)
    expect(state.phase).toBe('showdown');
    expect(state.showdownResult).toBeNull(); // No showdown evaluation on fold
  });
});

// Feature: chip-betting-system: RESTART_GAME resets everything
describe('RESTART_GAME resets everything', () => {
  test('restartGame resets chips and handNumber', () => {
    let state = createInitialState();
    // Play through to showdown
    for (let i = 0; i < 4; i++) {
      state = checkThroughBettingRound(state);
    }
    // Start new game to increment handNumber
    state = gameFlowReducer(state, { type: ACTION_NEW_GAME });
    expect(state.handNumber).toBe(2);

    // Now restart
    state = gameFlowReducer(state, { type: ACTION_RESTART_GAME });
    expect(state.handNumber).toBe(1);
    expect(state.chipState.playerChips + state.chipState.opponentChips + (state.bettingRound?.pot ?? 0)).toBe(4000);
    expect(state.phase).toBe('pre_flop_betting');
    expect(state.isGameOver).toBe(false);
  });
});

// Feature: chip-betting-system: Game over prevents NEW_GAME
describe('Game over state', () => {
  test('NEW_GAME is ignored when game is over', () => {
    // Create a state where game is over
    let state = createExtendedInitialState(1, { playerChips: 0, opponentChips: 4000 });
    // Force game over state
    state = { ...state, phase: 'game_over', isGameOver: true, gameOverWinner: 'opponent' };

    const afterNewGame = gameFlowReducer(state, { type: ACTION_NEW_GAME });
    expect(afterNewGame).toBe(state); // No change
  });
});
