import { useState, useEffect, useCallback, useRef } from 'react';
import Taro from '@tarojs/taro';
import { BettingAction } from '@/engine/types';

const SERVER_URL = process.env.TARO_APP_PVP_SERVER || 'https://texas-holdem-trainer.onrender.com';

export type PvpStatus = 'idle' | 'creating' | 'joining' | 'waiting' | 'playing' | 'disconnected' | 'error';

export interface PvpGameState {
  roomCode: string;
  myRole: 'player' | 'opponent';
  myHand: any[];
  opponentHand: any[] | null;
  phase: string;
  communityCards: any[];
  chipState: { playerChips: number; opponentChips: number };
  bettingRound: any;
  handNumber: number;
  isGameOver: boolean;
  gameOverWinner: string | null;
  actionLog: any[];
  showdownResult: any;
  currentActor: string | null;
  availableActions: string[];
  opponentConnected: boolean;
}

export interface UsePvpGameReturn {
  status: PvpStatus;
  roomCode: string;
  gameState: PvpGameState | null;
  errorMsg: string;
  createRoom: () => void;
  joinRoom: (code: string) => void;
  placeBet: (action: BettingAction) => void;
  restartGame: () => void;
}

export function usePvpGame(): UsePvpGameReturn {
  const [status, setStatus] = useState<PvpStatus>('idle');
  const [roomCode, setRoomCode] = useState('');
  const [gameState, setGameState] = useState<PvpGameState | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const socketRef = useRef<any>(null);
  const socketIdRef = useRef<string>('');
  const statusRef = useRef<PvpStatus>('idle');
  statusRef.current = status;

  const getSocket = useCallback(() => {
    if (socketRef.current) return socketRef.current;
    try {
      // 动态 import 避免模块加载时崩溃
      const { io } = require('socket.io-client');
      const socket = io(SERVER_URL, { autoConnect: false, transports: ['websocket', 'polling'] });
      socketRef.current = socket;

      socket.on('connect', () => {
        socketIdRef.current = socket.id || '';
        try {
          const savedRoom = Taro.getStorageSync('pvp_room');
          const savedSocketId = Taro.getStorageSync('pvp_socket_id');
          if (savedRoom && savedSocketId && savedSocketId !== socket.id) {
            socket.emit('reconnect', { roomCode: savedRoom, oldSocketId: savedSocketId });
          }
          Taro.setStorageSync('pvp_socket_id', socket.id || '');
        } catch (e) { /* storage not available */ }
      });

      socket.on('roomCreated', (data: { roomCode: string; role: string }) => {
        setRoomCode(data.roomCode);
        setStatus('waiting');
        try { Taro.setStorageSync('pvp_room', data.roomCode); } catch (e) {}
      });

      socket.on('roomJoined', (data: { roomCode: string; role: string }) => {
        setRoomCode(data.roomCode);
        setStatus('waiting');
        try { Taro.setStorageSync('pvp_room', data.roomCode); } catch (e) {}
      });

      socket.on('gameState', (state: PvpGameState) => {
        setGameState(state);
        setStatus('playing');
      });

      socket.on('reconnected', () => { setStatus('playing'); });
      socket.on('opponentDisconnected', () => { setErrorMsg('对手断线，等待重连...'); });
      socket.on('opponentAbandoned', () => { setErrorMsg('对手已离开'); setStatus('idle'); });
      socket.on('error', (data: { message: string }) => { setErrorMsg(data.message); });
      socket.on('disconnect', () => { if (statusRef.current === 'playing') setStatus('disconnected'); });

      return socket;
    } catch (e) {
      console.error('Socket.IO init failed:', e);
      setErrorMsg('网络模块加载失败');
      setStatus('error');
      return null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  const createRoom = useCallback(() => {
    const socket = getSocket();
    if (!socket) return;
    if (!socket.connected) socket.connect();
    setStatus('creating');
    setErrorMsg('');
    socket.emit('createRoom');
  }, [getSocket]);

  const joinRoom = useCallback((code: string) => {
    const socket = getSocket();
    if (!socket) return;
    if (!socket.connected) socket.connect();
    setStatus('joining');
    setErrorMsg('');
    socket.emit('joinRoom', { roomCode: code.toUpperCase() });
  }, [getSocket]);

  const placeBet = useCallback((action: BettingAction) => {
    socketRef.current?.emit('placeBet', { type: action.type, amount: action.amount });
  }, []);

  const restartGame = useCallback(() => {
    socketRef.current?.emit('restartGame');
  }, []);

  return { status, roomCode, gameState, errorMsg, createRoom, joinRoom, placeBet, restartGame };
}
