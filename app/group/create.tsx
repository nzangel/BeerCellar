import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
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

export default function CreateGroupScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!name.trim() || !session) return;
    setLoading(true);
    setError('');

    const { data, error: err } = await supabase
      .from('tasting_groups')
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        created_by: session.user.id,
      })
      .select()
      .single();

    setLoading(false);

    if (err || !data) {
      setError(err?.message ?? 'Impossible de créer le groupe.');
    } else {
      router.replace(`/group/${data.id}`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.title}>Nouveau groupe</Text>
        <Pressable
          onPress={handleCreate}
          disabled={!name.trim() || loading}
          style={[styles.saveBtn, (!name.trim() || loading) && styles.saveBtnDisabled]}
        >
          {loading
            ? <ActivityIndicator size="small" color={Colors.background} />
            : <Text style={styles.saveBtnText}>Créer</Text>}
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.form}>
          <View style={styles.iconPreview}>
            <Ionicons name="people-circle" size={80} color={Colors.primary} />
          </View>

          <Text style={styles.label}>Nom du groupe *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Les Amateurs de Stouts"
            placeholderTextColor={Colors.textDim}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Notre groupe de dégustation mensuel…"
            placeholderTextColor={Colors.textDim}
            multiline
            numberOfLines={4}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Text style={styles.hint}>
            Tu seras automatiquement administrateur du groupe. Tu pourras inviter tes amis depuis la page du groupe.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { fontSize: 17, fontWeight: '700', color: Colors.text },
  saveBtn: {
    backgroundColor: Colors.primary, paddingHorizontal: 16,
    paddingVertical: 8, borderRadius: 10, minWidth: 64, alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: Colors.background, fontWeight: '700', fontSize: 14 },
  form: { padding: 24, gap: 12 },
  iconPreview: { alignItems: 'center', marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  input: {
    backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1,
    borderColor: Colors.border, paddingHorizontal: 16, paddingVertical: 14,
    color: Colors.text, fontSize: 15,
  },
  textarea: { minHeight: 100, textAlignVertical: 'top' },
  errorText: { color: Colors.error, fontSize: 13 },
  hint: { fontSize: 13, color: Colors.textDim, lineHeight: 18, marginTop: 8 },
});
