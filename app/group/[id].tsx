import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Pressable,
  SafeAreaView as SafeAreaViewRN,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Avatar from '../../components/Avatar';
import UserBadge from '../../components/UserBadge';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { uploadImage } from '../../lib/storage';
import BeerCard from '../../components/BeerCard';
import { CellarEntry, GroupMember, TastingGroup } from '../../types';

export default function GroupScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();

  const [group, setGroup] = useState<TastingGroup | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState<'membres' | 'bieres'>('membres');
  const [inviteModal, setInviteModal] = useState(false);
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [friends, setFriends] = useState<Array<{ id: string; username: string; avatar_url: string | null }>>([]);
  const [groupBeers, setGroupBeers] = useState<(CellarEntry & {
    ownerUsername: string;
    ownerAvatar: string | null;
    cellarName: string | null;
    cellarEmoji: string | null;
  })[]>([]);
  const [filterMemberId, setFilterMemberId] = useState<string | null>(null);
  const [beersLoading, setBeersLoading] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAvatarUri, setEditAvatarUri] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [memberActionModal, setMemberActionModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<GroupMember | null>(null);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanResult, setScanResult] = useState<
    { found: true; entry: CellarEntry & { ownerUsername: string; ownerAvatar: string | null; cellarName: string | null; cellarEmoji: string | null } } |
    { found: false; barcode: string } |
    null
  >(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const scanCooldown = useRef(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  const HERO_HEIGHT = 160;
  const heroOpacity = scrollY.interpolate({ inputRange: [0, HERO_HEIGHT * 0.6], outputRange: [1, 0], extrapolate: 'clamp' });
  const heroHeight = scrollY.interpolate({ inputRange: [0, HERO_HEIGHT], outputRange: [HERO_HEIGHT, 0], extrapolate: 'clamp' });
  const heroTranslate = scrollY.interpolate({ inputRange: [0, HERO_HEIGHT], outputRange: [0, -16], extrapolate: 'clamp' });

  useEffect(() => { fetchAll(); }, [id]);

  const fetchAll = async () => {
    const [{ data: g }, { data: m }] = await Promise.all([
      supabase.from('tasting_groups').select('*').eq('id', id).single(),
      supabase.from('group_members').select('*, profile:profiles(*)').eq('group_id', id),
    ]);

    if (g) setGroup(g as TastingGroup);
    const fetchedMembers = (m ?? []) as GroupMember[];
    if (m) {
      setMembers(fetchedMembers);
      setIsAdmin(m.some((mem: any) => mem.user_id === session?.user.id && mem.role === 'admin'));
    }

    // Charger la liste des amis
    if (session) {
      const { data: fData } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id')
        .or(`requester_id.eq.${session.user.id},addressee_id.eq.${session.user.id}`)
        .eq('status', 'accepted');

      if (fData && fData.length > 0) {
        const friendIds = fData.map((f) =>
          f.requester_id === session.user.id ? f.addressee_id : f.requester_id
        );
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', friendIds);
        setFriends(profiles ?? []);
      }
    }

    setLoading(false);
    // Charger les bières en arrière-plan pour que le compteur soit disponible dès le départ
    fetchGroupBeers(fetchedMembers);
  };

  const fetchGroupBeers = async (currentMembers: GroupMember[]) => {
    if (currentMembers.length === 0) return;
    setBeersLoading(true);

    const memberIds = currentMembers.map((m) => m.user_id);
    const { data } = await supabase
      .from('cellar_entries')
      .select('*, beer:beers(*), cellar:cellars(name, emoji, is_public)')
      .in('user_id', memberIds)
      .order('added_at', { ascending: false });

    if (data) {
      const profileMap = new Map(
        currentMembers.map((m) => [
          m.user_id,
          { username: (m.profile as any)?.username ?? '?', avatar_url: (m.profile as any)?.avatar_url ?? null },
        ])
      );
      setGroupBeers(
        (data as any[])
          .filter((entry) => entry.cellar?.is_public === true)
          .map((entry) => ({
            ...entry,
            ownerUsername: profileMap.get(entry.user_id)?.username ?? '?',
            ownerAvatar: profileMap.get(entry.user_id)?.avatar_url ?? null,
            cellarName: entry.cellar?.name ?? null,
            cellarEmoji: entry.cellar?.emoji ?? null,
          }))
      );
      setFilterMemberId(null);
    }
    setBeersLoading(false);
  };

  useEffect(() => {
    scrollY.setValue(0);
  }, [tab]);

  const openScanner = async () => {
    if (!cameraPermission?.granted) {
      const { granted } = await requestCameraPermission();
      if (!granted) return;
    }
    scanCooldown.current = false;
    setScannerVisible(true);
  };

  const handleScanBarcode = ({ data: barcode }: { data: string }) => {
    if (scanCooldown.current) return;
    scanCooldown.current = true;
    setScannerVisible(false);

    const found = groupBeers.find((e) => e.beer?.barcode === barcode);
    if (found) {
      setScanResult({ found: true, entry: found });
    } else {
      setScanResult({ found: false, barcode });
    }
  };

  const addMember = async (directUserId?: string) => {
    setInviteLoading(true);

    let targetUserId = directUserId;

    if (!targetUserId) {
      if (!inviteUsername.trim()) { setInviteLoading(false); return; }
      const { data: user } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', inviteUsername.trim())
        .single();

      if (!user) {
        setInviteLoading(false);
        Alert.alert('Introuvable', `Aucun utilisateur avec le pseudo "@${inviteUsername}".`);
        return;
      }
      targetUserId = user.id;
    }

    const { error } = await supabase.from('group_members').insert({
      group_id: id,
      user_id: targetUserId,
      role: 'member',
    });

    setInviteLoading(false);

    if (error) {
      Alert.alert('Erreur', 'Cet utilisateur est peut-être déjà membre.');
    } else {
      setInviteModal(false);
      setInviteUsername('');
      fetchAll();
    }
  };

  const removeMember = (userId: string, username: string) => {
    if (userId === session?.user.id) return leaveGroup();
    Alert.alert('Retirer le membre', `Retirer @${username} du groupe ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Retirer',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase
            .from('group_members')
            .delete()
            .eq('group_id', id)
            .eq('user_id', userId);
          if (error) {
            Alert.alert('Erreur', error.message);
          } else {
            fetchAll();
          }
        },
      },
    ]);
  };

  const toggleAdmin = (userId: string, username: string, currentRole: string) => {
    const isPromoting = currentRole !== 'admin';
    const adminCount = members.filter((m) => m.role === 'admin').length;

    if (!isPromoting && adminCount <= 1) {
      Alert.alert('Action impossible', 'Il doit rester au moins un admin dans le groupe.');
      return;
    }

    const newRole = isPromoting ? 'admin' : 'member';
    const title = isPromoting ? `Nommer admin` : `Retirer le rôle admin`;
    const message = isPromoting
      ? `Nommer @${username} administrateur du groupe ?`
      : `Retirer le rôle admin à @${username} ?`;

    Alert.alert(title, message, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: isPromoting ? 'Nommer admin' : 'Rétrograder',
        onPress: async () => {
          const { error } = await supabase
            .from('group_members')
            .update({ role: newRole })
            .eq('group_id', id)
            .eq('user_id', userId);
          if (error) Alert.alert('Erreur', error.message);
          else fetchAll();
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

  const openEditModal = () => {
    setEditName(group?.name ?? '');
    setEditDescription(group?.description ?? '');
    setEditAvatarUri(null);
    setEditModal(true);
  };

  const pickGroupAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setEditAvatarUri(result.assets[0].uri);
    }
  };

  const saveGroup = async () => {
    if (!editName.trim()) return;
    setEditSaving(true);

    let avatarUrl = group?.avatar_url ?? null;
    if (editAvatarUri) {
      const { url, error } = await uploadImage(editAvatarUri, 'avatars', `groups/${id}/avatar`);
      if (error) Alert.alert('Erreur upload image', error);
      if (url) avatarUrl = url;
    }

    const { error } = await supabase
      .from('tasting_groups')
      .update({ name: editName.trim(), description: editDescription.trim() || null, avatar_url: avatarUrl })
      .eq('id', id);

    setEditSaving(false);
    if (error) {
      Alert.alert('Erreur', error.message);
    } else {
      setEditModal(false);
      fetchAll();
    }
  };

  const filteredGroupBeers = filterMemberId
    ? groupBeers.filter((e) => e.user_id === filterMemberId)
    : groupBeers;

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
        <View style={styles.headerRight}>
          {isAdmin && (
            <Pressable onPress={openEditModal} style={styles.headerBtn}>
              <Ionicons name="create-outline" size={22} color={Colors.primary} />
            </Pressable>
          )}
          <Pressable onPress={leaveGroup} style={styles.headerBtn}>
            <Ionicons name="exit-outline" size={24} color={Colors.error} />
          </Pressable>
        </View>
      </View>

      {/* Group hero — se rétracte au scroll */}
      <Animated.View style={[styles.groupHero, { height: heroHeight, opacity: heroOpacity, transform: [{ translateY: heroTranslate }], overflow: 'hidden' }]}>
        <Avatar uri={group?.avatar_url} name={group?.name} size={72} />
        <Text style={styles.groupName}>{group?.name}</Text>
        {group?.description && <Text style={styles.groupDesc}>{group.description}</Text>}
        <Text style={styles.memberCount}>{members.length} membre{members.length !== 1 ? 's' : ''}</Text>
      </Animated.View>

      {/* Scanner caméra */}
      <Modal visible={scannerVisible} animationType="slide" onRequestClose={() => setScannerVisible(false)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            onBarcodeScanned={handleScanBarcode}
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'] }}
          />
          <SafeAreaViewRN style={styles.scannerOverlay}>
            <Pressable style={styles.scannerClose} onPress={() => setScannerVisible(false)}>
              <Ionicons name="close" size={28} color="#fff" />
            </Pressable>
            <View style={styles.scannerFrame}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
            <Text style={styles.scannerHint}>Scanne le code-barres pour rechercher une bière dans le groupe</Text>
          </SafeAreaViewRN>
        </View>
      </Modal>

      {/* Résultat du scan */}
      <Modal
        visible={scanResult !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setScanResult(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setScanResult(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            {scanResult?.found ? (
              <>
                <View style={styles.scanResultHeader}>
                  <Ionicons name="checkmark-circle" size={32} color={Colors.success} />
                  <Text style={styles.scanResultTitle}>Trouvée dans le groupe !</Text>
                </View>
                <View style={styles.scanResultOwner}>
                  <Avatar uri={scanResult.entry.ownerAvatar} name={scanResult.entry.ownerUsername} size={28} />
                  <Text style={styles.scanResultOwnerName}>Cave de @{scanResult.entry.ownerUsername}</Text>
                </View>
                <View style={styles.scanResultBeer}>
                  <Text style={styles.scanResultBeerName}>{scanResult.entry.beer?.name ?? 'Bière'}</Text>
                  {scanResult.entry.beer?.brewery && (
                    <Text style={styles.scanResultBeerBrewery}>{scanResult.entry.beer.brewery}</Text>
                  )}
                  <View style={styles.scanResultMeta}>
                    {scanResult.entry.beer?.style && (
                      <Text style={styles.scanResultStyle}>{scanResult.entry.beer.style}</Text>
                    )}
                    {scanResult.entry.beer?.abv != null && (
                      <Text style={styles.scanResultAbv}>{scanResult.entry.beer.abv}%</Text>
                    )}
                  </View>
                </View>
                <Pressable style={styles.scanResultBtn} onPress={() => {
                  setScanResult(null);
                  router.push(`/user/${scanResult.entry.user_id}`);
                }}>
                  <Ionicons name="wine-outline" size={16} color={Colors.background} />
                  <Text style={styles.scanResultBtnText}>Voir sa cave</Text>
                </Pressable>
              </>
            ) : (
              <>
                <View style={styles.scanResultHeader}>
                  <Ionicons name="close-circle" size={32} color={Colors.error} />
                  <Text style={styles.scanResultTitle}>Absente du groupe</Text>
                </View>
                <Text style={styles.scanResultAbsentText}>
                  Aucun membre du groupe n'a cette bière dans sa cave.
                </Text>
                <Pressable style={[styles.scanResultBtn, styles.scanResultBtnClose]} onPress={() => setScanResult(null)}>
                  <Text style={styles.scanResultBtnCloseText}>Fermer</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tabBtn, tab === 'membres' && styles.tabBtnActive]}
          onPress={() => setTab('membres')}
        >
          <Ionicons name="people-outline" size={16} color={tab === 'membres' ? Colors.background : Colors.textMuted} />
          <Text style={[styles.tabText, tab === 'membres' && styles.tabTextActive]}>
            Membres ({members.length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabBtn, tab === 'bieres' && styles.tabBtnActive]}
          onPress={() => setTab('bieres')}
        >
          <Ionicons name="beer-outline" size={16} color={tab === 'bieres' ? Colors.background : Colors.textMuted} />
          <Text style={[styles.tabText, tab === 'bieres' && styles.tabTextActive]}>
            Bières ({groupBeers.length})
          </Text>
        </Pressable>
        {tab === 'bieres' && (
          <Pressable style={styles.scanBtn} onPress={openScanner}>
            <Ionicons name="barcode-outline" size={22} color={Colors.primary} />
          </Pressable>
        )}
      </View>

      {/* Modal invitation */}
      <Modal
        visible={inviteModal}
        transparent
        animationType="fade"
        onRequestClose={() => { setInviteModal(false); setInviteUsername(''); }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => { setInviteModal(false); setInviteUsername(''); }}
        >
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Inviter un membre</Text>

            {/* Champ de recherche */}
            <View style={styles.modalSearchBox}>
              <Ionicons name="search" size={16} color={Colors.textMuted} />
              <TextInput
                style={styles.modalInput}
                value={inviteUsername}
                onChangeText={setInviteUsername}
                placeholder="Rechercher un ami…"
                placeholderTextColor={Colors.textDim}
                autoCapitalize="none"
                autoFocus
              />
              {inviteUsername.length > 0 && (
                <Pressable onPress={() => setInviteUsername('')}>
                  <Ionicons name="close-circle" size={16} color={Colors.textDim} />
                </Pressable>
              )}
            </View>

            {/* Suggestions d'amis */}
            {(() => {
              const memberIds = new Set(members.map((m) => m.user_id));
              const suggestions = friends.filter(
                (f) =>
                  !memberIds.has(f.id) &&
                  (inviteUsername === '' ||
                    f.username.toLowerCase().includes(inviteUsername.toLowerCase()))
              );
              if (suggestions.length === 0 && inviteUsername === '') return null;
              return (
                <View style={styles.suggestionsBox}>
                  {suggestions.length > 0 ? (
                    <ScrollView style={{ maxHeight: 220 }} keyboardShouldPersistTaps="handled">
                      {suggestions.map((friend) => (
                        <Pressable
                          key={friend.id}
                          style={styles.suggestionRow}
                          onPress={() => addMember(friend.id)}
                        >
                          <Avatar uri={friend.avatar_url} name={friend.username} size={36} />
                          <Text style={styles.suggestionName}>@{friend.username}</Text>
                          <Ionicons name="person-add-outline" size={18} color={Colors.primary} />
                        </Pressable>
                      ))}
                    </ScrollView>
                  ) : (
                    <View style={styles.suggestionsEmpty}>
                      <Text style={styles.suggestionsEmptyText}>Aucun ami trouvé</Text>
                    </View>
                  )}
                </View>
              );
            })()}

            {/* Actions */}
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => { setInviteModal(false); setInviteUsername(''); }}
              >
                <Text style={styles.modalCancelText}>Annuler</Text>
              </Pressable>
              <Pressable
                style={[styles.modalConfirmBtn, (!inviteUsername.trim() || inviteLoading) && styles.modalConfirmDisabled]}
                onPress={() => addMember()}
                disabled={!inviteUsername.trim() || inviteLoading}
              >
                {inviteLoading
                  ? <ActivityIndicator size="small" color={Colors.background} />
                  : <Text style={styles.modalConfirmText}>Inviter</Text>
                }
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal édition du groupe */}
      <Modal
        visible={editModal}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setEditModal(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Modifier le groupe</Text>

            {/* Avatar */}
            <Pressable style={styles.editAvatarWrapper} onPress={pickGroupAvatar}>
              {editAvatarUri ?? group?.avatar_url ? (
                <Image
                  source={{ uri: editAvatarUri ?? group?.avatar_url ?? '' }}
                  style={styles.editAvatar}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.editAvatarPlaceholder}>
                  <Ionicons name="people" size={36} color={Colors.textDim} />
                </View>
              )}
              <View style={styles.editAvatarOverlay}>
                <Ionicons name="camera" size={20} color="#fff" />
              </View>
            </Pressable>

            {/* Nom */}
            <View style={styles.modalSearchBox}>
              <Ionicons name="people-outline" size={16} color={Colors.textMuted} />
              <TextInput
                style={styles.modalInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Nom du groupe"
                placeholderTextColor={Colors.textDim}
                autoCapitalize="words"
                maxLength={50}
              />
            </View>

            {/* Description */}
            <View style={[styles.modalSearchBox, styles.modalTextAreaBox]}>
              <Ionicons name="text-outline" size={16} color={Colors.textMuted} style={{ marginTop: 2 }} />
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder="Description (optionnelle)"
                placeholderTextColor={Colors.textDim}
                autoCapitalize="sentences"
                maxLength={200}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setEditModal(false)}
              >
                <Text style={styles.modalCancelText}>Annuler</Text>
              </Pressable>
              <Pressable
                style={[styles.modalConfirmBtn, (!editName.trim() || editSaving) && styles.modalConfirmDisabled]}
                onPress={saveGroup}
                disabled={!editName.trim() || editSaving}
              >
                {editSaving
                  ? <ActivityIndicator size="small" color={Colors.background} />
                  : <Text style={styles.modalConfirmText}>Enregistrer</Text>
                }
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal actions membre (appui long) */}
      <Modal
        visible={memberActionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setMemberActionModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setMemberActionModal(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            {/* En-tête membre */}
            <View style={styles.memberActionHeader}>
              <Avatar
                uri={(selectedMember?.profile as any)?.avatar_url}
                name={(selectedMember?.profile as any)?.username}
                size={48}
              />
              <View>
                <Text style={styles.memberActionName}>@{(selectedMember?.profile as any)?.username}</Text>
                <Text style={styles.memberActionRole}>
                  {selectedMember?.role === 'admin' ? '🛡️ Administrateur' : 'Membre'}
                </Text>
              </View>
            </View>

            <View style={styles.memberActionDivider} />

            {/* Voir la cave */}
            <Pressable
              style={styles.memberActionBtn}
              onPress={() => {
                setMemberActionModal(false);
                router.push(`/user/${selectedMember?.user_id}`);
              }}
            >
              <Ionicons name="wine-outline" size={20} color={Colors.primary} />
              <Text style={styles.memberActionBtnText}>Voir sa cave</Text>
            </Pressable>

            {/* Promouvoir / Rétrograder */}
            <Pressable
              style={styles.memberActionBtn}
              onPress={() => {
                setMemberActionModal(false);
                if (selectedMember) {
                  toggleAdmin(
                    selectedMember.user_id,
                    (selectedMember.profile as any)?.username ?? '',
                    selectedMember.role,
                  );
                }
              }}
            >
              <Ionicons
                name={selectedMember?.role === 'admin' ? 'shield-outline' : 'shield'}
                size={20}
                color={Colors.primary}
              />
              <Text style={styles.memberActionBtnText}>
                {selectedMember?.role === 'admin' ? 'Retirer le rôle admin' : 'Nommer administrateur'}
              </Text>
            </Pressable>

            {/* Retirer du groupe */}
            <Pressable
              style={[styles.memberActionBtn, styles.memberActionBtnDanger]}
              onPress={() => {
                setMemberActionModal(false);
                if (selectedMember) {
                  removeMember(
                    selectedMember.user_id,
                    (selectedMember.profile as any)?.username ?? '',
                  );
                }
              }}
            >
              <Ionicons name="person-remove-outline" size={20} color={Colors.error} />
              <Text style={[styles.memberActionBtnText, styles.memberActionBtnDangerText]}>
                Retirer du groupe
              </Text>
            </Pressable>

            <Pressable style={styles.modalCancelBtn} onPress={() => setMemberActionModal(false)}>
              <Text style={styles.modalCancelText}>Annuler</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {tab === 'membres' ? (
        /* Liste des membres */
        <Animated.FlatList
          data={members}
          keyExtractor={(item) => item.user_id}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
          scrollEventThrottle={16}
          renderItem={({ item }) => (
            <Pressable
              style={styles.memberRow}
              onPress={() => router.push(`/user/${item.user_id}`)}
              onLongPress={() => {
                if (isAdmin && item.user_id !== session?.user.id) {
                  setSelectedMember(item);
                  setMemberActionModal(true);
                }
              }}
              delayLongPress={350}
            >
              <Avatar uri={(item.profile as any)?.avatar_url} name={(item.profile as any)?.username} size={44} />
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>@{(item.profile as any)?.username}</Text>
                {(item.profile as any)?.badge && (
                  <UserBadge badge={(item.profile as any).badge} size={28} />
                )}
                {item.role === 'admin' && (
                  <View style={styles.adminBadge}>
                    <Text style={styles.adminBadgeText}>Admin</Text>
                  </View>
                )}
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.textDim} />
            </Pressable>
          )}
          ListHeaderComponent={
            isAdmin ? (
              <Pressable style={styles.inviteBtn} onPress={() => setInviteModal(true)}>
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
      ) : (
        /* Liste des bières du groupe */
        <Animated.FlatList
          data={filteredGroupBeers}
          keyExtractor={(item) => item.id}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
          scrollEventThrottle={16}
          renderItem={({ item }) => (
            <View>
              <View style={styles.beerOwnerRow}>
                <Avatar uri={item.ownerAvatar} name={item.ownerUsername} size={20} />
                <Text style={styles.beerOwnerName}>@{item.ownerUsername}</Text>
                {item.cellarEmoji != null && item.cellarName != null && (
                  <>
                    <Text style={styles.beerOwnerSep}>·</Text>
                    <Text style={styles.beerCellarTag}>
                      {item.cellarEmoji} {item.cellarName}
                    </Text>
                  </>
                )}
              </View>
              <BeerCard entry={item} readonly />
            </View>
          )}
          ListHeaderComponent={
            beersLoading ? (
              <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
            ) : members.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.memberFilterRow}
              >
                <Pressable
                  style={[styles.memberFilterChip, filterMemberId === null && styles.memberFilterChipActive]}
                  onPress={() => setFilterMemberId(null)}
                >
                  <Text style={[styles.memberFilterText, filterMemberId === null && styles.memberFilterTextActive]}>
                    Tous ({groupBeers.length})
                  </Text>
                </Pressable>
                {members.map((m) => {
                  const count = groupBeers.filter((e) => e.user_id === m.user_id).length;
                  const isActive = filterMemberId === m.user_id;
                  return (
                    <Pressable
                      key={m.user_id}
                      style={[styles.memberFilterChip, isActive && styles.memberFilterChipActive]}
                      onPress={() => setFilterMemberId(isActive ? null : m.user_id)}
                    >
                      <Avatar uri={(m.profile as any)?.avatar_url} name={(m.profile as any)?.username} size={20} />
                      <Text style={[styles.memberFilterText, isActive && styles.memberFilterTextActive]}>
                        @{(m.profile as any)?.username}
                      </Text>
                      <Text style={[styles.memberFilterCount, isActive && styles.memberFilterCountActive]}>
                        {count}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null
          }
          ListEmptyComponent={
            !beersLoading ? (
              <View style={styles.empty}>
                <Ionicons name="beer-outline" size={48} color={Colors.textDim} />
                <Text style={styles.emptyText}>
                  {filterMemberId ? 'Aucune bière pour ce membre' : 'Aucune bière dans le groupe'}
                </Text>
              </View>
            ) : null
          }
          onRefresh={() => fetchGroupBeers(members)}
          refreshing={beersLoading}
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
    paddingHorizontal: 20, paddingVertical: 12,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerBtn: { padding: 4 },
  editAvatarWrapper: { alignSelf: 'center', marginBottom: 20, position: 'relative' },
  editAvatar: { width: 84, height: 84, borderRadius: 42 },
  editAvatarPlaceholder: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: Colors.surfaceLight, borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  editAvatarOverlay: {
    ...StyleSheet.absoluteFillObject, borderRadius: 42,
    backgroundColor: 'rgba(0,0,0,0.40)', alignItems: 'center', justifyContent: 'center',
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
  actionBtnAdmin: { borderColor: Colors.primary },
  memberActionHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  memberActionName: { fontSize: 16, fontWeight: '700', color: Colors.text },
  memberActionRole: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  memberActionDivider: { height: 1, backgroundColor: Colors.border, marginBottom: 12 },
  memberActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  memberActionBtnText: { fontSize: 15, fontWeight: '600', color: Colors.text },
  memberActionBtnDanger: { borderBottomWidth: 0, marginTop: 4 },
  memberActionBtnDangerText: { color: Colors.error },
  tabRow: {
    flexDirection: 'row', marginHorizontal: 20, marginBottom: 8, gap: 8,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 12,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  tabBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  tabTextActive: { color: Colors.background },
  beerOwnerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap',
  },
  beerOwnerName: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  beerOwnerSep: { fontSize: 12, color: Colors.textDim },
  beerCellarTag: { fontSize: 12, color: Colors.textDim, fontWeight: '500' },
  memberFilterRow: { paddingBottom: 16, gap: 8, alignItems: 'center' },
  memberFilterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, height: 36, borderRadius: 18,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  memberFilterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  memberFilterText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  memberFilterTextActive: { color: Colors.background },
  memberFilterCount: {
    fontSize: 11, fontWeight: '700', color: Colors.textDim,
    backgroundColor: Colors.surfaceLight, borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 1,
  },
  memberFilterCountActive: { backgroundColor: 'rgba(255,255,255,0.25)', color: Colors.background },
  scanBtn: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  scannerOverlay: {
    flex: 1, backgroundColor: 'transparent',
    justifyContent: 'space-between', padding: 20,
  },
  scannerClose: {
    alignSelf: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20, padding: 6,
  },
  scannerFrame: {
    width: 220, height: 220, alignSelf: 'center',
    position: 'relative',
  },
  corner: {
    position: 'absolute', width: 28, height: 28,
    borderColor: '#fff', borderWidth: 3,
  },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 6 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 6 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 6 },
  scannerHint: {
    color: '#fff', textAlign: 'center', fontSize: 14,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  scanResultHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  scanResultTitle: { fontSize: 17, fontWeight: '800', color: Colors.text, flex: 1 },
  scanResultOwner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.surfaceLight, borderRadius: 10, padding: 10, marginBottom: 14,
  },
  scanResultOwnerName: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  scanResultBeer: { gap: 4, marginBottom: 16 },
  scanResultBeerName: { fontSize: 16, fontWeight: '700', color: Colors.text },
  scanResultBeerBrewery: { fontSize: 13, color: Colors.textMuted },
  scanResultMeta: { flexDirection: 'row', gap: 8, marginTop: 4 },
  scanResultStyle: {
    fontSize: 11, color: Colors.primary, backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden',
  },
  scanResultAbv: { fontSize: 11, color: Colors.textMuted, alignSelf: 'center' },
  scanResultBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 12,
  },
  scanResultBtnText: { color: Colors.background, fontWeight: '700', fontSize: 14 },
  scanResultAbsentText: {
    fontSize: 14, color: Colors.textMuted, textAlign: 'center',
    lineHeight: 20, marginBottom: 20,
  },
  scanResultBtnClose: { backgroundColor: Colors.surfaceLight },
  scanResultBtnCloseText: { color: Colors.textMuted, fontWeight: '700', fontSize: 14 },
  empty: { alignItems: 'center', marginTop: 40, gap: 10 },
  emptyText: { color: Colors.textMuted, fontSize: 14 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modalCard: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 24,
    width: '100%', maxWidth: 360,
    borderWidth: 1, borderColor: Colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 16 },
  modalSearchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.background, borderRadius: 12, borderWidth: 1,
    borderColor: Colors.border, paddingHorizontal: 12, marginBottom: 12,
  },
  modalInput: {
    flex: 1, color: Colors.text, fontSize: 15, paddingVertical: 12,
  },
  modalTextAreaBox: { alignItems: 'flex-start', paddingTop: 10 },
  modalTextArea: { paddingVertical: 0, minHeight: 64, textAlignVertical: 'top' },
  suggestionsBox: {
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.background, marginBottom: 16, overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  suggestionName: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.text },
  suggestionsEmpty: { paddingVertical: 16, alignItems: 'center' },
  suggestionsEmptyText: { fontSize: 13, color: Colors.textMuted },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: Colors.surfaceLight, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center',
  },
  modalCancelText: { color: Colors.textMuted, fontWeight: '600', fontSize: 14 },
  modalConfirmBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: Colors.primary, alignItems: 'center',
  },
  modalConfirmDisabled: { opacity: 0.4 },
  modalConfirmText: { color: Colors.background, fontWeight: '700', fontSize: 14 },
});
