import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { uploadImage } from '../../lib/storage';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
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
import StarRating from '../../components/StarRating';
import TasteTagPicker from '../../components/TasteTagPicker';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { CellarEntry, TasteTag } from '../../types';

export default function BeerDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();

  const scrollRef = useRef<ScrollView>(null);
  const [entry, setEntry] = useState<CellarEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState('');
  const [tasteTags, setTasteTags] = useState<TasteTag[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [isFavorite, setIsFavorite] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  useEffect(() => {
    fetchEntry();
  }, [id]);

  const fetchEntry = async () => {
    const { data } = await supabase
      .from('cellar_entries')
      .select('*, beer:beers(*)')
      .eq('id', id)
      .single();

    if (data) {
      setEntry(data as CellarEntry);
      setRating(data.rating ?? 0);
      setNotes(data.notes ?? '');
      setTasteTags(data.taste_tags ?? []);
      setQuantity(data.quantity ?? 1);
      setIsFavorite(data.is_favorite ?? false);
    }
    setLoading(false);
  };

  const uploadPhoto = async (uri: string): Promise<string | null> => {
    if (!session) return null;
    const { url, error } = await uploadImage(uri, 'beer-photos', `${session.user.id}/${Date.now()}`);
    if (error) Alert.alert('Erreur upload photo', error);
    return url;
  };

  const handleSave = async () => {
    if (!entry) return;
    setSaving(true);

    let photoUrl = entry.photo_url;
    if (photoUri) {
      const uploaded = await uploadPhoto(photoUri);
      if (uploaded) photoUrl = uploaded;
    }

    const { error: updateError } = await supabase.from('cellar_entries').update({
      rating: rating || null,
      notes: notes.trim() || null,
      taste_tags: tasteTags,
      quantity,
      is_favorite: isFavorite,
      photo_url: photoUrl,
    }).eq('id', entry.id);

    setSaving(false);

    if (updateError) {
      Alert.alert('Erreur sauvegarde', updateError.message);
      return;
    }

    setPhotoUri(null); // Réinitialise l'URI local après sauvegarde
    setEditing(false);
    fetchEntry();
  };

  const handleDelete = () => {
    Alert.alert(
      'Supprimer de la cave',
      `Retirer "${entry?.beer?.name}" de ta cave ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('cellar_entries').delete().eq('id', id);
            router.back();
          },
        },
      ]
    );
  };

  const toggleFavorite = async () => {
    const newVal = !isFavorite;
    setIsFavorite(newVal);
    await supabase.from('cellar_entries').update({ is_favorite: newVal }).eq('id', id);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [2, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  };

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [2, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (!entry) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: Colors.textMuted }}>Bière introuvable</Text>
      </View>
    );
  }

  const beer = entry.beer;
  const displayPhoto = photoUri ?? entry.photo_url ?? beer?.image_url;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <View style={styles.headerActions}>
          <Pressable onPress={toggleFavorite}>
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={24}
              color={isFavorite ? Colors.primary : Colors.textMuted}
            />
          </Pressable>
          {editing ? (
            <Pressable onPress={handleSave} disabled={saving}>
              {saving
                ? <ActivityIndicator size="small" color={Colors.primary} />
                : <Ionicons name="checkmark-done" size={24} color={Colors.primary} />}
            </Pressable>
          ) : (
            <Pressable onPress={() => setEditing(true)}>
              <Ionicons name="create-outline" size={24} color={Colors.primary} />
            </Pressable>
          )}
          <Pressable onPress={handleDelete}>
            <Ionicons name="trash-outline" size={24} color={Colors.error} />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'android' ? 0 : 0}>
        <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Hero image */}
          {displayPhoto ? (
            <Image source={{ uri: displayPhoto }} style={styles.heroImage} contentFit="cover" />
          ) : (
            <View style={styles.heroPlaceholder}>
              <Ionicons name="beer-outline" size={64} color={Colors.textDim} />
            </View>
          )}

          {/* Boutons photo en mode édition */}
          {editing && (
            <View style={styles.photoButtons}>
              <Pressable style={styles.photoBtn} onPress={takePhoto}>
                <Ionicons name="camera-outline" size={20} color={Colors.primary} />
                <Text style={styles.photoBtnText}>Caméra</Text>
              </Pressable>
              <Pressable style={styles.photoBtn} onPress={pickImage}>
                <Ionicons name="image-outline" size={20} color={Colors.primary} />
                <Text style={styles.photoBtnText}>Galerie</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.content}>
            {/* Beer info */}
            <View style={styles.beerInfo}>
              <Text style={styles.beerName}>{beer?.name}</Text>
              {beer?.brewery && <Text style={styles.brewery}>{beer.brewery}</Text>}
              <View style={styles.metaRow}>
                {beer?.style && <View style={styles.badge}><Text style={styles.badgeText}>{beer.style}</Text></View>}
                {beer?.country && <View style={styles.badge}><Text style={styles.badgeText}>🌍 {beer.country}</Text></View>}
                {beer?.abv != null && <Text style={styles.abv}>{beer.abv}% ABV</Text>}
                {beer?.ibu != null && <Text style={styles.abv}>{beer.ibu} IBU</Text>}
              </View>
              {beer?.description && (
                <Text style={styles.beerDescription}>{beer.description}</Text>
              )}
            </View>

            {/* Rating */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Note</Text>
              <StarRating rating={rating} onChange={editing ? setRating : undefined} size={36} readonly={!editing} />
            </View>

            {/* Taste tags */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Profil gustatif</Text>
              {editing ? (
                <TasteTagPicker selected={tasteTags} onChange={setTasteTags} />
              ) : tasteTags.length > 0 ? (
                <View style={styles.tagList}>
                  {tasteTags.map((tag) => (
                    <View key={tag} style={styles.tag}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyText}>Aucun tag</Text>
              )}
            </View>

            {/* Notes */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Mes notes</Text>
              {editing ? (
                <TextInput
                  style={[styles.input, styles.textarea]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Mes impressions…"
                  placeholderTextColor={Colors.textDim}
                  multiline
                  numberOfLines={4}
                  onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150)}
                />
              ) : (
                <Text style={notes ? styles.notesText : styles.emptyText}>
                  {notes || 'Aucune note'}
                </Text>
              )}
            </View>

            {/* Quantity */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>En cave</Text>
              {editing ? (
                <View style={styles.quantityRow}>
                  <Pressable style={styles.qtyBtn} onPress={() => setQuantity(Math.max(0, quantity - 1))}>
                    <Ionicons name="remove" size={20} color={Colors.text} />
                  </Pressable>
                  <Text style={styles.qtyValue}>{quantity}</Text>
                  <Pressable style={styles.qtyBtn} onPress={() => setQuantity(quantity + 1)}>
                    <Ionicons name="add" size={20} color={Colors.text} />
                  </Pressable>
                </View>
              ) : (
                <Text style={styles.notesText}>
                  {entry.quantity} exemplaire{entry.quantity !== 1 ? 's' : ''}
                </Text>
              )}
            </View>

            <View style={{ height: 40 }} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingVertical: 12,
  },
  headerActions: { flexDirection: 'row', gap: 20, alignItems: 'center' },
  heroImage: { width: '100%', height: 260 },
  photoButtons: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  photoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 10,
  },
  photoBtnText: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
  heroPlaceholder: {
    height: 260,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  editPhotoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { padding: 20, gap: 8 },
  beerInfo: { gap: 6, marginBottom: 8 },
  beerName: { fontSize: 26, fontWeight: '800', color: Colors.text },
  brewery: { fontSize: 16, color: Colors.textMuted },
  metaRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  badge: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
  abv: { fontSize: 13, color: Colors.textMuted },
  beerDescription: { fontSize: 14, color: Colors.textMuted, lineHeight: 20, marginTop: 4 },
  section: { gap: 8, marginTop: 16 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  tagList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    backgroundColor: Colors.tag,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tagText: { color: Colors.textMuted, fontSize: 13, fontWeight: '500' },
  emptyText: { color: Colors.textDim, fontSize: 14 },
  notesText: { color: Colors.text, fontSize: 15, lineHeight: 22 },
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
  textarea: { minHeight: 100, textAlignVertical: 'top' },
  quantityRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  qtyBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  qtyValue: { fontSize: 24, fontWeight: '700', color: Colors.text, minWidth: 32, textAlign: 'center' },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: Colors.background, fontSize: 16, fontWeight: '700' },
});
