import { evaluate, compare } from '@/engine/handEvaluator';
import { Card, GameResult, ShowdownResult } from '@/engine/types';

/**
 * 比较玩家和对手的最佳牌型，判定胜负
 * @param playerHand 玩家手牌 (2张)
 * @param opponentHand 对手手牌 (2张)
 * @param communityCards 公共牌 (5张)
 * @returns ShowdownResult 包含对局结果和双方牌型
 */
export function showdown(
  playerHand: Card[],
  opponentHand: Card[],
  communityCards: Card[],
): ShowdownResult {
  const playerEval = evaluate(playerHand, communityCards);
  const opponentEval = evaluate(opponentHand, communityCards);

  const cmp = compare(playerEval, opponentEval);

  let result: GameResult;
  if (cmp > 0) {
    result = GameResult.PlayerWin;
  } else if (cmp < 0) {
    result = GameResult.OpponentWin;
  } else {
    result = GameResult.Tie;
  }

  return { result, playerEval, opponentEval };
}
