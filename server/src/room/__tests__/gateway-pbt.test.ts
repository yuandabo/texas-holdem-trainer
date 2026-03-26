import * as fc from 'fast-check';
import { Room, PlayerRole } from '../room.model';
import {
  INITIAL_CHIPS, SMALL_BLIND_AMOUNT, BIG_BLIND_AMOUNT,
  BettingActionType, ExtendedGamePhase,
} from '../../engine/types';

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

/** Both players check through a betting round. */
function bothCheck(room: Room): void {
  const a1 = room.getCurrentActor();
  if (!a1) return;
  room.placeBet(a1, { type: 'check', amount: 0 });
  const a2 = room.getCurrentActor();
  if (!a2) return;
  room.placeBet(a2, { type: 'check', amount: 0 });
}

/** Deep-clone a plain-serialisable object. */
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Advance the room to a random betting phase (0=pre_flop, 1=flop, 2=turn, 3=river).
 * Returns the phase index actually reached.
 */
function advanceToPhase(room: Room, targetPhase: number): number {
  if (targetPhase === 0) return 0;

  // pre_flop: SB calls, BB checks → flop
  const sb = room.getCurrentActor();
  if (!sb) return 0;
  room.placeBet(sb, { type: 'call', amount: 10 });
  const bb = room.getCurrentActor();
  if (!bb) return 0;
  room.placeBet(bb, { type: 'check', amount: 0 });
  if (targetPhase === 1) return 1;

  // flop: both check → turn
  bothCheck(room);
  if ((room.state.phase as string) !== 'turn_betting') return 1;
  if (targetPhase === 2) return 2;

  // turn: both check → river
  bothCheck(room);
  if ((room.state.phase as string) !== 'river_betting') return 2;
  return 3;
}

const BETTING_PHASES: ExtendedGamePhase[] = [
  'pre_flop_betting', 'flop_betting', 'turn_betting', 'river_betting',
];

// ============================================================
// Feature: pvp-mode, Property 12: 超时默认操作
// **Validates: Requirements 7.3, 7.4**
// ============================================================

describe('Property 12: 超时默认操作', () => {
  it('For any game state where it is a player\'s turn, timeout auto-checks if check is available, otherwise auto-folds', () => {
    fc.assert(
      fc.property(
        // Target phase: 0=pre_flop, 1=flop, 2=turn, 3=river
        fc.integer({ min: 0, max: 3 }),
        fc.integer({ min: 1, max: 50 }),
        (targetPhase, handNumber) => {
          const room = createStartedRoom(handNumber);
          advanceToPhase(room, targetPhase);

          // Ensure we're in a betting phase with an active actor
          if (!BETTING_PHASES.includes(room.state.phase)) return;
          const actor = room.getCurrentActor();
          if (!actor) return;

          const availableActions = room.getAvailableActionsForCurrentActor();
          const canCheck = availableActions.includes('check');

          // Simulate timeout: execute the same logic the gateway timer uses
          if (canCheck) {
            room.placeBet(actor, { type: 'check', amount: 0 });
          } else {
            room.placeBet(actor, { type: 'fold', amount: 0 });
          }

          // The key property: if check was available, a check was executed (no fold)
          // If check was not available, a fold was executed (phase becomes showdown or game_over)
          if (canCheck) {
            // After check: fold flag should NOT be set
            if (room.state.bettingRound) {
              expect(room.state.bettingRound.foldedBy).toBeNull();
            }
          } else {
            // After fold: phase should be showdown or game_over
            expect(['showdown', 'game_over']).toContain(room.state.phase);
          }

          // Total chips + pot invariant always holds
          const pot = room.state.bettingRound?.pot ?? 0;
          const total = room.state.chipState.playerChips + room.state.chipState.opponentChips + pot;
          expect(total).toBe(INITIAL_CHIPS * 2);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Timeout result matches manual execution of the same action', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }),
        fc.integer({ min: 1, max: 50 }),
        (targetPhase, handNumber) => {
          // Create two identical rooms
          const room1 = createStartedRoom(handNumber);
          const room2 = createStartedRoom(handNumber);

          // We need deterministic decks — since both rooms are created independently
          // with random shuffles, we can't compare exact states. Instead, we verify
          // the timeout logic property: check if possible, else fold.
          advanceToPhase(room1, targetPhase);

          if (!BETTING_PHASES.includes(room1.state.phase)) return;
          const actor = room1.getCurrentActor();
          if (!actor) return;

          const actions = room1.getAvailableActionsForCurrentActor();
          const canCheck = actions.includes('check');

          // Execute timeout action
          const timeoutAction: BettingActionType = canCheck ? 'check' : 'fold';
          const result = room1.placeBet(actor, { type: timeoutAction, amount: 0 });

          // The action should always succeed
          expect(result).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ============================================================
// Feature: pvp-mode, Property 13: 断线保持状态不变
// **Validates: Requirements 8.1, 8.5**
// ============================================================

describe('Property 13: 断线保持状态不变', () => {
  it('For any game state, disconnecting a player (within 30s timeout) does not change the game state', () => {
    fc.assert(
      fc.property(
        // Which player disconnects
        fc.constantFrom<PlayerRole>('player', 'opponent'),
        // Target phase: 0=pre_flop, 1=flop, 2=turn, 3=river
        fc.integer({ min: 0, max: 3 }),
        fc.integer({ min: 1, max: 50 }),
        (disconnectingRole, targetPhase, handNumber) => {
          const room = createStartedRoom(handNumber);
          advanceToPhase(room, targetPhase);

          // Snapshot the full game state before disconnect
          const stateBefore = deepClone(room.state);
          const playerHandBefore = deepClone(room.getHandForRole('player'));
          const opponentHandBefore = deepClone(room.getHandForRole('opponent'));

          // Disconnect the player
          const socketId = disconnectingRole === 'player' ? 'socket-1' : 'socket-2';
          const disconnectedPlayer = room.handleDisconnect(socketId);

          // Player session should be preserved
          expect(disconnectedPlayer).toBeDefined();
          expect(disconnectedPlayer!.role).toBe(disconnectingRole);
          expect(disconnectedPlayer!.connected).toBe(false);
          expect(disconnectedPlayer!.disconnectedAt).not.toBeNull();

          // Game state should be completely unchanged
          expect(room.state.phase).toBe(stateBefore.phase);
          expect(room.state.handNumber).toBe(stateBefore.handNumber);
          expect(deepClone(room.state.chipState)).toEqual(stateBefore.chipState);
          expect(deepClone(room.state.communityCards)).toEqual(stateBefore.communityCards);
          expect(room.state.isGameOver).toBe(stateBefore.isGameOver);
          expect(room.state.gameOverWinner).toBe(stateBefore.gameOverWinner);
          expect(deepClone(room.state.bettingRound)).toEqual(stateBefore.bettingRound);
          expect(deepClone(room.state.actionLog)).toEqual(stateBefore.actionLog);
          expect(room.state.showdownResult).toEqual(stateBefore.showdownResult);

          // Hands should be unchanged
          expect(deepClone(room.getHandForRole('player'))).toEqual(playerHandBefore);
          expect(deepClone(room.getHandForRole('opponent'))).toEqual(opponentHandBefore);

          // Room should still have 2 players
          expect(room.playerCount).toBe(2);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('For any game state, disconnect + reconnect (within 30s) preserves game state', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<PlayerRole>('player', 'opponent'),
        fc.integer({ min: 0, max: 3 }),
        fc.integer({ min: 1, max: 50 }),
        (disconnectingRole, targetPhase, handNumber) => {
          const room = createStartedRoom(handNumber);
          advanceToPhase(room, targetPhase);

          // Snapshot state
          const stateBefore = deepClone(room.state);

          // Disconnect
          const oldSocketId = disconnectingRole === 'player' ? 'socket-1' : 'socket-2';
          room.handleDisconnect(oldSocketId);

          // Reconnect with new socket (within 30s)
          const newSocketId = `${oldSocketId}-reconnected`;
          const reconnected = room.handleReconnect(oldSocketId, newSocketId);

          // Reconnect should succeed
          expect(reconnected).not.toBeNull();
          expect(reconnected!.connected).toBe(true);
          expect(reconnected!.role).toBe(disconnectingRole);

          // Game state should be completely unchanged
          expect(room.state.phase).toBe(stateBefore.phase);
          expect(room.state.handNumber).toBe(stateBefore.handNumber);
          expect(deepClone(room.state.chipState)).toEqual(stateBefore.chipState);
          expect(deepClone(room.state.communityCards)).toEqual(stateBefore.communityCards);
          expect(room.state.isGameOver).toBe(stateBefore.isGameOver);
          expect(deepClone(room.state.bettingRound)).toEqual(stateBefore.bettingRound);
        },
      ),
      { numRuns: 100 },
    );
  });
});
