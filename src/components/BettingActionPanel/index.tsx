import { useState } from 'react';
import { View, Text, Slider } from '@tarojs/components';
import { BettingActionType, BettingAction } from '@/engine/types';
import './index.scss';

export interface BettingActionPanelProps {
  availableActions: BettingActionType[];
  currentBetToCall: number;
  minRaiseAmount: number;
  maxRaiseAmount: number;
  enabled: boolean;
  onAction: (action: BettingAction) => void;
}

export default function BettingActionPanel({
  availableActions,
  currentBetToCall,
  minRaiseAmount,
  maxRaiseAmount,
  enabled,
  onAction,
}: BettingActionPanelProps) {
  const [showRaiseInput, setShowRaiseInput] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState(minRaiseAmount);

  if (availableActions.length === 0) {
    return null;
  }

  const hasAction = (type: BettingActionType) => availableActions.includes(type);

  const handleCheck = () => {
    onAction({ type: 'check', amount: 0 });
  };

  const handleCall = () => {
    onAction({ type: 'call', amount: currentBetToCall });
  };

  const handleAllIn = () => {
    onAction({ type: 'all_in', amount: maxRaiseAmount });
  };

  const handleFold = () => {
    onAction({ type: 'fold', amount: 0 });
  };

  const handleRaiseToggle = () => {
    setRaiseAmount(minRaiseAmount);
    setShowRaiseInput(!showRaiseInput);
  };

  const handleRaiseConfirm = () => {
    onAction({ type: 'raise', amount: raiseAmount });
    setShowRaiseInput(false);
  };

  const handleSliderChange = (e: { detail: { value: number } }) => {
    setRaiseAmount(e.detail.value);
  };

  return (
    <View className='betting-panel'>
      {showRaiseInput && (
        <View className='betting-panel__raise-input'>
          <View className='betting-panel__raise-header'>
            <Text className='betting-panel__raise-label'>加注金额: {raiseAmount}</Text>
          </View>
          <Slider
            className='betting-panel__slider'
            min={minRaiseAmount}
            max={maxRaiseAmount}
            value={raiseAmount}
            step={1}
            activeColor='#f1c40f'
            backgroundColor='rgba(255,255,255,0.2)'
            blockSize={20}
            onChange={handleSliderChange}
          />
          <View className='betting-panel__raise-actions'>
            <View
              className={`betting-panel__btn betting-panel__btn--confirm ${!enabled ? 'betting-panel__btn--disabled' : ''}`}
              onClick={enabled ? handleRaiseConfirm : undefined}
            >
              <Text className='betting-panel__btn-text'>确认加注 {raiseAmount}</Text>
            </View>
            <View
              className='betting-panel__btn betting-panel__btn--cancel'
              onClick={handleRaiseToggle}
            >
              <Text className='betting-panel__btn-text'>取消</Text>
            </View>
          </View>
        </View>
      )}

      <View className='betting-panel__buttons'>
        {hasAction('check') && (
          <View
            className={`betting-panel__btn betting-panel__btn--check ${!enabled ? 'betting-panel__btn--disabled' : ''}`}
            onClick={enabled ? handleCheck : undefined}
          >
            <Text className='betting-panel__btn-text'>过牌</Text>
          </View>
        )}

        {hasAction('call') && (
          <View
            className={`betting-panel__btn betting-panel__btn--call ${!enabled ? 'betting-panel__btn--disabled' : ''}`}
            onClick={enabled ? handleCall : undefined}
          >
            <Text className='betting-panel__btn-text'>跟注 {currentBetToCall}</Text>
          </View>
        )}

        {hasAction('all_in') && (
          <View
            className={`betting-panel__btn betting-panel__btn--allin ${!enabled ? 'betting-panel__btn--disabled' : ''}`}
            onClick={enabled ? handleAllIn : undefined}
          >
            <Text className='betting-panel__btn-text'>全下 {maxRaiseAmount}</Text>
          </View>
        )}

        {hasAction('raise') && (
          <View
            className={`betting-panel__btn betting-panel__btn--raise ${!enabled ? 'betting-panel__btn--disabled' : ''}`}
            onClick={enabled ? handleRaiseToggle : undefined}
          >
            <Text className='betting-panel__btn-text'>加注</Text>
          </View>
        )}

        {hasAction('fold') && (
          <View
            className={`betting-panel__btn betting-panel__btn--fold ${!enabled ? 'betting-panel__btn--disabled' : ''}`}
            onClick={enabled ? handleFold : undefined}
          >
            <Text className='betting-panel__btn-text'>弃牌</Text>
          </View>
        )}
      </View>
    </View>
  );
}
