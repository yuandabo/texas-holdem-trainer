import * as fc from 'fast-check';
import { postBlinds } from '@/engine/bettingEngine';
import { ChipState } from '@/engine/types';

// Feature: chip-betting-system, Property 4: 盲注发放正确性
// **Validates: Requirements 2.1, 2.2, 2.4, 2.5**
test('postBlinds deducts correct blind amounts and pot equals sum of deductions', () => {
  const activeChipStateArb = fc.record({
    playerChips: fc.integer({ min: 1, max: 200 }),
    opponentChips: fc.integer({ min: 1, max: 200 }),
  });

  fc.assert(
    fc.property(
      activeChipStateArb,
      fc.constantFrom<'player' | 'opponent'>('player', 'opponent'),
      (chipState: ChipState, smallBlind) => {
        const result = postBlinds(chipState, smallBlind, 1, 2);
        const bigBlind = smallBlind === 'player' ? 'opponent' : 'player';

        const sbChipsBefore = smallBlind === 'player' ? chipState.playerChips : chipState.opponentChips;
        const bbChipsBefore = bigBlind === 'player' ? chipState.playerChips : chipState.opponentChips;

        const sbChipsAfter = smallBlind === 'player' ? result.chipState.playerChips : result.chipState.opponentChips;
        const bbChipsAfter = bigBlind === 'player' ? result.chipState.playerChips : result.chipState.opponentChips;

        const expectedSbDeduction = Math.min(1, sbChipsBefore);
        const expectedBbDeduction = Math.min(2, bbChipsBefore);

        expect(sbChipsBefore - sbChipsAfter).toBe(expectedSbDeduction);
        expect(bbChipsBefore - bbChipsAfter).toBe(expectedBbDeduction);
        expect(result.pot).toBe(expectedSbDeduction + expectedBbDeduction);
      }
    ),
    { numRuns: 100 }
  );
});

import { getSmallBlind } from '@/engine/bettingEngine';

// Feature: chip-betting-system, Property 5: 盲注位置交替
// **Validates: Requirements 2.3**
test('small blind alternates based on handNumber parity', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 1000 }),
      (handNumber: number) => {
        const sb = getSmallBlind(handNumber);
        if (handNumber % 2 === 1) {
          expect(sb).toBe('player');
        } else {
          expect(sb).toBe('opponent');
        }
      }
    ),
    { numRuns: 100 }
  );
});

import { getAvailableActions } from '@/engine/bettingEngine';
import { BettingRoundState } from '@/engine/types';

// Feature: chip-betting-system, Property 6: 可用操作正确性
// **Validates: Requirements 4.1, 4.2, 4.7**
test('available actions are correct based on unmatched bet and chip balance', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: 50 }),  // playerRoundBet
      fc.integer({ min: 0, max: 50 }),  // opponentRoundBet
      fc.integer({ min: 1, max: 200 }), // actorChips
      fc.constantFrom<'player' | 'opponent'>('player', 'opponent'), // currentActor
      (playerBet, opponentBet, actorChips, actor) => {
        const roundState: BettingRoundState = {
          pot: playerBet + opponentBet,
          playerRoundBet: playerBet,
          opponentRoundBet: opponentBet,
          currentActor: actor,
          playerActed: false,
          opponentActed: false,
          roundEnded: false,
          foldedBy: null,
          lastRaiseAmount: 0,
        };

        const actions = getAvailableActions(roundState, actorChips, 2);
        const actorBet = actor === 'player' ? playerBet : opponentBet;
        const otherBet = actor === 'player' ? opponentBet : playerBet;
        const betToCall = otherBet - actorBet;

        if (betToCall > 0) {
          // Unmatched bet exists
          expect(actions).toContain('fold');
          if (actorChips <= betToCall) {
            expect(actions).toContain('all_in');
          } else {
            expect(actions).toContain('call');
          }
        } else {
          // No unmatched bet
          expect(actions).toContain('check');
        }
      }
    ),
    { numRuns: 100 }
  );
});

import { isRoundComplete } from '@/engine/bettingEngine';

// Feature: chip-betting-system, Property 7: 下注回合结束条件
// **Validates: Requirements 3.4, 3.6**
test('round completes iff both acted with equal bets or someone folded', () => {
  const roundStateArb = fc.record({
    pot: fc.integer({ min: 0, max: 200 }),
    playerRoundBet: fc.integer({ min: 0, max: 100 }),
    opponentRoundBet: fc.integer({ min: 0, max: 100 }),
    currentActor: fc.constantFrom<'player' | 'opponent'>('player', 'opponent'),
    playerActed: fc.boolean(),
    opponentActed: fc.boolean(),
    roundEnded: fc.boolean(),
    foldedBy: fc.constantFrom<'player' | 'opponent' | null>('player', 'opponent', null),
    lastRaiseAmount: fc.integer({ min: 0, max: 50 }),
  });

  fc.assert(
    fc.property(roundStateArb, (state: BettingRoundState) => {
      const result = isRoundComplete(state);
      const expected =
        state.foldedBy !== null ||
        (state.playerActed && state.opponentActed && state.playerRoundBet === state.opponentRoundBet);
      expect(result).toBe(expected);
    }),
    { numRuns: 100 }
  );
});

import { executeBettingAction } from '@/engine/bettingEngine';
import { BettingAction, BettingError } from '@/engine/types';

// Feature: chip-betting-system, Property 8: 行动权交替
// **Validates: Requirements 3.3, 4.6**
test('currentActor switches after non-terminal actions (check, call, raise)', () => {
  fc.assert(
    fc.property(
      fc.constantFrom<'player' | 'opponent'>('player', 'opponent'),
      fc.constantFrom<'check' | 'call' | 'raise'>('check', 'call', 'raise'),
      (actor, actionType) => {
        const chipState = { playerChips: 100, opponentChips: 100 };
        let roundState: BettingRoundState;
        let action: BettingAction;

        if (actionType === 'check') {
          // Equal bets so check is valid
          roundState = {
            pot: 3, playerRoundBet: 2, opponentRoundBet: 2,
            currentActor: actor, playerActed: false, opponentActed: false,
            roundEnded: false, foldedBy: null, lastRaiseAmount: 0,
          };
          action = { type: 'check', amount: 0 };
        } else if (actionType === 'call') {
          // Unmatched bet exists for the actor
          if (actor === 'player') {
            roundState = {
              pot: 5, playerRoundBet: 1, opponentRoundBet: 3,
              currentActor: 'player', playerActed: false, opponentActed: true,
              roundEnded: false, foldedBy: null, lastRaiseAmount: 2,
            };
          } else {
            roundState = {
              pot: 5, playerRoundBet: 3, opponentRoundBet: 1,
              currentActor: 'opponent', playerActed: true, opponentActed: false,
              roundEnded: false, foldedBy: null, lastRaiseAmount: 2,
            };
          }
          action = { type: 'call', amount: 2 };
        } else {
          // Raise - set up with enough chips and valid raise amount
          if (actor === 'player') {
            roundState = {
              pot: 3, playerRoundBet: 1, opponentRoundBet: 2,
              currentActor: 'player', playerActed: false, opponentActed: false,
              roundEnded: false, foldedBy: null, lastRaiseAmount: 0,
            };
          } else {
            roundState = {
              pot: 3, playerRoundBet: 2, opponentRoundBet: 1,
              currentActor: 'opponent', playerActed: false, opponentActed: false,
              roundEnded: false, foldedBy: null, lastRaiseAmount: 0,
            };
          }
          // betToCall=1, raiseTotal=5, raiseIncrement=4 >= MIN_RAISE=2
          action = { type: 'raise', amount: 5 };
        }

        const result = executeBettingAction(roundState, chipState, action, 2);
        const expectedActor = actor === 'player' ? 'opponent' : 'player';
        expect(result.roundState.currentActor).toBe(expectedActor);
      }
    ),
    { numRuns: 100 }
  );
});

// Feature: chip-betting-system, Property 9: 弃牌立即结束牌局
// **Validates: Requirements 3.5, 4.5, 6.4**
test('fold immediately ends the round with foldedBy set to the folding player', () => {
  fc.assert(
    fc.property(
      fc.constantFrom<'player' | 'opponent'>('player', 'opponent'),
      fc.integer({ min: 0, max: 50 }),  // pot
      (actor, pot) => {
        const roundState: BettingRoundState = {
          pot,
          playerRoundBet: 1,
          opponentRoundBet: 2,
          currentActor: actor,
          playerActed: false,
          opponentActed: false,
          roundEnded: false,
          foldedBy: null,
          lastRaiseAmount: 0,
        };
        const chipState = { playerChips: 50, opponentChips: 50 };
        const action: BettingAction = { type: 'fold', amount: 0 };

        const result = executeBettingAction(roundState, chipState, action, 2);
        expect(result.roundState.foldedBy).toBe(actor);
        expect(result.roundState.roundEnded).toBe(true);
      }
    ),
    { numRuns: 100 }
  );
});

// Feature: chip-betting-system, Property 10: 加注金额验证
// **Validates: Requirements 4.4, 4.8**
test('raise with increment below MIN_RAISE is rejected with BettingError', () => {
  fc.assert(
    fc.property(
      fc.constantFrom<'player' | 'opponent'>('player', 'opponent'),
      fc.integer({ min: 1, max: 10 }),  // betToCall
      fc.integer({ min: 0, max: 1 }),   // raiseIncrement (below MIN_RAISE=2)
      (actor, betToCall, raiseIncrement) => {
        const raiseTotal = betToCall + raiseIncrement;
        const roundState: BettingRoundState = {
          pot: 10,
          playerRoundBet: actor === 'player' ? 0 : betToCall,
          opponentRoundBet: actor === 'opponent' ? 0 : betToCall,
          currentActor: actor,
          playerActed: false,
          opponentActed: false,
          roundEnded: false,
          foldedBy: null,
          lastRaiseAmount: 0,
        };
        const chipState = { playerChips: 100, opponentChips: 100 };
        const action: BettingAction = { type: 'raise', amount: raiseTotal };

        expect(() => executeBettingAction(roundState, chipState, action, 2)).toThrow(BettingError);
      }
    ),
    { numRuns: 100 }
  );
});
