import { Card, DealResult, DealError } from '@/engine/types';
import { draw } from '@/engine/deck';

/**
 * 发手牌阶段：从牌组顶部依次发出玩家 2 张底牌和对手 2 张底牌
 * @param deck 当前牌组
 * @returns DealResult 包含玩家手牌、对手手牌和剩余牌组
 * @throws DealError 当牌组不足 4 张时
 */
export function dealHands(deck: Card[]): DealResult {
  if (deck.length < 4) {
    throw new DealError('Not enough cards in deck');
  }
  const [playerHand, afterPlayer] = draw(deck, 2);
  const [opponentHand, remainingDeck] = draw(afterPlayer, 2);
  return { playerHand, opponentHand, remainingDeck };
}

/**
 * 发翻牌：从剩余牌组顶部取出 3 张公共牌
 * @param deck 剩余牌组
 * @returns [flopCards, remainingDeck] - 3 张翻牌和剩余牌组
 * @throws DealError 当牌组不足 3 张时
 */
export function dealFlop(deck: Card[]): [Card[], Card[]] {
  if (deck.length < 3) {
    throw new DealError('Not enough cards in deck');
  }
  return draw(deck, 3);
}

/**
 * 发转牌：从剩余牌组顶部取出 1 张公共牌
 * @param deck 剩余牌组
 * @returns [turnCard, remainingDeck] - 转牌和剩余牌组
 * @throws DealError 当牌组不足 1 张时
 */
export function dealTurn(deck: Card[]): [Card, Card[]] {
  if (deck.length < 1) {
    throw new DealError('Not enough cards in deck');
  }
  const [drawn, remaining] = draw(deck, 1);
  return [drawn[0], remaining];
}

/**
 * 发河牌：从剩余牌组顶部取出 1 张公共牌
 * @param deck 剩余牌组
 * @returns [riverCard, remainingDeck] - 河牌和剩余牌组
 * @throws DealError 当牌组不足 1 张时
 */
export function dealRiver(deck: Card[]): [Card, Card[]] {
  if (deck.length < 1) {
    throw new DealError('Not enough cards in deck');
  }
  const [drawn, remaining] = draw(deck, 1);
  return [drawn[0], remaining];
}
