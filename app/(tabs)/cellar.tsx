import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter, useFocusEffect } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView as SafeAreaViewRN } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';
import BeerCard from '../../components/BeerCard';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { Cellar, CellarEntry } from '../../types';

type SortOption = 'date' | 'rating' | 'name' | 'favorite';

const EMOJIS = ['🍺', '🍻', '🥃', '🍷', '🧊', '🌟', '🏆', '🔥', '🌿', '🎯'];

export default function CellarScreen() {
  const router = useRouter();
  const { session } = useAuth();

  const [cellars, setCellars] = useState<Cellar[]>([]);
  const [activeCellarId, setActiveCellarId] = useState<string | null>(null);
  const [entries, setEntries] = useState<CellarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('date');
  const [filterFavorites, setFilterFavorites] = useState(false);

  // Création de cave
  const [createModal, setCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('🍺');
  const [creating, setCreating] = useState(false);

  // Édition de cave (renommer / partager / supprimer)
  const [editModal, setEditModal] = useState(false);
  const [editingCellar, setEditingCellar] = useState<Cellar | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmoji, setEditEmoji] = useState('🍺');
  const [editIsPublic, setEditIsPublic] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  // Scanner
  const [scannerVisible, setScannerVisible] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const scanCooldown = useRef(false);

  const fetchAll = useCallback(async () => {
    if (!session) return;

    const [{ data: cellarData }, { data: entryData }] = await Promise.all([
      supabase.from('cellars').select('*').eq('user_id', session.user.id).order('created_at'),
      supabase.from('cellar_entries').select('*, beer:beers(*)').eq('user_id', session.user.id),
    ]);

    let finalCellars = (cellarData as Cellar[]) ?? [];

    // Créer une cave par défaut si l'utilisateur n'en a pas encore
    if (finalCellars.length === 0) {
      const { data: created } = await supabase
        .from('cellars')
        .insert({ user_id: session.user.id, name: 'Ma cave', emoji: '🍺', is_default: true })
        .select()
        .single();
      if (created) finalCellars = [created as Cellar];
    }

    setCellars(finalCellars);
    setActiveCellarId((prev) => prev ?? finalCellars[0]?.id ?? null);
    if (entryData) setEntries(entryData as CellarEntry[]);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      fetchAll().finally(() => setLoading(false));
    }, [fetchAll])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  const createCellar = async () => {
    if (!newName.trim() || !session) return;
    setCreating(true);
    const { data, error } = await supabase
      .from('cellars')
      .insert({ user_id: session.user.id, name: newName.trim(), emoji: newEmoji, is_default: false })
      .select()
      .single();
    setCreating(false);
    if (!error && data) {
      const newCellar = data as Cellar;
      setCellars((prev) => [...prev, newCellar]);
      setActiveCellarId(newCellar.id);
      setCreateModal(false);
      setNewName('');
      setNewEmoji('🍺');
    }
  };

  const openEditModal = (cellar: Cellar) => {
    setEditingCellar(cellar);
    setEditName(cellar.name);
    setEditEmoji(cellar.emoji);
    setEditIsPublic(cellar.is_public);
    setEditModal(true);
  };

  const closeEditModal = () => {
    setEditModal(false);
    setEditingCellar(null);
    setEditName('');
    setEditEmoji('🍺');
    setEditIsPublic(false);
  };

  const saveCellar = async () => {
    if (!editingCellar || !editName.trim()) return;
    setEditSaving(true);
    const { error } = await supabase
      .from('cellars')
      .update({ name: editName.trim(), emoji: editEmoji, is_public: editIsPublic })
      .eq('id', editingCellar.id);
    setEditSaving(false);
    if (!error) {
      setCellars((prev) =>
        prev.map((c) =>
          c.id === editingCellar.id
            ? { ...c, name: editName.trim(), emoji: editEmoji, is_public: editIsPublic }
            : c
        )
      );
      closeEditModal();
    }
  };

  const confirmDeleteCellar = () => {
    if (!editingCellar) return;
    const count = entries.filter((e) => e.cellar_id === editingCellar.id).length;
    Alert.alert(
      'Supprimer la cave',
      `Supprimer "${editingCellar.emoji} ${editingCellar.name}" ?${count > 0 ? `\n\nLes ${count} bière${count > 1 ? 's' : ''} qu'elle contient seront aussi supprimées.` : ''}`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('cellars').delete().eq('id', editingCellar.id);
            const remaining = cellars.filter((c) => c.id !== editingCellar.id);
            setCellars(remaining);
            setEntries((prev) => prev.filter((e) => e.cellar_id !== editingCellar.id));
            if (activeCellarId === editingCellar.id) setActiveCellarId(remaining[0]?.id ?? null);
            closeEditModal();
          },
        },
      ]
    );
  };

  // Entrées de la cave active
  const activeEntries = entries.filter((e) => e.cellar_id === activeCellarId);

  const filtered = activeEntries
    .filter((e) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        e.beer?.name.toLowerCase().includes(q) ||
        e.beer?.brewery?.toLowerCase().includes(q) ||
        e.beer?.style?.toLowerCase().includes(q) ||
        e.taste_tags.some((t) => t.toLowerCase().includes(q));
      const matchFav = !filterFavorites || e.is_favorite;
      return matchSearch && matchFav;
    })
    .sort((a, b) => {
      if (sort === 'rating') return (b.rating ?? 0) - (a.rating ?? 0);
      if (sort === 'name') return (a.beer?.name ?? '').localeCompare(b.beer?.name ?? '');
      if (sort === 'favorite') return (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0);
      return new Date(b.added_at).getTime() - new Date(a.added_at).getTime();
    });

  const totalBeers = activeEntries.reduce((acc, e) => acc + e.quantity, 0);
  const activeCellar = cellars.find((c) => c.id === activeCellarId);

  const openScanner = async () => {
    if (!cameraPermission?.granted) {
      const { granted } = await requestCameraPermission();
      if (!granted) return;
    }
    scanCooldown.current = false;
    setScannerVisible(true);
  };

  const handleScanBarcode = async ({ data: barcode }: { data: string }) => {
    if (scanCooldown.current) return;
    scanCooldown.current = true;
    setScannerVisible(false);

    const found = activeEntries.find((e) => e.beer?.barcode === barcode);
    if (found) { router.push(`/beer/${found.id}`); return; }

    const lookupBeer = async () => {
      const { data: globalBeer } = await supabase.from('beers').select('*').eq('barcode', barcode).maybeSingle();
      if (globalBeer) return { beerId: globalBeer.id, beerData: null };
      const { lookupBeerByBarcode } = await import('../../lib/beerApi');
      const data = await lookupBeerByBarcode(barcode);
      return { beerId: null, beerData: data ? { ...data, barcode } : null };
    };

    Alert.alert('Bière non trouvée', "Cette bière n'est pas dans cette cave. Tu veux l'ajouter ?", [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Ajouter',
        onPress: async () => {
          const { beerId, beerData } = await lookupBeer();
          const params: any = { cellarId: activeCellarId };
          if (beerId) params.beerId = beerId;
          else if (beerData) params.beerData = JSON.stringify(beerData);
          else params.barcode = barcode;
          router.push({ pathname: '/beer/add', params });
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>
            {activeCellar ? `${activeCellar.emoji} ${activeCellar.name}` : 'Ma Cave'}
          </Text>
          <Text style={styles.subtitle}>
            {activeEntries.length} bière{activeEntries.length !== 1 ? 's' : ''} · {totalBeers} exemplaire{totalBeers !== 1 ? 's' : ''}
          </Text>
        </View>
        <View style={styles.headerBtns}>
          <Pressable style={styles.scanBtn} onPress={openScanner}>
            <Ionicons name="barcode-outline" size={22} color={Colors.primary} />
          </Pressable>
          <Pressable
            style={styles.addBtn}
            onPress={() => router.push({ pathname: '/beer/add', params: { cellarId: activeCellarId } })}
          >
            <Ionicons name="add" size={24} color={Colors.background} />
          </Pressable>
        </View>
      </View>

      {/* Sélecteur de caves */}
      <View style={styles.cellarScrollWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cellarRow}
        >
          {cellars.map((cellar) => {
            const count = entries.filter((e) => e.cellar_id === cellar.id).length;
            const isActive = cellar.id === activeCellarId;
            return (
              <Pressable
                key={cellar.id}
                style={[styles.cellarChip, isActive && styles.cellarChipActive]}
                onPress={() => setActiveCellarId(cellar.id)}
                onLongPress={() => openEditModal(cellar)}
              >
                <Text style={styles.cellarChipEmoji}>{cellar.emoji}</Text>
                <Text style={[styles.cellarChipText, isActive && styles.cellarChipTextActive]}>
                  {cellar.name}
                </Text>
                <Text style={[styles.cellarChipCount, isActive && styles.cellarChipCountActive]}>
                  {count}
                </Text>
                {!cellar.is_public && (
                  <Ionicons
                    name="lock-closed"
                    size={11}
                    color={isActive ? 'rgba(255,255,255,0.6)' : Colors.textDim}
                  />
                )}
              </Pressable>
            );
          })}
          <Pressable style={styles.cellarChipNew} onPress={() => setCreateModal(true)}>
            <Ionicons name="add" size={16} color={Colors.primary} />
            <Text style={styles.cellarChipNewText}>Nouvelle</Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* Modal création cave */}
      <Modal visible={createModal} transparent animationType="fade" onRequestClose={() => setCreateModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setCreateModal(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Nouvelle cave</Text>

            {/* Emoji picker */}
            <View style={styles.emojiGrid}>
              {EMOJIS.map((e) => (
                <Pressable
                  key={e}
                  style={[styles.emojiBtn, newEmoji === e && styles.emojiBtnActive]}
                  onPress={() => setNewEmoji(e)}
                >
                  <Text style={styles.emojiText}>{e}</Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              style={styles.modalInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="Nom de la cave…"
              placeholderTextColor={Colors.textDim}
              autoFocus
            />

            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelBtn} onPress={() => { setCreateModal(false); setNewName(''); }}>
                <Text style={styles.modalCancelText}>Annuler</Text>
              </Pressable>
              <Pressable
                style={[styles.modalConfirmBtn, (!newName.trim() || creating) && { opacity: 0.4 }]}
                onPress={createCellar}
                disabled={!newName.trim() || creating}
              >
                <Text style={styles.modalConfirmText}>Créer</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal édition cave (renommer / supprimer) */}
      <Modal visible={editModal} transparent animationType="fade" onRequestClose={closeEditModal}>
        <Pressable style={styles.modalOverlay} onPress={closeEditModal}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Modifier la cave</Text>

            {/* Emoji picker */}
            <View style={styles.emojiGrid}>
              {EMOJIS.map((e) => (
                <Pressable
                  key={e}
                  style={[styles.emojiBtn, editEmoji === e && styles.emojiBtnActive]}
                  onPress={() => setEditEmoji(e)}
                >
                  <Text style={styles.emojiText}>{e}</Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              style={styles.modalInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Nom de la cave…"
              placeholderTextColor={Colors.textDim}
              autoFocus
            />

            {/* Toggle visibilité */}
            <Pressable
              style={[styles.visibilityToggle, editIsPublic && styles.visibilityTogglePublic]}
              onPress={() => setEditIsPublic((v) => !v)}
            >
              <Ionicons
                name={editIsPublic ? 'eye-outline' : 'eye-off-outline'}
                size={18}
                color={editIsPublic ? Colors.primary : Colors.textMuted}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.visibilityLabel, editIsPublic && styles.visibilityLabelPublic]}>
                  {editIsPublic ? 'Cave partagée' : 'Cave privée'}
                </Text>
                <Text style={styles.visibilityHint}>
                  {editIsPublic
                    ? 'Visible par tes amis et dans les groupes'
                    : 'Visible par toi uniquement'}
                </Text>
              </View>
              <View style={[styles.visibilityDot, editIsPublic && styles.visibilityDotPublic]} />
            </Pressable>

            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelBtn} onPress={closeEditModal}>
                <Text style={styles.modalCancelText}>Annuler</Text>
              </Pressable>
              <Pressable
                style={[styles.modalConfirmBtn, (!editName.trim() || editSaving) && { opacity: 0.4 }]}
                onPress={saveCellar}
                disabled={!editName.trim() || editSaving}
              >
                <Text style={styles.modalConfirmText}>Enregistrer</Text>
              </Pressable>
            </View>

            {/* Suppression — masquée pour la cave par défaut */}
            {editingCellar && !editingCellar.is_default && (
              <Pressable style={styles.deleteBtn} onPress={confirmDeleteCellar}>
                <Ionicons name="trash-outline" size={16} color={Colors.error} />
                <Text style={styles.deleteBtnText}>Supprimer cette cave</Text>
              </Pressable>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Scanner */}
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
            <Text style={styles.scannerHint}>Scanne le code-barres pour retrouver une bière dans ta cave</Text>
          </SafeAreaViewRN>
        </View>
      </Modal>

      {/* Recherche + filtres */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Nom, brasserie, style, goût…"
            placeholderTextColor={Colors.textDim}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={Colors.textDim} />
            </Pressable>
          )}
        </View>
        <Pressable
          style={[styles.favFilter, filterFavorites && styles.favFilterActive]}
          onPress={() => setFilterFavorites(!filterFavorites)}
        >
          <Ionicons
            name={filterFavorites ? 'heart' : 'heart-outline'}
            size={20}
            color={filterFavorites ? Colors.background : Colors.primary}
          />
        </Pressable>
      </View>

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
            <Text style={[styles.sortText, sort === key && styles.sortTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ flex: 1 }}>
        {loading ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Chargement…</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="beer-outline" size={64} color={Colors.textDim} />
            <Text style={styles.emptyTitle}>
              {activeEntries.length === 0 ? 'Cave vide !' : 'Aucun résultat'}
            </Text>
            <Text style={styles.emptyText}>
              {activeEntries.length === 0
                ? 'Scanne ta première bière ou ajoute-la manuellement.'
                : 'Essaie un autre terme de recherche.'}
            </Text>
            {activeEntries.length === 0 && (
              <Pressable
                style={styles.emptyBtn}
                onPress={() => router.push({ pathname: '/beer/add', params: { cellarId: activeCellarId } })}
              >
                <Text style={styles.emptyBtnText}>Ajouter une bière</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <BeerCard entry={item} />}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14,
  },
  title: { fontSize: 26, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: 13, color: Colors.textMuted, marginTop: 4 },
  headerBtns: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  scanBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  addBtn: {
    backgroundColor: Colors.primary, width: 44, height: 44,
    borderRadius: 22, alignItems: 'center', justifyContent: 'center',
  },
  // Sélecteur de caves
  cellarScrollWrapper: { flexShrink: 0 },
  cellarRow: { paddingHorizontal: 20, paddingVertical: 8, gap: 10, alignItems: 'center' },
  cellarChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, height: 44, borderRadius: 22,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  cellarChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  cellarChipEmoji: { fontSize: 18 },
  cellarChipText: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
  cellarChipTextActive: { color: Colors.background },
  cellarChipCount: {
    fontSize: 12, fontWeight: '700', color: Colors.textDim,
    backgroundColor: Colors.surfaceLight, borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  cellarChipCountActive: { backgroundColor: 'rgba(255,255,255,0.25)', color: Colors.background },
  cellarChipNew: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, height: 44, borderRadius: 22,
    borderWidth: 1, borderColor: Colors.primary, borderStyle: 'dashed',
  },
  cellarChipNewText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modalCard: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 24,
    width: '100%', maxWidth: 360, borderWidth: 1, borderColor: Colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 16 },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  emojiBtn: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  emojiBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.surfaceLight },
  emojiText: { fontSize: 22 },
  modalInput: {
    backgroundColor: Colors.background, borderRadius: 12, borderWidth: 1,
    borderColor: Colors.border, paddingHorizontal: 16, paddingVertical: 12,
    color: Colors.text, fontSize: 15, marginBottom: 20,
  },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center',
    backgroundColor: Colors.surfaceLight, borderWidth: 1, borderColor: Colors.border,
  },
  modalCancelText: { color: Colors.textMuted, fontWeight: '600', fontSize: 14 },
  modalConfirmBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: Colors.primary, alignItems: 'center',
  },
  modalConfirmText: { color: Colors.background, fontWeight: '700', fontSize: 14 },
  visibilityToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.background, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16,
  },
  visibilityTogglePublic: { borderColor: Colors.primary },
  visibilityLabel: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
  visibilityLabelPublic: { color: Colors.primary },
  visibilityHint: { fontSize: 12, color: Colors.textDim, marginTop: 1 },
  visibilityDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: Colors.textDim,
  },
  visibilityDotPublic: { backgroundColor: Colors.primary },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 16, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.error,
  },
  deleteBtnText: { color: Colors.error, fontWeight: '600', fontSize: 14 },
  // Scanner
  scannerOverlay: { flex: 1, alignItems: 'center', justifyContent: 'space-between', padding: 24 },
  scannerClose: { alignSelf: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: 6 },
  scannerFrame: { width: 260, height: 260, position: 'relative' },
  corner: { position: 'absolute', width: 28, height: 28, borderColor: Colors.primary, borderWidth: 3 },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 4 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 4 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 4 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 4 },
  scannerHint: { color: 'rgba(255,255,255,0.8)', fontSize: 14, textAlign: 'center' },
  // Recherche / tri
  searchRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 4, marginBottom: 12 },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1,
    borderColor: Colors.border, paddingHorizontal: 14, gap: 8,
  },
  searchInput: { flex: 1, color: Colors.text, fontSize: 15, paddingVertical: 13 },
  favFilter: {
    width: 50, height: 50, borderRadius: 14,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  favFilterActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  sortRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 18 },
  sortChip: {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 18,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  sortChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  sortText: { fontSize: 13, color: Colors.textMuted, fontWeight: '600' },
  sortTextActive: { color: Colors.background },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.text },
  emptyText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    backgroundColor: Colors.primary, paddingHorizontal: 24,
    paddingVertical: 12, borderRadius: 12, marginTop: 8,
  },
  emptyBtnText: { color: Colors.background, fontWeight: '700', fontSize: 15 },
});
