import * as fc from 'fast-check';
import { makeDecision } from '@/engine/opponentAI';
import { BettingRoundState } from '@/engine/types';

// Feature: chip-betting-system, Property 11: AI 决策与随机数的确定性映射
// **Validates: Requirements 5.2, 5.3**
test('AI decision maps deterministically from RNG value when no unmatched bet', () => {
  fc.assert(
    fc.property(
      fc.double({ min: 0, max: 1, noNaN: true, maxExcluded: true }),
      (r: number) => {
        const roundState: BettingRoundState = {
          pot: 3,
          playerRoundBet: 2,
          opponentRoundBet: 2,
          currentActor: 'opponent',
          playerActed: true,
          opponentActed: false,
          roundEnded: false,
          foldedBy: null,
          lastRaiseAmount: 0,
        };
        const decision = makeDecision(roundState, 50, 100, 2, () => r);
        if (r < 0.7) {
          expect(decision.action.type).toBe('check');
        } else {
          expect(decision.action.type).toBe('raise');
        }
      },
    ),
    { numRuns: 100 },
  );
});

test('AI decision maps deterministically from RNG value when unmatched bet exists', () => {
  fc.assert(
    fc.property(
      fc.double({ min: 0, max: 1, noNaN: true, maxExcluded: true }),
      (r: number) => {
        const roundState: BettingRoundState = {
          pot: 5,
          playerRoundBet: 4,
          opponentRoundBet: 1,
          currentActor: 'opponent',
          playerActed: true,
          opponentActed: false,
          roundEnded: false,
          foldedBy: null,
          lastRaiseAmount: 0,
        };
        const decision = makeDecision(roundState, 50, 100, 2, () => r);
        if (r < 0.6) {
          expect(decision.action.type).toBe('call');
        } else if (r < 0.8) {
          expect(decision.action.type).toBe('raise');
        } else {
          expect(decision.action.type).toBe('fold');
        }
      },
    ),
    { numRuns: 100 },
  );
});
