import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/colors';

type Props = {
  uri?: string | null;
  name?: string;
  size?: number;
};

export default function Avatar({ uri, name, size = 40 }: Props) {
  const initials = name
    ? name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
        contentFit="cover"
      />
    );
  }

  return (
    <View
      style={[
        styles.placeholder,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      {name ? (
        <Text style={[styles.initials, { fontSize: size * 0.38 }]}>{initials}</Text>
      ) : (
        <Ionicons name="person" size={size * 0.5} color={Colors.textDim} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {},
  placeholder: {
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  initials: { color: Colors.textMuted, fontWeight: '700' },
});
