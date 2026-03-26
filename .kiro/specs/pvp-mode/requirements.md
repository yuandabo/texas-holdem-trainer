# 需求文档

## 简介

PVP 对战模式是德州扑克训练器的核心扩展功能，允许两名真实玩家通过 WebSocket 进行实时 1v1 德州扑克对战。系统采用权威服务器架构，由 NestJS 后端全权管理牌组、发牌、下注、摊牌等核心游戏逻辑，客户端（Taro + React）仅负责展示和发送操作指令，从而确保对战公平性。玩家可通过创建房间并分享 6 位房间码邀请好友加入对战，支持断线重连和操作超时自动处理。前端复用现有组件体系（CardDisplay、ChipDisplay、BettingActionPanel 等），后端复用 `src/engine/` 中的纯函数引擎模块。

## 术语表

- **PVP_Server**: 基于 NestJS 框架构建的后端 WebSocket 服务，部署在 `server/` 目录下，承载所有 PVP 游戏逻辑
- **Game_Gateway**: NestJS 中处理 Socket.IO 连接和事件的 WebSocket 网关，负责接收客户端事件并分发响应
- **Room_Manager**: 负责房间创建、加入、查询、销毁的服务模块（对应 `RoomService`）
- **Room**: 一个 1v1 对战实例，包含两名玩家的连接信息和完整游戏状态（对应 `Room` 模型）
- **Room_Code**: 由服务端生成的 6 位大写字母数字房间码，用于好友邀请
- **Game_Engine**: 服务端游戏引擎，封装牌组管理、发牌、下注、摊牌等核心逻辑，复用 `src/engine/` 中的纯函数模块
- **Player_Session**: 玩家在房间中的会话信息，包含 socket ID、角色（player/opponent）、连接状态
- **Game_State**: 服务端维护的完整游戏状态，包含牌组、手牌、公共牌、筹码、下注回合等全部数据
- **Client_View**: 服务端根据玩家角色过滤后发送给客户端的游戏状态视图，隐藏对手手牌等敏感信息
- **PVP_Client**: 前端 PVP 页面及其 Hook（`usePvpGame`），负责与 PVP_Server 建立 Socket.IO 连接并渲染游戏界面
- **Action_Timer**: 操作超时计时器，当玩家在规定时间内未做出操作时自动执行默认操作
- **Betting_Round**: 一个下注回合的状态，包含底池、各方下注额、当前行动方等
- **Showdown_Engine**: 摊牌引擎，负责在河牌下注结束后评估双方牌型并判定胜负

## 需求

### 需求 1：NestJS 后端服务搭建

**用户故事：** 作为开发者，我希望在项目中拥有独立的 NestJS 后端服务，以便承载 PVP 对战的服务端逻辑。

#### 验收标准

1. THE PVP_Server SHALL 在项目根目录下的 `server/` 目录中作为独立的 NestJS 项目运行
2. THE PVP_Server SHALL 使用 TypeScript 作为开发语言，并集成 `@nestjs/websockets` 和 `@nestjs/platform-socket.io` 依赖
3. THE PVP_Server SHALL 支持通过环境变量 `PORT` 配置监听端口（默认 3000），通过 `CORS_ORIGIN` 配置允许的跨域来源（默认 `*`）
4. THE PVP_Server SHALL 复用 `src/engine/` 目录下的纯函数引擎模块（deck、dealEngine、handEvaluator、showdownEngine、bettingEngine、chipManager、types）
5. THE PVP_Server SHALL 在启动时输出包含端口号的日志信息

### 需求 2：WebSocket 事件协议

**用户故事：** 作为开发者，我希望前后端之间有清晰定义的 WebSocket 事件协议，以便实现可靠的实时通信。

#### 验收标准

1. THE Game_Gateway SHALL 监听以下客户端事件：`createRoom`、`joinRoom`（携带 roomCode 参数）、`placeBet`（携带 type 和 amount 参数）、`restartGame`、`reconnect`（携带 roomCode 和 oldSocketId 参数）
2. THE Game_Gateway SHALL 向客户端发送以下服务端事件：`roomCreated`（携带 roomCode 和 role）、`roomJoined`（携带 roomCode 和 role）、`gameState`（携带该玩家视角的 Client_View）、`reconnected`（携带 role）、`opponentDisconnected`、`opponentAbandoned`、`error`（携带 message）
3. WHEN 客户端发送无效事件参数时，THE Game_Gateway SHALL 向该客户端发送 `error` 事件并附带描述性错误信息
4. THE Game_Gateway SHALL 对所有客户端输入进行校验，拒绝非法的下注操作（如非当前行动方下注、操作类型不在可用列表中、金额不符合规则等）
5. THE Game_Gateway SHALL 使用 Socket.IO 的 Room 机制将同一房间的两名玩家分组，确保 `gameState` 事件仅发送给房间内对应的玩家

### 需求 3：房间创建与加入

**用户故事：** 作为玩家，我希望能创建房间并通过房间码邀请好友加入，以便进行 1v1 对战。

#### 验收标准

1. WHEN 玩家发送 `createRoom` 事件时，THE Room_Manager SHALL 生成一个唯一的 6 位大写字母数字 Room_Code 并创建新的 Room
2. THE Room_Manager SHALL 确保生成的 Room_Code 不与任何现有活跃房间的 Room_Code 重复
3. WHEN 房间创建成功时，THE Game_Gateway SHALL 向创建者发送 `roomCreated` 事件，携带 roomCode 和分配的 role
4. WHEN 玩家发送 `joinRoom` 事件且 Room_Code 对应一个等待中的房间时，THE Room_Manager SHALL 将该玩家加入房间
5. WHEN 玩家成功加入房间时，THE Game_Gateway SHALL 向该玩家发送 `roomJoined` 事件，携带 roomCode 和分配的 role
6. IF 玩家发送 `joinRoom` 事件但 Room_Code 不存在或房间已满，THEN THE Game_Gateway SHALL 返回 `error` 事件，message 为"房间不存在或已满"
7. THE Room SHALL 限制为恰好 2 名玩家（1v1 模式）
8. WHEN 两名玩家均加入房间后，THE Room_Manager SHALL 触发 Game_Engine 初始化游戏状态并向双方各自发送对应视角的初始 `gameState`

### 需求 4：服务端游戏引擎

**用户故事：** 作为开发者，我希望所有游戏逻辑在服务端执行，以便实现权威服务器模式防止作弊。

#### 验收标准

1. THE Game_Engine SHALL 在服务端复用 `src/engine/` 中的以下纯函数模块：deck（创建牌组、洗牌）、dealEngine（发手牌、翻牌、转牌、河牌）、handEvaluator（牌型评估与比较）、showdownEngine（摊牌判定）、bettingEngine（下注回合管理）、chipManager（筹码管理）
2. THE Game_Engine SHALL 在服务端执行所有随机操作（洗牌），客户端不参与随机数生成
3. THE Game_Engine SHALL 在服务端维护完整的 Game_State，包含 remainingDeck、playerHand、opponentHand、communityCards、chipState、bettingRound、handNumber、actionLog 等全部字段
4. THE Game_Engine SHALL 在每次状态变更后为每位玩家生成独立的 Client_View，隐藏对手的手牌和剩余牌组信息
5. WHEN 进入摊牌阶段或全下后下注回合结束时，THE Game_Engine SHALL 在 Client_View 中向双方公开对手手牌和牌型评估结果

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
8. WHEN 任一方全下且下注回合结束时，THE Game_Engine SHALL 自动发出所有剩余公共牌并直接进入摊牌
9. THE Game_Engine SHALL 根据手牌序号交替小盲注位置（奇数手牌 player 为小盲注，偶数手牌 opponent 为小盲注）
10. WHEN 任一方筹码归零时，THE Game_Engine SHALL 将游戏阶段设为 game_over 并标记获胜方
11. THE Game_Engine SHALL 为每位玩家初始分配 2000 筹码

### 需求 6：手牌结束与续局

**用户故事：** 作为玩家，我希望一手牌结束后能自动开始下一手，游戏结束后能重新开始，以便持续对战。

#### 验收标准

1. WHEN 一手牌进入 showdown 阶段后，THE Game_Engine SHALL 在 3 秒延迟后自动开始下一手牌（保留当前筹码）
2. WHEN 游戏进入 game_over 阶段后，THE Game_Engine SHALL 等待任一玩家发送 `restartGame` 事件
3. WHEN 玩家发送 `restartGame` 事件且当前处于 game_over 阶段时，THE Game_Engine SHALL 重置双方筹码为 2000 并开始新一手牌
4. WHEN 开始新一手牌时，THE Game_Engine SHALL 递增手牌序号并据此交替小盲注位置

### 需求 7：操作超时处理

**用户故事：** 作为玩家，我希望对手长时间不操作时系统能自动处理，以便游戏不会无限期卡住。

#### 验收标准

1. WHEN 轮到某方行动时，THE Action_Timer SHALL 启动 60 秒倒计时
2. WHEN 该方在 60 秒内做出操作时，THE Action_Timer SHALL 重置计时器
3. IF 该方在 60 秒内未做出操作且可用操作包含 check，THEN THE Game_Engine SHALL 自动执行 check 操作
4. IF 该方在 60 秒内未做出操作且可用操作不包含 check，THEN THE Game_Engine SHALL 自动执行 fold 操作
5. WHEN 自动操作执行后，THE Game_Gateway SHALL 向双方广播更新后的 gameState

### 需求 8：断线重连

**用户故事：** 作为玩家，我希望在网络断开后能重新连接回正在进行的对局，以便继续游戏。

#### 验收标准

1. WHEN 玩家断开连接时，THE Room_Manager SHALL 保留该玩家的 Player_Session 和房间状态，并向对手发送 `opponentDisconnected` 事件
2. WHEN 断线玩家发送 `reconnect` 事件（携带 roomCode 和 oldSocketId）时，THE Room_Manager SHALL 验证身份并将新的 socket 连接绑定到原有 Player_Session
3. WHEN 重连成功时，THE Game_Gateway SHALL 向重连玩家发送 `reconnected` 事件（携带 role）和当前完整的 Client_View
4. IF 断线玩家在 30 秒内未重连，THEN THE Room_Manager SHALL 判定该玩家放弃对局，向对手发送 `opponentAbandoned` 事件，并销毁房间
5. WHILE 对手处于断线状态且未超时，THE Game_Engine SHALL 保持当前游戏状态不变，等待对手重连

### 需求 9：安全性与防作弊

**用户故事：** 作为玩家，我希望对战环境公平安全，不存在作弊可能。

#### 验收标准

1. THE PVP_Server SHALL 仅在服务端执行洗牌和发牌操作，客户端无法获取未公开的牌面信息
2. THE Game_Gateway SHALL 拒绝来自非房间成员的任何游戏操作事件
3. THE Game_Gateway SHALL 拒绝非当前行动方发送的 `placeBet` 事件
4. THE Game_Gateway SHALL 对每个事件的参数进行类型和范围校验（如 amount 为非负整数、type 为合法的 BettingActionType）
5. THE Client_View SHALL 在非摊牌阶段不包含对手手牌（opponentHand）和剩余牌组（remainingDeck）信息

### 需求 10：前端 PVP 大厅界面

**用户故事：** 作为玩家，我希望有一个清晰的大厅界面来创建或加入房间，以便快速开始对战。

#### 验收标准

1. THE PVP_Client SHALL 展示 PVP 大厅界面，包含"创建房间"按钮、房间码输入框和"加入房间"按钮
2. WHEN 玩家点击"创建房间"按钮时，THE PVP_Client SHALL 向 PVP_Server 发送 `createRoom` 事件
3. WHEN 玩家输入房间码并点击"加入房间"按钮时，THE PVP_Client SHALL 向 PVP_Server 发送 `joinRoom` 事件
4. WHEN 房间创建成功后，THE PVP_Client SHALL 展示等待界面，显示房间码供玩家分享给好友
5. IF PVP_Server 返回 `error` 事件，THEN THE PVP_Client SHALL 在界面上展示错误信息
6. THE PVP_Client SHALL 提供"返回训练模式"按钮，允许玩家退出 PVP 模式

### 需求 11：前端对战界面

**用户故事：** 作为玩家，我希望在对战中看到清晰的游戏界面，以便实时了解牌局状态并做出操作。

#### 验收标准

1. THE PVP_Client SHALL 复用现有的 CardDisplay 组件展示我的手牌、对手手牌（背面或正面）和公共牌
2. THE PVP_Client SHALL 复用现有的 ChipDisplay 组件展示双方筹码余额和底池金额
3. THE PVP_Client SHALL 复用现有的 BettingActionPanel 组件展示下注操作按钮
4. WHILE 轮到我行动时，THE PVP_Client SHALL 启用下注操作按钮并展示"轮到你行动"提示
5. WHILE 轮到对手行动时，THE PVP_Client SHALL 禁用下注操作按钮并展示"等待对手..."提示
6. WHEN 对手断线时，THE PVP_Client SHALL 在界面上展示"对手已断线"提示
7. WHEN 一手牌进入 showdown 阶段时，THE PVP_Client SHALL 复用 ResultPanel 组件展示摊牌结果
8. WHEN 游戏进入 game_over 阶段时，THE PVP_Client SHALL 复用 GameOverPanel 组件展示最终结果和"重新开始"按钮
9. THE PVP_Client SHALL 在界面底部展示当前房间号信息

### 需求 12：前端 Socket.IO 连接管理

**用户故事：** 作为开发者，我希望前端有可靠的 Socket.IO 连接管理，以便处理各种网络状况。

#### 验收标准

1. THE PVP_Client SHALL 通过 `usePvpGame` Hook 封装所有 Socket.IO 连接逻辑和游戏状态管理
2. WHEN Socket.IO 连接断开时，THE PVP_Client SHALL 自动尝试重连并展示"连接断开，正在尝试重连..."界面
3. WHEN 重连成功时，THE PVP_Client SHALL 向 PVP_Server 发送 `reconnect` 事件以恢复游戏会话
4. THE PVP_Client SHALL 维护连接状态（idle、creating、joining、waiting、playing、disconnected），并根据状态渲染对应界面
5. WHEN 收到 `gameState` 事件时，THE PVP_Client SHALL 更新本地游戏状态并重新渲染界面
6. WHEN 收到 `opponentAbandoned` 事件时，THE PVP_Client SHALL 展示"对手已放弃对局"提示并允许玩家返回大厅

### 需求 13：卡牌数据序列化

**用户故事：** 作为开发者，我希望卡牌数据在网络传输中保持一致性，以便前后端正确解析游戏状态。

#### 验收标准

1. THE Game_Engine SHALL 通过 Socket.IO 的 JSON 序列化机制传输 Card 对象（包含 suit 和 rank 字段）
2. THE PVP_Client SHALL 正确解析从服务端接收的 Card 对象并渲染对应的牌面
3. FOR ALL 有效的 Card 对象，序列化后再反序列化 SHALL 产生与原始对象等价的结果（往返一致性）
