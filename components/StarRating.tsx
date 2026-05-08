import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Colors } from '../constants/colors';

type Props = {
  rating: number;
  onChange?: (rating: number) => void;
  size?: number;
  readonly?: boolean;
};

export default function StarRating({ rating, onChange, size = 28, readonly = false }: Props) {
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable
          key={star}
          onPress={() => !readonly && onChange?.(star === rating ? 0 : star)}
          disabled={readonly}
          hitSlop={8}
        >
          <Ionicons
            name={rating >= star ? 'star' : rating >= star - 0.5 ? 'star-half' : 'star-outline'}
            size={size}
            color={rating >= star - 0.5 ? Colors.star : Colors.starEmpty}
          />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4 },
});
