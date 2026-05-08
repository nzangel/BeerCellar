import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Avatar from '../../components/Avatar';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { Friendship, TastingGroup } from '../../types';

type Tab = 'amis' | 'groupes';

export default function SocialScreen() {
  const router = useRouter();
  const { session, profile } = useAuth();
  const [tab, setTab] = useState<Tab>('amis');
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [pendingIn, setPendingIn] = useState<Friendship[]>([]);
  const [groups, setGroups] = useState<TastingGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!session) return;

    const [{ data: friendData }, { data: groupData }] = await Promise.all([
      supabase
        .from('friendships')
        .select('*, profile:profiles!friendships_addressee_id_fkey(*)')
        .or(`requester_id.eq.${session.user.id},addressee_id.eq.${session.user.id}`),
      supabase
        .from('tasting_groups')
        .select('*, group_members!inner(user_id)')
        .eq('group_members.user_id', session.user.id),
    ]);

    if (friendData) {
      const accepted = friendData.filter((f) => f.status === 'accepted') as Friendship[];
      const incoming = friendData.filter(
        (f) => f.status === 'pending' && f.addressee_id === session.user.id
      ) as Friendship[];

      const enriched = await Promise.all(
        accepted.map(async (f) => {
          const otherId =
            f.requester_id === session.user.id ? f.addressee_id : f.requester_id;
          const { data: p } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', otherId)
            .single();
          return { ...f, profile: p };
        })
      );
      const enrichedPending = await Promise.all(
        incoming.map(async (f) => {
          const { data: p } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', f.requester_id)
            .single();
          return { ...f, profile: p };
        })
      );
      setFriends(enriched as Friendship[]);
      setPendingIn(enrichedPending as Friendship[]);
    }

    if (groupData) setGroups(groupData as TastingGroup[]);
  }, [session]);

  useEffect(() => {
    fetchAll().finally(() => setLoading(false));
  }, [fetchAll]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  const searchUsers = async (q: string) => {
    if (!q.trim() || !session) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .ilike('username', `%${q}%`)
      .neq('id', session.user.id)
      .limit(10);
    setSearchResults(data ?? []);
    setSearching(false);
  };

  const sendFriendRequest = async (userId: string) => {
    if (!session) return;
    const { error } = await supabase.from('friendships').insert({
      requester_id: session.user.id,
      addressee_id: userId,
    });
    if (!error) {
      Alert.alert('Demande envoyée !', 'Tu as envoyé une demande d\'ami.');
      setSearchQuery('');
      setSearchResults([]);
    } else {
      Alert.alert('Erreur', 'Impossible d\'envoyer la demande.');
    }
  };

  const respondToRequest = async (friendshipId: string, accept: boolean) => {
    await supabase
      .from('friendships')
      .update({ status: accept ? 'accepted' : 'declined' })
      .eq('id', friendshipId);
    fetchAll();
  };

  const removeFriend = (friendshipId: string, name: string) => {
    Alert.alert('Supprimer ami', `Retirer ${name} de tes amis ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('friendships').delete().eq('id', friendshipId);
          fetchAll();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Communauté</Text>
        {tab === 'groupes' && (
          <Pressable style={styles.addBtn} onPress={() => router.push('/group/create')}>
            <Ionicons name="add" size={24} color={Colors.background} />
          </Pressable>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(['amis', 'groupes'] as Tab[]).map((t) => (
          <Pressable
            key={t}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'amis' ? `Amis (${friends.length})` : `Groupes (${groups.length})`}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'amis' ? (
        <FlatList
          data={friends}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ListHeaderComponent={
            <View>
              {/* Search */}
              <View style={styles.searchBox}>
                <Ionicons name="search" size={18} color={Colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={(q) => { setSearchQuery(q); searchUsers(q); }}
                  placeholder="Chercher un utilisateur…"
                  placeholderTextColor={Colors.textDim}
                  autoCapitalize="none"
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
                    <Ionicons name="close-circle" size={18} color={Colors.textDim} />
                  </Pressable>
                )}
              </View>

              {/* Search results */}
              {searchResults.length > 0 && (
                <View style={styles.searchResults}>
                  {searchResults.map((user) => (
                    <View key={user.id} style={styles.userRow}>
                      <Avatar uri={user.avatar_url} name={user.username} size={40} />
                      <Text style={styles.username}>@{user.username}</Text>
                      <Pressable
                        style={styles.addFriendBtn}
                        onPress={() => sendFriendRequest(user.id)}
                      >
                        <Ionicons name="person-add" size={16} color={Colors.background} />
                        <Text style={styles.addFriendText}>Ajouter</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}

              {/* Pending requests */}
              {pendingIn.length > 0 && (
                <View style={styles.pendingSection}>
                  <Text style={styles.sectionTitle}>
                    Demandes reçues ({pendingIn.length})
                  </Text>
                  {pendingIn.map((req) => (
                    <View key={req.id} style={styles.pendingRow}>
                      <Avatar uri={req.profile?.avatar_url} name={req.profile?.username} size={40} />
                      <Text style={styles.username}>@{req.profile?.username}</Text>
                      <View style={styles.pendingActions}>
                        <Pressable
                          style={styles.acceptBtn}
                          onPress={() => respondToRequest(req.id, true)}
                        >
                          <Ionicons name="checkmark" size={18} color={Colors.success} />
                        </Pressable>
                        <Pressable
                          style={styles.declineBtn}
                          onPress={() => respondToRequest(req.id, false)}
                        >
                          <Ionicons name="close" size={18} color={Colors.error} />
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {friends.length > 0 && (
                <Text style={[styles.sectionTitle, { paddingHorizontal: 20, marginTop: 8 }]}>
                  Mes amis
                </Text>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.friendRow}>
              <Avatar uri={item.profile?.avatar_url} name={item.profile?.username} size={44} />
              <View style={styles.friendInfo}>
                <Text style={styles.friendName}>@{item.profile?.username}</Text>
                {item.profile?.bio && (
                  <Text style={styles.friendBio} numberOfLines={1}>{item.profile.bio}</Text>
                )}
              </View>
              <Pressable onPress={() => removeFriend(item.id, item.profile?.username ?? '')}>
                <Ionicons name="person-remove-outline" size={20} color={Colors.textDim} />
              </Pressable>
            </View>
          )}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.empty}>
                <Ionicons name="people-outline" size={64} color={Colors.textDim} />
                <Text style={styles.emptyTitle}>Aucun ami</Text>
                <Text style={styles.emptyText}>Recherche des utilisateurs par pseudo pour les ajouter.</Text>
              </View>
            ) : null
          }
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          renderItem={({ item }) => (
            <Pressable
              style={styles.groupCard}
              onPress={() => router.push(`/group/${item.id}`)}
            >
              <Avatar uri={item.avatar_url} name={item.name} size={52} />
              <View style={styles.groupInfo}>
                <Text style={styles.groupName}>{item.name}</Text>
                {item.description && (
                  <Text style={styles.groupDesc} numberOfLines={1}>{item.description}</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textDim} />
            </Pressable>
          )}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.empty}>
                <Ionicons name="people-circle-outline" size={64} color={Colors.textDim} />
                <Text style={styles.emptyTitle}>Aucun groupe</Text>
                <Text style={styles.emptyText}>Crée un groupe de dégustation ou rejoins-en un.</Text>
                <Pressable style={styles.emptyBtn} onPress={() => router.push('/group/create')}>
                  <Text style={styles.emptyBtnText}>Créer un groupe</Text>
                </Pressable>
              </View>
            ) : null
          }
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16,
  },
  title: { fontSize: 28, fontWeight: '800', color: Colors.text },
  addBtn: {
    backgroundColor: Colors.primary, width: 44, height: 44,
    borderRadius: 22, alignItems: 'center', justifyContent: 'center',
  },
  tabRow: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 16, gap: 8 },
  tabBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 12,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
  tabTextActive: { color: Colors.background },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 12, gap: 8, marginHorizontal: 20, marginBottom: 12,
  },
  searchInput: { flex: 1, color: Colors.text, fontSize: 14, paddingVertical: 10 },
  searchResults: {
    marginHorizontal: 20, backgroundColor: Colors.surface,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    marginBottom: 12, overflow: 'hidden',
  },
  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  username: { flex: 1, color: Colors.text, fontWeight: '600', fontSize: 14 },
  addFriendBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primary, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  addFriendText: { color: Colors.background, fontWeight: '700', fontSize: 12 },
  pendingSection: { marginHorizontal: 20, marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.textMuted, marginBottom: 10 },
  pendingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1,
    borderColor: Colors.border, padding: 12, marginBottom: 8,
  },
  pendingActions: { flexDirection: 'row', gap: 8 },
  acceptBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surfaceLight, borderWidth: 1, borderColor: Colors.success,
    alignItems: 'center', justifyContent: 'center',
  },
  declineBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surfaceLight, borderWidth: 1, borderColor: Colors.error,
    alignItems: 'center', justifyContent: 'center',
  },
  friendRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  friendInfo: { flex: 1 },
  friendName: { fontSize: 15, fontWeight: '600', color: Colors.text },
  friendBio: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  groupCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.card, borderRadius: 14, borderWidth: 1,
    borderColor: Colors.cardBorder, padding: 14, marginBottom: 10,
  },
  groupInfo: { flex: 1 },
  groupName: { fontSize: 16, fontWeight: '700', color: Colors.text },
  groupDesc: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40, marginTop: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.text },
  emptyText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    backgroundColor: Colors.primary, paddingHorizontal: 24,
    paddingVertical: 12, borderRadius: 12, marginTop: 8,
  },
  emptyBtnText: { color: Colors.background, fontWeight: '700', fontSize: 15 },
});
