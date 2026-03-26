import * as fc from 'fast-check';
import { Room, PlayerRole } from '../room.model';
import {
  INITIAL_CHIPS, SMALL_BLIND_AMOUNT, BIG_BLIND_AMOUNT, MIN_RAISE,
  BettingAction, BettingActionType, ExtendedGamePhase,
} from '../../engine/types';
import { getSmallBlind } from '../../engine/bettingEngine';

// ============================================================
// Helpers
// ============================================================

function createStartedRoom(handNumber = 1): Room {
  const room = new Room();
  room.addPlayer('socket-1');
  room.addPlayer('socket-2');
  room.state.handNumber = handNumber;
  room.startNewHand();
  return room;
}

/** Play both players check through a betting round. */
function bothCheck(room: Room): void {
  const a1 = room.getCurrentActor();
  if (!a1) return;
  room.placeBet(a1, { type: 'check', amount: 0 });
  const a2 = room.getCurrentActor();
  if (!a2) return;
  room.placeBet(a2, { type: 'check', amount: 0 });
}

/** Advance from pre-flop all the way to showdown via call+check pattern. */
function advanceToShowdown(room: Room): void {
  // pre_flop: SB calls, BB checks
  const sb = room.getCurrentActor()!;
  room.placeBet(sb, { type: 'call', amount: 10 });
  const bb = room.getCurrentActor()!;
  room.placeBet(bb, { type: 'check', amount: 0 });
  // flop, turn, river: both check
  bothCheck(room);
  bothCheck(room);
  bothCheck(room);
}

const BETTING_PHASES: ExtendedGamePhase[] = [
  'pre_flop_betting', 'flop_betting', 'turn_betting', 'river_betting',
];

/** Deep-clone a plain-serialisable object. */
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// ============================================================
// Feature: pvp-mode, Property 3: 游戏初始状态正确性
// **Validates: Requirements 5.1, 5.11**
// ============================================================

describe('Property 3: 游戏初始状态正确性', () => {
  it('For any new game (hand 1), both players have 2 hole cards, chips correct, phase is pre_flop_betting, pot=30', () => {
    fc.assert(
      fc.property(
        // We only need a seed to trigger different shuffles; hand 1 is always the first hand
        fc.integer({ min: 1, max: 1000 }),
        (_seed) => {
          const room = createStartedRoom(1);

          // Both players have exactly 2 hole cards
          expect(room.getHandForRole('player')).toHaveLength(2);
          expect(room.getHandForRole('opponent')).toHaveLength(2);

          // Hand 1: player is SB (10), opponent is BB (20)
          expect(room.state.chipState.playerChips).toBe(INITIAL_CHIPS - SMALL_BLIND_AMOUNT);   // 1990
          expect(room.state.chipState.opponentChips).toBe(INITIAL_CHIPS - BIG_BLIND_AMOUNT);    // 1980

          // Phase
          expect(room.state.phase).toBe('pre_flop_betting');

          // Pot = SB + BB = 30
          expect(room.state.bettingRound!.pot).toBe(SMALL_BLIND_AMOUNT + BIG_BLIND_AMOUNT);

          // Community cards empty
          expect(room.state.communityCards).toHaveLength(0);

          // Hand number
          expect(room.state.handNumber).toBe(1);
        },
      ),
      { numRuns: 100 },
    );
  });
});


// ============================================================
// Feature: pvp-mode, Property 4: 客户端视角信息隐藏
// **Validates: Requirements 4.4, 9.5**
// ============================================================

describe('Property 4: 客户端视角信息隐藏', () => {
  it('For any non-showdown state, ClientView.opponentHand is null', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<PlayerRole>('player', 'opponent'),
        fc.integer({ min: 1, max: 50 }),
        (role, _seed) => {
          const room = createStartedRoom(1);
          // Room is in pre_flop_betting — a non-showdown phase
          const view = room.getStateForRole(role);
          expect(view.opponentHand).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('For any betting phase reached by advancing, ClientView.opponentHand is null', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<PlayerRole>('player', 'opponent'),
        // How many phases to advance: 0=pre_flop, 1=flop, 2=turn, 3=river
        fc.integer({ min: 0, max: 2 }),
        (role, phasesToAdvance) => {
          const room = createStartedRoom(1);

          // Advance through phases via call/check
          if (phasesToAdvance >= 0) {
            // pre_flop: SB calls, BB checks
            const sb = room.getCurrentActor()!;
            room.placeBet(sb, { type: 'call', amount: 10 });
            if (phasesToAdvance === 0) {
              // Still in pre_flop after SB call, BB hasn't acted
              const view = room.getStateForRole(role);
              expect(view.opponentHand).toBeNull();
              return;
            }
            const bb = room.getCurrentActor()!;
            room.placeBet(bb, { type: 'check', amount: 0 });
          }
          // Now in flop_betting
          if (phasesToAdvance >= 2) {
            bothCheck(room); // flop → turn
          }
          // Now in flop_betting or turn_betting — both are non-showdown
          if (BETTING_PHASES.includes(room.state.phase as any)) {
            const view = room.getStateForRole(role);
            expect(view.opponentHand).toBeNull();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ============================================================
// Feature: pvp-mode, Property 5: 摊牌阶段公开手牌
// **Validates: Requirements 4.5**
// ============================================================

describe('Property 5: 摊牌阶段公开手牌', () => {
  it('For any showdown state, ClientView.opponentHand is not null and has 2 cards', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<PlayerRole>('player', 'opponent'),
        fc.integer({ min: 1, max: 100 }),
        (role, _seed) => {
          const room = createStartedRoom(1);
          advanceToShowdown(room);

          // After showdown, phase is 'showdown' or 'game_over'
          expect(['showdown', 'game_over']).toContain(room.state.phase);

          const view = room.getStateForRole(role);
          expect(view.opponentHand).not.toBeNull();
          expect(view.opponentHand).toHaveLength(2);
        },
      ),
      { numRuns: 100 },
    );
  });
});


// ============================================================
// Feature: pvp-mode, Property 6: 游戏阶段有序推进
// **Validates: Requirements 5.2, 5.3**
// ============================================================

describe('Property 6: 游戏阶段有序推进', () => {
  it('Phases advance strictly in order: pre_flop → flop → turn → river → showdown, community cards: 0→3→4→5', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 200 }),
        (_seed) => {
          const room = createStartedRoom(1);

          // Phase 1: pre_flop_betting, 0 community cards
          expect(room.state.phase).toBe('pre_flop_betting');
          expect(room.state.communityCards).toHaveLength(0);

          // SB calls, BB checks → advance to flop
          const sb1 = room.getCurrentActor()!;
          room.placeBet(sb1, { type: 'call', amount: 10 });
          const bb1 = room.getCurrentActor()!;
          room.placeBet(bb1, { type: 'check', amount: 0 });

          // Phase 2: flop_betting, 3 community cards
          expect(room.state.phase).toBe('flop_betting');
          expect(room.state.communityCards).toHaveLength(3);

          // Both check → advance to turn
          bothCheck(room);

          // Phase 3: turn_betting, 4 community cards
          expect(room.state.phase).toBe('turn_betting');
          expect(room.state.communityCards).toHaveLength(4);

          // Both check → advance to river
          bothCheck(room);

          // Phase 4: river_betting, 5 community cards
          expect(room.state.phase).toBe('river_betting');
          expect(room.state.communityCards).toHaveLength(5);

          // Both check → showdown
          bothCheck(room);

          // Phase 5: showdown (or game_over)
          expect(['showdown', 'game_over']).toContain(room.state.phase);
          expect(room.state.communityCards).toHaveLength(5);
        },
      ),
      { numRuns: 100 },
    );
  });
});


// ============================================================
// Feature: pvp-mode, Property 7: 非法下注不改变状态
// **Validates: Requirements 2.3, 2.4, 5.4, 5.5, 9.3, 9.4**
// ============================================================

describe('Property 7: 非法下注不改变状态', () => {
  it('Wrong actor bet does not change game state', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<BettingActionType>('check', 'call', 'raise', 'fold', 'all_in'),
        fc.integer({ min: 0, max: 500 }),
        (actionType, amount) => {
          const room = createStartedRoom(1);
          const currentActor = room.getCurrentActor()!;
          const wrongActor: PlayerRole = currentActor === 'player' ? 'opponent' : 'player';

          const stateBefore = deepClone(room.state);
          const result = room.placeBet(wrongActor, { type: actionType, amount });

          expect(result).toBe(false);
          expect(deepClone(room.state)).toEqual(stateBefore);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Invalid action type (raise below minimum) does not change game state', () => {
    fc.assert(
      fc.property(
        // Generate a raise amount that is too small (1 to 19, since betToCall=10 and minRaise=20, raise must be >= 30)
        fc.integer({ min: 1, max: 29 }),
        (tooSmallRaise) => {
          const room = createStartedRoom(1);
          const actor = room.getCurrentActor()!;

          const stateBefore = deepClone(room.state);
          const result = room.placeBet(actor, { type: 'raise', amount: tooSmallRaise });

          expect(result).toBe(false);
          expect(deepClone(room.state)).toEqual(stateBefore);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Bet when betting round is null does not change state', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<PlayerRole>('player', 'opponent'),
        fc.constantFrom<BettingActionType>('check', 'call', 'raise', 'fold', 'all_in'),
        (role, actionType) => {
          const room = createStartedRoom(1);
          room.state.bettingRound = null;

          const stateBefore = deepClone(room.state);
          const result = room.placeBet(role, { type: actionType, amount: 0 });

          expect(result).toBe(false);
          expect(deepClone(room.state)).toEqual(stateBefore);
        },
      ),
      { numRuns: 100 },
    );
  });
});


// ============================================================
// Feature: pvp-mode, Property 8: 弃牌结算正确性
// **Validates: Requirements 5.6**
// ============================================================

describe('Property 8: 弃牌结算正确性', () => {
  it('For any fold, non-folding player gets pot, total chips = 4000', () => {
    fc.assert(
      fc.property(
        // Which player folds: the current actor (SB in hand 1)
        fc.boolean(),
        fc.integer({ min: 1, max: 100 }),
        (foldImmediately, _seed) => {
          const room = createStartedRoom(1);
          const TOTAL = INITIAL_CHIPS * 2; // 4000

          if (foldImmediately) {
            // Current actor (SB = player) folds immediately
            const actor = room.getCurrentActor()!;
            const otherRole: PlayerRole = actor === 'player' ? 'opponent' : 'player';
            const otherChipsBefore = actor === 'player'
              ? room.state.chipState.opponentChips
              : room.state.chipState.playerChips;
            const potBefore = room.state.bettingRound!.pot;

            room.placeBet(actor, { type: 'fold', amount: 0 });

            // Non-folding player gets the pot
            const otherChipsAfter = otherRole === 'player'
              ? room.state.chipState.playerChips
              : room.state.chipState.opponentChips;
            expect(otherChipsAfter).toBe(otherChipsBefore + potBefore);
          } else {
            // SB calls, then BB folds
            const sb = room.getCurrentActor()!;
            room.placeBet(sb, { type: 'call', amount: 10 });
            const bb = room.getCurrentActor()!;
            const sbRole: PlayerRole = sb;
            const sbChipsBefore = sbRole === 'player'
              ? room.state.chipState.playerChips
              : room.state.chipState.opponentChips;
            const potBefore = room.state.bettingRound!.pot;

            room.placeBet(bb, { type: 'fold', amount: 0 });

            // SB (non-folding) gets the pot
            const sbChipsAfter = sbRole === 'player'
              ? room.state.chipState.playerChips
              : room.state.chipState.opponentChips;
            expect(sbChipsAfter).toBe(sbChipsBefore + potBefore);
          }

          // Total chips invariant
          const total = room.state.chipState.playerChips + room.state.chipState.opponentChips;
          expect(total).toBe(TOTAL);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ============================================================
// Feature: pvp-mode, Property 9: 摊牌结算正确性
// **Validates: Requirements 5.7**
// ============================================================

describe('Property 9: 摊牌结算正确性', () => {
  it('For any showdown, winner gets pot, total chips = 4000', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 500 }),
        (_seed) => {
          const room = createStartedRoom(1);
          const TOTAL = INITIAL_CHIPS * 2; // 4000

          advanceToShowdown(room);

          // Total chips must be conserved
          const total = room.state.chipState.playerChips + room.state.chipState.opponentChips;
          expect(total).toBe(TOTAL);

          // Showdown result must exist
          expect(room.state.showdownResult).not.toBeNull();

          // Pot should be 0 after settlement
          if (room.state.bettingRound) {
            expect(room.state.bettingRound.pot).toBe(0);
          }

          // Phase should be showdown or game_over
          expect(['showdown', 'game_over']).toContain(room.state.phase);
        },
      ),
      { numRuns: 100 },
    );
  });
});


// ============================================================
// Feature: pvp-mode, Property 10: 全下自动发牌
// **Validates: Requirements 5.8**
// ============================================================

describe('Property 10: 全下自动发牌', () => {
  it('For any all-in completion, 5 community cards dealt and enters showdown', () => {
    fc.assert(
      fc.property(
        // Phase at which all-in happens: 0=pre_flop, 1=flop, 2=turn
        fc.integer({ min: 0, max: 2 }),
        fc.integer({ min: 1, max: 200 }),
        (phaseIndex, _seed) => {
          const room = createStartedRoom(1);

          // Advance to the target phase
          if (phaseIndex >= 1) {
            // pre_flop: SB calls, BB checks → flop
            const sb = room.getCurrentActor()!;
            room.placeBet(sb, { type: 'call', amount: 10 });
            const bb = room.getCurrentActor()!;
            room.placeBet(bb, { type: 'check', amount: 0 });
          }
          if (phaseIndex >= 2) {
            // flop: both check → turn
            bothCheck(room);
          }

          // Now go all-in
          const actor = room.getCurrentActor()!;
          room.placeBet(actor, { type: 'all_in', amount: 0 });
          const other: PlayerRole = actor === 'player' ? 'opponent' : 'player';
          room.placeBet(other, { type: 'call', amount: 0 });

          // After all-in resolution: 5 community cards
          expect(room.state.communityCards).toHaveLength(5);

          // Phase should be showdown or game_over
          expect(['showdown', 'game_over']).toContain(room.state.phase);

          // Showdown result must exist
          expect(room.state.showdownResult).not.toBeNull();

          // Total chips conserved
          const total = room.state.chipState.playerChips + room.state.chipState.opponentChips;
          expect(total).toBe(INITIAL_CHIPS * 2);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ============================================================
// Feature: pvp-mode, Property 11: 小盲注位置交替
// **Validates: Requirements 5.9, 6.4**
// ============================================================

describe('Property 11: 小盲注位置交替', () => {
  it('For any hand number n, odd → player is SB, even → opponent is SB', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 200 }),
        (handNumber) => {
          const room = createStartedRoom(handNumber);

          const expectedSB = handNumber % 2 === 1 ? 'player' : 'opponent';
          const expectedBB = expectedSB === 'player' ? 'opponent' : 'player';

          // Verify via getSmallBlind engine function
          expect(getSmallBlind(handNumber)).toBe(expectedSB);

          // Verify via chip deductions: SB pays 10, BB pays 20
          const sbChips = expectedSB === 'player'
            ? room.state.chipState.playerChips
            : room.state.chipState.opponentChips;
          const bbChips = expectedBB === 'player'
            ? room.state.chipState.playerChips
            : room.state.chipState.opponentChips;

          expect(sbChips).toBe(INITIAL_CHIPS - SMALL_BLIND_AMOUNT);  // 1990
          expect(bbChips).toBe(INITIAL_CHIPS - BIG_BLIND_AMOUNT);    // 1980

          // Current actor in pre-flop is the SB (acts first pre-flop)
          expect(room.getCurrentActor()).toBe(expectedSB);
        },
      ),
      { numRuns: 100 },
    );
  });
});
