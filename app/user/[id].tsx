import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BeerCard from '../../components/BeerCard';
import { Colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { CellarEntry, Profile } from '../../types';

type SortOption = 'date' | 'rating' | 'name' | 'favorite';

export default function FriendCellarScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [entries, setEntries] = useState<CellarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('date');

  useEffect(() => {
    if (!id) return;
    Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single(),
      supabase.from('cellar_entries').select('*, beer:beers(*)').eq('user_id', id),
    ]).then(([{ data: p }, { data: e }]) => {
      if (p) setProfile(p as Profile);
      if (e) setEntries(e as CellarEntry[]);
      setLoading(false);
    });
  }, [id]);

  const totalBeers = entries.reduce((acc, e) => acc + e.quantity, 0);

  const filtered = entries
    .filter((e) => {
      const q = search.toLowerCase();
      return (
        !q ||
        e.beer?.name.toLowerCase().includes(q) ||
        e.beer?.brewery?.toLowerCase().includes(q) ||
        e.beer?.style?.toLowerCase().includes(q) ||
        e.taste_tags.some((t) => t.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      if (sort === 'rating') return (b.rating ?? 0) - (a.rating ?? 0);
      if (sort === 'name') return (a.beer?.name ?? '').localeCompare(b.beer?.name ?? '');
      if (sort === 'favorite') return (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0);
      return new Date(b.added_at).getTime() - new Date(a.added_at).getTime();
    });

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Cave de l'ami</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {/* Profile card */}
            <View style={styles.profileCard}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={28} color={Colors.textDim} />
                </View>
              )}
              <View style={styles.profileInfo}>
                <Text style={styles.username}>@{profile?.username}</Text>
                {profile?.bio && <Text style={styles.bio}>{profile.bio}</Text>}
                <Text style={styles.stats}>
                  {entries.length} bière{entries.length !== 1 ? 's' : ''} · {totalBeers} exemplaire{totalBeers !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>

            {/* Search */}
            <View style={styles.searchRow}>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={18} color={Colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Nom, brasserie, style…"
                  placeholderTextColor={Colors.textDim}
                />
                {search.length > 0 && (
                  <Pressable onPress={() => setSearch('')}>
                    <Ionicons name="close-circle" size={18} color={Colors.textDim} />
                  </Pressable>
                )}
              </View>
            </View>

            {/* Sort */}
            <View style={styles.sortRow}>
              {([
                { key: 'date', label: 'Récent' },
                { key: 'rating', label: 'Note' },
                { key: 'name', label: 'Nom' },
                { key: 'favorite', label: 'Favoris' },
              ] as { key: SortOption; label: string }[]).map(({ key, label }) => (
                <Pressable
                  key={key}
                  style={[styles.sortChip, sort === key && styles.sortChipActive]}
                  onPress={() => setSort(key)}
                >
                  <Text style={[styles.sortText, sort === key && styles.sortTextActive]}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) => <BeerCard entry={item} readonly />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Ionicons name="beer-outline" size={64} color={Colors.textDim} />
              <Text style={styles.emptyTitle}>
                {entries.length === 0 ? 'Cave vide' : 'Aucun résultat'}
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 20, marginBottom: 20,
    backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border, padding: 16,
  },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  avatarPlaceholder: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Colors.surfaceLight, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  profileInfo: { flex: 1, gap: 4 },
  username: { fontSize: 18, fontWeight: '800', color: Colors.text },
  bio: { fontSize: 13, color: Colors.textMuted, lineHeight: 18 },
  stats: { fontSize: 12, color: Colors.primary, fontWeight: '600', marginTop: 2 },
  searchRow: { paddingHorizontal: 20, marginBottom: 12 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 12, gap: 8,
  },
  searchInput: { flex: 1, color: Colors.text, fontSize: 14, paddingVertical: 10 },
  sortRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 16 },
  sortChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  sortChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  sortText: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  sortTextActive: { color: Colors.background },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  empty: { alignItems: 'center', gap: 12, padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
});
