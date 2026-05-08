import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { lookupBeerByBarcode } from '../../lib/beerApi';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';

export default function ScanScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [loading, setLoading] = useState(false);
  const [lastBarcode, setLastBarcode] = useState('');
  const [status, setStatus] = useState<'idle' | 'found' | 'notfound' | 'exists'>('idle');
  const [beerName, setBeerName] = useState('');
  const cooldown = useRef(false);

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, []);

  const handleBarcode = async ({ data: barcode }: { data: string }) => {
    if (!scanning || cooldown.current || barcode === lastBarcode || !session) return;

    cooldown.current = true;
    setScanning(false);
    setLoading(true);
    setLastBarcode(barcode);
    setStatus('idle');

    try {
      // Vérifie si déjà dans la cave
      const { data: existing } = await supabase
        .from('cellar_entries')
        .select('id, beer:beers(name)')
        .eq('user_id', session.user.id)
        .eq('beers.barcode', barcode)
        .maybeSingle();

      if (existing) {
        setBeerName((existing.beer as any)?.name ?? 'Cette bière');
        setStatus('exists');
        setLoading(false);
        return;
      }

      // Cherche dans le catalogue global
      const { data: globalBeer } = await supabase
        .from('beers')
        .select('*')
        .eq('barcode', barcode)
        .maybeSingle();

      if (globalBeer) {
        setBeerName(globalBeer.name);
        setStatus('found');
        setLoading(false);
        setTimeout(() => {
          router.push({ pathname: '/beer/add', params: { beerId: globalBeer.id } });
          resetScanner();
        }, 800);
        return;
      }

      // Lookup Open Food Facts
      const beerData = await lookupBeerByBarcode(barcode);

      if (beerData) {
        setBeerName(beerData.name ?? 'Bière trouvée');
        setStatus('found');
        setLoading(false);
        setTimeout(() => {
          router.push({
            pathname: '/beer/add',
            params: { beerData: JSON.stringify(beerData) },
          });
          resetScanner();
        }, 800);
      } else {
        setStatus('notfound');
        setLoading(false);
        setTimeout(() => {
          router.push({
            pathname: '/beer/add',
            params: { barcode },
          });
          resetScanner();
        }, 1000);
      }
    } catch {
      setLoading(false);
      resetScanner();
    }
  };

  const resetScanner = () => {
    setScanning(true);
    setStatus('idle');
    setLastBarcode('');
    setTimeout(() => { cooldown.current = false; }, 2000);
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
        onBarcodeScanned={scanning && !loading ? handleBarcode : undefined}
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

      {/* Status feedback */}
      <View style={styles.statusContainer}>
        {loading && (
          <View style={styles.statusBox}>
            <ActivityIndicator color={Colors.primary} size="small" />
            <Text style={styles.statusText}>Recherche en cours…</Text>
          </View>
        )}
        {status === 'found' && (
          <View style={[styles.statusBox, styles.statusSuccess]}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
            <Text style={styles.statusText}>Trouvé : {beerName}</Text>
          </View>
        )}
        {status === 'notfound' && (
          <View style={[styles.statusBox, styles.statusWarning]}>
            <Ionicons name="alert-circle" size={20} color={Colors.warning} />
            <Text style={styles.statusText}>Bière inconnue — ajout manuel</Text>
          </View>
        )}
        {status === 'exists' && (
          <View style={[styles.statusBox, styles.statusInfo]}>
            <Ionicons name="information-circle" size={20} color={Colors.primary} />
            <Text style={styles.statusText}>{beerName} est déjà dans ta cave</Text>
          </View>
        )}
      </View>

      {/* Manual add button */}
      <SafeAreaView style={styles.footer} edges={['bottom']}>
        <Pressable
          style={styles.manualBtn}
          onPress={() => router.push('/beer/add')}
        >
          <Ionicons name="create-outline" size={18} color={Colors.primary} />
          <Text style={styles.manualBtnText}>Ajouter manuellement</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const WINDOW_SIZE = 260;
const CORNER = 24;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 32,
  },
  permTitle: { fontSize: 20, fontWeight: '700', color: Colors.text },
  permText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  permBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  permBtnText: { color: Colors.background, fontWeight: '700', fontSize: 15 },

  overlay: { ...StyleSheet.absoluteFillObject },
  overlayTop: { flex: 1, backgroundColor: Colors.overlay },
  overlayMiddle: { flexDirection: 'row', height: WINDOW_SIZE },
  overlaySide: { flex: 1, backgroundColor: Colors.overlay },
  scanWindow: {
    width: WINDOW_SIZE,
    height: WINDOW_SIZE,
    borderRadius: 4,
  },
  overlayBottom: { flex: 1, backgroundColor: Colors.overlay },

  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: Colors.primary,
    borderWidth: 3,
  },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 4 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 4 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 4 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 4 },

  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: 8,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.white },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 },

  statusContainer: {
    position: 'absolute',
    bottom: 120,
    left: 24,
    right: 24,
    alignItems: 'center',
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusSuccess: { borderColor: Colors.success },
  statusWarning: { borderColor: Colors.warning },
  statusInfo: { borderColor: Colors.primary },
  statusText: { color: Colors.text, fontSize: 14, fontWeight: '500' },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 16,
  },
  manualBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  manualBtnText: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
});
