import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Avatar from '../../components/Avatar';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { GroupMember, GroupSession, TastingGroup } from '../../types';

export default function GroupScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, profile } = useAuth();

  const [group, setGroup] = useState<TastingGroup | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [sessions, setSessions] = useState<GroupSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState<'sessions' | 'membres'>('sessions');

  useEffect(() => { fetchAll(); }, [id]);

  const fetchAll = async () => {
    const [{ data: g }, { data: m }, { data: s }] = await Promise.all([
      supabase.from('tasting_groups').select('*').eq('id', id).single(),
      supabase.from('group_members').select('*, profile:profiles(*)').eq('group_id', id),
      supabase.from('group_sessions').select('*').eq('group_id', id).order('scheduled_at', { ascending: true }),
    ]);

    if (g) setGroup(g as TastingGroup);
    if (m) {
      setMembers(m as GroupMember[]);
      setIsAdmin(m.some((mem: any) => mem.user_id === session?.user.id && mem.role === 'admin'));
    }
    if (s) setSessions(s as GroupSession[]);
    setLoading(false);
  };

  const addMember = async () => {
    Alert.prompt(
      'Inviter un membre',
      'Entrez le pseudo de l\'utilisateur à inviter:',
      async (username) => {
        if (!username?.trim()) return;
        const { data: user } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', username.trim())
          .single();

        if (!user) {
          Alert.alert('Introuvable', `Aucun utilisateur avec le pseudo "${username}".`);
          return;
        }

        const { error } = await supabase.from('group_members').insert({
          group_id: id,
          user_id: user.id,
          role: 'member',
        });

        if (error) {
          Alert.alert('Erreur', 'Cet utilisateur est peut-être déjà membre.');
        } else {
          fetchAll();
        }
      }
    );
  };

  const createSession = async () => {
    Alert.prompt(
      'Nouvelle session',
      'Titre de la session de dégustation:',
      async (title) => {
        if (!title?.trim() || !session) return;
        const { error } = await supabase.from('group_sessions').insert({
          group_id: id,
          title: title.trim(),
          created_by: session.user.id,
        });
        if (!error) fetchAll();
      }
    );
  };

  const leaveGroup = () => {
    Alert.alert('Quitter le groupe', `Quitter "${group?.name}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Quitter',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('group_members')
            .delete()
            .eq('group_id', id)
            .eq('user_id', session?.user.id ?? '');
          router.back();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Pressable onPress={leaveGroup}>
          <Ionicons name="exit-outline" size={24} color={Colors.error} />
        </Pressable>
      </View>

      {/* Group hero */}
      <View style={styles.groupHero}>
        <Avatar uri={group?.avatar_url} name={group?.name} size={72} />
        <Text style={styles.groupName}>{group?.name}</Text>
        {group?.description && <Text style={styles.groupDesc}>{group.description}</Text>}
        <Text style={styles.memberCount}>{members.length} membre{members.length !== 1 ? 's' : ''}</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(['sessions', 'membres'] as const).map((t) => (
          <Pressable
            key={t}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'sessions' ? `Sessions (${sessions.length})` : `Membres (${members.length})`}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'sessions' ? (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.sessionCard}>
              <View style={styles.sessionIcon}>
                <Ionicons name="wine" size={24} color={Colors.primary} />
              </View>
              <View style={styles.sessionInfo}>
                <Text style={styles.sessionTitle}>{item.title}</Text>
                {item.scheduled_at && (
                  <Text style={styles.sessionDate}>
                    {new Date(item.scheduled_at).toLocaleDateString('fr-FR', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </Text>
                )}
                {item.description && (
                  <Text style={styles.sessionDesc} numberOfLines={2}>{item.description}</Text>
                )}
              </View>
            </View>
          )}
          ListHeaderComponent={
            isAdmin ? (
              <Pressable style={styles.createSessionBtn} onPress={createSession}>
                <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
                <Text style={styles.createSessionText}>Nouvelle session de dégustation</Text>
              </Pressable>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="wine-outline" size={48} color={Colors.textDim} />
              <Text style={styles.emptyText}>Aucune session planifiée</Text>
            </View>
          }
          contentContainerStyle={{ padding: 20 }}
        />
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item) => item.user_id}
          renderItem={({ item }) => (
            <View style={styles.memberRow}>
              <Avatar uri={(item.profile as any)?.avatar_url} name={(item.profile as any)?.username} size={44} />
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>@{(item.profile as any)?.username}</Text>
                {item.role === 'admin' && (
                  <View style={styles.adminBadge}>
                    <Text style={styles.adminBadgeText}>Admin</Text>
                  </View>
                )}
              </View>
            </View>
          )}
          ListHeaderComponent={
            isAdmin ? (
              <Pressable style={styles.createSessionBtn} onPress={addMember}>
                <Ionicons name="person-add-outline" size={20} color={Colors.primary} />
                <Text style={styles.createSessionText}>Inviter un membre</Text>
              </Pressable>
            ) : null
          }
          contentContainerStyle={{ padding: 20 }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12,
  },
  groupHero: { alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20, gap: 6 },
  groupName: { fontSize: 22, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  groupDesc: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  memberCount: { fontSize: 13, color: Colors.textDim },
  tabRow: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 4, gap: 8 },
  tabBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 12,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  tabTextActive: { color: Colors.background },
  createSessionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1,
    borderColor: Colors.primary, borderStyle: 'dashed',
    padding: 14, marginBottom: 12,
  },
  createSessionText: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
  sessionCard: {
    flexDirection: 'row', gap: 12, backgroundColor: Colors.card,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.cardBorder,
    padding: 14, marginBottom: 10,
  },
  sessionIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.surfaceLight, alignItems: 'center', justifyContent: 'center',
  },
  sessionInfo: { flex: 1, gap: 4 },
  sessionTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  sessionDate: { fontSize: 12, color: Colors.primary },
  sessionDesc: { fontSize: 13, color: Colors.textMuted },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  memberInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  memberName: { fontSize: 15, fontWeight: '600', color: Colors.text },
  adminBadge: {
    backgroundColor: Colors.primary, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  adminBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.background },
  empty: { alignItems: 'center', gap: 12, marginTop: 40 },
  emptyText: { color: Colors.textMuted, fontSize: 14 },
});
