import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';

export default function ScanScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const cooldown = useRef(false);

  const [newBeerModal, setNewBeerModal] = useState(false);
  const [pendingBarcode, setPendingBarcode] = useState<string | null>(null);
  const [addingBeer, setAddingBeer] = useState(false);

  const handleBarcode = async ({ data: barcode }: { data: string }) => {
    if (!scanning || cooldown.current || !session) return;
    cooldown.current = true;
    setScanning(false);

    // Vérifie si la bière est déjà dans une cave
    const { data: existing } = await supabase
      .from('cellar_entries')
      .select('id, beer:beers!inner(barcode)')
      .eq('user_id', session.user.id)
      .eq('beers.barcode', barcode)
      .maybeSingle();

    if (existing) {
      router.push(`/beer/${existing.id}`);
      resetScanner();
      return;
    }

    // Pas trouvée → modale
    setPendingBarcode(barcode);
    setNewBeerModal(true);
  };

  const resetScanner = () => {
    setScanning(true);
    setTimeout(() => { cooldown.current = false; }, 1500);
  };

  const confirmAddBeer = async () => {
    if (!pendingBarcode) return;
    setAddingBeer(true);
    const barcode = pendingBarcode;

    const { data: globalBeer } = await supabase
      .from('beers')
      .select('*')
      .eq('barcode', barcode)
      .maybeSingle();

    const params: any = {};
    if (globalBeer) {
      params.beerId = globalBeer.id;
    } else {
      const { lookupBeerByBarcode } = await import('../../lib/beerApi');
      const data = await lookupBeerByBarcode(barcode);
      if (data) params.beerData = JSON.stringify({ ...data, barcode });
      else params.barcode = barcode;
    }

    setAddingBeer(false);
    setNewBeerModal(false);
    setPendingBarcode(null);
    resetScanner();
    router.push({ pathname: '/beer/add', params });
  };

  const dismissModal = () => {
    setNewBeerModal(false);
    setPendingBarcode(null);
    resetScanner();
  };

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.centered}>
        <Ionicons name="camera-outline" size={64} color={Colors.textDim} />
        <Text style={styles.permTitle}>Caméra requise</Text>
        <Text style={styles.permText}>BeerCellar a besoin de la caméra pour scanner les codes-barres.</Text>
        <Pressable style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Autoriser</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={scanning ? handleBarcode : undefined}
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'] }}
      />

      {/* Overlay */}
      <View style={styles.overlay}>
        <View style={styles.overlayTop} />
        <View style={styles.overlayMiddle}>
          <View style={styles.overlaySide} />
          <View style={styles.scanWindow}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <View style={styles.overlaySide} />
        </View>
        <View style={styles.overlayBottom} />
      </View>

      {/* Header */}
      <SafeAreaView style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Scanner une bière</Text>
        <Text style={styles.headerSub}>Pointe l'appareil vers le code-barres</Text>
      </SafeAreaView>

      {/* Bouton ajout manuel */}
      <SafeAreaView style={styles.footer} edges={['bottom']}>
        <Pressable
          style={styles.manualBtn}
          onPress={() => router.push('/beer/add')}
        >
          <Ionicons name="create-outline" size={18} color={Colors.primary} />
          <Text style={styles.manualBtnText}>Ajouter manuellement</Text>
        </Pressable>
      </SafeAreaView>

      {/* Modale nouvelle bière */}
      <Modal
        visible={newBeerModal}
        transparent
        animationType="fade"
        onRequestClose={dismissModal}
      >
        <Pressable style={styles.modalOverlay} onPress={() => { if (!addingBeer) dismissModal(); }}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalIcon}>
              <Ionicons name="beer-outline" size={36} color={Colors.primary} />
            </View>
            <Text style={styles.modalTitle}>Nouvelle bière</Text>
            <Text style={styles.modalText}>
              Cette bière n'est pas encore dans ta cave. Tu veux l'ajouter ?
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={dismissModal}
                disabled={addingBeer}
              >
                <Text style={styles.modalCancelText}>Annuler</Text>
              </Pressable>
              <Pressable
                style={[styles.modalConfirmBtn, addingBeer && { opacity: 0.7 }]}
                onPress={confirmAddBeer}
                disabled={addingBeer}
              >
                {addingBeer
                  ? <ActivityIndicator size="small" color={Colors.background} />
                  : <Text style={styles.modalConfirmText}>Ajouter</Text>
                }
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const WINDOW_SIZE = 260;
const CORNER = 24;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: {
    flex: 1, backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center',
    gap: 16, padding: 32,
  },
  permTitle: { fontSize: 20, fontWeight: '700', color: Colors.text },
  permText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  permBtn: { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  permBtnText: { color: Colors.background, fontWeight: '700', fontSize: 15 },

  overlay: { ...StyleSheet.absoluteFillObject },
  overlayTop: { flex: 1, backgroundColor: Colors.overlay },
  overlayMiddle: { flexDirection: 'row', height: WINDOW_SIZE },
  overlaySide: { flex: 1, backgroundColor: Colors.overlay },
  scanWindow: { width: WINDOW_SIZE, height: WINDOW_SIZE, borderRadius: 4 },
  overlayBottom: { flex: 1, backgroundColor: Colors.overlay },

  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: Colors.primary, borderWidth: 3 },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 4 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 4 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 4 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 4 },

  headerContainer: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', paddingTop: 8 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.white },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', paddingBottom: 16 },
  manualBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 24, borderWidth: 1, borderColor: Colors.primary,
  },
  manualBtnText: { color: Colors.primary, fontWeight: '600', fontSize: 14 },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modalCard: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 24,
    width: '100%', maxWidth: 360, borderWidth: 1, borderColor: Colors.border,
  },
  modalIcon: { alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, textAlign: 'center', marginBottom: 8 },
  modalText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center',
    backgroundColor: Colors.surfaceLight, borderWidth: 1, borderColor: Colors.border,
  },
  modalCancelText: { color: Colors.textMuted, fontWeight: '600', fontSize: 14 },
  modalConfirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center' },
  modalConfirmText: { color: Colors.background, fontWeight: '700', fontSize: 14 },
});
