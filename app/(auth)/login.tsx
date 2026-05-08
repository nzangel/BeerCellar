import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
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

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Remplis tous les champs.');
      return;
    }
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      if (error.message.includes('Email not confirmed')) {
        setError('Vérifie ta boîte mail et clique sur le lien de confirmation avant de te connecter.');
      } else {
        setError('Email ou mot de passe incorrect.');
      }
    } else {
      router.replace('/(tabs)/cellar');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <View style={styles.logo}>
          <Ionicons name="beer" size={64} color={Colors.primary} />
          <Text style={styles.appName}>BeerCellar</Text>
          <Text style={styles.tagline}>Ta cave à bières, ta communauté</Text>
        </View>

        <View style={styles.form}>
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
              <Ionicons
                name={showPassword ? 'eye-off' : 'eye'}
                size={20}
                color={Colors.textMuted}
              />
            </Pressable>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.85 }, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.btnText}>{loading ? 'Connexion...' : 'Se connecter'}</Text>
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.dividerLine} />
          </View>

          <Link href="/(auth)/register" asChild>
            <Pressable style={({ pressed }) => [styles.btnSecondary, pressed && { opacity: 0.85 }]}>
              <Text style={styles.btnSecondaryText}>Créer un compte</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  inner: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logo: { alignItems: 'center', marginBottom: 48 },
  appName: { fontSize: 36, fontWeight: '800', color: Colors.primary, marginTop: 12 },
  tagline: { fontSize: 14, color: Colors.textMuted, marginTop: 4 },
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
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { color: Colors.textDim, fontSize: 13 },
  btnSecondary: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  btnSecondaryText: { color: Colors.text, fontSize: 16, fontWeight: '600' },
});
