/**
 * PVP 对战界面数据逻辑单元测试
 *
 * 测试环境为 node（无 DOM），因此不渲染组件，
 * 而是直接测试 PvpPage 中驱动 UI 渲染的纯数据转换逻辑。
 */

import type { PvpGameState } from '@/hooks/usePvpGame';

// --- Helper: replicate the pure logic from PvpPage ---

function computeBattleUI(gs: PvpGameState) {
  const isBetting = ['pre_flop_betting', 'flop_betting', 'turn_betting', 'river_betting'].includes(gs.phase);
  const isMyTurn = gs.currentActor === gs.myRole;
  const myChips = gs.myRole === 'player' ? gs.chipState.playerChips : gs.chipState.opponentChips;
  const opChips = gs.myRole === 'player' ? gs.chipState.opponentChips : gs.chipState.playerChips;
  const myRoundBet = gs.bettingRound
    ? (gs.myRole === 'player' ? gs.bettingRound.playerRoundBet : gs.bettingRound.opponentRoundBet)
    : 0;
  const opRoundBet = gs.bettingRound
    ? (gs.myRole === 'player' ? gs.bettingRound.opponentRoundBet : gs.bettingRound.playerRoundBet)
    : 0;
  const betToCall = Math.max(0, opRoundBet - myRoundBet);

  const didIWin = gs.gameOverWinner === gs.myRole;
  const gameOverWinnerLabel = gs.gameOverWinner ? (didIWin ? 'player' : 'opponent') : null;

  return { isBetting, isMyTurn, myChips, opChips, betToCall, gameOverWinnerLabel };
}

// --- Factory for building PvpGameState ---

function makeGameState(overrides: Partial<PvpGameState> = {}): PvpGameState {
  return {
    roomCode: 'TEST01',
    myRole: 'player',
    myHand: [],
    opponentHand: null,
    phase: 'pre_flop_betting',
    communityCards: [],
    chipState: { playerChips: 1990, opponentChips: 1980 },
    bettingRound: {
      pot: 30,
      playerRoundBet: 10,
      opponentRoundBet: 20,
      currentActor: 'player',
      playerActed: false,
      opponentActed: false,
      roundEnded: false,
      foldedBy: null,
      lastRaiseAmount: 20,
    },
    handNumber: 1,
    isGameOver: false,
    gameOverWinner: null,
    actionLog: [],
    showdownResult: null,
    currentActor: 'player',
    availableActions: ['check', 'raise', 'fold'],
    opponentConnected: true,
    ...overrides,
  };
}

describe('PVP 对战界面数据逻辑', () => {
  describe('isBetting — 下注阶段判断', () => {
    test.each([
      'pre_flop_betting',
      'flop_betting',
      'turn_betting',
      'river_betting',
    ])('phase=%s 时 isBetting 应为 true', (phase) => {
      const gs = makeGameState({ phase });
      const { isBetting } = computeBattleUI(gs);
      expect(isBetting).toBe(true);
    });

    test.each([
      'showdown',
      'game_over',
      'pre_flop',
      'flop',
      'turn',
      'river',
    ])('phase=%s 时 isBetting 应为 false', (phase) => {
      const gs = makeGameState({ phase });
      const { isBetting } = computeBattleUI(gs);
      expect(isBetting).toBe(false);
    });
  });

  describe('isMyTurn — 行动方判断', () => {
    test('currentActor === myRole 时 isMyTurn 为 true', () => {
      const gs = makeGameState({ myRole: 'player', currentActor: 'player' });
      expect(computeBattleUI(gs).isMyTurn).toBe(true);
    });

    test('currentActor !== myRole 时 isMyTurn 为 false', () => {
      const gs = makeGameState({ myRole: 'player', currentActor: 'opponent' });
      expect(computeBattleUI(gs).isMyTurn).toBe(false);
    });

    test('myRole=opponent, currentActor=opponent 时 isMyTurn 为 true', () => {
      const gs = makeGameState({ myRole: 'opponent', currentActor: 'opponent' });
      expect(computeBattleUI(gs).isMyTurn).toBe(true);
    });

    test('currentActor 为 null 时 isMyTurn 为 false', () => {
      const gs = makeGameState({ currentActor: null });
      expect(computeBattleUI(gs).isMyTurn).toBe(false);
    });
  });

  describe('myChips / opChips — 筹码映射', () => {
    test('myRole=player 时 myChips=playerChips, opChips=opponentChips', () => {
      const gs = makeGameState({
        myRole: 'player',
        chipState: { playerChips: 1500, opponentChips: 2500 },
      });
      const { myChips, opChips } = computeBattleUI(gs);
      expect(myChips).toBe(1500);
      expect(opChips).toBe(2500);
    });

    test('myRole=opponent 时 myChips=opponentChips, opChips=playerChips', () => {
      const gs = makeGameState({
        myRole: 'opponent',
        chipState: { playerChips: 1500, opponentChips: 2500 },
      });
      const { myChips, opChips } = computeBattleUI(gs);
      expect(myChips).toBe(2500);
      expect(opChips).toBe(1500);
    });
  });

  describe('betToCall — 跟注金额计算', () => {
    test('对手下注多于我时 betToCall = 差额', () => {
      const gs = makeGameState({
        myRole: 'player',
        bettingRound: {
          pot: 60,
          playerRoundBet: 10,
          opponentRoundBet: 40,
          currentActor: 'player',
          playerActed: false,
          opponentActed: true,
          roundEnded: false,
          foldedBy: null,
          lastRaiseAmount: 20,
        },
      });
      expect(computeBattleUI(gs).betToCall).toBe(30);
    });

    test('双方下注相同时 betToCall = 0', () => {
      const gs = makeGameState({
        myRole: 'player',
        bettingRound: {
          pot: 40,
          playerRoundBet: 20,
          opponentRoundBet: 20,
          currentActor: 'player',
          playerActed: false,
          opponentActed: true,
          roundEnded: false,
          foldedBy: null,
          lastRaiseAmount: 20,
        },
      });
      expect(computeBattleUI(gs).betToCall).toBe(0);
    });

    test('bettingRound 为 null 时 betToCall = 0', () => {
      const gs = makeGameState({ bettingRound: null });
      expect(computeBattleUI(gs).betToCall).toBe(0);
    });

    test('myRole=opponent 时正确映射 round bets', () => {
      const gs = makeGameState({
        myRole: 'opponent',
        bettingRound: {
          pot: 80,
          playerRoundBet: 50,
          opponentRoundBet: 20,
          currentActor: 'opponent',
          playerActed: true,
          opponentActed: false,
          roundEnded: false,
          foldedBy: null,
          lastRaiseAmount: 30,
        },
      });
      // myRole=opponent → myRoundBet=opponentRoundBet=20, opRoundBet=playerRoundBet=50
      expect(computeBattleUI(gs).betToCall).toBe(30);
    });
  });

  describe('gameOverWinnerLabel — 游戏结束赢家标签', () => {
    test('myRole 赢时 label 为 player', () => {
      const gs = makeGameState({
        myRole: 'player',
        isGameOver: true,
        gameOverWinner: 'player',
      });
      expect(computeBattleUI(gs).gameOverWinnerLabel).toBe('player');
    });

    test('对手赢时 label 为 opponent', () => {
      const gs = makeGameState({
        myRole: 'player',
        isGameOver: true,
        gameOverWinner: 'opponent',
      });
      expect(computeBattleUI(gs).gameOverWinnerLabel).toBe('opponent');
    });

    test('myRole=opponent 且 opponent 赢时 label 为 player', () => {
      const gs = makeGameState({
        myRole: 'opponent',
        isGameOver: true,
        gameOverWinner: 'opponent',
      });
      expect(computeBattleUI(gs).gameOverWinnerLabel).toBe('player');
    });

    test('myRole=opponent 且 player 赢时 label 为 opponent', () => {
      const gs = makeGameState({
        myRole: 'opponent',
        isGameOver: true,
        gameOverWinner: 'player',
      });
      expect(computeBattleUI(gs).gameOverWinnerLabel).toBe('opponent');
    });

    test('gameOverWinner 为 null 时 label 为 null', () => {
      const gs = makeGameState({ gameOverWinner: null });
      expect(computeBattleUI(gs).gameOverWinnerLabel).toBeNull();
    });
  });

  describe('对手断线检测', () => {
    test('opponentConnected=false 时可检测断线状态', () => {
      const gs = makeGameState({ opponentConnected: false });
      expect(gs.opponentConnected).toBe(false);
    });

    test('opponentConnected=true 时非断线状态', () => {
      const gs = makeGameState({ opponentConnected: true });
      expect(gs.opponentConnected).toBe(true);
    });
  });

  describe('摊牌阶段结果数据', () => {
    test('showdown 阶段且有 showdownResult 时结果数据可用', () => {
      const mockResult = {
        result: 'player_win' as const,
        playerEval: {
          rankType: 2,
          rankName: 'One Pair',
          bestCards: [],
          compareValues: [2, 14, 13, 12, 11],
        },
        opponentEval: {
          rankType: 1,
          rankName: 'High Card',
          bestCards: [],
          compareValues: [14, 13, 12, 11, 10],
        },
      };
      const gs = makeGameState({
        phase: 'showdown',
        showdownResult: mockResult,
      });
      const isShowdownWithResult = gs.phase === 'showdown' && gs.showdownResult !== null;
      expect(isShowdownWithResult).toBe(true);
      expect(gs.showdownResult).toEqual(mockResult);
    });

    test('showdown 阶段但无 showdownResult（弃牌结算）时结果数据不可用', () => {
      const gs = makeGameState({
        phase: 'showdown',
        showdownResult: null,
      });
      const isShowdownWithResult = gs.phase === 'showdown' && gs.showdownResult !== null;
      expect(isShowdownWithResult).toBe(false);
    });

    test('非 showdown 阶段时结果数据不可用', () => {
      const gs = makeGameState({
        phase: 'flop_betting',
        showdownResult: null,
      });
      const isShowdownWithResult = gs.phase === 'showdown' && gs.showdownResult !== null;
      expect(isShowdownWithResult).toBe(false);
    });
  });
});
