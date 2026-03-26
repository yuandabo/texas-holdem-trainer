import { v4 as uuidv4 } from 'uuid';
import {
  Card, BettingRoundState, ChipState, BettingAction, ShowdownResult,
  ExtendedGamePhase, ActionLogEntry, GameResult,
  INITIAL_CHIPS, SMALL_BLIND_AMOUNT, BIG_BLIND_AMOUNT, MIN_RAISE,
} from '../engine/types';
import { createDeck, shuffle } from '../engine/deck';
import { dealHands, dealFlop, dealTurn, dealRiver } from '../engine/dealEngine';
import { showdown } from '../engine/showdownEngine';
import { createChipState, awardPot, splitPot, isGameOver } from '../engine/chipManager';
import { createBettingRound, executeBettingAction, postBlinds, getSmallBlind, getAvailableActions } from '../engine/bettingEngine';

export type PlayerRole = 'player' | 'opponent';

export interface PlayerInfo {
  socketId: string;
  role: PlayerRole;
  connected: boolean;
  /** 断线时间戳 */
  disconnectedAt: number | null;
}

export interface RoomState {
  phase: ExtendedGamePhase;
  communityCards: Card[];
  chipState: ChipState;
  bettingRound: BettingRoundState | null;
  handNumber: number;
  isGameOver: boolean;
  gameOverWinner: PlayerRole | null;
  actionLog: ActionLogEntry[];
  showdownResult: ShowdownResult | null;
}

/** 断线重连超时 (30秒) */
const RECONNECT_TIMEOUT_MS = 30_000;
/** 操作超时 (60秒) */
const ACTION_TIMEOUT_MS = 60_000;

export class Room {
  readonly id: string;
  readonly roomCode: string;
  players: Map<string, PlayerInfo> = new Map(); // socketId -> PlayerInfo
  private playerHand: Card[] = [];
  private opponentHand: Card[] = [];
  private remainingDeck: Card[] = [];
  state: RoomState;
  private actionTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(existingCodes: Set<string> = new Set()) {
    this.id = uuidv4();
    this.roomCode = Room.generateRoomCode(existingCodes);
    this.state = {
      phase: 'pre_flop_betting',
      communityCards: [],
      chipState: createChipState(INITIAL_CHIPS),
      bettingRound: null,
      handNumber: 1,
      isGameOver: false,
      gameOverWinner: null,
      actionLog: [],
      showdownResult: null,
    };
  }

  static generateRoomCode(existingCodes: Set<string> = new Set()): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code: string;
    do {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (existingCodes.has(code));
    return code;
  }

  get isFull(): boolean { return this.players.size >= 2; }
  get playerCount(): number { return this.players.size; }

  addPlayer(socketId: string): PlayerInfo {
    if (this.isFull) {
      throw new Error('房间已满');
    }
    const role: PlayerRole = this.players.size === 0 ? 'player' : 'opponent';
    const playerInfo: PlayerInfo = { socketId, role, connected: true, disconnectedAt: null };
    this.players.set(socketId, playerInfo);
    return playerInfo;
  }

  getPlayerBySocket(socketId: string): PlayerInfo | undefined {
    return this.players.get(socketId);
  }

  getOpponent(socketId: string): PlayerInfo | undefined {
    for (const p of this.players.values()) {
      if (p.socketId !== socketId) return p;
    }
    return undefined;
  }

  getPlayerByRole(role: PlayerRole): PlayerInfo | undefined {
    for (const p of this.players.values()) {
      if (p.role === role) return p;
    }
    return undefined;
  }

  /** 断线处理 */
  handleDisconnect(socketId: string): PlayerInfo | undefined {
    const player = this.players.get(socketId);
    if (player) {
      player.connected = false;
      player.disconnectedAt = Date.now();
    }
    return player;
  }

  /** 断线重连 */
  handleReconnect(oldSocketId: string, newSocketId: string): PlayerInfo | null {
    const player = this.players.get(oldSocketId);
    if (!player) return null;
    if (player.disconnectedAt && Date.now() - player.disconnectedAt > RECONNECT_TIMEOUT_MS) return null;
    this.players.delete(oldSocketId);
    player.socketId = newSocketId;
    player.connected = true;
    player.disconnectedAt = null;
    this.players.set(newSocketId, player);
    return player;
  }

  /** 检查是否所有断线玩家都超时了 */
  hasAbandonedPlayers(): boolean {
    for (const p of this.players.values()) {
      if (!p.connected && p.disconnectedAt && Date.now() - p.disconnectedAt > RECONNECT_TIMEOUT_MS) return true;
    }
    return false;
  }

  /** 开始新一手牌 */
  startNewHand(): void {
    const deck = createDeck();
    const shuffled = shuffle(deck);
    const { playerHand, opponentHand, remainingDeck } = dealHands(shuffled);
    this.playerHand = playerHand;
    this.opponentHand = opponentHand;
    this.remainingDeck = remainingDeck;

    const handNumber = this.state.handNumber;
    const smallBlind = getSmallBlind(handNumber);
    const blindResult = postBlinds(this.state.chipState, smallBlind, SMALL_BLIND_AMOUNT, BIG_BLIND_AMOUNT);

    const bettingRound: BettingRoundState = {
      ...createBettingRound(blindResult.pot, smallBlind),
      playerRoundBet: blindResult.playerRoundBet,
      opponentRoundBet: blindResult.opponentRoundBet,
    };

    this.state = {
      phase: 'pre_flop_betting',
      communityCards: [],
      chipState: blindResult.chipState,
      bettingRound,
      handNumber,
      isGameOver: false,
      gameOverWinner: null,
      actionLog: [],
      showdownResult: null,
    };
  }

  /** 获取指定角色的手牌 */
  getHandForRole(role: PlayerRole): Card[] {
    return role === 'player' ? this.playerHand : this.opponentHand;
  }

  /** 获取当前行动方角色 */
  getCurrentActor(): PlayerRole | null {
    if (!this.state.bettingRound || this.state.bettingRound.roundEnded) return null;
    return this.state.bettingRound.currentActor;
  }

  /** 获取可用操作 */
  getAvailableActionsForCurrentActor(): string[] {
    if (!this.state.bettingRound) return [];
    const actor = this.state.bettingRound.currentActor;
    const chips = actor === 'player' ? this.state.chipState.playerChips : this.state.chipState.opponentChips;
    return getAvailableActions(this.state.bettingRound, chips, MIN_RAISE);
  }

  /** 执行下注操作 */
  placeBet(role: PlayerRole, action: BettingAction): boolean {
    if (!this.state.bettingRound || this.state.bettingRound.roundEnded) return false;
    if (this.state.bettingRound.currentActor !== role) return false;

    const phaseLabel = this.getPhaseLabel();
    const logEntry: ActionLogEntry = {
      actor: role,
      phase: phaseLabel,
      actionType: this.getActionLabel(action.type, action.amount),
      amount: action.amount,
    };

    try {
      const result = executeBettingAction(this.state.bettingRound, this.state.chipState, action, MIN_RAISE);
      this.state.bettingRound = result.roundState;
      this.state.chipState = result.chipState;
      this.state.actionLog = [...this.state.actionLog, logEntry];

      if (result.roundState.foldedBy !== null) {
        this.handleFoldSettlement();
        return true;
      }
      if (result.roundState.roundEnded) {
        this.advanceAfterBetting();
        return true;
      }
      return true;
    } catch {
      return false;
    }
  }

  private handleFoldSettlement(): void {
    const br = this.state.bettingRound!;
    const winner: PlayerRole = br.foldedBy === 'player' ? 'opponent' : 'player';
    const newChipState = awardPot(this.state.chipState, winner, br.pot);
    const gameOver = isGameOver(newChipState);
    this.state.chipState = newChipState;
    this.state.bettingRound = { ...br, pot: 0 };
    this.state.showdownResult = null;
    if (gameOver) {
      this.state.phase = 'game_over';
      this.state.isGameOver = true;
      this.state.gameOverWinner = newChipState.playerChips === 0 ? 'opponent' : 'player';
    } else {
      this.state.phase = 'showdown';
    }
  }

  private handleShowdownSettlement(): void {
    const result = showdown(this.playerHand, this.opponentHand, this.state.communityCards);
    const pot = this.state.bettingRound?.pot ?? 0;
    let newChipState = this.state.chipState;
    const smallBlind = getSmallBlind(this.state.handNumber);
    if (result.result === GameResult.PlayerWin) newChipState = awardPot(newChipState, 'player', pot);
    else if (result.result === GameResult.OpponentWin) newChipState = awardPot(newChipState, 'opponent', pot);
    else newChipState = splitPot(newChipState, pot, smallBlind);
    const gameOver = isGameOver(newChipState);
    this.state.chipState = newChipState;
    this.state.bettingRound = this.state.bettingRound ? { ...this.state.bettingRound, pot: 0 } : null;
    this.state.showdownResult = result;
    if (gameOver) {
      this.state.phase = 'game_over';
      this.state.isGameOver = true;
      this.state.gameOverWinner = newChipState.playerChips === 0 ? 'opponent' : 'player';
    } else {
      this.state.phase = 'showdown';
    }
  }

  private advanceAfterBetting(): void {
    const currentPot = this.state.bettingRound?.pot ?? 0;
    const smallBlind = getSmallBlind(this.state.handNumber);
    const anyAllIn = this.state.chipState.playerChips === 0 || this.state.chipState.opponentChips === 0;

    if (anyAllIn) {
      // Deal all remaining community cards and go to showdown
      let cc = [...this.state.communityCards];
      let deck = this.remainingDeck;
      if (cc.length < 3) { const [f, d] = dealFlop(deck); cc = [...cc, ...f]; deck = d; }
      if (cc.length < 4) { const [t, d] = dealTurn(deck); cc = [...cc, t]; deck = d; }
      if (cc.length < 5) { const [r, d] = dealRiver(deck); cc = [...cc, r]; deck = d; }
      this.state.communityCards = cc;
      this.remainingDeck = deck;
      this.handleShowdownSettlement();
      return;
    }

    switch (this.state.phase) {
      case 'pre_flop_betting': {
        const [flopCards, remaining] = dealFlop(this.remainingDeck);
        this.remainingDeck = remaining;
        this.state.communityCards = [...this.state.communityCards, ...flopCards];
        this.state.bettingRound = createBettingRound(currentPot, smallBlind);
        this.state.phase = 'flop_betting';
        break;
      }
      case 'flop_betting': {
        const [turnCard, remaining] = dealTurn(this.remainingDeck);
        this.remainingDeck = remaining;
        this.state.communityCards = [...this.state.communityCards, turnCard];
        this.state.bettingRound = createBettingRound(currentPot, smallBlind);
        this.state.phase = 'turn_betting';
        break;
      }
      case 'turn_betting': {
        const [riverCard, remaining] = dealRiver(this.remainingDeck);
        this.remainingDeck = remaining;
        this.state.communityCards = [...this.state.communityCards, riverCard];
        this.state.bettingRound = createBettingRound(currentPot, smallBlind);
        this.state.phase = 'river_betting';
        break;
      }
      case 'river_betting':
        this.handleShowdownSettlement();
        break;
    }
  }

  /** 开始下一手 */
  nextHand(): void {
    if (this.state.isGameOver) return;
    this.state.handNumber += 1;
    this.startNewHand();
  }

  /** 重新开始整个游戏 */
  restartGame(): void {
    this.state.chipState = createChipState(INITIAL_CHIPS);
    this.state.handNumber = 1;
    this.state.isGameOver = false;
    this.state.gameOverWinner = null;
    this.startNewHand();
  }

  /** 获取发送给特定角色的状态（隐藏对手手牌） */
  getStateForRole(role: PlayerRole): any {
    const isShowdown = this.state.phase === 'showdown' || this.state.phase === 'game_over';
    const anyAllIn = this.state.chipState.playerChips === 0 || this.state.chipState.opponentChips === 0;
    const showOpponentHand = isShowdown || (anyAllIn && this.state.bettingRound?.roundEnded);

    return {
      roomCode: this.roomCode,
      myRole: role,
      myHand: this.getHandForRole(role),
      opponentHand: showOpponentHand ? this.getHandForRole(role === 'player' ? 'opponent' : 'player') : null,
      phase: this.state.phase,
      communityCards: this.state.communityCards,
      chipState: this.state.chipState,
      bettingRound: this.state.bettingRound,
      handNumber: this.state.handNumber,
      isGameOver: this.state.isGameOver,
      gameOverWinner: this.state.gameOverWinner,
      actionLog: this.state.actionLog,
      showdownResult: this.state.showdownResult,
      currentActor: this.getCurrentActor(),
      availableActions: this.getCurrentActor() === role ? this.getAvailableActionsForCurrentActor() : [],
      opponentConnected: this.getPlayerByRole(role === 'player' ? 'opponent' : 'player')?.connected ?? false,
    };
  }

  private getPhaseLabel(): string {
    switch (this.state.phase) {
      case 'pre_flop_betting': return '翻牌前';
      case 'flop_betting': return '翻牌';
      case 'turn_betting': return '转牌';
      case 'river_betting': return '河牌';
      default: return this.state.phase;
    }
  }

  private getActionLabel(type: string, amount: number): string {
    switch (type) {
      case 'check': return '过牌';
      case 'call': return `跟注 ${amount}`;
      case 'raise': return `加注 ${amount}`;
      case 'fold': return '弃牌';
      case 'all_in': return `全下 ${amount}`;
      default: return type;
    }
  }

  clearActionTimer(): void {
    if (this.actionTimer) { clearTimeout(this.actionTimer); this.actionTimer = null; }
  }

  setActionTimer(callback: () => void): void {
    this.clearActionTimer();
    this.actionTimer = setTimeout(callback, ACTION_TIMEOUT_MS);
  }
}
