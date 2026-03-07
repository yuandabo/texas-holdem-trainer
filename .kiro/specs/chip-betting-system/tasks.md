# 实现计划：筹码与下注系统

## 概述

在现有德州扑克模拟训练器基础上，增加筹码管理和下注交互层。先实现三个纯 TypeScript 核心引擎模块（ChipManager、BettingEngine、OpponentAI），再扩展现有类型和游戏流程 Hook，然后实现三个新增 UI 组件（ChipDisplay、BettingActionPanel、GameOverPanel），最后集成到主页面。

## 任务

- [x] 1. 核心类型扩展与常量定义
  - [x] 1.1 扩展类型定义和新增错误类
    - 在 `src/engine/types.ts` 中新增 `BettingPhase`、`ExtendedGamePhase`、`BettingActionType`、`BettingAction`、`ChipState`、`BettingRoundState`、`ExtendedGameStateData` 类型定义
    - 新增 `BettingError` 和 `ChipError` 自定义错误类
    - 新增常量：`INITIAL_CHIPS = 100`、`SMALL_BLIND_AMOUNT = 1`、`BIG_BLIND_AMOUNT = 2`、`MIN_RAISE = 2`、`AI_DELAY_MS = 500`
    - _需求: 1.1, 1.2, 2.1, 2.2, 4.4_

- [x] 2. ChipManager 筹码管理器
  - [x] 2.1 实现 ChipManager 模块
    - 创建 `src/engine/chipManager.ts`
    - 实现 `createChipState(initialChips?)`: 创建初始筹码状态，默认 100
    - 实现 `deductChips(state, who, amount)`: 从指定方扣减筹码，扣减金额不超过当前余额
    - 实现 `awardPot(state, winner, potAmount)`: 将底池分配给获胜方
    - 实现 `splitPot(state, potAmount, smallBlind)`: 平局分配底池，奇数时多余 1 个给小盲注方
    - 实现 `isGameOver(state)`: 检查是否有一方筹码归零
    - 负数金额扣减时抛出 `ChipError`
    - _需求: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 9.1_

  - [x] 2.2 编写属性测试：筹码非负不变量
    - **属性 1: 筹码非负不变量**
    - 对于任意初始筹码状态和任意合法的下注操作序列，执行操作后双方筹码余额均为非负整数
    - **验证需求: 1.2, 1.6**

  - [x] 2.3 编写属性测试：筹码守恒
    - **属性 2: 筹码守恒**
    - 对于任意初始筹码状态和任意合法操作序列，双方筹码余额之和加底池金额始终等于初始筹码总和
    - **验证需求: 1.3, 6.2, 6.6**

  - [x] 2.4 编写属性测试：平局底池分配正确性
    - **属性 3: 平局底池分配正确性**
    - 对于任意底池金额和小盲注方标识，`splitPot` 应使双方各获得 `floor(pot/2)` 个筹码，奇数时多余 1 个给小盲注方
    - **验证需求: 1.5**

  - [x] 2.5 编写属性测试：游戏结束检测
    - **属性 12: 游戏结束检测**
    - 对于任意筹码状态，`isGameOver` 返回 true 当且仅当 `playerChips === 0` 或 `opponentChips === 0`
    - **验证需求: 9.1**

- [x] 3. BettingEngine 下注引擎
  - [x] 3.1 实现 BettingEngine 核心模块
    - 创建 `src/engine/bettingEngine.ts`
    - 实现 `createBettingRound(pot, firstActor)`: 创建新的下注回合状态
    - 实现 `getAvailableActions(roundState, actorChips, minRaise)`: 获取当前行动方可用操作列表
    - 实现 `executeBettingAction(roundState, chipState, action, minRaise)`: 验证并执行下注操作，返回新的回合状态和筹码变动
    - 实现 `postBlinds(chipState, smallBlind, smallBlindAmount, bigBlindAmount)`: 发放盲注
    - 实现 `isRoundComplete(roundState)`: 检查下注回合是否结束
    - 加注金额不足时抛出 `BettingError`，下注超过余额时自动转为 All-In
    - _需求: 2.1, 2.2, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 6.1, 6.2_

  - [x] 3.2 编写属性测试：盲注发放正确性
    - **属性 4: 盲注发放正确性**
    - 对于任意筹码状态（双方 > 0），执行 `postBlinds` 后小盲注方筹码减少 `min(1, 余额)`，大盲注方筹码减少 `min(2, 余额)`，底池增加量等于双方减少量之和
    - **验证需求: 2.1, 2.2, 2.4, 2.5**

  - [x] 3.3 编写属性测试：盲注位置交替
    - **属性 5: 盲注位置交替**
    - 对于任意牌局序号 `handNumber`，奇数时玩家为小盲注方，偶数时对手为小盲注方
    - **验证需求: 2.3**

  - [x] 3.4 编写属性测试：可用操作正确性
    - **属性 6: 可用操作正确性**
    - 对于任意下注回合状态和行动方筹码余额：存在未匹配下注时可用操作包含 Call/All-In、Raise、Fold；无未匹配下注时包含 Check 和 Raise
    - **验证需求: 4.1, 4.2, 4.7**

  - [x] 3.5 编写属性测试：下注回合结束条件
    - **属性 7: 下注回合结束条件**
    - 当且仅当双方均已行动且下注金额相等，或一方 Fold 时，回合应结束
    - **验证需求: 3.4, 3.6**

  - [x] 3.6 编写属性测试：行动权交替
    - **属性 8: 行动权交替**
    - 对于非终结操作（Check、Call、Raise），执行后 `currentActor` 应切换为另一方
    - **验证需求: 3.3, 4.6**

  - [x] 3.7 编写属性测试：弃牌立即结束牌局
    - **属性 9: 弃牌立即结束牌局**
    - 当一方执行 Fold 后，`foldedBy` 设为该方，`roundEnded` 为 true
    - **验证需求: 3.5, 4.5, 6.4**

  - [x] 3.8 编写属性测试：加注金额验证
    - **属性 10: 加注金额验证**
    - 若加注增量小于 `MIN_RAISE` 且非 All-In，则操作应被拒绝
    - **验证需求: 4.4, 4.8**

- [x] 4. OpponentAI 对手 AI
  - [x] 4.1 实现 OpponentAI 模块
    - 创建 `src/engine/opponentAI.ts`
    - 实现 `makeDecision(roundState, opponentChips, minRaise, rng)`: 根据当前状态和策略做出下注决策
    - 无未匹配下注时：70% Check，30% Raise（Min_Raise 金额）
    - 存在未匹配下注时：60% Call，20% Raise，20% Fold
    - 筹码不足 Call 时：70% All-In，30% Fold
    - 接受可注入的随机数生成器 `rng: () => number`
    - _需求: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 4.2 编写属性测试：AI 决策与随机数的确定性映射
    - **属性 11: AI 决策与随机数的确定性映射**
    - 对于任意 RNG 返回值 `r ∈ [0, 1)` 和下注回合状态：无未匹配下注时 `r < 0.7` 产生 Check，`r >= 0.7` 产生 Raise；存在未匹配下注时 `r < 0.6` 产生 Call，`0.6 <= r < 0.8` 产生 Raise，`r >= 0.8` 产生 Fold
    - **验证需求: 5.2, 5.3**

- [x] 5. 检查点 - 确保核心引擎测试通过
  - 确保所有测试通过，如有问题请向用户确认。

- [x] 6. 扩展游戏流程 Hook
  - [x] 6.1 扩展 useGameFlow Hook 支持下注流程
    - 修改 `src/hooks/useGameFlow.ts`
    - 扩展 reducer 支持新增 action：`PLAYER_BET`、`OPPONENT_BET`、`START_BETTING_ROUND`、`RESTART_GAME`
    - 在每个发牌阶段完成后自动插入下注回合（pre_flop → pre_flop_betting → flop → ...）
    - 下注回合进行中禁用 `nextStep` 操作
    - 实现 `placeBet(action)`: 玩家下注，触发 `PLAYER_BET` action
    - 实现 `restartGame()`: 重置筹码为初始值并开始新游戏
    - 对手行动时自动调用 OpponentAI 并在 500ms 延迟后执行 `OPPONENT_BET`
    - 新一局时重置下注状态、清空底池、发放盲注、`handNumber` 递增
    - 牌局结算后检查游戏结束条件
    - 弃牌时立即结束牌局并分配底池
    - _需求: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 6.3, 6.4, 6.5, 9.1, 9.4, 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 6.2 编写属性测试：阶段序列含下注回合
    - **属性 13: 阶段序列含下注回合**
    - 对于完整牌局（无弃牌），阶段推进顺序为 pre_flop → pre_flop_betting → flop → flop_betting → turn → turn_betting → river → river_betting → showdown
    - **验证需求: 3.1, 10.1, 10.2, 10.5**

  - [x] 6.3 编写属性测试：新一局重置下注状态
    - **属性 14: 新一局重置下注状态**
    - 开始新一局后底池为盲注总额、下注回合状态为新的翻牌前下注回合、`handNumber` 递增 1、双方筹码反映盲注扣减
    - **验证需求: 10.4**

- [x] 7. 检查点 - 确保流程扩展测试通过
  - 确保所有测试通过，如有问题请向用户确认。

- [x] 8. UI 组件 - 筹码展示
  - [x] 8.1 实现 ChipDisplay 组件
    - 创建 `src/components/ChipDisplay/index.tsx` 和样式文件
    - 接收 `playerChips`、`opponentChips`、`pot` 属性
    - 在对手手牌区域旁展示对手筹码余额
    - 在玩家手牌区域旁展示玩家筹码余额
    - 在公共牌区域附近展示底池金额
    - 下注操作后立即更新显示
    - 适配微信小程序屏幕宽度 320px-428px，使用 rpx 单位
    - _需求: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 9. UI 组件 - 下注操作面板
  - [x] 9.1 实现 BettingActionPanel 组件
    - 创建 `src/components/BettingActionPanel/index.tsx` 和样式文件
    - 接收 `availableActions`、`currentBetToCall`、`minRaiseAmount`、`maxRaiseAmount`、`enabled`、`onAction` 属性
    - 存在未匹配下注时展示 Call、Raise、Fold 按钮
    - 无未匹配下注时展示 Check、Raise 按钮
    - 筹码不足 Call 时将 Call 替换为 All-In 按钮
    - 选择 Raise 时展示加注金额输入控件，范围为 Min_Raise 到玩家当前筹码
    - 每个按钮标注对应操作所需筹码金额（如"跟注 2"、"加注 4"）
    - 轮到对手行动或非下注阶段时禁用所有按钮
    - 结算阶段或弃牌后隐藏所有按钮
    - _需求: 4.1, 4.2, 4.7, 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 10. UI 组件 - 游戏结束面板
  - [x] 10.1 实现 GameOverPanel 组件
    - 创建 `src/components/GameOverPanel/index.tsx` 和样式文件
    - 接收 `winner`、`playerChips`、`opponentChips`、`onRestart` 属性
    - 展示游戏结束面板，显示最终胜负结果和双方筹码余额
    - 提供"重新开始"按钮，点击后重置双方筹码为初始值并开始新游戏
    - 游戏结束状态下禁用"下一步"和"新一局"按钮
    - _需求: 9.1, 9.2, 9.3, 9.4_

- [x] 11. 主页面集成
  - [x] 11.1 集成筹码与下注系统到 GamePage
    - 修改 `src/pages/game/index.tsx`
    - 集成扩展后的 `useGameFlow` Hook（含下注相关状态和方法）
    - 在对手手牌区域旁添加 ChipDisplay（对手筹码）
    - 在公共牌区域附近添加 ChipDisplay（底池）
    - 在玩家手牌区域旁添加 ChipDisplay（玩家筹码）
    - 在操作按钮区域添加 BettingActionPanel
    - 下注回合进行中隐藏"下一步"按钮，由下注操作驱动流程
    - 游戏结束时展示 GameOverPanel，隐藏"下一步"和"新一局"按钮
    - 保持现有牌面展示、提示功能和结算面板不变
    - _需求: 7.1, 7.2, 7.3, 8.1, 8.2, 9.2, 9.4, 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 12. 最终检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请向用户确认。

## 备注

- 标记 `*` 的子任务为可选任务，可跳过以加速 MVP 开发
- 每个任务引用了具体的需求编号，确保可追溯性
- 检查点任务确保增量验证
- 属性测试验证通用正确性属性，单元测试验证具体示例和边界情况
- 核心引擎模块（任务 1-5）不依赖 Taro/React，可独立测试
- 使用 Jest + fast-check 延续现有测试框架配置
