import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/colors';
import { CellarEntry } from '../types';
import StarRating from './StarRating';

type Props = {
  entry: CellarEntry;
  readonly?: boolean;
};

export default function BeerCard({ entry, readonly = false }: Props) {
  const router = useRouter();
  const beer = entry.beer;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && !readonly && styles.cardPressed]}
      onPress={() => !readonly && router.push(`/beer/${entry.id}`)}
    >
      <View style={styles.imageContainer}>
        {entry.photo_url || beer?.image_url ? (
          <Image
            source={{ uri: entry.photo_url ?? beer?.image_url ?? '' }}
            style={styles.image}
            contentFit="cover"
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="beer-outline" size={32} color={Colors.textDim} />
          </View>
        )}
        {entry.is_favorite && (
          <View style={styles.favBadge}>
            <Ionicons name="heart" size={12} color={Colors.primary} />
          </View>
        )}
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{beer?.name ?? 'Bière'}</Text>
        {beer?.brewery && (
          <Text style={styles.brewery} numberOfLines={1}>{beer.brewery}</Text>
        )}
        <View style={styles.meta}>
          {beer?.style && <Text style={styles.style}>{beer.style}</Text>}
          {beer?.abv != null && (
            <Text style={styles.abv}>{beer.abv}%</Text>
          )}
        </View>
        {entry.rating != null && (
          <StarRating rating={entry.rating} readonly size={14} />
        )}
        {entry.taste_tags.length > 0 && (
          <View style={styles.tags}>
            {entry.taste_tags.slice(0, 3).map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {entry.quantity > 1 && (
        <View style={styles.qty}>
          <Text style={styles.qtyText}>×{entry.quantity}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
    marginBottom: 12,
  },
  cardPressed: { opacity: 0.85 },
  imageContainer: { width: 90, height: 120, position: 'relative' },
  image: { width: 90, height: 120 },
  imagePlaceholder: {
    width: 90,
    height: 120,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 3,
  },
  info: { flex: 1, padding: 12, gap: 4 },
  name: { fontSize: 15, fontWeight: '700', color: Colors.text },
  brewery: { fontSize: 13, color: Colors.textMuted },
  meta: { flexDirection: 'row', gap: 8 },
  style: {
    fontSize: 11,
    color: Colors.primary,
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  abv: { fontSize: 11, color: Colors.textMuted, alignSelf: 'center' },
  tags: { flexDirection: 'row', gap: 4, flexWrap: 'wrap', marginTop: 2 },
  tag: {
    backgroundColor: Colors.tag,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: { fontSize: 10, color: Colors.tagText },
  qty: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  qtyText: { fontSize: 11, fontWeight: '700', color: Colors.background },
});
