# 任务列表

## 1. 后端基础设施与共享引擎集成

- [x] 1.1 验证 `server/` 目录下 NestJS 项目结构完整（main.ts、app.module.ts、nest-cli.json、tsconfig.json）
- [x] 1.2 确认 `tsconfig.json` 中 `@engine/*` 路径别名正确指向 `../src/engine/*`，确保 `jest.config` 中配置对应的 `moduleNameMapper`
- [x] 1.3 验证 `server/src/engine/` 下的引擎模块（deck、dealEngine、bettingEngine、handEvaluator、showdownEngine、chipManager、types）可正常导入和使用

## 2. 房间管理模块

- [x] 2.1 实现 `Room` 模型中的 `generateRoomCode()` 方法，生成 6 位大写字母数字房间码，确保不与现有活跃房间重复
- [x] 2.2 实现 `Room.addPlayer()` 方法，限制最多 2 名玩家，分配 player/opponent 角色
- [x] 2.3 实现 `RoomService.createRoom()` 和 `RoomService.joinRoom()` 方法
- [x] 2.4 实现 `Room.handleDisconnect()` 和 `Room.handleReconnect()` 方法，保留断线玩家会话
- [x] 2.5 实现 `RoomService.removeRoom()` 和断线超时（30 秒）清理逻辑
- [x] 2.6 编写房间管理单元测试：创建房间、加入房间、加入已满房间、加入不存在房间、断线重连
  - [x] 2.6.1 [PBT] Property 1: 房间码格式与唯一性 — *For any* 创建的房间，Room_Code 应为 6 位大写字母数字且不重复
  - [x] 2.6.2 [PBT] Property 2: 房间人数上限 — *For any* 房间，玩家数量不超过 2，已满时拒绝加入

## 3. 服务端游戏引擎

- [x] 3.1 实现 `Room.startNewHand()` 方法：创建牌组、洗牌、发手牌、发放盲注、设置 pre_flop_betting 阶段
- [x] 3.2 实现 `Room.placeBet()` 方法：验证操作合法性，调用 bettingEngine 执行下注，处理阶段转换
- [x] 3.3 实现 `Room.advanceAfterBetting()` 方法：下注回合结束后自动发公共牌或进入摊牌
- [x] 3.4 实现弃牌结算（`handleFoldSettlement`）和摊牌结算（`handleShowdownSettlement`）逻辑
- [x] 3.5 实现全下后自动发出所有剩余公共牌并进入摊牌的逻辑
- [x] 3.6 实现 `Room.nextHand()` 方法：递增手牌序号、交替小盲注位置、开始新一手牌
- [x] 3.7 实现 `Room.restartGame()` 方法：重置筹码为 2000、重置手牌序号、开始新游戏
- [x] 3.8 实现 `Room.getStateForRole()` 方法：生成玩家视角的 ClientView，非摊牌阶段隐藏对手手牌
- [x] 3.9 编写游戏引擎单元测试
  - [x] 3.9.1 [PBT] Property 3: 游戏初始状态正确性 — *For any* 新游戏，双方各 2 张手牌，筹码正确，阶段为 pre_flop_betting
  - [x] 3.9.2 [PBT] Property 4: 客户端视角信息隐藏 — *For any* 非摊牌状态，ClientView 不含对手手牌
  - [x] 3.9.3 [PBT] Property 5: 摊牌阶段公开手牌 — *For any* 摊牌状态，ClientView 包含对手手牌
  - [x] 3.9.4 [PBT] Property 6: 游戏阶段有序推进 — *For any* 阶段序列，严格按规定顺序推进
  - [x] 3.9.5 [PBT] Property 7: 非法下注不改变状态 — *For any* 非法操作，游戏状态保持不变
  - [x] 3.9.6 [PBT] Property 8: 弃牌结算正确性 — *For any* 弃牌，未弃牌方获得底池，筹码总和恒定
  - [x] 3.9.7 [PBT] Property 9: 摊牌结算正确性 — *For any* 摊牌，获胜方获得底池，筹码总和恒定
  - [x] 3.9.8 [PBT] Property 10: 全下自动发牌 — *For any* 全下结束，自动发出 5 张公共牌并进入摊牌
  - [x] 3.9.9 [PBT] Property 11: 小盲注位置交替 — *For any* 手牌序号，小盲注位置正确交替

## 4. WebSocket 网关

- [x] 4.1 实现 `GameGateway.handleCreateRoom()` 方法：创建房间，将 socket 加入 Socket.IO Room，发送 roomCreated 事件
- [x] 4.2 实现 `GameGateway.handleJoinRoom()` 方法：加入房间，房间满时触发游戏初始化并广播 gameState
- [x] 4.3 实现 `GameGateway.handlePlaceBet()` 方法：验证操作合法性，执行下注，广播状态，处理摊牌后自动下一手
- [x] 4.4 实现 `GameGateway.handleRestartGame()` 方法：验证 game_over 阶段，重置游戏
- [x] 4.5 实现 `GameGateway.handleReconnect()` 方法：验证身份，绑定新 socket，发送 reconnected 和 gameState
- [x] 4.6 实现 `GameGateway.handleDisconnect()` 方法：通知对手断线，30 秒超时后销毁房间
- [x] 4.7 实现 `broadcastState()` 私有方法：向房间内每位玩家发送各自视角的 ClientView
- [x] 4.8 实现操作超时计时器（`startActionTimer`）：60 秒超时自动 check 或 fold
- [x] 4.9 编写 WebSocket 网关单元测试
  - [x] 4.9.1 [PBT] Property 12: 超时默认操作 — *For any* 超时场景，可 check 则 check，否则 fold
  - [x] 4.9.2 [PBT] Property 13: 断线保持状态不变 — *For any* 断线（未超时），游戏状态不变

## 5. 前端 PVP 大厅界面

- [x] 5.1 实现 PvpPage 大厅界面：创建房间按钮、房间码输入框、加入房间按钮、返回训练模式按钮
- [x] 5.2 实现等待对手界面：显示房间码，提示分享给好友
- [x] 5.3 实现错误信息展示：收到 error 事件时在界面上显示
- [x] 5.4 编写大厅界面单元测试：验证各 UI 元素渲染和交互

## 6. 前端对战界面

- [x] 6.1 实现对战界面：复用 CardDisplay 展示手牌和公共牌，复用 ChipDisplay 展示筹码和底池
- [x] 6.2 实现下注操作面板：复用 BettingActionPanel，轮到我行动时启用，轮到对手时禁用
- [x] 6.3 实现状态提示：轮到我行动显示"轮到你行动"，轮到对手显示"等待对手..."，对手断线显示"对手已断线"
- [x] 6.4 实现摊牌结果展示：复用 ResultPanel 组件
- [x] 6.5 实现游戏结束展示：复用 GameOverPanel 组件，显示"重新开始"按钮
- [x] 6.6 实现房间号信息展示：在界面底部显示当前房间号
- [x] 6.7 编写对战界面单元测试：验证各状态下的 UI 渲染

## 7. 前端 Socket.IO 连接管理

- [x] 7.1 实现 `usePvpGame` Hook：封装 Socket.IO 连接、事件监听、状态管理
- [x] 7.2 实现连接状态管理：idle → creating/joining → waiting → playing → disconnected 状态转换
- [x] 7.3 实现自动重连逻辑：连接断开时自动重连，重连成功后发送 reconnect 事件
- [x] 7.4 实现 gameState 事件处理：更新本地游戏状态并触发重新渲染
- [x] 7.5 实现 opponentAbandoned 事件处理：展示提示并允许返回大厅
- [x] 7.6 编写 usePvpGame Hook 单元测试

## 8. 卡牌数据序列化

- [x] 8.1 验证 Card 对象通过 Socket.IO JSON 序列化正确传输（suit 和 rank 字段保持一致）
- [x] 8.2 编写序列化测试
  - [x] 8.2.1 [PBT] Property 14: 卡牌序列化往返一致性 — *For any* 有效 Card，序列化再反序列化等于原始对象
