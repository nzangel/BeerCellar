import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { uploadImage } from '../../lib/storage';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView as SafeAreaViewRN } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';
import StarRating from '../../components/StarRating';
import TasteTagPicker from '../../components/TasteTagPicker';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { Beer, TasteTag } from '../../types';

export default function AddBeerScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const params = useLocalSearchParams<{ beerId?: string; beerData?: string; barcode?: string; cellarId?: string }>();

  const [beer, setBeer] = useState<Partial<Beer>>({});
  const [name, setName] = useState('');
  const [brewery, setBrewery] = useState('');
  const [style, setStyle] = useState('');
  const [abv, setAbv] = useState('');
  const [description, setDescription] = useState('');
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState('');
  const [tasteTags, setTasteTags] = useState<TasteTag[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scannerLoading, setScannerLoading] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const scanCooldown = useRef(false);

  useEffect(() => {
    async function init() {
      if (params.beerId) {
        const { data } = await supabase.from('beers').select('*').eq('id', params.beerId).single();
        if (data) {
          setBeer(data);
          setName(data.name ?? '');
          setBrewery(data.brewery ?? '');
          setStyle(data.style ?? '');
          setAbv(data.abv?.toString() ?? '');
          setDescription(data.description ?? '');
        }
      } else if (params.beerData) {
        const data: Partial<Beer> = JSON.parse(params.beerData);
        setBeer(data);
        setName(data.name ?? '');
        setBrewery(data.brewery ?? '');
        setStyle(data.style ?? '');
        setAbv(data.abv?.toString() ?? '');
      }
      setInitialLoading(false);
    }
    init();
  }, []);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [2, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [2, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const uploadPhoto = async (uri: string, userId: string): Promise<string | null> => {
    const { url, error } = await uploadImage(uri, 'beer-photos', `${userId}/${Date.now()}`);
    if (error) Alert.alert('Erreur upload photo', error);
    return url;
  };

  const handleSave = async () => {
    if (!name.trim() || !session) return;
    setLoading(true);

    try {
      let beerId = params.beerId ?? beer.id;

      // Crée ou récupère la bière dans le catalogue
      if (!beerId) {
        const beerPayload: Partial<Beer> & { created_by: string } = {
          barcode: beer.barcode ?? params.barcode ?? null,
          name: name.trim(),
          brewery: brewery.trim() || null,
          style: style.trim() || null,
          abv: abv ? parseFloat(abv) : null,
          description: description.trim() || null,
          image_url: beer.image_url ?? null,
          country: beer.country ?? null,
          created_by: session.user.id,
        };

        const { data: newBeer, error } = await supabase
          .from('beers')
          .insert(beerPayload)
          .select()
          .single();

        if (error || !newBeer) {
          setLoading(false);
          return;
        }
        beerId = newBeer.id;
      }

      // Upload photo si sélectionnée
      let photoUrl: string | null = null;
      if (photoUri) {
        photoUrl = await uploadPhoto(photoUri, session.user.id);
      }

      // Récupérer ou créer la cave cible
      let cellarId = params.cellarId ?? null;
      if (!cellarId) {
        const { data: defaultCellar } = await supabase
          .from('cellars')
          .select('id')
          .eq('user_id', session.user.id)
          .eq('is_default', true)
          .single();
        cellarId = defaultCellar?.id ?? null;
      }

      // Upsert dans la cave
      const { error: entryError } = await supabase.from('cellar_entries').upsert({
        user_id: session.user.id,
        beer_id: beerId,
        cellar_id: cellarId,
        rating: rating || null,
        notes: notes.trim() || null,
        taste_tags: tasteTags,
        photo_url: photoUrl,
        quantity,
      }, { onConflict: 'user_id,beer_id,cellar_id' });

      if (entryError) {
        Alert.alert('Erreur', entryError.message);
      } else {
        router.back();
      }
    } finally {
      setLoading(false);
    }
  };

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
    setScannerLoading(true);

    try {
      // Cherche dans le catalogue Supabase
      const { data: globalBeer } = await supabase
        .from('beers')
        .select('*')
        .eq('barcode', barcode)
        .maybeSingle();

      if (globalBeer) {
        setName(globalBeer.name ?? '');
        setBrewery(globalBeer.brewery ?? '');
        setStyle(globalBeer.style ?? '');
        setAbv(globalBeer.abv?.toString() ?? '');
        setDescription(globalBeer.description ?? '');
        setBeer(globalBeer);
      } else {
        // Lookup Open Food Facts
        const { lookupBeerByBarcode } = await import('../../lib/beerApi');
        const data = await lookupBeerByBarcode(barcode);
        if (data) {
          setName(data.name ?? '');
          setBrewery(data.brewery ?? '');
          setStyle(data.style ?? '');
          setAbv(data.abv?.toString() ?? '');
          setBeer({ ...data, barcode });
        } else {
          setBeer((prev) => ({ ...prev, barcode }));
        }
      }
    } finally {
      setScannerLoading(false);
      setScannerVisible(false);
    }
  };

  if (initialLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {params.beerId ? 'Ajouter à ma cave' : 'Nouvelle bière'}
        </Text>
        <View style={styles.headerRight}>
          <Pressable style={styles.scanBtn} onPress={openScanner}>
            <Ionicons name="barcode-outline" size={22} color={Colors.primary} />
          </Pressable>
          <Pressable
            onPress={handleSave}
            disabled={!name.trim() || loading}
            style={[styles.saveBtn, (!name.trim() || loading) && styles.saveBtnDisabled]}
          >
            {loading ? (
              <ActivityIndicator size="small" color={Colors.background} />
            ) : (
              <Text style={styles.saveBtnText}>Sauver</Text>
            )}
          </Pressable>
        </View>
      </View>

      {/* Scanner modal */}
      <Modal visible={scannerVisible} animationType="slide" onRequestClose={() => setScannerVisible(false)}>
        <View style={styles.scannerContainer}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            onBarcodeScanned={!scannerLoading ? handleScanBarcode : undefined}
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'] }}
          />
          <SafeAreaViewRN style={styles.scannerOverlay}>
            <Pressable style={styles.scannerClose} onPress={() => setScannerVisible(false)}>
              <Ionicons name="close" size={28} color="#fff" />
            </Pressable>
            <View style={styles.scannerFrame}>
              <View style={[styles.scanCorner, styles.scanTL]} />
              <View style={[styles.scanCorner, styles.scanTR]} />
              <View style={[styles.scanCorner, styles.scanBL]} />
              <View style={[styles.scanCorner, styles.scanBR]} />
            </View>
            <Text style={styles.scannerHint}>Pointe vers le code-barres de la bière</Text>
            {scannerLoading && (
              <View style={styles.scannerLoadingBox}>
                <ActivityIndicator color={Colors.primary} />
                <Text style={styles.scannerLoadingText}>Recherche en cours…</Text>
              </View>
            )}
          </SafeAreaViewRN>
        </View>
      </Modal>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
          {/* Photo */}
          <View style={styles.photoSection}>
            {photoUri || beer.image_url ? (
              <Pressable onPress={pickImage}>
                <Image
                  source={{ uri: photoUri ?? beer.image_url ?? '' }}
                  style={styles.photo}
                  contentFit="cover"
                />
              </Pressable>
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="beer-outline" size={40} color={Colors.textDim} />
              </View>
            )}
            <View style={styles.photoBtns}>
              <Pressable style={styles.photoBtn} onPress={takePhoto}>
                <Ionicons name="camera-outline" size={20} color={Colors.primary} />
                <Text style={styles.photoBtnText}>Photo</Text>
              </Pressable>
              <Pressable style={styles.photoBtn} onPress={pickImage}>
                <Ionicons name="image-outline" size={20} color={Colors.primary} />
                <Text style={styles.photoBtnText}>Galerie</Text>
              </Pressable>
            </View>
          </View>

          {/* Infos bière */}
          <Text style={styles.sectionTitle}>Informations</Text>

          <Text style={styles.label}>Nom *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Chimay Bleue"
            placeholderTextColor={Colors.textDim}
          />

          <Text style={styles.label}>Brasserie</Text>
          <TextInput
            style={styles.input}
            value={brewery}
            onChangeText={setBrewery}
            placeholder="Bières de Chimay"
            placeholderTextColor={Colors.textDim}
          />

          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={styles.label}>Style</Text>
              <TextInput
                style={styles.input}
                value={style}
                onChangeText={setStyle}
                placeholder="Trappiste"
                placeholderTextColor={Colors.textDim}
              />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.label}>ABV (%)</Text>
              <TextInput
                style={styles.input}
                value={abv}
                onChangeText={setAbv}
                placeholder="9.0"
                placeholderTextColor={Colors.textDim}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Notes de dégustation, arômes, bouche…"
            placeholderTextColor={Colors.textDim}
            multiline
            numberOfLines={3}
          />

          {/* Ma dégustation */}
          <Text style={styles.sectionTitle}>Ma dégustation</Text>

          <Text style={styles.label}>Note</Text>
          <StarRating rating={rating} onChange={setRating} size={36} />

          <Text style={styles.label}>Profil gustatif</Text>
          <TasteTagPicker selected={tasteTags} onChange={setTasteTags} />

          <Text style={styles.label}>Mes notes</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Mes impressions personnelles…"
            placeholderTextColor={Colors.textDim}
            multiline
            numberOfLines={3}
          />

          {/* Quantité */}
          <Text style={styles.sectionTitle}>Quantité en cave</Text>
          <View style={styles.quantityRow}>
            <Pressable
              style={styles.qtyBtn}
              onPress={() => setQuantity(Math.max(0, quantity - 1))}
            >
              <Ionicons name="remove" size={20} color={Colors.text} />
            </Pressable>
            <Text style={styles.qtyValue}>{quantity}</Text>
            <Pressable
              style={styles.qtyBtn}
              onPress={() => setQuantity(quantity + 1)}
            >
              <Ionicons name="add" size={20} color={Colors.text} />
            </Pressable>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  scanBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 64,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: Colors.background, fontWeight: '700', fontSize: 14 },
  scannerContainer: { flex: 1, backgroundColor: '#000' },
  scannerOverlay: { flex: 1, alignItems: 'center', justifyContent: 'space-between', padding: 24 },
  scannerClose: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    padding: 6,
  },
  scannerFrame: {
    width: 240,
    height: 240,
    position: 'relative',
  },
  scanCorner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: Colors.primary,
    borderWidth: 3,
  },
  scanTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 4 },
  scanTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 4 },
  scanBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 4 },
  scanBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 4 },
  scannerHint: { color: 'rgba(255,255,255,0.8)', fontSize: 14, textAlign: 'center' },
  scannerLoadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  scannerLoadingText: { color: Colors.text, fontSize: 14 },
  form: { padding: 20, gap: 12 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 12,
    marginBottom: 4,
  },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 15,
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1, gap: 4 },
  photoSection: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 8 },
  photo: { width: 90, height: 120, borderRadius: 10 },
  photoPlaceholder: {
    width: 90,
    height: 120,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoBtns: { flex: 1, gap: 10 },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  photoBtnText: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  qtyBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyValue: { fontSize: 24, fontWeight: '700', color: Colors.text, minWidth: 32, textAlign: 'center' },
});
