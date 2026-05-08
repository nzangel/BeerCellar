import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { Colors } from '../constants/colors';
import { TASTE_TAGS, TasteTag } from '../types';

type Props = {
  selected: TasteTag[];
  onChange: (tags: TasteTag[]) => void;
};

export default function TasteTagPicker({ selected, onChange }: Props) {
  const toggle = (tag: TasteTag) => {
    if (selected.includes(tag)) {
      onChange(selected.filter((t) => t !== tag));
    } else {
      onChange([...selected, tag]);
    }
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {TASTE_TAGS.map((tag) => {
        const active = selected.includes(tag);
        return (
          <Pressable
            key={tag}
            onPress={() => toggle(tag)}
            style={[styles.tag, active && styles.tagActive]}
          >
            <Text style={[styles.tagText, active && styles.tagTextActive]}>{tag}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', gap: 8, paddingHorizontal: 4 },
  tag: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.tag,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tagActive: {
    backgroundColor: Colors.tagActive,
    borderColor: Colors.tagActive,
  },
  tagText: { fontSize: 13, color: Colors.tagText, fontWeight: '500' },
  tagTextActive: { color: Colors.tagActiveText, fontWeight: '700' },
});
