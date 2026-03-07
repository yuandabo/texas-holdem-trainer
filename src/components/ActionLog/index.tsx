import { View, Text, ScrollView } from '@tarojs/components';
import { ActionLogEntry } from '@/engine/types';
import './index.scss';

export interface ActionLogProps {
  entries: ActionLogEntry[];
}

export default function ActionLog({ entries }: ActionLogProps) {
  if (entries.length === 0) {
    return (
      <View className='action-log'>
        <Text className='action-log__title'>操作记录</Text>
        <Text className='action-log__empty'>等待操作...</Text>
      </View>
    );
  }

  return (
    <View className='action-log'>
      <Text className='action-log__title'>操作记录</Text>
      <ScrollView className='action-log__list' scrollY>
        {entries.map((entry, i) => (
          <View key={i} className={`action-log__item action-log__item--${entry.actor}`}>
            <Text className='action-log__actor'>
              {entry.actor === 'player' ? '你' : 'Luna'}
            </Text>
            <Text className='action-log__phase'>{entry.phase}</Text>
            <Text className='action-log__action'>{entry.actionType}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
