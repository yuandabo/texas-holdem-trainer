# Project Structure

Monorepo with a Taro frontend at root and a NestJS backend in `server/`.

```
├── src/                        # Frontend source (Taro + React)
│   ├── engine/                 # Pure game logic (shared with server)
│   │   ├── types.ts            # Core types, enums, interfaces, constants
│   │   ├── deck.ts             # Deck creation and shuffling
│   │   ├── dealEngine.ts       # Card dealing logic
│   │   ├── handEvaluator.ts    # Hand ranking evaluation
│   │   ├── showdownEngine.ts   # Showdown comparison
│   │   ├── bettingEngine.ts    # Betting rules and available actions
│   │   ├── chipManager.ts      # Chip/blind management
│   │   ├── cardSerializer.ts   # Card ↔ string serialization for Socket.IO
│   │   ├── opponentAI.ts       # AI opponent logic (training mode)
│   │   └── winRateCalculator.ts# Monte Carlo win-rate estimation
│   ├── components/             # Reusable UI components (BEM-named SCSS)
│   │   ├── CardDisplay/
│   │   ├── ChipDisplay/
│   │   ├── BettingActionPanel/
│   │   ├── ResultPanel/
│   │   ├── GameOverPanel/
│   │   ├── HandRankHint/
│   │   ├── WinRateHint/
│   │   └── ActionLog/
│   ├── hooks/                  # React hooks
│   │   ├── useGameFlow.ts      # AI mode game orchestration
│   │   └── usePvpGame.ts       # PVP mode Socket.IO state management
│   ├── pages/
│   │   ├── game/index.tsx      # Main game page (AI mode + mode switch)
│   │   └── pvp/index.tsx       # PVP game page
│   └── __tests__/              # Frontend unit + PBT tests
│
├── server/                     # Backend (NestJS)
│   ├── src/
│   │   ├── main.ts             # Bootstrap (CORS, port 3000)
│   │   ├── app.module.ts       # Root module (imports RoomModule)
│   │   ├── engine/             # Server-side copy of game engine
│   │   │   └── (mirrors src/engine/ — imported via @engine/ alias)
│   │   └── room/               # PVP room management
│   │       ├── room.model.ts   # Room class: players, game state, betting, timers
│   │       ├── room.service.ts # Room CRUD, socket mapping, reconnection
│   │       ├── room.module.ts  # NestJS module
│   │       ├── game.gateway.ts # WebSocket gateway (createRoom, joinRoom, placeBet, etc.)
│   │       └── __tests__/      # Backend tests
│   ├── jest.config.js
│   ├── tsconfig.json
│   └── package.json
│
├── config/index.ts             # Taro build config (webpack5, aliases, platform plugins)
├── android/                    # Capacitor Android shell
├── package.json                # Frontend deps + scripts
└── tsconfig.json               # Frontend TS config
```

## Key Patterns
- **Engine code is shared**: `src/engine/` contains pure logic with no UI deps. The server mirrors it under `server/src/engine/` and imports via `@engine/` alias.
- **Component structure**: Each component lives in its own folder with an `index.tsx` and `index.scss`.
- **Tests co-located by convention**: Frontend tests in `src/__tests__/`, backend tests in `server/src/*/__tests__/`. Property-based tests use `-pbt.test.ts` suffix.
- **Socket.IO events**: `createRoom`, `joinRoom`, `placeBet`, `restartGame`, `reconnect` (client → server); `roomCreated`, `roomJoined`, `gameState`, `error`, `opponentDisconnected`, `opponentAbandoned`, `reconnected` (server → client).
