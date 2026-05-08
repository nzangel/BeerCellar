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
import { CellarEntry } from '../../types';

type SortOption = 'date' | 'rating' | 'name' | 'favorite';

export default function CellarScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [entries, setEntries] = useState<CellarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('date');
  const [filterFavorites, setFilterFavorites] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const scanCooldown = useRef(false);

  const fetchCellar = useCallback(async () => {
    if (!session) return;
    const { data, error } = await supabase
      .from('cellar_entries')
      .select('*, beer:beers(*)')
      .eq('user_id', session.user.id);

    if (!error && data) setEntries(data as CellarEntry[]);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      fetchCellar().finally(() => setLoading(false));
    }, [fetchCellar])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCellar();
    setRefreshing(false);
  };

  const filtered = entries
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

  const totalBeers = entries.reduce((acc, e) => acc + e.quantity, 0);

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

    // Cherche dans les entrées déjà chargées
    const found = entries.find((e) => e.beer?.barcode === barcode);
    if (found) {
      router.push(`/beer/${found.id}`);
      return;
    }

    // Pas dans la cave — lookup catalogue + Open Food Facts en avance
    const lookupBeer = async () => {
      // Catalogue Supabase d'abord
      const { data: globalBeer } = await supabase
        .from('beers')
        .select('*')
        .eq('barcode', barcode)
        .maybeSingle();

      if (globalBeer) {
        return { beerId: globalBeer.id, beerData: null };
      }

      // Open Food Facts ensuite
      const { lookupBeerByBarcode } = await import('../../lib/beerApi');
      const data = await lookupBeerByBarcode(barcode);
      return { beerId: null, beerData: data ? { ...data, barcode } : null };
    };

    Alert.alert(
      'Bière non trouvée',
      'Cette bière n\'est pas dans ta cave. Tu veux l\'ajouter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Ajouter',
          onPress: async () => {
            const { beerId, beerData } = await lookupBeer();
            if (beerId) {
              router.push({ pathname: '/beer/add', params: { beerId } });
            } else if (beerData) {
              router.push({ pathname: '/beer/add', params: { beerData: JSON.stringify(beerData) } });
            } else {
              router.push({ pathname: '/beer/add', params: { barcode } });
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Ma Cave</Text>
          <Text style={styles.subtitle}>
            {entries.length} bière{entries.length !== 1 ? 's' : ''} · {totalBeers} exemplaire{totalBeers !== 1 ? 's' : ''}
          </Text>
        </View>
        <View style={styles.headerBtns}>
          <Pressable style={styles.scanBtn} onPress={openScanner}>
            <Ionicons name="barcode-outline" size={22} color={Colors.primary} />
          </Pressable>
          <Pressable style={styles.addBtn} onPress={() => router.push('/beer/add')}>
            <Ionicons name="add" size={24} color={Colors.background} />
          </Pressable>
        </View>
      </View>

      {/* Scanner modal */}
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
            <Text style={[styles.sortText, sort === key && styles.sortTextActive]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Chargement…</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="beer-outline" size={64} color={Colors.textDim} />
          <Text style={styles.emptyTitle}>
            {entries.length === 0 ? 'Cave vide !' : 'Aucun résultat'}
          </Text>
          <Text style={styles.emptyText}>
            {entries.length === 0
              ? 'Scanne ta première bière ou ajoute-la manuellement.'
              : 'Essaie un autre terme de recherche.'}
          </Text>
          {entries.length === 0 && (
            <Pressable style={styles.emptyBtn} onPress={() => router.push('/beer/add')}>
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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: { fontSize: 28, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  headerBtns: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  scanBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    backgroundColor: Colors.primary,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerOverlay: { flex: 1, alignItems: 'center', justifyContent: 'space-between', padding: 24 },
  scannerClose: { alignSelf: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: 6 },
  scannerFrame: { width: 260, height: 260, position: 'relative' },
  corner: { position: 'absolute', width: 28, height: 28, borderColor: Colors.primary, borderWidth: 3 },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 4 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 4 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 4 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 4 },
  scannerHint: { color: 'rgba(255,255,255,0.8)', fontSize: 14, textAlign: 'center' },
  searchRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 12 },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: { flex: 1, color: Colors.text, fontSize: 14, paddingVertical: 10 },
  favFilter: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favFilterActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  sortRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 16 },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sortChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  sortText: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  sortTextActive: { color: Colors.background },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.text },
  emptyText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  emptyBtnText: { color: Colors.background, fontWeight: '700', fontSize: 15 },
});
