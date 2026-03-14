import { Card, DealResult, DealError } from './types';
import { draw } from './deck';

export function dealHands(deck: Card[]): DealResult {
  if (deck.length < 4) throw new DealError('Not enough cards in deck');
  const [playerHand, afterPlayer] = draw(deck, 2);
  const [opponentHand, remainingDeck] = draw(afterPlayer, 2);
  return { playerHand, opponentHand, remainingDeck };
}

export function dealFlop(deck: Card[]): [Card[], Card[]] {
  if (deck.length < 3) throw new DealError('Not enough cards in deck');
  return draw(deck, 3);
}

export function dealTurn(deck: Card[]): [Card, Card[]] {
  if (deck.length < 1) throw new DealError('Not enough cards in deck');
  const [drawn, remaining] = draw(deck, 1);
  return [drawn[0], remaining];
}

export function dealRiver(deck: Card[]): [Card, Card[]] {
  if (deck.length < 1) throw new DealError('Not enough cards in deck');
  const [drawn, remaining] = draw(deck, 1);
  return [drawn[0], remaining];
}
