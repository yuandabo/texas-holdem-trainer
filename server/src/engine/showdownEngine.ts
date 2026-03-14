import { evaluate, compare } from './handEvaluator';
import { Card, GameResult, ShowdownResult } from './types';

export function showdown(playerHand: Card[], opponentHand: Card[], communityCards: Card[]): ShowdownResult {
  const playerEval = evaluate(playerHand, communityCards);
  const opponentEval = evaluate(opponentHand, communityCards);
  const cmp = compare(playerEval, opponentEval);
  let result: GameResult;
  if (cmp > 0) result = GameResult.PlayerWin;
  else if (cmp < 0) result = GameResult.OpponentWin;
  else result = GameResult.Tie;
  return { result, playerEval, opponentEval };
}
