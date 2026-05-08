import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import React, { useEffect } from 'react';
import { AuthProvider } from '../lib/auth';
import { supabase } from '../lib/supabase';

function DeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    // Gère le deep link quand l'app est déjà ouverte
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    // Gère le deep link quand l'app est ouverte via le lien
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    return () => subscription.remove();
  }, []);

  const handleDeepLink = async (url: string) => {
    // Supabase insère les tokens dans le fragment (#) de l'URL
    // expo-linking les passe dans les query params
    const parsed = Linking.parse(url);
    const params = parsed.queryParams as Record<string, string> | null;

    if (!params) return;

    const accessToken = params['access_token'];
    const refreshToken = params['refresh_token'];

    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (!error) {
        router.replace('/(tabs)/cellar');
      }
    }
  };

  return null;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <DeepLinkHandler />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="beer/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="beer/add" options={{ presentation: 'modal' }} />
        <Stack.Screen name="group/[id]" />
        <Stack.Screen name="group/create" options={{ presentation: 'modal' }} />
      </Stack>
    </AuthProvider>
  );
}
