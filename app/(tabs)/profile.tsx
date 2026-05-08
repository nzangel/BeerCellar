import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { uploadImage } from '../../lib/storage';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';

export default function ProfileScreen() {
  const { profile, session, signOut, refreshProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(profile?.username ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  const [stats, setStats] = useState({ beers: 0, rating: 0 });

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      supabase
        .from('cellar_entries')
        .select('quantity, rating')
        .eq('user_id', session.user.id)
        .then(({ data }) => {
          if (!data) return;
          const beers = data.reduce((acc, e) => acc + (e.quantity ?? 0), 0);
          const rated = data.filter((e) => e.rating != null);
          const rating = rated.length > 0
            ? rated.reduce((acc, e) => acc + e.rating, 0) / rated.length
            : 0;
          setStats({ beers, rating });
        });
    }, [session])
  );

  const handleSave = async () => {
    if (!session) return;
    setSaving(true);

    let avatarUrl = profile?.avatar_url ?? null;

    if (avatarUri) {
      const { url, error } = await uploadImage(avatarUri, 'avatars', `${session.user.id}/avatar`);
      if (error) Alert.alert('Erreur upload avatar', error);
      if (url) avatarUrl = url;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ username: username.trim(), bio: bio.trim() || null, avatar_url: avatarUrl })
      .eq('id', session.user.id);

    setSaving(false);
    if (error) {
      Alert.alert('Erreur', error.message.includes('unique') ? 'Ce pseudo est déjà pris.' : error.message);
    } else {
      await refreshProfile();
      setEditing(false);
    }
  };

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) setAvatarUri(result.assets[0].uri);
  };

  const handleSignOut = () => {
    Alert.alert('Déconnexion', 'Es-tu sûr de vouloir te déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnecter', style: 'destructive', onPress: signOut },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Supprimer mon compte',
      'Cette action est irréversible. Ton profil, ta cave, tes notes et toutes tes données seront définitivement effacés.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Dernière confirmation',
              'Es-tu vraiment sûr ? Toutes tes données seront perdues.',
              [
                { text: 'Annuler', style: 'cancel' },
                {
                  text: 'Oui, supprimer',
                  style: 'destructive',
                  onPress: async () => {
                    const { error } = await supabase.rpc('delete_user');
                    if (error) {
                      Alert.alert('Erreur', 'Impossible de supprimer le compte. Contacte le support.');
                    } else {
                      await signOut();
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const displayAvatar = avatarUri ?? profile?.avatar_url;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Profil</Text>
        <View style={styles.headerActions}>
          {editing ? (
            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            >
              {saving
                ? <ActivityIndicator size="small" color={Colors.background} />
                : <Text style={styles.saveBtnText}>Sauver</Text>}
            </Pressable>
          ) : (
            <Pressable onPress={() => setEditing(true)}>
              <Ionicons name="create-outline" size={24} color={Colors.primary} />
            </Pressable>
          )}
          <Pressable onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={24} color={Colors.error} />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {/* Avatar */}
          <View style={styles.avatarSection}>
            <Pressable onPress={editing ? pickAvatar : undefined}>
              {displayAvatar ? (
                <Image source={{ uri: displayAvatar }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={40} color={Colors.textDim} />
                </View>
              )}
              {editing && (
                <View style={styles.avatarEditOverlay}>
                  <Ionicons name="camera" size={20} color={Colors.white} />
                </View>
              )}
            </Pressable>
            {!editing ? (
              <>
                <Text style={styles.username}>@{profile?.username}</Text>
                {profile?.bio && <Text style={styles.bio}>{profile.bio}</Text>}
                <Text style={styles.email}>{session?.user.email}</Text>
              </>
            ) : (
              <View style={styles.editFields}>
                <Text style={styles.label}>Pseudo</Text>
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={setUsername}
                  placeholder="monpseudo"
                  placeholderTextColor={Colors.textDim}
                  autoCapitalize="none"
                />
                <Text style={styles.label}>Bio</Text>
                <TextInput
                  style={[styles.input, styles.textarea]}
                  value={bio}
                  onChangeText={setBio}
                  placeholder="Passionné de bières artisanales…"
                  placeholderTextColor={Colors.textDim}
                  multiline
                  numberOfLines={3}
                />
              </View>
            )}
          </View>

          {/* Stats */}
          {!editing && (
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Ionicons name="wine" size={24} color={Colors.primary} />
                <Text style={styles.statValue}>{stats.beers}</Text>
                <Text style={styles.statLabel}>Bières</Text>
              </View>
              <View style={[styles.statBox, styles.statBoxBorder]}>
                <Ionicons name="star" size={24} color={Colors.primary} />
                <Text style={styles.statValue}>
                  {stats.rating > 0 ? stats.rating.toFixed(1) : '—'}
                </Text>
                <Text style={styles.statLabel}>Moy. notes</Text>
              </View>
              <View style={styles.statBox}>
                <Ionicons name="calendar" size={24} color={Colors.primary} />
                <Text style={styles.statValue}>
                  {profile?.created_at
                    ? new Date(profile.created_at).getFullYear()
                    : '—'}
                </Text>
                <Text style={styles.statLabel}>Membre depuis</Text>
              </View>
            </View>
          )}

          {/* About */}
          {!editing && (
            <View style={styles.infoSection}>
              <View style={styles.infoRow}>
                <Ionicons name="mail-outline" size={20} color={Colors.textMuted} />
                <Text style={styles.infoText}>{session?.user.email}</Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="calendar-outline" size={20} color={Colors.textMuted} />
                <Text style={styles.infoText}>
                  Membre depuis{' '}
                  {profile?.created_at
                    ? new Date(profile.created_at).toLocaleDateString('fr-FR', {
                        month: 'long', year: 'numeric',
                      })
                    : '—'}
                </Text>
              </View>
            </View>
          )}

          {/* Danger zone */}
          {!editing && (
            <View style={styles.dangerSection}>
              <Pressable style={styles.signOutBtn} onPress={handleSignOut}>
                <Ionicons name="log-out-outline" size={20} color={Colors.error} />
                <Text style={styles.signOutText}>Se déconnecter</Text>
              </Pressable>
              <Pressable style={styles.deleteAccountBtn} onPress={handleDeleteAccount}>
                <Ionicons name="trash-outline" size={18} color={Colors.textDim} />
                <Text style={styles.deleteAccountText}>Supprimer mon compte</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  saveBtn: {
    backgroundColor: Colors.primary, paddingHorizontal: 16,
    paddingVertical: 8, borderRadius: 10, minWidth: 64, alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: Colors.background, fontWeight: '700', fontSize: 14 },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 20 },
  avatarSection: { alignItems: 'center', gap: 10 },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarPlaceholder: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: Colors.surface, borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarEditOverlay: {
    ...StyleSheet.absoluteFillObject, borderRadius: 50,
    backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center',
  },
  username: { fontSize: 22, fontWeight: '800', color: Colors.text },
  bio: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  email: { fontSize: 13, color: Colors.textDim },
  editFields: { width: '100%', gap: 10, marginTop: 8 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  input: {
    backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1,
    borderColor: Colors.border, paddingHorizontal: 16, paddingVertical: 12,
    color: Colors.text, fontSize: 15,
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  statsRow: {
    flexDirection: 'row', backgroundColor: Colors.surface,
    borderRadius: 16, borderWidth: 1, borderColor: Colors.border,
  },
  statBox: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 18 },
  statBoxBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: Colors.border },
  statValue: { fontSize: 20, fontWeight: '800', color: Colors.text },
  statLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  infoSection: {
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  infoText: { fontSize: 14, color: Colors.text },
  dangerSection: { marginTop: 8 },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1,
    borderColor: Colors.border, padding: 14,
  },
  signOutText: { fontSize: 15, color: Colors.error, fontWeight: '600' },
  deleteAccountBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, padding: 14, marginTop: 8,
  },
  deleteAccountText: { fontSize: 14, color: Colors.textDim },
});
