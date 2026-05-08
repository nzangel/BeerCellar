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
import { GroupMember, TastingGroup } from '../../types';

export default function GroupScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();

  const [group, setGroup] = useState<TastingGroup | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => { fetchAll(); }, [id]);

  const fetchAll = async () => {
    const [{ data: g }, { data: m }] = await Promise.all([
      supabase.from('tasting_groups').select('*').eq('id', id).single(),
      supabase.from('group_members').select('*, profile:profiles(*)').eq('group_id', id),
    ]);

    if (g) setGroup(g as TastingGroup);
    if (m) {
      setMembers(m as GroupMember[]);
      setIsAdmin(m.some((mem: any) => mem.user_id === session?.user.id && mem.role === 'admin'));
    }
    setLoading(false);
  };

  const addMember = async () => {
    Alert.prompt(
      'Inviter un membre',
      'Entrez le pseudo de l\'utilisateur à inviter :',
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

  const removeMember = (userId: string, username: string) => {
    if (userId === session?.user.id) return leaveGroup();
    Alert.alert('Retirer le membre', `Retirer @${username} du groupe ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Retirer',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('group_members').delete().eq('group_id', id).eq('user_id', userId);
          fetchAll();
        },
      },
    ]);
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

      {/* Liste des membres */}
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
            {/* Voir la cave */}
            <Pressable
              style={styles.actionBtn}
              onPress={() => router.push(`/user/${item.user_id}`)}
            >
              <Ionicons name="wine-outline" size={18} color={Colors.primary} />
            </Pressable>
            {/* Retirer (admin seulement, pas sur soi-même sauf pour quitter) */}
            {isAdmin && item.user_id !== session?.user.id && (
              <Pressable
                style={[styles.actionBtn, styles.actionBtnDanger]}
                onPress={() => removeMember(item.user_id, (item.profile as any)?.username ?? '')}
              >
                <Ionicons name="person-remove-outline" size={18} color={Colors.error} />
              </Pressable>
            )}
          </View>
        )}
        ListHeaderComponent={
          isAdmin ? (
            <Pressable style={styles.inviteBtn} onPress={addMember}>
              <Ionicons name="person-add-outline" size={20} color={Colors.primary} />
              <Text style={styles.inviteBtnText}>Inviter un membre</Text>
            </Pressable>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Aucun membre</Text>
          </View>
        }
        contentContainerStyle={{ padding: 20 }}
      />
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
  inviteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1,
    borderColor: Colors.primary, borderStyle: 'dashed',
    padding: 14, marginBottom: 16,
  },
  inviteBtnText: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
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
  actionBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surfaceLight, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  actionBtnDanger: { borderColor: Colors.error },
  empty: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: Colors.textMuted, fontSize: 14 },
});
