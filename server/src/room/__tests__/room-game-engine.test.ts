import { Room, PlayerRole } from '../room.model';
import {
  INITIAL_CHIPS, SMALL_BLIND_AMOUNT, BIG_BLIND_AMOUNT, MIN_RAISE,
  BettingAction,
} from '../../engine/types';

/**
 * Helper: create a room with 2 players and start a hand.
 */
function createStartedRoom(handNumber = 1): Room {
  const room = new Room();
  room.addPlayer('socket-1');
  room.addPlayer('socket-2');
  room.state.handNumber = handNumber;
  room.startNewHand();
  return room;
}

/**
 * Helper: play through a full betting round where both players check.
 * Returns true if the round ended.
 */
function bothCheck(room: Room): boolean {
  const actor1 = room.getCurrentActor();
  if (!actor1) return false;
  room.placeBet(actor1, { type: 'check', amount: 0 });
  const actor2 = room.getCurrentActor();
  if (!actor2) return true; // round already ended after first check
  room.placeBet(actor2, { type: 'check', amount: 0 });
  return true;
}

/**
 * Helper: advance the game through all betting rounds via check-check
 * until showdown is reached.
 */
function advanceToShowdown(room: Room): void {
  // pre_flop: SB calls (since SB has 10, BB has 20, SB must call 10 to continue)
  const sbActor = room.getCurrentActor()!;
  room.placeBet(sbActor, { type: 'call', amount: 10 });
  // BB checks
  const bbActor = room.getCurrentActor()!;
  room.placeBet(bbActor, { type: 'check', amount: 0 });
  // flop, turn, river: both check
  bothCheck(room); // flop
  bothCheck(room); // turn
  bothCheck(room); // river → showdown
}

// ============================================================
// 3.2 Room.placeBet()
// ============================================================
describe('Room.placeBet()', () => {
  let room: Room;

  beforeEach(() => {
    room = createStartedRoom();
  });

  it('should succeed with a valid action from the current actor', () => {
    const actor = room.getCurrentActor()!;
    // In pre-flop hand 1, player is SB and acts first. Available: call, raise, fold
    const result = room.placeBet(actor, { type: 'call', amount: 10 });
    expect(result).toBe(true);
  });

  it('should update chip state after a valid call', () => {
    const actor = room.getCurrentActor()!; // player (SB)
    const chipsBefore = { ...room.state.chipState };
    room.placeBet(actor, { type: 'call', amount: 10 });
    // SB called 10 more, so player chips should decrease by 10
    expect(room.state.chipState.playerChips).toBe(chipsBefore.playerChips - 10);
  });

  it('should add an action log entry after a valid bet', () => {
    const actor = room.getCurrentActor()!;
    expect(room.state.actionLog).toHaveLength(0);
    room.placeBet(actor, { type: 'call', amount: 10 });
    expect(room.state.actionLog).toHaveLength(1);
    expect(room.state.actionLog[0].actor).toBe(actor);
  });

  it('should return false when the wrong actor tries to bet', () => {
    const actor = room.getCurrentActor()!;
    const wrongActor: PlayerRole = actor === 'player' ? 'opponent' : 'player';
    const result = room.placeBet(wrongActor, { type: 'call', amount: 10 });
    expect(result).toBe(false);
  });

  it('should not change state when the wrong actor tries to bet', () => {
    const stateBefore = JSON.stringify(room.state);
    const actor = room.getCurrentActor()!;
    const wrongActor: PlayerRole = actor === 'player' ? 'opponent' : 'player';
    room.placeBet(wrongActor, { type: 'call', amount: 10 });
    expect(JSON.stringify(room.state)).toBe(stateBefore);
  });

  it('should return false for a raise below minimum raise amount', () => {
    // Pre-flop, SB has betToCall=10. A raise must be at least betToCall + MIN_RAISE = 30.
    // Raise of 20 means raiseIncrement = 20 - 10 = 10 < MIN_RAISE(20), so it should fail.
    const actor = room.getCurrentActor()!;
    const result = room.placeBet(actor, { type: 'raise', amount: 20 });
    expect(result).toBe(false);
  });

  it('should return false when betting round is null', () => {
    room.state.bettingRound = null;
    const result = room.placeBet('player', { type: 'check', amount: 0 });
    expect(result).toBe(false);
  });

  it('should return false when betting round has ended', () => {
    room.state.bettingRound!.roundEnded = true;
    const result = room.placeBet('player', { type: 'check', amount: 0 });
    expect(result).toBe(false);
  });

  it('should return false for a raise below minimum', () => {
    const actor = room.getCurrentActor()!;
    // Raise amount must be at least betToCall + MIN_RAISE. betToCall=10, so raise must be >= 30
    const result = room.placeBet(actor, { type: 'raise', amount: 15 });
    expect(result).toBe(false);
  });

  it('should handle fold and trigger settlement', () => {
    const actor = room.getCurrentActor()!;
    room.placeBet(actor, { type: 'fold', amount: 0 });
    // After fold, phase should be showdown (or game_over if chips = 0)
    expect(['showdown', 'game_over']).toContain(room.state.phase);
  });
});

// ============================================================
// 3.3 Room.advanceAfterBetting() — phase transitions
// ============================================================
describe('Room.advanceAfterBetting() — phase transitions', () => {
  let room: Room;

  beforeEach(() => {
    room = createStartedRoom();
  });

  it('should transition from pre_flop_betting to flop_betting with 3 community cards', () => {
    // SB calls, BB checks → round ends → advance to flop
    const sb = room.getCurrentActor()!;
    room.placeBet(sb, { type: 'call', amount: 10 });
    const bb = room.getCurrentActor()!;
    room.placeBet(bb, { type: 'check', amount: 0 });
    expect(room.state.phase).toBe('flop_betting');
    expect(room.state.communityCards).toHaveLength(3);
  });

  it('should transition from flop_betting to turn_betting with 4 community cards', () => {
    // Get to flop
    const sb = room.getCurrentActor()!;
    room.placeBet(sb, { type: 'call', amount: 10 });
    const bb = room.getCurrentActor()!;
    room.placeBet(bb, { type: 'check', amount: 0 });
    expect(room.state.phase).toBe('flop_betting');

    // Both check on flop
    bothCheck(room);
    expect(room.state.phase).toBe('turn_betting');
    expect(room.state.communityCards).toHaveLength(4);
  });

  it('should transition from turn_betting to river_betting with 5 community cards', () => {
    // Get to flop
    const sb = room.getCurrentActor()!;
    room.placeBet(sb, { type: 'call', amount: 10 });
    const bb = room.getCurrentActor()!;
    room.placeBet(bb, { type: 'check', amount: 0 });
    // flop → turn
    bothCheck(room);
    // turn → river
    bothCheck(room);
    expect(room.state.phase).toBe('river_betting');
    expect(room.state.communityCards).toHaveLength(5);
  });

  it('should transition from river_betting to showdown after both check', () => {
    advanceToShowdown(room);
    expect(['showdown', 'game_over']).toContain(room.state.phase);
  });

  it('should have a showdownResult after reaching showdown via river', () => {
    advanceToShowdown(room);
    expect(room.state.showdownResult).not.toBeNull();
  });

  it('should create a new betting round with carried-over pot on phase advance', () => {
    const sb = room.getCurrentActor()!;
    room.placeBet(sb, { type: 'call', amount: 10 });
    const potBeforeAdvance = room.state.bettingRound!.pot;
    const bb = room.getCurrentActor()!;
    room.placeBet(bb, { type: 'check', amount: 0 });
    // After advancing to flop, the pot should carry over
    expect(room.state.bettingRound!.pot).toBe(potBeforeAdvance);
  });
});

// ============================================================
// 3.4 handleFoldSettlement and handleShowdownSettlement
// ============================================================
describe('Fold and Showdown Settlement', () => {
  describe('handleFoldSettlement', () => {
    it('should award pot to non-folding player when player folds', () => {
      const room = createStartedRoom();
      const potBefore = room.state.bettingRound!.pot;
      const opponentChipsBefore = room.state.chipState.opponentChips;

      // Player (SB) folds
      room.placeBet('player', { type: 'fold', amount: 0 });

      // Opponent should get the pot
      expect(room.state.chipState.opponentChips).toBe(opponentChipsBefore + potBefore);
    });

    it('should award pot to non-folding player when opponent folds', () => {
      const room = createStartedRoom();
      // Player calls first
      room.placeBet('player', { type: 'call', amount: 10 });
      const potBefore = room.state.bettingRound!.pot;
      const playerChipsBefore = room.state.chipState.playerChips;

      // Opponent folds
      room.placeBet('opponent', { type: 'fold', amount: 0 });

      expect(room.state.chipState.playerChips).toBe(playerChipsBefore + potBefore);
    });

    it('should conserve total chips after fold (always 4000)', () => {
      const room = createStartedRoom();
      room.placeBet('player', { type: 'fold', amount: 0 });
      const total = room.state.chipState.playerChips + room.state.chipState.opponentChips;
      expect(total).toBe(INITIAL_CHIPS * 2);
    });

    it('should set phase to showdown after fold (when not game over)', () => {
      const room = createStartedRoom();
      room.placeBet('player', { type: 'fold', amount: 0 });
      // With initial chips, folding SB (10 chips) won't cause game over
      expect(room.state.phase).toBe('showdown');
    });

    it('should set showdownResult to null after fold', () => {
      const room = createStartedRoom();
      room.placeBet('player', { type: 'fold', amount: 0 });
      expect(room.state.showdownResult).toBeNull();
    });

    it('should set pot to 0 after fold settlement', () => {
      const room = createStartedRoom();
      room.placeBet('player', { type: 'fold', amount: 0 });
      expect(room.state.bettingRound!.pot).toBe(0);
    });
  });

  describe('handleShowdownSettlement', () => {
    it('should produce a showdownResult with player and opponent evaluations', () => {
      const room = createStartedRoom();
      advanceToShowdown(room);
      expect(room.state.showdownResult).not.toBeNull();
      expect(room.state.showdownResult!.playerEval).toBeDefined();
      expect(room.state.showdownResult!.opponentEval).toBeDefined();
    });

    it('should conserve total chips after showdown (always 4000)', () => {
      const room = createStartedRoom();
      advanceToShowdown(room);
      const total = room.state.chipState.playerChips + room.state.chipState.opponentChips;
      expect(total).toBe(INITIAL_CHIPS * 2);
    });

    it('should set pot to 0 after showdown settlement', () => {
      const room = createStartedRoom();
      advanceToShowdown(room);
      if (room.state.bettingRound) {
        expect(room.state.bettingRound.pot).toBe(0);
      }
    });

    it('should set phase to showdown or game_over after showdown settlement', () => {
      const room = createStartedRoom();
      advanceToShowdown(room);
      expect(['showdown', 'game_over']).toContain(room.state.phase);
    });

    it('should have result as player_win, opponent_win, or tie', () => {
      const room = createStartedRoom();
      advanceToShowdown(room);
      expect(['player_win', 'opponent_win', 'tie']).toContain(room.state.showdownResult!.result);
    });
  });
});

// ============================================================
// 3.5 All-in auto-deal remaining community cards
// ============================================================
describe('All-in auto-deal', () => {
  it('should deal all 5 community cards when a player goes all-in pre-flop', () => {
    const room = createStartedRoom();
    // Player (SB) goes all-in
    room.placeBet('player', { type: 'all_in', amount: 0 });
    // Opponent calls the all-in
    room.placeBet('opponent', { type: 'call', amount: 0 });

    // After all-in resolution, should have 5 community cards
    expect(room.state.communityCards).toHaveLength(5);
  });

  it('should enter showdown or game_over after all-in', () => {
    const room = createStartedRoom();
    room.placeBet('player', { type: 'all_in', amount: 0 });
    room.placeBet('opponent', { type: 'call', amount: 0 });

    expect(['showdown', 'game_over']).toContain(room.state.phase);
  });

  it('should have a showdownResult after all-in resolution', () => {
    const room = createStartedRoom();
    room.placeBet('player', { type: 'all_in', amount: 0 });
    room.placeBet('opponent', { type: 'call', amount: 0 });

    expect(room.state.showdownResult).not.toBeNull();
  });

  it('should conserve total chips after all-in (always 4000)', () => {
    const room = createStartedRoom();
    room.placeBet('player', { type: 'all_in', amount: 0 });
    room.placeBet('opponent', { type: 'call', amount: 0 });

    const total = room.state.chipState.playerChips + room.state.chipState.opponentChips;
    expect(total).toBe(INITIAL_CHIPS * 2);
  });

  it('should deal remaining community cards when all-in happens on flop', () => {
    const room = createStartedRoom();
    // Get to flop
    room.placeBet('player', { type: 'call', amount: 10 });
    room.placeBet('opponent', { type: 'check', amount: 0 });
    expect(room.state.phase).toBe('flop_betting');
    expect(room.state.communityCards).toHaveLength(3);

    // All-in on flop
    const actor = room.getCurrentActor()!;
    room.placeBet(actor, { type: 'all_in', amount: 0 });
    const other: PlayerRole = actor === 'player' ? 'opponent' : 'player';
    room.placeBet(other, { type: 'call', amount: 0 });

    expect(room.state.communityCards).toHaveLength(5);
    expect(['showdown', 'game_over']).toContain(room.state.phase);
  });
});

// ============================================================
// 3.6 Room.nextHand()
// ============================================================
describe('Room.nextHand()', () => {
  it('should increment hand number', () => {
    const room = createStartedRoom();
    expect(room.state.handNumber).toBe(1);
    // End the hand first (fold to get to showdown)
    room.placeBet('player', { type: 'fold', amount: 0 });
    room.nextHand();
    expect(room.state.handNumber).toBe(2);
  });

  it('should alternate blinds (hand 1: player=SB, hand 2: opponent=SB)', () => {
    const room = createStartedRoom();
    // Hand 1: player is SB
    expect(room.state.chipState.playerChips).toBe(INITIAL_CHIPS - SMALL_BLIND_AMOUNT);
    expect(room.state.chipState.opponentChips).toBe(INITIAL_CHIPS - BIG_BLIND_AMOUNT);

    room.placeBet('player', { type: 'fold', amount: 0 });
    room.nextHand();

    // Hand 2: opponent is SB (10), player is BB (20)
    expect(room.state.handNumber).toBe(2);
    // After fold in hand 1, opponent got pot (30). Opponent had 1980+30=2010, player had 1990.
    // Hand 2: opponent=SB deducts 10, player=BB deducts 20
    const expectedOpponentChips = (INITIAL_CHIPS - BIG_BLIND_AMOUNT + SMALL_BLIND_AMOUNT + BIG_BLIND_AMOUNT) - SMALL_BLIND_AMOUNT;
    const expectedPlayerChips = (INITIAL_CHIPS - SMALL_BLIND_AMOUNT) - BIG_BLIND_AMOUNT;
    expect(room.state.chipState.opponentChips).toBe(expectedOpponentChips);
    expect(room.state.chipState.playerChips).toBe(expectedPlayerChips);
  });

  it('should start a new hand with fresh cards and empty community', () => {
    const room = createStartedRoom();
    room.placeBet('player', { type: 'fold', amount: 0 });
    room.nextHand();
    expect(room.state.communityCards).toEqual([]);
    expect(room.getHandForRole('player')).toHaveLength(2);
    expect(room.getHandForRole('opponent')).toHaveLength(2);
  });

  it('should set phase to pre_flop_betting', () => {
    const room = createStartedRoom();
    room.placeBet('player', { type: 'fold', amount: 0 });
    room.nextHand();
    expect(room.state.phase).toBe('pre_flop_betting');
  });

  it('should not advance if game is over', () => {
    const room = createStartedRoom();
    room.state.isGameOver = true;
    const handBefore = room.state.handNumber;
    room.nextHand();
    expect(room.state.handNumber).toBe(handBefore);
  });

  it('should reset action log and showdown result', () => {
    const room = createStartedRoom();
    room.placeBet('player', { type: 'fold', amount: 0 });
    room.nextHand();
    expect(room.state.actionLog).toEqual([]);
    expect(room.state.showdownResult).toBeNull();
  });
});

// ============================================================
// 3.7 Room.restartGame()
// ============================================================
describe('Room.restartGame()', () => {
  it('should reset chips to 2000 each', () => {
    const room = createStartedRoom();
    // Modify chips
    room.state.chipState = { playerChips: 500, opponentChips: 3500 };
    room.restartGame();
    expect(room.state.chipState.playerChips).toBe(INITIAL_CHIPS - SMALL_BLIND_AMOUNT);
    expect(room.state.chipState.opponentChips).toBe(INITIAL_CHIPS - BIG_BLIND_AMOUNT);
  });

  it('should reset hand number to 1', () => {
    const room = createStartedRoom();
    room.state.handNumber = 10;
    room.restartGame();
    expect(room.state.handNumber).toBe(1);
  });

  it('should clear isGameOver and gameOverWinner', () => {
    const room = createStartedRoom();
    room.state.isGameOver = true;
    room.state.gameOverWinner = 'player';
    room.restartGame();
    expect(room.state.isGameOver).toBe(false);
    expect(room.state.gameOverWinner).toBeNull();
  });

  it('should start a new hand (phase = pre_flop_betting)', () => {
    const room = createStartedRoom();
    room.state.phase = 'game_over';
    room.restartGame();
    expect(room.state.phase).toBe('pre_flop_betting');
  });

  it('should deal new cards', () => {
    const room = createStartedRoom();
    room.restartGame();
    expect(room.getHandForRole('player')).toHaveLength(2);
    expect(room.getHandForRole('opponent')).toHaveLength(2);
  });

  it('should have empty community cards', () => {
    const room = createStartedRoom();
    room.restartGame();
    expect(room.state.communityCards).toEqual([]);
  });

  it('should have pot = 30 (blinds posted)', () => {
    const room = createStartedRoom();
    room.restartGame();
    expect(room.state.bettingRound!.pot).toBe(SMALL_BLIND_AMOUNT + BIG_BLIND_AMOUNT);
  });
});

// ============================================================
// 3.8 Room.getStateForRole()
// ============================================================
describe('Room.getStateForRole()', () => {
  it('should return myRole matching the requested role', () => {
    const room = createStartedRoom();
    const playerView = room.getStateForRole('player');
    expect(playerView.myRole).toBe('player');
    const opponentView = room.getStateForRole('opponent');
    expect(opponentView.myRole).toBe('opponent');
  });

  it('should return myHand as the correct hand for the role', () => {
    const room = createStartedRoom();
    const playerView = room.getStateForRole('player');
    expect(playerView.myHand).toEqual(room.getHandForRole('player'));
    const opponentView = room.getStateForRole('opponent');
    expect(opponentView.myHand).toEqual(room.getHandForRole('opponent'));
  });

  it('should hide opponent hand (null) during non-showdown phases', () => {
    const room = createStartedRoom();
    // Phase is pre_flop_betting
    const playerView = room.getStateForRole('player');
    expect(playerView.opponentHand).toBeNull();
    const opponentView = room.getStateForRole('opponent');
    expect(opponentView.opponentHand).toBeNull();
  });

  it('should show opponent hand during showdown phase', () => {
    const room = createStartedRoom();
    advanceToShowdown(room);
    if (room.state.phase === 'showdown' || room.state.phase === 'game_over') {
      const playerView = room.getStateForRole('player');
      expect(playerView.opponentHand).not.toBeNull();
      expect(playerView.opponentHand).toHaveLength(2);

      const opponentView = room.getStateForRole('opponent');
      expect(opponentView.opponentHand).not.toBeNull();
      expect(opponentView.opponentHand).toHaveLength(2);
    }
  });

  it('should show opponent hand during game_over phase', () => {
    const room = createStartedRoom();
    room.state.phase = 'game_over';
    const view = room.getStateForRole('player');
    expect(view.opponentHand).not.toBeNull();
  });

  it('should include roomCode', () => {
    const room = createStartedRoom();
    const view = room.getStateForRole('player');
    expect(view.roomCode).toBe(room.roomCode);
  });

  it('should include communityCards, chipState, phase, handNumber', () => {
    const room = createStartedRoom();
    const view = room.getStateForRole('player');
    expect(view.communityCards).toEqual(room.state.communityCards);
    expect(view.chipState).toEqual(room.state.chipState);
    expect(view.phase).toBe(room.state.phase);
    expect(view.handNumber).toBe(room.state.handNumber);
  });

  it('should include currentActor and availableActions for the current actor', () => {
    const room = createStartedRoom();
    const actor = room.getCurrentActor()!;
    const actorView = room.getStateForRole(actor);
    expect(actorView.currentActor).toBe(actor);
    expect(actorView.availableActions.length).toBeGreaterThan(0);
  });

  it('should return empty availableActions for the non-current actor', () => {
    const room = createStartedRoom();
    const actor = room.getCurrentActor()!;
    const nonActor: PlayerRole = actor === 'player' ? 'opponent' : 'player';
    const nonActorView = room.getStateForRole(nonActor);
    expect(nonActorView.availableActions).toEqual([]);
  });

  it('should include opponentConnected status', () => {
    const room = createStartedRoom();
    const view = room.getStateForRole('player');
    // opponent is connected
    expect(view.opponentConnected).toBe(true);
  });

  it('should reflect opponent disconnected status', () => {
    const room = createStartedRoom();
    room.handleDisconnect('socket-2'); // opponent disconnects
    const view = room.getStateForRole('player');
    expect(view.opponentConnected).toBe(false);
  });

  it('should show opponent hand when all-in and round ended (non-showdown phase)', () => {
    const room = createStartedRoom();
    // Player all-in, opponent calls → all-in triggers auto-deal and showdown
    room.placeBet('player', { type: 'all_in', amount: 0 });
    room.placeBet('opponent', { type: 'call', amount: 0 });

    // After all-in resolution, both views should show opponent hand
    const playerView = room.getStateForRole('player');
    expect(playerView.opponentHand).not.toBeNull();
    const opponentView = room.getStateForRole('opponent');
    expect(opponentView.opponentHand).not.toBeNull();
  });

  it('should include showdownResult and actionLog', () => {
    const room = createStartedRoom();
    advanceToShowdown(room);
    const view = room.getStateForRole('player');
    expect(view.showdownResult).toBe(room.state.showdownResult);
    expect(view.actionLog).toBe(room.state.actionLog);
  });

  it('should include isGameOver and gameOverWinner', () => {
    const room = createStartedRoom();
    const view = room.getStateForRole('player');
    expect(view.isGameOver).toBe(room.state.isGameOver);
    expect(view.gameOverWinner).toBe(room.state.gameOverWinner);
  });
});
