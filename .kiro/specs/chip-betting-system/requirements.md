# 需求文档

## 简介

筹码与下注系统是德州扑克模拟训练器的扩展功能。该系统为玩家和电脑对手分配固定初始筹码，并在每个牌局阶段（翻牌前、翻牌、转牌、河牌）引入标准的德州扑克下注环节，包括加注（Raise）、跟注（Call）、弃牌（Fold）和过牌（Check）操作。对手将使用简单的策略逻辑进行自动下注决策。牌局结束后根据胜负结果分配底池筹码，当任一方筹码归零时游戏结束。该功能在现有发牌流程和牌型判定基础上增加筹码管理和下注交互层。

## 术语表

- **Chip_Manager（筹码管理器）**: 负责管理玩家和对手筹码余额、扣减和分配的模块
- **Betting_Engine（下注引擎）**: 负责处理下注回合逻辑，包括验证下注金额、管理下注轮次和底池的模块
- **Pot（底池）**: 当前牌局中所有玩家下注筹码的总和，牌局结束后分配给获胜方
- **Blind（盲注）**: 翻牌前强制下注的筹码，包括小盲注和大盲注
- **Small_Blind（小盲注）**: 翻牌前由一名玩家强制下注的较小金额，固定为 1 个筹码
- **Big_Blind（大盲注）**: 翻牌前由另一名玩家强制下注的较大金额，固定为 2 个筹码
- **Raise（加注）**: 玩家在当前下注基础上增加下注金额的操作
- **Call（跟注）**: 玩家匹配当前最高下注金额的操作
- **Fold（弃牌）**: 玩家放弃当前牌局的操作，放弃底池中已下注的筹码
- **Check（过牌）**: 当前无需额外下注时，玩家选择不加注直接传递行动权的操作
- **All_In（全下）**: 玩家将剩余全部筹码投入底池的操作
- **Betting_Round（下注回合）**: 每个牌局阶段中玩家和对手轮流做出下注决策的过程
- **Opponent_AI（对手AI）**: 对手的自动下注决策模块，使用简单策略逻辑进行下注
- **Betting_Action_Panel（下注操作面板）**: 展示下注操作按钮（加注、跟注、弃牌、过牌）的 UI 组件
- **Chip_Display（筹码展示组件）**: 在 UI 上展示玩家和对手当前筹码余额及底池金额的视觉组件
- **Initial_Chips（初始筹码）**: 每次开始新游戏时分配给玩家和对手的固定筹码数量，默认为 100 个筹码
- **Min_Raise（最小加注额）**: 加注时的最小增加金额，等于当前大盲注金额（2 个筹码）

## 需求

### 需求 1：筹码初始化与管理

**用户故事：** 作为一名训练者，我希望每次开始游戏时系统为我和对手分配固定数量的筹码，以便模拟真实的德州扑克资金管理。

#### 验收标准

1. WHEN 一局新游戏开始时，THE Chip_Manager SHALL 为玩家和对手各分配 100 个初始筹码
2. THE Chip_Manager SHALL 维护玩家和对手各自独立的筹码余额，余额值为非负整数
3. WHEN 玩家执行下注操作时，THE Chip_Manager SHALL 从该玩家的筹码余额中扣减对应金额
4. WHEN 牌局结算完成后，THE Chip_Manager SHALL 将 Pot 中的全部筹码分配给获胜方
5. WHEN 牌局结算为平局时，THE Chip_Manager SHALL 将 Pot 中的筹码平均分配给双方，无法整除时多余 1 个筹码分配给小盲注方
6. FOR ALL 下注操作，THE Chip_Manager SHALL 确保扣减后的筹码余额不低于 0

### 需求 2：盲注机制

**用户故事：** 作为一名训练者，我希望每局开始时有强制盲注，以便模拟真实德州扑克的底池启动机制。

#### 验收标准

1. WHEN 翻牌前阶段开始时，THE Betting_Engine SHALL 自动从小盲注方扣减 1 个筹码并放入 Pot
2. WHEN 翻牌前阶段开始时，THE Betting_Engine SHALL 自动从大盲注方扣减 2 个筹码并放入 Pot
3. THE Betting_Engine SHALL 在连续牌局中交替分配小盲注和大盲注位置，第一局玩家为小盲注方
4. IF 小盲注方的筹码余额不足 1 个筹码，THEN THE Betting_Engine SHALL 将该方剩余全部筹码作为小盲注放入 Pot
5. IF 大盲注方的筹码余额不足 2 个筹码，THEN THE Betting_Engine SHALL 将该方剩余全部筹码作为大盲注放入 Pot

### 需求 3：下注回合流程

**用户故事：** 作为一名训练者，我希望在每个牌局阶段都有下注环节，以便练习德州扑克的下注决策。

#### 验收标准

1. WHEN 每个牌局阶段的发牌完成后，THE Betting_Engine SHALL 启动一个 Betting_Round
2. THE Betting_Engine SHALL 按照固定顺序轮流请求玩家和对手做出下注决策：翻牌前由小盲注方先行动，翻牌后各阶段由小盲注方先行动
3. WHEN 一方做出下注决策后，THE Betting_Engine SHALL 将行动权传递给另一方
4. WHEN 双方在同一 Betting_Round 中的下注金额相等且双方均已行动至少一次时，THE Betting_Engine SHALL 结束当前 Betting_Round 并推进到下一阶段
5. IF 一方选择 Fold，THEN THE Betting_Engine SHALL 立即结束当前牌局，将 Pot 分配给未弃牌方
6. WHEN 双方均选择 Check 时，THE Betting_Engine SHALL 结束当前 Betting_Round 并推进到下一阶段

### 需求 4：玩家下注操作

**用户故事：** 作为一名训练者，我希望能执行加注、跟注、弃牌和过牌操作，以便练习德州扑克的下注策略。

#### 验收标准

1. WHEN 轮到玩家行动且当前存在未匹配的下注时，THE Betting_Action_Panel SHALL 展示 Call 和 Raise 和 Fold 按钮
2. WHEN 轮到玩家行动且当前无未匹配的下注时，THE Betting_Action_Panel SHALL 展示 Check 和 Raise 按钮
3. WHEN 玩家选择 Call 时，THE Betting_Engine SHALL 从玩家筹码中扣减与当前最高下注的差额并放入 Pot
4. WHEN 玩家选择 Raise 时，THE Betting_Engine SHALL 从玩家筹码中扣减加注总额并放入 Pot，加注金额至少为 Min_Raise
5. WHEN 玩家选择 Fold 时，THE Betting_Engine SHALL 结束当前牌局，玩家放弃 Pot 中已下注的筹码
6. WHEN 玩家选择 Check 时，THE Betting_Engine SHALL 将行动权传递给对手，不扣减筹码
7. IF 玩家的筹码余额不足以执行 Call 操作，THEN THE Betting_Action_Panel SHALL 将 Call 按钮替换为 All_In 按钮
8. IF 玩家选择 Raise 且加注金额小于 Min_Raise，THEN THE Betting_Engine SHALL 拒绝该操作并提示玩家加注金额不足

### 需求 5：对手 AI 下注策略

**用户故事：** 作为一名训练者，我希望对手能根据简单策略自动做出下注决策，以便模拟有一定变化的对局体验。

#### 验收标准

1. WHEN 轮到对手行动时，THE Opponent_AI SHALL 在 500 毫秒延迟后自动做出下注决策
2. WHEN 当前无未匹配的下注时，THE Opponent_AI SHALL 以 70% 概率选择 Check，以 30% 概率选择 Raise（加注 Min_Raise 金额）
3. WHEN 当前存在未匹配的下注时，THE Opponent_AI SHALL 以 60% 概率选择 Call，以 20% 概率选择 Raise（加注 Min_Raise 金额），以 20% 概率选择 Fold
4. IF 对手的筹码余额不足以执行 Call 操作，THEN THE Opponent_AI SHALL 选择 All_In 或 Fold，以 70% 概率选择 All_In
5. THE Opponent_AI SHALL 使用可注入的随机数生成器，以便测试时可以控制决策结果

### 需求 6：底池管理与结算

**用户故事：** 作为一名训练者，我希望底池能正确累积和分配筹码，以便了解每局的筹码变动。

#### 验收标准

1. THE Betting_Engine SHALL 维护一个 Pot 变量，初始值为 0，记录当前牌局所有下注筹码的总和
2. WHEN 任一方执行下注操作（Call、Raise、All_In、盲注）时，THE Betting_Engine SHALL 将对应金额累加到 Pot
3. WHEN 牌局进入结算阶段且非弃牌结束时，THE Betting_Engine SHALL 调用 Showdown_Engine 判定胜负，并将 Pot 全部分配给获胜方
4. WHEN 一方弃牌时，THE Betting_Engine SHALL 将 Pot 全部分配给未弃牌方，跳过摊牌判定
5. WHEN 牌局结算完成后，THE Betting_Engine SHALL 将 Pot 重置为 0
6. FOR ALL 牌局，THE Betting_Engine SHALL 确保 Pot 中的筹码总和等于双方本局已下注筹码的总和

### 需求 7：筹码与底池 UI 展示

**用户故事：** 作为一名训练者，我希望在界面上清晰地看到双方的筹码余额和底池金额，以便实时了解资金状况。

#### 验收标准

1. THE Chip_Display SHALL 在对手手牌区域旁展示对手当前筹码余额
2. THE Chip_Display SHALL 在玩家手牌区域旁展示玩家当前筹码余额
3. THE Chip_Display SHALL 在公共牌区域附近展示当前 Pot 金额
4. WHEN 任一方执行下注操作后，THE Chip_Display SHALL 立即更新对应的筹码余额和 Pot 金额
5. THE Chip_Display SHALL 适配微信小程序的常见屏幕尺寸（宽度 320px 至 428px）

### 需求 8：下注操作面板 UI

**用户故事：** 作为一名训练者，我希望有清晰的下注操作按钮，以便快速做出下注决策。

#### 验收标准

1. WHILE 轮到玩家行动时，THE Betting_Action_Panel SHALL 展示可用的下注操作按钮
2. WHILE 轮到对手行动或处于非下注阶段时，THE Betting_Action_Panel SHALL 禁用所有下注操作按钮
3. WHEN 玩家选择 Raise 时，THE Betting_Action_Panel SHALL 展示一个加注金额输入控件，允许玩家输入 Min_Raise 到玩家当前筹码余额之间的整数金额
4. THE Betting_Action_Panel SHALL 在每个按钮上标注对应操作所需的筹码金额（如 "跟注 2"、"加注 4"）
5. WHILE 牌局处于结算阶段或已有一方弃牌，THE Betting_Action_Panel SHALL 隐藏所有下注操作按钮

### 需求 9：游戏结束判定

**用户故事：** 作为一名训练者，我希望当一方筹码归零时系统提示游戏结束，以便了解最终的训练结果。

#### 验收标准

1. WHEN 牌局结算完成后任一方筹码余额为 0 时，THE Chip_Manager SHALL 触发游戏结束状态
2. WHILE 游戏处于结束状态，THE Game_Flow_Controller SHALL 展示游戏结束面板，显示最终胜负结果和双方筹码余额
3. WHEN 游戏结束后玩家点击"重新开始"按钮时，THE Chip_Manager SHALL 重置双方筹码为 Initial_Chips 并开始新游戏
4. WHILE 游戏处于结束状态，THE Game_Flow_Controller SHALL 禁用"下一步"和"新一局"按钮

### 需求 10：游戏流程与下注系统集成

**用户故事：** 作为一名训练者，我希望下注环节自然地融入现有的牌局流程中，以便获得完整的德州扑克体验。

#### 验收标准

1. THE Game_Flow_Controller SHALL 在每个牌局阶段的发牌操作完成后、推进到下一阶段之前，插入一个 Betting_Round
2. WHEN 当前 Betting_Round 结束后，THE Game_Flow_Controller SHALL 自动推进到下一个牌局阶段
3. WHILE Betting_Round 进行中，THE Game_Flow_Controller SHALL 禁用"下一步"按钮，由下注操作驱动流程推进
4. WHEN 玩家点击"新一局"按钮时，THE Game_Flow_Controller SHALL 重置下注状态、清空 Pot、重新发放盲注并开始新的牌局
5. THE Game_Flow_Controller SHALL 保持现有的牌局阶段顺序（翻牌前 → 翻牌 → 转牌 → 河牌 → 结算），在每个阶段之间增加下注回合
