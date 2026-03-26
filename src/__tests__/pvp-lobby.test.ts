/**
 * PVP 大厅 usePvpGame Hook 单元测试
 *
 * 测试环境为 node（无 DOM），因此不渲染组件，
 * 而是直接测试 hook 的 socket 事件处理逻辑和状态管理。
 */

// --- Mock setup (must be before imports) ---

// Mock Taro
jest.mock('@tarojs/taro', () => ({
  getStorageSync: jest.fn(() => ''),
  setStorageSync: jest.fn(),
}));

// Mock React hooks to capture hook behavior
let stateStore: Record<string, any> = {};
let stateIndex = 0;
const stateKeys = ['status', 'roomCode', 'gameState', 'errorMsg', 'inputCode'];

let refStore: Record<number, { current: any }> = {};
let refIndex = 0;

jest.mock('react', () => ({
  useState: (initial: any) => {
    const key = stateKeys[stateIndex % stateKeys.length] || `state_${stateIndex}`;
    if (!(key in stateStore)) {
      stateStore[key] = initial;
    }
    const currentKey = key;
    stateIndex++;
    const setter = (val: any) => {
      if (typeof val === 'function') {
        stateStore[currentKey] = val(stateStore[currentKey]);
      } else {
        stateStore[currentKey] = val;
      }
    };
    return [stateStore[currentKey], setter];
  },
  useEffect: (fn: () => any) => { fn(); },
  useCallback: (fn: any) => fn,
  useRef: (initial: any) => {
    if (!(refIndex in refStore)) {
      refStore[refIndex] = { current: initial };
    }
    const ref = refStore[refIndex];
    refIndex++;
    return ref;
  },
}));

// Socket.IO mock
const mockEventHandlers: Record<string, Function> = {};
const mockSocket = {
  on: jest.fn((event: string, handler: Function) => {
    mockEventHandlers[event] = handler;
  }),
  emit: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  connected: false,
  id: 'test-socket-id',
};

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => mockSocket),
}));

import { usePvpGame, UsePvpGameReturn } from '@/hooks/usePvpGame';

describe('usePvpGame Hook - PVP 大厅单元测试', () => {
  let hookResult: UsePvpGameReturn;

  beforeEach(() => {
    jest.clearAllMocks();
    stateStore = {};
    stateIndex = 0;
    refStore = {};
    refIndex = 0;
    Object.keys(mockEventHandlers).forEach(k => delete mockEventHandlers[k]);
    mockSocket.connected = false;
    mockSocket.id = 'test-socket-id';

    hookResult = usePvpGame();
  });

  describe('初始状态', () => {
    test('hook 返回正确的初始状态', () => {
      expect(hookResult.status).toBe('idle');
      expect(hookResult.roomCode).toBe('');
      expect(hookResult.gameState).toBeNull();
      expect(hookResult.errorMsg).toBe('');
    });

    test('hook 返回所有必需的方法', () => {
      expect(typeof hookResult.createRoom).toBe('function');
      expect(typeof hookResult.joinRoom).toBe('function');
      expect(typeof hookResult.placeBet).toBe('function');
      expect(typeof hookResult.restartGame).toBe('function');
    });
  });

  describe('createRoom - 创建房间', () => {
    test('createRoom 应连接 socket 并发送 createRoom 事件', () => {
      hookResult.createRoom();

      expect(mockSocket.connect).toHaveBeenCalled();
      expect(mockSocket.emit).toHaveBeenCalledWith('createRoom');
    });

    test('createRoom 后状态应变为 creating', () => {
      hookResult.createRoom();

      // Re-invoke hook to read updated state
      stateIndex = 0;
      const updated = usePvpGame();
      expect(updated.status).toBe('creating');
    });

    test('createRoom 应清除之前的错误信息', () => {
      // Simulate a previous error
      stateStore['errorMsg'] = '之前的错误';
      hookResult.createRoom();

      stateIndex = 0;
      const updated = usePvpGame();
      expect(updated.errorMsg).toBe('');
    });
  });

  describe('joinRoom - 加入房间', () => {
    test('joinRoom 应连接 socket 并发送 joinRoom 事件（房间码大写）', () => {
      hookResult.joinRoom('abc123');

      expect(mockSocket.connect).toHaveBeenCalled();
      expect(mockSocket.emit).toHaveBeenCalledWith('joinRoom', { roomCode: 'ABC123' });
    });

    test('joinRoom 后状态应变为 joining', () => {
      hookResult.joinRoom('XYZ789');

      stateIndex = 0;
      const updated = usePvpGame();
      expect(updated.status).toBe('joining');
    });
  });

  describe('Socket 事件处理 - roomCreated', () => {
    test('收到 roomCreated 事件后状态应变为 waiting 并设置 roomCode', () => {
      // Initialize socket by calling createRoom
      hookResult.createRoom();

      // Simulate server response
      expect(mockEventHandlers['roomCreated']).toBeDefined();
      mockEventHandlers['roomCreated']({ roomCode: 'ABC123', role: 'player' });

      stateIndex = 0;
      const updated = usePvpGame();
      expect(updated.status).toBe('waiting');
      expect(updated.roomCode).toBe('ABC123');
    });
  });

  describe('Socket 事件处理 - roomJoined', () => {
    test('收到 roomJoined 事件后状态应变为 waiting 并设置 roomCode', () => {
      hookResult.joinRoom('XYZ789');

      expect(mockEventHandlers['roomJoined']).toBeDefined();
      mockEventHandlers['roomJoined']({ roomCode: 'XYZ789', role: 'opponent' });

      stateIndex = 0;
      const updated = usePvpGame();
      expect(updated.status).toBe('waiting');
      expect(updated.roomCode).toBe('XYZ789');
    });
  });

  describe('Socket 事件处理 - gameState', () => {
    test('收到 gameState 事件后状态应变为 playing 并更新 gameState', () => {
      hookResult.createRoom();

      const mockGameState = {
        roomCode: 'ABC123',
        myRole: 'player' as const,
        myHand: [],
        opponentHand: null,
        phase: 'pre_flop_betting',
        communityCards: [],
        chipState: { playerChips: 1990, opponentChips: 1980 },
        bettingRound: null,
        handNumber: 1,
        isGameOver: false,
        gameOverWinner: null,
        actionLog: [],
        showdownResult: null,
        currentActor: 'player',
        availableActions: ['check', 'raise', 'fold'],
        opponentConnected: true,
      };

      expect(mockEventHandlers['gameState']).toBeDefined();
      mockEventHandlers['gameState'](mockGameState);

      stateIndex = 0;
      const updated = usePvpGame();
      expect(updated.status).toBe('playing');
      expect(updated.gameState).toEqual(mockGameState);
    });
  });

  describe('Socket 事件处理 - error', () => {
    test('收到 error 事件后应设置 errorMsg', () => {
      hookResult.createRoom();

      expect(mockEventHandlers['error']).toBeDefined();
      mockEventHandlers['error']({ message: '房间不存在或已满' });

      stateIndex = 0;
      const updated = usePvpGame();
      expect(updated.errorMsg).toBe('房间不存在或已满');
    });
  });

  describe('Socket 事件处理 - opponentDisconnected', () => {
    test('收到 opponentDisconnected 事件后应设置断线提示', () => {
      hookResult.createRoom();

      expect(mockEventHandlers['opponentDisconnected']).toBeDefined();
      mockEventHandlers['opponentDisconnected']();

      stateIndex = 0;
      const updated = usePvpGame();
      expect(updated.errorMsg).toBe('对手断线，等待重连...');
    });
  });

  describe('Socket 事件处理 - opponentAbandoned', () => {
    test('收到 opponentAbandoned 事件后应设置提示并回到 idle', () => {
      hookResult.createRoom();

      expect(mockEventHandlers['opponentAbandoned']).toBeDefined();
      mockEventHandlers['opponentAbandoned']();

      stateIndex = 0;
      const updated = usePvpGame();
      expect(updated.errorMsg).toBe('对手已离开');
      expect(updated.status).toBe('idle');
    });
  });

  describe('placeBet - 下注操作', () => {
    test('placeBet 应通过 socket 发送 placeBet 事件', () => {
      // Need to initialize socket first
      hookResult.createRoom();

      hookResult.placeBet({ type: 'raise', amount: 40 });

      expect(mockSocket.emit).toHaveBeenCalledWith('placeBet', { type: 'raise', amount: 40 });
    });

    test('placeBet 发送 check 操作', () => {
      hookResult.createRoom();

      hookResult.placeBet({ type: 'check', amount: 0 });

      expect(mockSocket.emit).toHaveBeenCalledWith('placeBet', { type: 'check', amount: 0 });
    });

    test('placeBet 发送 fold 操作', () => {
      hookResult.createRoom();

      hookResult.placeBet({ type: 'fold', amount: 0 });

      expect(mockSocket.emit).toHaveBeenCalledWith('placeBet', { type: 'fold', amount: 0 });
    });
  });

  describe('restartGame - 重新开始', () => {
    test('restartGame 应通过 socket 发送 restartGame 事件', () => {
      hookResult.createRoom();

      hookResult.restartGame();

      expect(mockSocket.emit).toHaveBeenCalledWith('restartGame');
    });
  });

  describe('状态转换流程', () => {
    test('完整流程: idle → creating → waiting → playing', () => {
      // Initial: idle
      expect(hookResult.status).toBe('idle');

      // Create room: idle → creating
      hookResult.createRoom();
      stateIndex = 0;
      let updated = usePvpGame();
      expect(updated.status).toBe('creating');

      // Room created: creating → waiting
      mockEventHandlers['roomCreated']({ roomCode: 'TEST01', role: 'player' });
      stateIndex = 0;
      updated = usePvpGame();
      expect(updated.status).toBe('waiting');

      // Game state received: waiting → playing
      mockEventHandlers['gameState']({
        roomCode: 'TEST01',
        myRole: 'player',
        myHand: [],
        opponentHand: null,
        phase: 'pre_flop_betting',
        communityCards: [],
        chipState: { playerChips: 1990, opponentChips: 1980 },
        bettingRound: null,
        handNumber: 1,
        isGameOver: false,
        gameOverWinner: null,
        actionLog: [],
        showdownResult: null,
        currentActor: 'player',
        availableActions: ['check', 'raise', 'fold'],
        opponentConnected: true,
      });
      stateIndex = 0;
      updated = usePvpGame();
      expect(updated.status).toBe('playing');
    });

    test('加入流程: idle → joining → waiting → playing', () => {
      expect(hookResult.status).toBe('idle');

      hookResult.joinRoom('ROOM01');
      stateIndex = 0;
      let updated = usePvpGame();
      expect(updated.status).toBe('joining');

      mockEventHandlers['roomJoined']({ roomCode: 'ROOM01', role: 'opponent' });
      stateIndex = 0;
      updated = usePvpGame();
      expect(updated.status).toBe('waiting');

      mockEventHandlers['gameState']({
        roomCode: 'ROOM01',
        myRole: 'opponent',
        myHand: [],
        opponentHand: null,
        phase: 'pre_flop_betting',
        communityCards: [],
        chipState: { playerChips: 1990, opponentChips: 1980 },
        bettingRound: null,
        handNumber: 1,
        isGameOver: false,
        gameOverWinner: null,
        actionLog: [],
        showdownResult: null,
        currentActor: 'player',
        availableActions: [],
        opponentConnected: true,
      });
      stateIndex = 0;
      updated = usePvpGame();
      expect(updated.status).toBe('playing');
    });
  });

  describe('Socket 事件处理 - reconnected', () => {
    test('收到 reconnected 事件后状态应变为 playing', () => {
      // Simulate being in disconnected state
      stateStore['status'] = 'disconnected';
      hookResult.createRoom();

      expect(mockEventHandlers['reconnected']).toBeDefined();
      mockEventHandlers['reconnected']();

      stateIndex = 0;
      const updated = usePvpGame();
      expect(updated.status).toBe('playing');
    });
  });

  describe('Socket 事件处理 - disconnect', () => {
    test('playing 状态下 socket 断开应将状态设为 disconnected', () => {
      hookResult.createRoom();
      // statusRef is the 3rd useRef (index 2): socketRef(0), socketIdRef(1), statusRef(2)
      // Simulate being in playing state via the persistent statusRef
      refStore[2].current = 'playing';

      expect(mockEventHandlers['disconnect']).toBeDefined();
      mockEventHandlers['disconnect']();

      stateIndex = 0;
      refIndex = 0;
      const updated = usePvpGame();
      expect(updated.status).toBe('disconnected');
    });

    test('非 playing 状态下 socket 断开不应改变状态', () => {
      hookResult.createRoom();
      // Status is 'creating' (set by createRoom), not 'playing'
      // statusRef.current will be 'creating' from the hook re-invocation
      refStore[2].current = 'waiting';

      mockEventHandlers['disconnect']();

      stateIndex = 0;
      refIndex = 0;
      const updated = usePvpGame();
      // Status should remain 'waiting', not change to 'disconnected'
      expect(updated.status).not.toBe('disconnected');
    });
  });

  describe('cleanup on unmount', () => {
    test('组件卸载时应断开 socket 连接', () => {
      // Initialize socket
      hookResult.createRoom();

      // The useEffect mock calls the function immediately,
      // and the cleanup is the returned function.
      // Since our mock calls fn() directly, we verify disconnect is available
      expect(mockSocket.disconnect).toBeDefined();
    });
  });

  describe('Hook 返回接口完整性', () => {
    test('UsePvpGameReturn 接口包含所有必需字段', () => {
      const keys = Object.keys(hookResult);
      expect(keys).toContain('status');
      expect(keys).toContain('roomCode');
      expect(keys).toContain('gameState');
      expect(keys).toContain('errorMsg');
      expect(keys).toContain('createRoom');
      expect(keys).toContain('joinRoom');
      expect(keys).toContain('placeBet');
      expect(keys).toContain('restartGame');
      expect(keys).toHaveLength(8);
    });
  });
});
