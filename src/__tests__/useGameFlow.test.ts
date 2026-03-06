import fc from 'fast-check';
import { gameFlowReducer, createInitialState, ACTION_NEXT_STEP, ACTION_NEW_GAME } from '@/hooks/useGameFlow';
import { GamePhase, GameResult } from '@/engine/types';

// Feature: texas-holdem-trainer, Property 3: 牌局阶段按固定顺序推进
describe('Property 3: 牌局阶段按固定顺序推进', () => {
  /**
   * Validates: Requirements 3.1, 3.2
   *
   * 验证连续调用 nextStep() 按 pre_flop → flop → turn → river → showdown 推进阶段，
   * 且每次推进后公共牌数量应分别为 0、3、4、5、5。
   */
  test('consecutive nextStep() calls advance phases in fixed order with correct community card counts', () => {
    const expectedPhases: GamePhase[] = ['pre_flop', 'flop', 'turn', 'river', 'showdown'];
    const expectedCardCounts = [0, 3, 4, 5, 5];

    fc.assert(
      fc.property(fc.constant(null), () => {
        let state = createInitialState();

        // Step 0: initial state is pre_flop with 0 community cards
        expect(state.phase).toBe(expectedPhases[0]);
        expect(state.communityCards).toHaveLength(expectedCardCounts[0]);

        // Steps 1-4: dispatch NEXT_STEP and verify phase + community card count
        for (let i = 1; i < expectedPhases.length; i++) {
          state = gameFlowReducer(state, { type: ACTION_NEXT_STEP });
          expect(state.phase).toBe(expectedPhases[i]);
          expect(state.communityCards).toHaveLength(expectedCardCounts[i]);
        }
      }),
      { numRuns: 100 },
    );
  });
});


// Feature: texas-holdem-trainer, Property 4: 新一局重置所有状态
describe('Property 4: 新一局重置所有状态', () => {
  /**
   * Validates: Requirements 3.4, 9.3
   *
   * 验证在任意阶段调用 newGame() 后，phase 重置为 pre_flop，
   * 玩家和对手各持有 2 张手牌，公共牌为空，结算结果为 null。
   */
  test('newGame() resets all state regardless of current phase', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4 }), (steps) => {
        // Start from initial state
        let state = createInitialState();

        // Advance to a random phase by dispatching 0-4 NEXT_STEP actions
        for (let i = 0; i < steps; i++) {
          state = gameFlowReducer(state, { type: ACTION_NEXT_STEP });
        }

        // Dispatch NEW_GAME action
        state = gameFlowReducer(state, { type: ACTION_NEW_GAME });

        // Verify all state is reset
        expect(state.phase).toBe('pre_flop');
        expect(state.playerHand).toHaveLength(2);
        expect(state.opponentHand).toHaveLength(2);
        expect(state.communityCards).toHaveLength(0);
        expect(state.showdownResult).toBeNull();
      }),
      { numRuns: 100 },
    );
  });
});


// Feature: texas-holdem-trainer, Property 12: 结算阶段包含有效结果
describe('Property 12: 结算阶段包含有效结果', () => {
  /**
   * Validates: Requirements 3.3, 11.6
   *
   * 验证完整走完所有阶段（pre_flop 到 showdown）后，
   * showdownResult 非 null 且包含有效的对局结果和双方牌型信息。
   */
  test('showdown phase contains valid result after completing all phases', () => {
    const validResults = [GameResult.PlayerWin, GameResult.OpponentWin, GameResult.Tie];

    fc.assert(
      fc.property(fc.constant(null), () => {
        // 1. Create initial state
        let state = createInitialState();

        // 2. Dispatch 4 NEXT_STEP actions to reach showdown
        for (let i = 0; i < 4; i++) {
          state = gameFlowReducer(state, { type: ACTION_NEXT_STEP });
        }

        // Confirm we are in showdown phase
        expect(state.phase).toBe('showdown');

        // 3. showdownResult is not null
        expect(state.showdownResult).not.toBeNull();
        const result = state.showdownResult!;

        // 4. result is one of GameResult values
        expect(validResults).toContain(result.result);

        // 5. playerEval and opponentEval have non-empty rankName
        expect(result.playerEval.rankName).toBeTruthy();
        expect(result.playerEval.rankName.length).toBeGreaterThan(0);
        expect(result.opponentEval.rankName).toBeTruthy();
        expect(result.opponentEval.rankName.length).toBeGreaterThan(0);

        // 6. bestCards each have exactly 5 cards
        expect(result.playerEval.bestCards).toHaveLength(5);
        expect(result.opponentEval.bestCards).toHaveLength(5);
      }),
      { numRuns: 100 },
    );
  });
});
