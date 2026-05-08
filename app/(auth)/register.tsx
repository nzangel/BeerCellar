import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';

export default function RegisterScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleRegister = async () => {
    setError('');
    if (!username || !email || !password) {
      setError('Remplis tous les champs.');
      return;
    }
    if (username.length < 3) {
      setError('Le pseudo doit faire au moins 3 caractères.');
      return;
    }
    if (password.length < 6) {
      setError('Le mot de passe doit faire au moins 6 caractères.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });
    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <View style={styles.successContainer}>
        <Ionicons name="checkmark-circle" size={80} color={Colors.success} />
        <Text style={styles.successTitle}>Compte créé !</Text>
        <Text style={styles.successText}>
          Vérifie ta boîte mail pour confirmer ton adresse, puis connecte-toi.
        </Text>
        <Pressable style={styles.btnPrimary} onPress={() => router.replace('/(auth)/login')}>
          <Text style={styles.btnText}>Se connecter</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>

        <Text style={styles.title}>Créer un compte</Text>
        <Text style={styles.subtitle}>Rejoins la communauté BeerCellar</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Pseudo</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="hopmaster42"
            placeholderTextColor={Colors.textDim}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="ton@email.com"
            placeholderTextColor={Colors.textDim}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Mot de passe</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={Colors.textDim}
              secureTextEntry={!showPassword}
            />
            <Pressable style={styles.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
              <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={Colors.textMuted} />
            </Pressable>
          </View>

          <Text style={styles.label}>Confirmer le mot de passe</Text>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="••••••••"
            placeholderTextColor={Colors.textDim}
            secureTextEntry={!showPassword}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.85 }, loading && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            <Text style={styles.btnText}>{loading ? 'Inscription...' : "S'inscrire"}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  inner: { flexGrow: 1, padding: 24, paddingTop: 60 },
  backBtn: { marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '800', color: Colors.text, marginBottom: 6 },
  subtitle: { fontSize: 14, color: Colors.textMuted, marginBottom: 32 },
  form: { gap: 12 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: Colors.text,
    fontSize: 15,
  },
  passwordRow: { position: 'relative' },
  passwordInput: { paddingRight: 48 },
  eyeBtn: { position: 'absolute', right: 14, top: 14 },
  errorText: { color: Colors.error, fontSize: 13, textAlign: 'center' },
  btnPrimary: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: Colors.background, fontSize: 16, fontWeight: '700' },
  successContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 20,
  },
  successTitle: { fontSize: 28, fontWeight: '800', color: Colors.text },
  successText: { fontSize: 15, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },
});
