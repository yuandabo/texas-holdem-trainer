# Tech Stack

## Frontend (root `/`)
- **Framework**: Taro 4.1 + React 18 — cross-platform (WeChat Mini Program, H5, Android)
- **Language**: TypeScript (strict mode)
- **Styling**: SCSS with BEM naming (`game-page__player-row`)
- **Bundler**: Webpack 5 (via `@tarojs/webpack5-runner`)
- **Mobile native**: Capacitor 8 for Android builds
- **Realtime**: socket.io-client 4.x for PVP communication
- **Path alias**: `@/` → `src/`

## Backend (`server/`)
- **Framework**: NestJS 10 (modules, injectable services, decorators)
- **Realtime**: `@nestjs/websockets` + `@nestjs/platform-socket.io` (Socket.IO 4.x)
- **Language**: TypeScript
- **Build**: Nest CLI (`nest build`)
- **Path alias**: `@engine/` → `../src/engine/` (maps to shared frontend engine code)

## Testing
- **Runner**: Jest 29 with ts-jest preset
- **Property-based testing**: fast-check 3.x (files suffixed `-pbt.test.ts`)
- **Frontend tests**: `src/__tests__/` — run with `npm test` from root
- **Backend tests**: `server/src/**/__tests__/` — run with `npm test` from `server/`

## Common Commands

| Task | Command | Working Dir |
|---|---|---|
| Run frontend tests | `npm test` | `/` (root) |
| Run backend tests | `npm test` | `server/` |
| Dev H5 | `npm run dev:h5` | `/` |
| Build H5 | `npm run build:h5` | `/` |
| Dev WeChat | `npm run dev:weapp` | `/` |
| Build WeChat | `npm run build:weapp` | `/` |
| Build Android | `npm run build:android` | `/` |
| Start server (dev) | `npm run start:dev` | `server/` |
| Build server | `npm run build` | `server/` |

## Key Dependencies
- `react`, `react-dom` 18.x
- `@tarojs/*` 4.1.11
- `@nestjs/*` 10.4.x
- `socket.io` / `socket.io-client` 4.x
- `uuid` (server-side room code generation)
- `sass` for styling
- `fast-check` for property-based tests
