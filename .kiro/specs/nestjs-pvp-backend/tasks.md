# 实施计划：NestJS PVP 后端

## 概述

将现有德州扑克训练器的客户端引擎逻辑迁移至 NestJS + Socket.IO 后端，构建权威服务器模式的 1v1 PVP 对战系统。按照"项目初始化 → 数据模型 → 核心服务 → WebSocket 网关 → 断线重连 → 集成联调"的顺序递增实现。

## 任务

- [ ] 1. 初始化 NestJS 项目结构与引擎共享配置
  - [x] 1.1 创建 `server/` 目录，初始化 `package.json`，安装 `@nestjs/core`、`@nestjs/common`、`@nestjs/websockets`、`@nestjs/platform-socket.io`、`socket.io`、`rxjs`、`reflect-metadata` 等依赖，以及 devDependencies（`@nestjs/cli`、`@nestjs/testing`、`jest`、`ts-jest`、`fast-check`、`socket.io-client`、`@types/jest`、`typescript`）
    - _需求：1.1, 1.2, 1.3_
  - [x] 1.2 创建 `server/tsconfig.json`，配置 `paths` 别名 `@engine/*` 指向 `../src/engine/*`，启用 `emitDecoratorMetadata` 和 `experimentalDecorators`
    - _需求：1.5_
  - [ ] 1.3 创建 `server/nest-cli.json` 和 `server/src/main.ts` 入口文件，支持通过环境变量配置端口（默认 3000）和 CORS
    - _需求：1.4_
  - [ ] 1.4 创建 `server/src/app.module.ts` 根模块和 `server/src/game/game.module.ts` 游戏模块
    - _需求：1.1_
  - [ ] 1.5 创建 `server/src/shared/engine.ts`，重导出 `@engine/deck`、`@engine/dealEngine`、`@engine/bettingEngine`、`@engine/chipManager`、`@engine/handEvaluator`、`@engine/showdownEngine`、`@engine/cardSerializer`、`@engine/types` 中的所有导出
    - _需求：2.1_

- [ ] 2. 定义服务端数据模型与接口
  - [ ] 2.1 创建 `server/src/game/interfaces.ts`，定义 `Room`、`PlayerSession`、`ClientView`、`ExtendedGamePhase` 等服务端专用接口，复用 `@engine/types` 中的 `Card`、`ChipState`、`BettingRoundState`、`BettingActionType`、`ShowdownResult`、`ActionLogEntry` 等类型
    - _需求：2.3, 2.4, 4.8_

- [ ] 3. 实现 RoomService（房间管理服务）
  - [ ] 3.1 创建 `server/src/game/room.service.ts`，实现 `RoomService` 类，包含 `rooms: Map<string, Room>` 私有属性
    - 实现 `generateRoomCode()` 方法：生成 6 位大写字母房间码，确保不与已有房间码重复
    - 实现 `createRoom(socketId)` 方法：创建新房间，将创建者设为 player 角色，返回 `{ roomCode, role }`
    - 实现 `joinRoom(socketId, roomCode)` 方法：验证房间存在性和人数上限，将加入者设为 opponent 角色
    - 实现 `findRoomBySocketId(socketId)` 方法：通过 socket ID 查找所属房间
    - 实现 `handleDisconnect(socketId)` 方法：标记玩家为断线状态，返回房间和角色信息
    - 实现 `handleReconnect(roomCode, oldSocketId, newSocketId)` 方法：验证身份并绑定新 socket
    - 实现 `destroyRoom(roomCode)` 方法：销毁房间释放资源
    - _需求：4.1, 4.2, 4.3, 4.4, 4.5, 4.7, 4.8, 6.1, 6.2_
  - [ ] 3.2 编写属性测试：房间码格式与唯一性
    - **属性 3：房间码格式与唯一性**
    - 使用 fast-check 生成随机已有房间码集合，验证新生成的房间码匹配 `/^[A-Z]{6}$/` 且不重复
    - **验证需求：4.1, 4.2**
  - [ ] 3.3 编写属性测试：房间人数上限
    - **属性 4：房间人数上限**
    - 使用 fast-check 生成已满房间，验证第三人加入被拒绝且房间状态不变
    - **验证需求：4.8**
  - [ ] 3.4 编写 RoomService 单元测试
    - 测试创建房间、加入房间、房间不存在、房间已满、断线处理、重连等场景
    - _需求：4.1, 4.2, 4.3, 4.4, 4.5, 6.1, 6.2_

- [ ] 4. 检查点 - 确保 RoomService 所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [ ] 5. 实现 GameService（游戏流程服务）
  - [ ] 5.1 创建 `server/src/game/game.service.ts`，实现 `GameService` 类
    - 实现 `initializeGame(room)` 方法：调用 `createDeck`、`shuffle`、`dealHands`、`postBlinds`、`createBettingRound` 初始化游戏状态，设置阶段为 `pre_flop_betting`，双方各 2000 筹码
    - 实现 `placeBet(room, socketId, action)` 方法：验证行动方身份、操作合法性，调用 `executeBettingAction`，处理弃牌结算、回合结束后自动发牌推进阶段、all-in 自动补全公共牌进入摊牌、摊牌结算（调用 `showdown`、`awardPot`/`splitPot`）、筹码归零触发 game_over
    - 实现 `restartGame(room, socketId)` 方法：验证当前阶段为 showdown 或 game_over，showdown 时保留筹码开始新手牌，game_over 时重置为 2000 筹码
    - 实现 `getClientView(room, role)` 方法：根据角色过滤游戏状态，非摊牌阶段隐藏对手手牌和 remainingDeck，摊牌阶段公开对手手牌
    - _需求：2.1, 2.2, 2.3, 2.4, 2.5, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 5.12, 7.1_
  - [ ] 5.2 编写属性测试：游戏初始化正确性
    - **属性 5：游戏初始化正确性**
    - 使用 fast-check 生成随机 handNumber 和 chipState，验证初始化后阶段为 pre_flop_betting、双方各 2 张手牌、公共牌为空、筹码总和加底池等于 4000、盲注正确
    - **验证需求：2.3, 5.1, 5.12**
  - [ ] 5.3 编写属性测试：Client_View 信息过滤
    - **属性 2：Client_View 信息过滤**
    - 使用 fast-check 生成随机游戏状态和角色，验证非摊牌阶段 opponentHand 为 null 且不含 remainingDeck，摊牌阶段公开对手手牌
    - **验证需求：2.4, 2.5, 7.5**
  - [ ] 5.4 编写属性测试：阶段推进与公共牌一致性
    - **属性 6：阶段推进与公共牌一致性**
    - 使用 fast-check 生成随机合法操作序列，验证阶段按 pre_flop → flop → turn → river → showdown 推进，各阶段公共牌数量正确
    - **验证需求：5.2, 5.3**
  - [ ] 5.5 编写属性测试：筹码守恒
    - **属性 7：筹码守恒**
    - 使用 fast-check 生成随机完整牌局，验证任意时刻双方筹码加底池等于初始总筹码
    - **验证需求：5.6, 5.7**
  - [ ] 5.6 编写属性测试：小盲注交替
    - **属性 8：小盲注交替**
    - 使用 fast-check 生成随机 handNumber，验证奇数时 player 为小盲注、偶数时 opponent 为小盲注
    - **验证需求：5.9**
  - [ ] 5.7 编写属性测试：筹码归零触发 game_over
    - **属性 9：筹码归零触发 game_over**
    - 使用 fast-check 生成随机筹码归零状态，验证阶段为 game_over 且 gameOverWinner 正确
    - **验证需求：5.10**
  - [ ] 5.8 编写属性测试：非法操作不改变游戏状态
    - **属性 10：非法操作不改变游戏状态**
    - 使用 fast-check 生成随机游戏状态和非法操作（非当前行动方、非法类型、金额不足、负数金额），验证状态不变并返回错误
    - **验证需求：3.3, 3.4, 5.4, 5.5, 7.3, 7.4**
  - [ ] 5.9 编写属性测试：All-in 后自动完成公共牌
    - **属性 12：All-in 后自动完成公共牌**
    - 使用 fast-check 生成随机 all-in 状态，验证系统自动发出所有剩余公共牌使总数达到 5 张并进入摊牌
    - **验证需求：5.8**
  - [ ] 5.10 编写 GameService 单元测试
    - 测试游戏初始化、各阶段转换、弃牌结算、摊牌结算、restartGame 在 showdown 和 game_over 阶段的行为
    - _需求：5.1, 5.2, 5.6, 5.7, 5.10, 5.11_

- [ ] 6. 检查点 - 确保 GameService 所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [ ] 7. 实现 GameGateway（WebSocket 网关）
  - [ ] 7.1 创建 `server/src/game/game.gateway.ts`，实现 `GameGateway` 类
    - 实现 `handleConnection(client)` 和 `handleDisconnect(client)` 生命周期方法
    - `handleDisconnect`：调用 `RoomService.handleDisconnect`，通知对手 `opponentDisconnected`，启动 120 秒计时器，超时后发送 `opponentAbandoned` 并销毁房间
    - 实现 `@SubscribeMessage('createRoom')` 处理器：调用 `RoomService.createRoom`，将 socket 加入 Socket.IO Room，发送 `roomCreated` 事件
    - 实现 `@SubscribeMessage('joinRoom')` 处理器：校验 `roomCode` 为 6 位大写字母，调用 `RoomService.joinRoom`，处理错误（房间不存在、房间已满），成功后将 socket 加入 Room，发送 `roomJoined`，触发 `GameService.initializeGame`，向双方发送各自的 `gameState`（ClientView）
    - 实现 `@SubscribeMessage('placeBet')` 处理器：校验 `type` 为合法 `BettingActionType`、`amount` 为非负整数，验证发送者为房间成员，调用 `GameService.placeBet`，成功后向双方发送更新的 `gameState`
    - 实现 `@SubscribeMessage('restartGame')` 处理器：验证发送者为房间成员，调用 `GameService.restartGame`，成功后向双方发送更新的 `gameState`
    - 实现 `@SubscribeMessage('reconnect')` 处理器：校验 `roomCode` 和 `oldSocketId` 为非空字符串，调用 `RoomService.handleReconnect`，成功后将新 socket 加入 Room，发送 `reconnected` 和当前 `gameState`，通知对手 `opponentReconnected`
    - 所有游戏操作事件（placeBet、restartGame）需先验证发送者是否为房间成员，非成员返回 `error` 事件
    - _需求：3.1, 3.2, 3.3, 3.4, 3.5, 4.3, 4.4, 4.5, 4.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 7.2, 7.3, 7.4_
  - [ ] 7.2 编写属性测试：Card 序列化往返一致性
    - **属性 1：Card 序列化往返一致性**
    - 使用 fast-check 生成随机有效 Card 对象，验证 serialize → deserialize 往返一致性，以及 serializeMany → deserializeMany 往返一致性
    - **验证需求：2.6, 2.7**
  - [ ] 7.3 编写属性测试：非房间成员操作被拒绝
    - **属性 11：非房间成员操作被拒绝**
    - 使用 fast-check 生成随机非成员 socket ID，验证 placeBet 和 restartGame 操作被拒绝且房间状态不变
    - **验证需求：7.2**
  - [ ] 7.4 编写 GameGateway 单元测试
    - 使用 `@nestjs/testing` 模块测试事件路由、输入校验（无效 roomCode 格式、无效 BettingActionType、负数 amount）、错误响应
    - _需求：3.3, 3.4, 7.2, 7.3, 7.4_

- [ ] 8. 检查点 - 确保 GameGateway 所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [ ] 9. 集成联调与端到端验证
  - [ ] 9.1 配置 Jest 测试环境
    - 创建 `server/jest.config.ts`，配置 `moduleNameMapper` 将 `@engine/*` 映射到 `../src/engine/*`，确保属性测试和单元测试均可运行
    - _需求：1.5_
  - [ ] 9.2 编写集成测试
    - 创建 `server/test/game.e2e.spec.ts`，使用 `@nestjs/testing` 和 `socket.io-client` 测试完整流程：
      - 创建房间 → 加入房间 → 游戏开始 → 下注 → 阶段推进 → 摊牌
      - 断线 → 重连 → 继续游戏
      - 断线 → 超时 → 房间销毁
    - _需求：3.1, 3.2, 4.3, 4.6, 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 10. 最终检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

## 备注

- 标记 `*` 的子任务为可选任务，可跳过以加速 MVP 开发
- 每个任务引用了具体的需求编号以确保可追溯性
- 检查点确保增量验证
- 属性测试验证通用正确性属性，单元测试验证具体示例和边界情况
- 所有服务端代码通过 `@engine/*` 路径别名复用 `src/engine/` 中的纯函数，无需复制代码
