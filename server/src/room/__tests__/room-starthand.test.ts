import { Room } from '../room.model';
import { INITIAL_CHIPS, SMALL_BLIND_AMOUNT, BIG_BLIND_AMOUNT } from '../../engine/types';

describe('Room.startNewHand', () => {
  let room: Room;

  beforeEach(() => {
    room = new Room();
    room.addPlayer('socket-1');
    room.addPlayer('socket-2');
  });

  it('should set phase to pre_flop_betting', () => {
    room.startNewHand();
    expect(room.state.phase).toBe('pre_flop_betting');
  });

  it('should deal 2 hole cards to each player', () => {
    room.startNewHand();
    expect(room.getHandForRole('player')).toHaveLength(2);
    expect(room.getHandForRole('opponent')).toHaveLength(2);
  });

  it('should deal unique cards (no overlap between hands)', () => {
    room.startNewHand();
    const playerHand = room.getHandForRole('player');
    const opponentHand = room.getHandForRole('opponent');
    const allCards = [...playerHand, ...opponentHand];
    const serialized = allCards.map(c => `${c.suit}${c.rank}`);
    expect(new Set(serialized).size).toBe(4);
  });

  it('should post blinds with pot = 30', () => {
    room.startNewHand();
    expect(room.state.bettingRound).not.toBeNull();
    expect(room.state.bettingRound!.pot).toBe(SMALL_BLIND_AMOUNT + BIG_BLIND_AMOUNT);
  });

  it('should deduct blinds from chip stacks (hand 1: player=SB, opponent=BB)', () => {
    // Hand 1 is odd → player is small blind (10), opponent is big blind (20)
    room.startNewHand();
    expect(room.state.chipState.playerChips).toBe(INITIAL_CHIPS - SMALL_BLIND_AMOUNT);
    expect(room.state.chipState.opponentChips).toBe(INITIAL_CHIPS - BIG_BLIND_AMOUNT);
  });

  it('should set correct round bets for hand 1 (player=SB=10, opponent=BB=20)', () => {
    room.startNewHand();
    expect(room.state.bettingRound!.playerRoundBet).toBe(SMALL_BLIND_AMOUNT);
    expect(room.state.bettingRound!.opponentRoundBet).toBe(BIG_BLIND_AMOUNT);
  });

  it('should alternate blinds for hand 2 (opponent=SB, player=BB)', () => {
    room.state.handNumber = 2;
    room.startNewHand();
    // Hand 2 is even → opponent is small blind (10), player is big blind (20)
    expect(room.state.chipState.playerChips).toBe(INITIAL_CHIPS - BIG_BLIND_AMOUNT);
    expect(room.state.chipState.opponentChips).toBe(INITIAL_CHIPS - SMALL_BLIND_AMOUNT);
    expect(room.state.bettingRound!.playerRoundBet).toBe(BIG_BLIND_AMOUNT);
    expect(room.state.bettingRound!.opponentRoundBet).toBe(SMALL_BLIND_AMOUNT);
  });

  it('should start with empty community cards', () => {
    room.startNewHand();
    expect(room.state.communityCards).toEqual([]);
  });

  it('should reset action log and showdown result', () => {
    room.startNewHand();
    expect(room.state.actionLog).toEqual([]);
    expect(room.state.showdownResult).toBeNull();
  });

  it('should not be game over', () => {
    room.startNewHand();
    expect(room.state.isGameOver).toBe(false);
    expect(room.state.gameOverWinner).toBeNull();
  });

  it('should set currentActor to small blind (player for hand 1)', () => {
    room.startNewHand();
    // Pre-flop: small blind acts first in heads-up
    expect(room.state.bettingRound!.currentActor).toBe('player');
  });

  it('should preserve handNumber', () => {
    room.state.handNumber = 5;
    room.startNewHand();
    expect(room.state.handNumber).toBe(5);
  });
});
