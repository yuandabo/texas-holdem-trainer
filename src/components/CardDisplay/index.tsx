import { View, Text } from '@tarojs/components';
import { Card, Suit, Rank } from '@/engine/types';
import './index.scss';

export interface CardDisplayProps {
  cards: Card[];
  faceDown?: boolean;
  totalSlots?: number;
  highlightCards?: Card[];
  label?: string;
}

const SUIT_SYMBOLS: Record<Suit, string> = {
  [Suit.Spades]: '♠',
  [Suit.Hearts]: '♥',
  [Suit.Clubs]: '♣',
  [Suit.Diamonds]: '♦',
};

const RANK_TEXT: Record<Rank, string> = {
  [Rank.Two]: '2',
  [Rank.Three]: '3',
  [Rank.Four]: '4',
  [Rank.Five]: '5',
  [Rank.Six]: '6',
  [Rank.Seven]: '7',
  [Rank.Eight]: '8',
  [Rank.Nine]: '9',
  [Rank.Ten]: '10',
  [Rank.Jack]: 'J',
  [Rank.Queen]: 'Q',
  [Rank.King]: 'K',
  [Rank.Ace]: 'A',
};

function isRedSuit(suit: Suit): boolean {
  return suit === Suit.Hearts || suit === Suit.Diamonds;
}

function isHighlighted(card: Card, highlightCards?: Card[]): boolean {
  if (!highlightCards || highlightCards.length === 0) return false;
  return highlightCards.some(h => h.suit === card.suit && h.rank === card.rank);
}

export default function CardDisplay({ cards, faceDown, totalSlots, highlightCards, label }: CardDisplayProps) {
  const slots = totalSlots ?? cards.length;
  const items: Array<{ type: 'card'; card: Card } | { type: 'placeholder' }> = [];

  for (let i = 0; i < slots; i++) {
    if (i < cards.length) {
      items.push({ type: 'card', card: cards[i] });
    } else {
      items.push({ type: 'placeholder' });
    }
  }

  return (
    <View className='card-display'>
      {label && <Text className='card-display__label'>{label}</Text>}
      <View className='card-display__row'>
        {items.map((item, index) => {
          if (item.type === 'placeholder' || faceDown) {
            return (
              <View key={index} className='card-display__card card-display__card--back'>
                <View className='card-display__back-pattern' />
              </View>
            );
          }

          const { card } = item;
          const red = isRedSuit(card.suit);
          const highlighted = isHighlighted(card, highlightCards);
          const cardClass = [
            'card-display__card',
            red ? 'card-display__card--red' : 'card-display__card--black',
            highlighted ? 'card-display__card--highlight' : '',
          ].filter(Boolean).join(' ');

          return (
            <View key={`${card.suit}-${card.rank}-${index}`} className={cardClass}>
              <Text className='card-display__rank'>{RANK_TEXT[card.rank]}</Text>
              <Text className='card-display__suit'>{SUIT_SYMBOLS[card.suit]}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
