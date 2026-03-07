import * as fc from 'fast-check';
import { deductChips, awardPot, splitPot, isGameOver } from '@/engine/chipManager';
import { ChipState } from '@/engine/types';

// Feature: chip-betting-system, Property 1: 筹码非负不变量
// **Validates: Requirements 1.2, 1.6**
test('chip balances remain non-negative after any valid deduction sequence', () => {
  const chipStateArb = fc.record({
    playerChips: fc.integer({ min: 0, max: 200 }),
    opponentChips: fc.integer({ min: 0, max: 200 }),
  });

  const deductionArb = fc.tuple(
    fc.constantFrom<'player' | 'opponent'>('player', 'opponent'),
    fc.integer({ min: 1, max: 200 }),
  );

  fc.assert(
    fc.property(
      chipStateArb,
      fc.array(deductionArb, { minLength: 0, maxLength: 20 }),
      (initialState: ChipState, deductions: Array<['player' | 'opponent', number]>) => {
        let state = { ...initialState };

        for (const [who, amount] of deductions) {
          state = deductChips(state, who, amount);
          expect(state.playerChips).toBeGreaterThanOrEqual(0);
          expect(state.opponentChips).toBeGreaterThanOrEqual(0);
          expect(Number.isInteger(state.playerChips)).toBe(true);
          expect(Number.isInteger(state.opponentChips)).toBe(true);
        }
      },
    ),
    { numRuns: 100 },
  );
});

// Feature: chip-betting-system, Property 2: 筹码守恒
// **Validates: Requirements 1.3, 6.2, 6.6**
test('total chips are conserved across deductions and pot awards', () => {
  const initialChipsArb = fc.record({
    playerChips: fc.integer({ min: 0, max: 200 }),
    opponentChips: fc.integer({ min: 0, max: 200 }),
  });

  const deductionArb = fc.tuple(
    fc.constantFrom<'player' | 'opponent'>('player', 'opponent'),
    fc.integer({ min: 1, max: 50 }),
  );

  const awardTypeArb = fc.oneof(
    fc.constantFrom<'player' | 'opponent'>('player', 'opponent').map(winner => ({ kind: 'award' as const, winner })),
    fc.constantFrom<'player' | 'opponent'>('player', 'opponent').map(sb => ({ kind: 'split' as const, smallBlind: sb })),
  );

  fc.assert(
    fc.property(
      initialChipsArb,
      fc.array(deductionArb, { minLength: 1, maxLength: 10 }),
      awardTypeArb,
      (initialState: ChipState, deductions, award) => {
        const total = initialState.playerChips + initialState.opponentChips;
        let state = { ...initialState };
        let pot = 0;

        // Perform deductions (simulating bets going to pot)
        for (const [who, amount] of deductions) {
          const before = who === 'player' ? state.playerChips : state.opponentChips;
          state = deductChips(state, who, amount);
          const after = who === 'player' ? state.playerChips : state.opponentChips;
          const actualDeducted = before - after;
          pot += actualDeducted;

          // Conservation holds at every step
          expect(state.playerChips + state.opponentChips + pot).toBe(total);
        }

        // Award or split the pot
        if (award.kind === 'award') {
          state = awardPot(state, award.winner, pot);
        } else {
          state = splitPot(state, pot, award.smallBlind);
        }
        pot = 0;

        // After pot distribution, all chips are back with players
        expect(state.playerChips + state.opponentChips).toBe(total);
      },
    ),
    { numRuns: 100 },
  );
});

// Feature: chip-betting-system, Property 3: 平局底池分配正确性
// **Validates: Requirements 1.5**
test('splitPot distributes floor(pot/2) to each side, odd chip to small blind', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: 200 }),  // pot amount
      fc.constantFrom<'player' | 'opponent'>('player', 'opponent'),  // small blind
      (potAmount, smallBlind) => {
        const state: ChipState = { playerChips: 0, opponentChips: 0 };
        const result = splitPot(state, potAmount, smallBlind);
        const half = Math.floor(potAmount / 2);
        const remainder = potAmount % 2;

        if (smallBlind === 'player') {
          expect(result.playerChips).toBe(half + remainder);
          expect(result.opponentChips).toBe(half);
        } else {
          expect(result.playerChips).toBe(half);
          expect(result.opponentChips).toBe(half + remainder);
        }
        // Total distributed equals pot
        expect(result.playerChips + result.opponentChips).toBe(potAmount);
      }
    ),
    { numRuns: 100 }
  );
});

// Feature: chip-betting-system, Property 12: 游戏结束检测
// **Validates: Requirements 9.1**
test('isGameOver returns true iff playerChips === 0 or opponentChips === 0', () => {
  fc.assert(
    fc.property(
      fc.record({
        playerChips: fc.integer({ min: 0, max: 200 }),
        opponentChips: fc.integer({ min: 0, max: 200 }),
      }),
      (state: ChipState) => {
        const result = isGameOver(state);
        const expected = state.playerChips === 0 || state.opponentChips === 0;
        expect(result).toBe(expected);
      }
    ),
    { numRuns: 100 }
  );
});
