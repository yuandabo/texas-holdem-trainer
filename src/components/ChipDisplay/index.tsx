import { View, Text } from '@tarojs/components';
import './index.scss';

export interface ChipDisplayProps {
  label: string;
  amount: number;
}

export default function ChipDisplay({ label, amount }: ChipDisplayProps) {
  return (
    <View className='chip-display'>
      <Text className='chip-display__label'>{label}</Text>
      <Text className='chip-display__amount'>💰 {amount}</Text>
    </View>
  );
}
