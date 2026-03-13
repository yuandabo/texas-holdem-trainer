import { View, Text } from '@tarojs/components';
import { BettingActionType, BettingAction } from '@/engine/types';
import './index.scss';

export interface BettingActionPanelProps {
  availableActions: BettingActionType[];
  currentBetToCall: number;
  minRaiseAmount: number;
  maxRaiseAmount: number;
  potSize: number;
  enabled: boolean;
  onAction: (action: BettingAction) => void;
}

export default function BettingActionPanel({
  availableActions,
  currentBetToCall,
  minRaiseAmount,
  maxRaiseAmount,
  potSize,
  enabled,
  onAction,
}: BettingActionPanelProps) {
  if (availableActions.length === 0) return null;

  const hasAction = (type: BettingActionType) => availableActions.includes(type);
  const disabledCls = !enabled ? ' betting-panel__btn--disabled' : '';

  const handleCheck = () => enabled && onAction({ type: 'check', amount: 0 });
  const handleCall = () => enabled && onAction({ type: 'call', amount: currentBetToCall });
  const handleFold = () => enabled && onAction({ type: 'fold', amount: 0 });
  const handleAllIn = () => enabled && onAction({ type: 'all_in', amount: maxRaiseAmount });

  const handleRaise = (amount: number) => {
    if (!enabled) return;
    // 限制在 [minRaiseAmount, maxRaiseAmount]
    const clamped = Math.min(Math.max(amount, minRaiseAmount), maxRaiseAmount);
    onAction({ type: 'raise', amount: clamped });
  };

  // 生成倍数按钮：基于底池大小的倍数
  const raiseBase = Math.max(potSize, currentBetToCall, 1);
  const multipliers = [
    { label: '2x', value: raiseBase * 2 },
    { label: '3x', value: raiseBase * 3 },
    { label: '4x', value: raiseBase * 4 },
  ];
  // 只保留在有效范围内的倍数按钮
  const validMultipliers = multipliers.filter(m => m.value >= minRaiseAmount && m.value < maxRaiseAmount);

  return (
    <View className='betting-panel'>
      {/* 加注倍数按钮行 */}
      {hasAction('raise') && (
        <View className='betting-panel__raise-row'>
          {validMultipliers.map(m => (
            <View
              key={m.label}
              className={`betting-panel__btn betting-panel__btn--raise${disabledCls}`}
              onClick={() => handleRaise(m.value)}
            >
              <Text className='betting-panel__btn-text'>{m.label} ({m.value})</Text>
            </View>
          ))}
          <View
            className={`betting-panel__btn betting-panel__btn--allin${disabledCls}`}
            onClick={enabled ? handleAllIn : undefined}
          >
            <Text className='betting-panel__btn-text'>全下 {maxRaiseAmount}</Text>
          </View>
        </View>
      )}

      {/* 基础操作按钮行 */}
      <View className='betting-panel__buttons'>
        {hasAction('check') && (
          <View className={`betting-panel__btn betting-panel__btn--check${disabledCls}`} onClick={handleCheck}>
            <Text className='betting-panel__btn-text'>过牌</Text>
          </View>
        )}
        {hasAction('call') && (
          <View className={`betting-panel__btn betting-panel__btn--call${disabledCls}`} onClick={handleCall}>
            <Text className='betting-panel__btn-text'>跟注 {currentBetToCall}</Text>
          </View>
        )}
        {hasAction('all_in') && !hasAction('raise') && (
          <View className={`betting-panel__btn betting-panel__btn--allin${disabledCls}`} onClick={handleAllIn}>
            <Text className='betting-panel__btn-text'>全下 {maxRaiseAmount}</Text>
          </View>
        )}
        {hasAction('fold') && (
          <View className={`betting-panel__btn betting-panel__btn--fold${disabledCls}`} onClick={handleFold}>
            <Text className='betting-panel__btn-text'>弃牌</Text>
          </View>
        )}
      </View>
    </View>
  );
}
