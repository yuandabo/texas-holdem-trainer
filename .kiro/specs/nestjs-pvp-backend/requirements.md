# 需求文档

## 简介

将现有德州扑克训练器的客户端引擎逻辑迁移至 NestJS + Socket.IO 后端，构建权威服务器模式的 1v1 PVP 对战系统。服务端全权管理牌组、发牌、下注、摊牌等核心游戏逻辑，客户端仅负责展示和发送操作指令，从而防止作弊。支持房间码邀请好友和断线重连。

## 术语表

- **PVP_Server**: 基于 NestJS 框架构建的后端 WebSocket 服务，承载所有游戏逻辑
- **Game_Gateway**: NestJS 中处理 Socket.IO 连接和事件的 WebSocket 网关
- **Room_Manager**: 负责房间创建、加入、查询、销毁的服务模块
- **Game_Engine**: 服务端游戏引擎，封装牌组管理、发牌、下注、摊牌等核心逻辑（从客户端 src/engine/ 迁移）
- **Room**: 一个 1v1 对战实例，包含两名玩家的连接信息和完整游戏状态
- **Room_Code**: 由服务端生成的 6 位大写字母房间码，用于好友邀请
- **Player_Session**: 玩家在房间中的会话信息，包含 socket ID、角色（player/opponent）、连接状态
- **Game_State**: 服务端维护的完整游戏状态，包含牌组、手牌、公共牌、筹码、下注回合等全部数据
- **Client_View**: 服务端根据玩家角色过滤后发送给客户端的游戏状态视图（隐藏对手手牌等敏感信息）
- **Card_Serializer**: 卡牌序列化/反序列化模块，用于网络传输中的数据编解码
- **Betting_Round**: 一个下注回合的状态，包含底池、各方下注额、当前行动方等
- **Showdown_Engine**: 摊牌引擎，负责在河牌下注结束后评估双方牌型并判定胜负

## 需求

### 需求 1：NestJS 项目初始化

**用户故事：** 作为开发者，我希望在项目中创建独立的 NestJS 后端服务目录，以便与现有 Taro 前端代码共存。

#### 验收标准

1. THE PVP_Server SHALL 在项目根目录下的 `server/` 目录中初始化为独立的 NestJS 项目
2. THE PVP_Server SHALL 使用 TypeScript 作为开发语言
3. THE PVP_Server SHALL 集成 `@nestjs/websockets` 和 `@nestjs/platform-socket.io` 依赖
4. THE PVP_Server SHALL 支持通过环境变量配置监听端口（默认 3000）和 CORS 允许的来源
5. THE PVP_Server SHALL 与前端共享 `src/engine/` 目录下的类型定义和纯函数引擎模块（通过 TypeScript 路径别名或符号链接）

### 需求 2：引擎逻辑迁移至服务端

**用户故事：** 作为开发者，我希望将客户端的游戏引擎逻辑迁移到服务端执行，以便实现权威服务器模式防止作弊。

#### 验收标准

1. THE Game_Engine SHALL 在服务端复用现有 `src/engine/` 中的以下纯函数模块：deck（创建牌组、洗牌、抽牌）、dealEngine（发手牌、翻牌、转牌、河牌）、handEvaluator（牌型评估与比较）、showdownEngine（摊牌判定）、bettingEngine（下注回合管理）、chipManager（筹码管理）
2. THE Game_Engine SHALL 在服务端执行所有随机操作（洗牌），客户端不参与随机数生成
3. THE Game_Engine SHALL 在服务端维护完整的 Game_State，包含 remainingDeck、playerHand、opponentHand、communityCards、chipState、bettingRound、handNumber、actionLog 等全部字段
4. THE Game_Engine SHALL 在每次状态变更后生成 Client_View，对每位玩家隐藏对手的手牌和剩余牌组信息
5. WHEN 进入摊牌阶段时，THE Game_Engine SHALL 在 Client_View 中向双方公开对手手牌和牌型评估结果
6. THE Card_Serializer SHALL 对通过 WebSocket 传输的卡牌数据进行序列化和反序列化
7. FOR ALL 有效的 Card 对象，序列化后再反序列化 SHALL 产生与原始对象等价的结果（往返一致性）

### 需求 3：WebSocket 网关与事件协议

**用户故事：** 作为开发者，我希望定义清晰的 WebSocket 事件协议，以便前后端通过 Socket.IO 进行可靠通信。

#### 验收标准

1. THE Game_Gateway SHALL 监听以下客户端事件：`createRoom`、`joinRoom`（携带 roomCode 参数）、`placeBet`（携带 type 和 amount 参数）、`restartGame`、`reconnect`（携带 roomCode 和 oldSocketId 参数）
2. THE Game_Gateway SHALL 向客户端发送以下服务端事件：`roomCreated`（携带 roomCode 和 role）、`roomJoined`（携带 roomCode 和 role）、`gameState`（携带该玩家视角的 Client_View）、`reconnected`、`opponentDisconnected`、`opponentAbandoned`、`error`（携带 message）
3. WHEN 客户端发送无效事件或参数格式错误时，THE Game_Gateway SHALL 向该客户端发送 `error` 事件并附带描述性错误信息
4. THE Game_Gateway SHALL 对所有客户端输入进行校验，拒绝非法的下注操作（如非当前行动方下注、金额不合法等）
5. THE Game_Gateway SHALL 使用 Socket.IO 的 Room 机制将同一房间的两名玩家分组，确保 gameState 事件仅发送给房间内的玩家

### 需求 4：房间管理

**用户故事：** 作为玩家，我希望能创建房间并通过房间码邀请好友加入，以便进行 1v1 对战。

#### 验收标准

1. WHEN 玩家发送 `createRoom` 事件时，THE Room_Manager SHALL 生成一个唯一的 6 位大写字母 Room_Code 并创建新的 Room
2. THE Room_Manager SHALL 确保生成的 Room_Code 不与任何现有活跃房间的 Room_Code 重复
3. WHEN 玩家发送 `joinRoom` 事件且 Room_Code 对应一个等待中的房间时，THE Room_Manager SHALL 将该玩家加入房间并通知双方
4. IF 玩家发送 `joinRoom` 事件但 Room_Code 不存在，THEN THE Room_Manager SHALL 返回 `error` 事件，message 为"房间不存在"
5. IF 玩家发送 `joinRoom` 事件但房间已满（已有 2 名玩家），THEN THE Room_Manager SHALL 返回 `error` 事件，message 为"房间已满"
6. WHEN 两名玩家均加入房间后，THE Room_Manager SHALL 触发 Game_Engine 初始化游戏状态并向双方发送初始 gameState
7. THE Room_Manager SHALL 在房间内所有玩家断开连接超过 120 秒后自动销毁该房间并释放资源
8. THE Room SHALL 限制为恰好 2 名玩家（1v1 模式）

### 需求 5：游戏流程管理

**用户故事：** 作为玩家，我希望服务端管理完整的德州扑克游戏流程，以便获得公平的对战体验。

#### 验收标准

1. WHEN 游戏初始化时，THE Game_Engine SHALL 创建牌组、洗牌、发手牌、发放盲注（小盲注 10、大盲注 20），并将阶段设为 pre_flop_betting
2. THE Game_Engine SHALL 按照 pre_flop_betting → flop_betting → turn_betting → river_betting → showdown 的顺序推进游戏阶段
3. WHEN 一个下注回合结束且无人弃牌时，THE Game_Engine SHALL 自动发出下一阶段的公共牌（翻牌 3 张、转牌 1 张、河牌 1 张）并开始新的下注回合
4. WHEN 玩家发送 `placeBet` 事件时，THE Game_Engine SHALL 验证该操作是否合法（是否为当前行动方、操作类型是否在可用操作列表中、金额是否符合最低加注要求 20）
5. IF 玩家发送的下注操作不合法，THEN THE Game_Engine SHALL 返回 `error` 事件并附带具体原因，不改变游戏状态
6. WHEN 某方弃牌时，THE Game_Engine SHALL 立即结算底池给未弃牌方并结束当前手牌
7. WHEN 河牌下注回合结束且无人弃牌时，THE Showdown_Engine SHALL 评估双方牌型并判定胜负，将底池分配给获胜方（平局时各得一半，奇数筹码归小盲注方）
8. WHEN 任一方全下（all-in）且下注回合结束时，THE Game_Engine SHALL 自动发出所有剩余公共牌并直接进入摊牌
9. WHEN 一手牌结束后，THE Game_Engine SHALL 根据手牌序号交替小盲注位置（奇数手牌 player 为小盲注，偶数手牌 opponent 为小盲注）
10. WHEN 任一方筹码归零时，THE Game_Engine SHALL 将游戏阶段设为 game_over 并标记获胜方
11. WHEN 玩家发送 `restartGame` 事件且当前手牌已结束（showdown 或 game_over 阶段）时，THE Game_Engine SHALL 开始新一手牌（showdown 时保留筹码，game_over 时重置为初始筹码 2000）
12. THE Game_Engine SHALL 为每位玩家初始分配 2000 筹码

### 需求 6：断线重连

**用户故事：** 作为玩家，我希望在网络断开后能重新连接回正在进行的对局，以便继续游戏。

#### 验收标准

1. WHEN 玩家断开连接时，THE Room_Manager SHALL 保留该玩家的 Player_Session 和房间状态，并向对手发送 `opponentDisconnected` 事件
2. WHEN 断线玩家发送 `reconnect` 事件（携带 roomCode 和 oldSocketId）时，THE Room_Manager SHALL 验证身份并将新的 socket 连接绑定到原有 Player_Session
3. WHEN 重连成功时，THE Game_Gateway SHALL 向重连玩家发送 `reconnected` 事件和当前完整的 Client_View（gameState）
4. WHEN 重连成功时，THE Game_Gateway SHALL 向对手发送 `opponentReconnected` 事件
5. IF 断线玩家在 120 秒内未重连，THEN THE Room_Manager SHALL 判定该玩家放弃对局，向对手发送 `opponentAbandoned` 事件，并销毁房间
6. WHILE 对手处于断线状态，THE Game_Engine SHALL 暂停游戏计时和行动超时（如有），等待对手重连

### 需求 7：安全性与防作弊

**用户故事：** 作为玩家，我希望对战环境公平安全，不存在作弊可能。

#### 验收标准

1. THE PVP_Server SHALL 仅在服务端执行洗牌和发牌操作，客户端无法获取未公开的牌面信息
2. THE Game_Gateway SHALL 拒绝来自非房间成员的任何游戏操作事件
3. THE Game_Gateway SHALL 拒绝非当前行动方发送的 `placeBet` 事件
4. THE Game_Gateway SHALL 对每个事件的参数进行类型和范围校验（如 amount 为非负整数、type 为合法的 BettingActionType）
5. THE Client_View SHALL 在非摊牌阶段不包含对手手牌（opponentHand）和剩余牌组（remainingDeck）信息
