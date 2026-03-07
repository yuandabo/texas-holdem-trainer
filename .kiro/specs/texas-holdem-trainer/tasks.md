# 实现计划：德州扑克模拟训练器

## 概述

基于 Taro + React + TypeScript 构建微信小程序，实现德州扑克模拟训练器。采用核心引擎与 UI 分离的架构，先实现纯 TypeScript 核心引擎（牌组、发牌、牌型判定、摊牌、胜率计算、序列化），再实现 UI 层（流程控制 Hook、牌面展示、提示功能、结算面板），最后集成联调。

## 任务

- [x] 1. 项目初始化与基础类型定义
  - [x] 1.1 使用 Taro CLI 初始化项目，配置 TypeScript、Jest、fast-check
    - 执行 `npx @tarojs/cli init` 创建 Taro + React + TypeScript 项目
    - 安装 `fast-check` 作为开发依赖
    - 配置 Jest 支持 TypeScript 和路径别名
    - 确保 `npm test` 可正常运行
    - _需求: 全局_

  - [x] 1.2 定义核心类型和枚举
    - 创建 `src/engine/types.ts`
    - 定义 `Suit` 枚举（S/H/C/D）
    - 定义 `Rank` 枚举（2-14）
    - 定义 `Card` 接口
    - 定义 `HandRankType` 枚举（1-10，高牌到皇家同花顺）
    - 定义 `HandEvalResult` 接口（rankType, rankName, bestCards, compareValues）
    - 定义 `GameResult` 枚举（player_win, opponent_win, tie）
    - 定义 `ShowdownResult` 接口
    - 定义 `GamePhase` 类型（pre_flop, flop, turn, river, showdown）
    - 定义 `GameStateData` 接口
    - 定义自定义错误类：`CardSerializationError`、`DealError`、`EvaluationError`
    - _需求: 1.1, 4.1, 11.1_

- [x] 2. 牌组与洗牌引擎
  - [x] 2.1 实现 Deck 模块
    - 创建 `src/engine/deck.ts`
    - 实现 `createDeck()`: 生成 52 张不重复牌
    - 实现 `shuffle(cards)`: Fisher-Yates 算法洗牌
    - 实现 `draw(cards, n)`: 从顶部取出 n 张牌，返回 `[drawn, remaining]`
    - _需求: 1.1, 1.2, 1.3_

  - [x] 2.2 编写属性测试：洗牌是一个排列
    - **属性 1: 洗牌是一个排列**
    - 验证 `shuffle()` 后牌组包含与原始牌组完全相同的 52 张牌，无重复
    - **验证需求: 1.1, 1.2, 1.3**

- [x] 3. 发牌引擎
  - [x] 3.1 实现 DealEngine 模块
    - 创建 `src/engine/dealEngine.ts`
    - 实现 `dealHands(deck)`: 发出玩家 2 张 + 对手 2 张底牌，返回 `DealResult`
    - 实现 `dealFlop(deck)`: 从剩余牌组取 3 张翻牌
    - 实现 `dealTurn(deck)`: 从剩余牌组取 1 张转牌
    - 实现 `dealRiver(deck)`: 从剩余牌组取 1 张河牌
    - 牌组不足时抛出 `DealError`
    - _需求: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 9.1, 9.2_

  - [x] 3.2 编写属性测试：发牌保持牌组完整性
    - **属性 2: 发牌保持牌组完整性**
    - 验证完整发牌流程后，所有发出的牌 + 剩余牌组 = 原始牌组
    - **验证需求: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**

- [x] 4. 序列化模块
  - [x] 4.1 实现 CardSerializer 模块
    - 创建 `src/engine/cardSerializer.ts`
    - 实现 `serialize(card)` / `deserialize(json)`: 单张牌序列化/反序列化
    - 实现 `serializeMany(cards)` / `deserializeMany(json)`: 批量序列化/反序列化
    - 无效 JSON 抛出 `CardSerializationError`，包含描述性错误信息
    - _需求: 8.1, 8.2, 8.3, 8.4_

  - [x] 4.2 编写属性测试：序列化往返一致性
    - **属性 8: Card 序列化往返一致性**
    - 验证 `deserialize(serialize(card))` 产生与原始 card 等价的对象
    - **验证需求: 8.1, 8.2, 8.3**

  - [x] 4.3 编写属性测试：无效 JSON 反序列化产生错误
    - **属性 9: 无效 JSON 反序列化产生错误**
    - 验证无效 JSON 字符串调用 `deserialize()` 时抛出 `CardSerializationError`
    - **验证需求: 8.4**

- [x] 5. 检查点 - 确保基础引擎测试通过
  - 确保所有测试通过，如有问题请向用户确认。

- [x] 6. 牌型判定引擎
  - [x] 6.1 实现 HandEvaluator 模块
    - 创建 `src/engine/handEvaluator.ts`
    - 实现 `evaluate(hand, communityCards)`: 从 7 张牌中选出最佳 5 张组合
    - 识别 10 种牌型（皇家同花顺到高牌）
    - 正确处理 A 在顺子中的双重角色（A-2-3-4-5 和 10-J-Q-K-A）
    - 返回 `HandEvalResult`，包含 rankType、rankName、bestCards、compareValues
    - 实现 `compare(a, b)`: 比较两个牌型结果
    - 输入不足 7 张或有重复时抛出 `EvaluationError`
    - _需求: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 6.2 编写属性测试：牌型判定输出不变量
    - **属性 5: 牌型判定输出不变量**
    - 验证 `evaluate()` 返回 rankType 在 1-10、rankName 非空、bestCards 恰好 5 张且为输入子集
    - **验证需求: 4.1, 4.2, 4.3**

  - [x] 6.3 编写属性测试：最佳牌型选择的最优性
    - **属性 6: 最佳牌型选择的最优性**
    - 验证 `evaluate()` 返回的组合牌型等级 >= 任意其他 5 张组合
    - **验证需求: 4.2**

  - [x] 6.4 编写属性测试：牌型比较的传递性和反对称性
    - **属性 7: 牌型比较的传递性和反对称性**
    - 验证 `compare()` 满足传递性和反对称性
    - **验证需求: 4.4, 11.2, 11.3**

- [x] 7. 摊牌引擎
  - [x] 7.1 实现 ShowdownEngine 模块
    - 创建 `src/engine/showdownEngine.ts`
    - 实现 `showdown(playerHand, opponentHand, communityCards)`: 比较双方最佳牌型，返回 `ShowdownResult`
    - 调用 `HandEvaluator` 分别评估双方牌型，再比较判定胜负
    - _需求: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 7.2 编写属性测试：摊牌结果一致性
    - **属性 11: 摊牌结果一致性**
    - 验证 `showdown()` 结果与分别调用 `evaluate()` + `compare()` 的结果一致
    - **验证需求: 11.1, 11.2, 11.3, 11.4, 11.5**

- [x] 8. 胜率计算器
  - [x] 8.1 实现 WinRateCalculator 模块
    - 创建 `src/engine/winRateCalculator.ts`
    - 实现 `calculate(hand, communityCards, simulations?)`: 蒙特卡洛模拟计算胜率
    - 默认模拟 1000 次，返回 0-100 的整数百分比
    - 从剩余牌中随机补全对手手牌和公共牌，使用 `HandEvaluator` 判定每次模拟结果
    - _需求: 7.1, 7.2, 7.3, 7.4_

  - [x] 8.2 编写属性测试：胜率计算范围不变量
    - **属性 10: 胜率计算范围不变量**
    - 验证 `calculate()` 返回值为 0 到 100 之间的整数
    - **验证需求: 7.1, 7.3**

- [x] 9. 检查点 - 确保所有核心引擎测试通过
  - 确保所有测试通过，如有问题请向用户确认。

- [x] 10. 游戏流程控制 Hook
  - [x] 10.1 实现 useGameFlow Hook
    - 创建 `src/hooks/useGameFlow.ts`
    - 使用 `useReducer` 管理 `GameStateData` 状态
    - 实现 `newGame()`: 创建牌组 → 洗牌 → 发手牌 → 设置 phase 为 pre_flop
    - 实现 `nextStep()`: 根据当前 phase 推进到下一阶段并触发对应发牌
      - pre_flop → flop（发 3 张翻牌）
      - flop → turn（发 1 张转牌）
      - turn → river（发 1 张河牌）
      - river → showdown（调用 ShowdownEngine 判定胜负）
      - showdown 阶段调用 nextStep 时忽略操作
    - 实现 `toggleHandRankHint()` / `toggleWinRateHint()`: 切换提示开关
    - _需求: 3.1, 3.2, 3.3, 3.4, 9.3, 11.6_

  - [x] 10.2 编写属性测试：牌局阶段按固定顺序推进
    - **属性 3: 牌局阶段按固定顺序推进**
    - 验证连续调用 `nextStep()` 按 pre_flop → flop → turn → river → showdown 推进
    - **验证需求: 3.1, 3.2**

  - [x] 10.3 编写属性测试：新一局重置所有状态
    - **属性 4: 新一局重置所有状态**
    - 验证 `newGame()` 后 phase 为 pre_flop，手牌各 2 张，公共牌为空，结算结果为 null
    - **验证需求: 3.4, 9.3**

  - [x] 10.4 编写属性测试：结算阶段包含有效结果
    - **属性 12: 结算阶段包含有效结果**
    - 验证完整走完所有阶段后 showdownResult 非 null 且包含有效信息
    - **验证需求: 3.3, 11.6**

- [x] 11. UI 组件 - 牌面展示
  - [x] 11.1 实现 CardDisplay 组件
    - 创建 `src/components/CardDisplay/index.tsx` 和样式文件
    - 展示每张牌的花色和点数，使用可辨识的视觉样式（红色/黑色区分花色）
    - 支持 `faceDown` 属性：背面朝上展示
    - 支持 `totalSlots` 属性：未发出的位置显示背面占位牌
    - 支持 `highlightCards` 属性：高亮标识指定牌张
    - 支持 `label` 属性：区域标签（如"对手"）
    - 适配微信小程序屏幕宽度 320px-428px，使用 rpx 单位
    - _需求: 5.1, 5.2, 5.3, 5.4, 5.5, 10.1, 10.2, 10.3_

- [x] 12. UI 组件 - 提示与结算
  - [x] 12.1 实现 HandRankHint 组件
    - 创建 `src/components/HandRankHint/index.tsx`
    - 调用 `HandEvaluator.evaluate()` 获取当前最佳牌型
    - 展示牌型名称，返回高亮牌张列表供 CardDisplay 使用
    - 翻牌阶段及之后、且开关开启时才展示
    - _需求: 6.1, 6.2, 6.3_

  - [x] 12.2 实现 WinRateHint 组件
    - 创建 `src/components/WinRateHint/index.tsx`
    - 调用 `WinRateCalculator.calculate()` 获取胜率
    - 以整数百分比形式展示
    - 开关开启时才展示，每阶段自动更新
    - _需求: 7.1, 7.2, 7.3_

  - [x] 12.3 实现 ResultPanel 组件
    - 创建 `src/components/ResultPanel/index.tsx`
    - 展示对局结果（玩家胜/对手胜/平局）
    - 展示双方最佳牌型名称
    - _需求: 3.3, 11.5, 11.6_

  - [x] 12.4 编写属性测试：牌型提示与判定器一致
    - **属性 13: 牌型提示与判定器一致**
    - 验证牌型提示返回的牌型名称和高亮牌张与 `HandEvaluator.evaluate()` 结果一致
    - **验证需求: 6.1**

- [x] 13. 主页面集成
  - [x] 13.1 实现 GamePage 主页面
    - 创建 `src/pages/game/index.tsx` 和样式文件
    - 集成 `useGameFlow` Hook 管理游戏状态
    - 布局：对手手牌区域（顶部）→ 公共牌区域（中部）→ 玩家手牌区域 → 提示区域 → 操作按钮
    - 对手手牌：非结算阶段背面朝上，结算阶段翻开并标注"对手"标签
    - 公共牌：根据阶段展示已发出的牌，未发出位置显示背面占位
    - 玩家手牌：始终正面展示
    - "下一步"按钮：非 showdown 阶段可用，点击调用 `nextStep()`
    - "新一局"按钮：点击调用 `newGame()`
    - 牌型提示/胜率提示开关
    - 手牌区域和公共牌区域之间提供清晰的视觉分隔
    - _需求: 3.1, 3.2, 3.3, 3.4, 5.1, 5.2, 5.3, 5.4, 5.5, 10.1, 10.2, 10.3_

- [x] 14. 最终检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请向用户确认。

## 备注

- 标记 `*` 的子任务为可选任务，可跳过以加速 MVP 开发
- 每个任务引用了具体的需求编号，确保可追溯性
- 检查点任务确保增量验证
- 属性测试验证通用正确性属性，单元测试验证具体示例和边界情况
- 核心引擎（任务 1-9）不依赖 Taro/React，可独立测试
