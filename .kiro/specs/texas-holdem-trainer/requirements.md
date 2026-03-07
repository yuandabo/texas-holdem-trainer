# 需求文档

## 简介

德州扑克模拟训练器是一款基于 Taro + React + TypeScript 的微信小程序。该训练器允许用户与一名"无脑跟注"对手进行模拟对局，体验德州扑克的完整发牌流程（翻牌前、翻牌、转牌、河牌），并在河牌后比较双方牌型大小判定输赢。训练器不涉及筹码和下注系统，对手始终自动跟注。用户可选地获取胜率提示和牌型提示以辅助训练。核心目标是帮助玩家熟悉德州扑克的牌局流程、牌型判定和对局胜负比较。

## 术语表

- **Deck（牌组）**: 一副标准的 52 张扑克牌，包含 4 种花色（黑桃、红心、梅花、方块），每种花色 13 张（2-10、J、Q、K、A）
- **Shuffle_Engine（洗牌引擎）**: 负责将牌组随机打乱的模块
- **Deal_Engine（发牌引擎）**: 负责按德州扑克规则在各阶段发出对应数量牌的模块
- **Hand_Evaluator（牌型判定器）**: 负责从手牌和公共牌中识别最佳五张牌组合并判定牌型的模块
- **Hand（手牌）**: 翻牌前发给玩家的 2 张底牌
- **Community_Cards（公共牌）**: 翻牌、转牌、河牌阶段依次发出的共 5 张公共牌
- **Flop（翻牌）**: 第一轮公共牌，一次发出 3 张
- **Turn（转牌）**: 第二轮公共牌，发出 1 张
- **River（河牌）**: 第三轮公共牌，发出 1 张
- **Hand_Rank（牌型）**: 德州扑克中的 10 种牌型等级，从高到低依次为：皇家同花顺、同花顺、四条、葫芦、同花、顺子、三条、两对、一对、高牌
- **Game_Flow_Controller（流程控制器）**: 管理牌局从翻牌前到河牌各阶段推进的模块
- **Card_Display（牌面展示组件）**: 在 UI 上展示手牌和公共牌的视觉组件
- **Opponent（对手）**: 模拟对局中的虚拟对手，始终自动跟注，不进行任何策略决策
- **Opponent_Hand（对手手牌）**: 翻牌前发给对手的 2 张底牌
- **Showdown_Engine（摊牌引擎）**: 河牌结束后负责比较玩家和对手最佳牌型并判定胜负的模块
- **Win_Rate_Hint（胜率提示）**: 基于当前手牌和公共牌计算并展示的大致胜率信息
- **Hand_Rank_Hint（牌型提示）**: 展示当前最佳牌型名称和组成牌的辅助信息

## 需求

### 需求 1：牌组初始化与洗牌

**用户故事：** 作为一名训练者，我希望每局开始时获得一副充分随机打乱的标准扑克牌，以便模拟真实的发牌体验。

#### 验收标准

1. THE Deck SHALL 包含恰好 52 张不重复的扑克牌，覆盖 4 种花色各 13 张
2. WHEN 一局新游戏开始时，THE Shuffle_Engine SHALL 使用 Fisher-Yates 算法将 Deck 中的 52 张牌随机打乱
3. WHEN 洗牌完成后，THE Deck SHALL 保持恰好 52 张牌且无重复

### 需求 2：发牌流程

**用户故事：** 作为一名训练者，我希望按照德州扑克标准规则依次获得手牌和公共牌，以便练习各阶段的牌局分析。

#### 验收标准

1. WHEN 发牌阶段开始时，THE Deal_Engine SHALL 从 Deck 顶部发出 2 张牌作为玩家的 Hand
2. WHEN 发牌阶段开始时，THE Deal_Engine SHALL 从 Deck 顶部发出 2 张牌作为 Opponent_Hand
3. WHEN 翻牌阶段开始时，THE Deal_Engine SHALL 从 Deck 顶部发出 3 张牌作为 Flop
4. WHEN 转牌阶段开始时，THE Deal_Engine SHALL 从 Deck 顶部发出 1 张牌作为 Turn
5. WHEN 河牌阶段开始时，THE Deal_Engine SHALL 从 Deck 顶部发出 1 张牌作为 River
6. THE Deal_Engine SHALL 确保整局游戏中发出的所有牌（Hand + Opponent_Hand + Community_Cards）无重复

### 需求 3：牌局流程控制

**用户故事：** 作为一名训练者，我希望能按步骤推进牌局的各个阶段，以便在每个阶段有时间思考和分析。

#### 验收标准

1. THE Game_Flow_Controller SHALL 按照固定顺序管理牌局阶段：翻牌前 → 翻牌 → 转牌 → 河牌 → 结算
2. WHEN 玩家点击"下一步"按钮时，THE Game_Flow_Controller SHALL 推进到下一个阶段并触发对应的发牌操作
3. WHILE 牌局处于结算阶段，THE Game_Flow_Controller SHALL 展示最终牌型判定结果和对局胜负结果
4. WHEN 玩家点击"新一局"按钮时，THE Game_Flow_Controller SHALL 重置牌局状态并开始新的一局

### 需求 4：牌型判定

**用户故事：** 作为一名训练者，我希望系统能准确识别我的手牌和公共牌组成的最佳牌型，以便学习和验证各种牌型。

#### 验收标准

1. THE Hand_Evaluator SHALL 识别以下 10 种牌型（按等级从高到低）：皇家同花顺、同花顺、四条、葫芦、同花、顺子、三条、两对、一对、高牌
2. WHEN 河牌阶段结束后，THE Hand_Evaluator SHALL 从 2 张 Hand 和 5 张 Community_Cards 中选出最佳的 5 张牌组合
3. THE Hand_Evaluator SHALL 返回牌型名称和组成该牌型的 5 张具体牌
4. WHEN 两种牌型等级相同时，THE Hand_Evaluator SHALL 根据踢脚牌（Kicker）规则确定更高的组合
5. THE Hand_Evaluator SHALL 正确处理 A 在顺子中既可作为最高牌（10-J-Q-K-A）也可作为最低牌（A-2-3-4-5）的情况

### 需求 5：牌面 UI 展示

**用户故事：** 作为一名训练者，我希望在界面上清晰地看到我的手牌和公共牌，以便直观地分析牌局。

#### 验收标准

1. THE Card_Display SHALL 展示每张牌的花色和点数，使用可辨识的视觉样式
2. WHILE 牌局处于翻牌前阶段，THE Card_Display SHALL 仅展示玩家的 2 张 Hand，Community_Cards 区域显示为背面朝上的占位牌
3. WHEN 新的公共牌发出时，THE Card_Display SHALL 在 Community_Cards 区域展示已发出的公共牌，未发出的位置保持背面朝上
4. THE Card_Display SHALL 在手牌区域和公共牌区域之间提供清晰的视觉分隔
5. THE Card_Display SHALL 适配微信小程序的常见屏幕尺寸（宽度 320px 至 428px）

### 需求 6：牌型提示功能

**用户故事：** 作为一名训练者，我希望在牌局进行中获得当前最佳牌型的提示，以便辅助学习牌型识别。

#### 验收标准

1. WHEN 翻牌阶段或之后的阶段，且玩家开启牌型提示时，THE Hand_Rank_Hint SHALL 展示当前手牌和已发出公共牌组成的最佳牌型名称
2. THE Hand_Rank_Hint SHALL 高亮标识组成当前最佳牌型的具体牌张
3. WHERE 玩家选择开启牌型提示功能，THE Hand_Rank_Hint SHALL 在每个阶段自动更新提示内容

### 需求 7：胜率提示功能

**用户故事：** 作为一名训练者，我希望了解当前手牌的大致胜率，以便学习不同手牌的强弱。

#### 验收标准

1. WHERE 玩家选择开启胜率提示功能，THE Win_Rate_Hint SHALL 基于当前 Hand 和已发出的 Community_Cards 计算大致胜率
2. WHEN 新的公共牌发出时，THE Win_Rate_Hint SHALL 重新计算并更新胜率数值
3. THE Win_Rate_Hint SHALL 以百分比形式展示胜率，精度为整数百分比
4. THE Win_Rate_Hint SHALL 使用蒙特卡洛模拟方法，模拟至少 1000 次随机对局来估算胜率

### 需求 8：牌型判定的序列化与反序列化

**用户故事：** 作为一名开发者，我希望牌和牌型数据能在序列化和反序列化之间保持一致，以便数据在存储和传输中不丢失。

#### 验收标准

1. THE Deal_Engine SHALL 将 Card 对象序列化为 JSON 格式字符串
2. THE Deal_Engine SHALL 将 JSON 格式字符串反序列化为 Card 对象
3. FOR ALL 有效的 Card 对象，序列化后再反序列化 SHALL 产生与原始对象等价的 Card 对象（往返一致性）
4. IF 提供的 JSON 字符串格式无效，THEN THE Deal_Engine SHALL 返回描述性的错误信息

### 需求 9：对手手牌管理

**用户故事：** 作为一名训练者，我希望每局有一名虚拟对手也获得底牌，以便模拟真实的对局场景。

#### 验收标准

1. WHEN 发牌阶段开始时，THE Deal_Engine SHALL 在发出玩家 Hand 之后，从 Deck 顶部发出 2 张牌作为 Opponent_Hand
2. THE Deal_Engine SHALL 确保 Opponent_Hand 与 Hand 和 Community_Cards 之间无重复
3. WHEN 玩家点击"新一局"按钮时，THE Game_Flow_Controller SHALL 清除上一局的 Opponent_Hand 并重新发牌

### 需求 10：对手手牌展示

**用户故事：** 作为一名训练者，我希望在牌局进行中对手的手牌保持隐藏，在结算时翻开，以便模拟真实的对局体验。

#### 验收标准

1. WHILE 牌局处于翻牌前、翻牌、转牌或河牌阶段，THE Card_Display SHALL 将 Opponent_Hand 展示为背面朝上的 2 张牌
2. WHEN 牌局进入结算阶段时，THE Card_Display SHALL 将 Opponent_Hand 翻开，展示对手 2 张底牌的花色和点数
3. THE Card_Display SHALL 在玩家手牌区域上方提供独立的对手手牌展示区域，并标注"对手"标签

### 需求 11：胜负判定

**用户故事：** 作为一名训练者，我希望在河牌结束后系统自动比较双方牌型并判定输赢，以便了解对局结果。

#### 验收标准

1. WHEN 河牌阶段结束后，THE Showdown_Engine SHALL 分别从玩家的 Hand 和对手的 Opponent_Hand 各自与 5 张 Community_Cards 中选出最佳的 5 张牌组合
2. THE Showdown_Engine SHALL 比较玩家和对手的最佳牌型等级，牌型等级高者获胜
3. WHEN 双方牌型等级相同时，THE Showdown_Engine SHALL 根据踢脚牌（Kicker）规则判定胜负
4. WHEN 双方牌型和踢脚牌完全相同时，THE Showdown_Engine SHALL 判定为平局
5. THE Showdown_Engine SHALL 返回对局结果（玩家胜、对手胜、平局）以及双方的最佳牌型名称
6. WHILE 牌局处于结算阶段，THE Game_Flow_Controller SHALL 展示对局结果和双方的牌型判定信息
