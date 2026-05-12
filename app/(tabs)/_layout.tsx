import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth';
import { usePendingRequests } from '../../lib/usePendingRequests';
import { useVersionCheck } from '../../lib/useVersionCheck';
import { Colors } from '../../constants/colors';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.beercellar.app';

export default function TabsLayout() {
  const { session, loading } = useAuth();
  const insets = useSafeAreaInsets();
  const pendingRequests = usePendingRequests();
  const { status, message } = useVersionCheck();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/login" />;

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: Colors.tabBar,
            borderTopColor: Colors.border,
            borderTopWidth: 1,
            paddingBottom: insets.bottom,
            height: 60 + insets.bottom,
          },
          tabBarActiveTintColor: Colors.tabBarActive,
          tabBarInactiveTintColor: Colors.tabBarInactive,
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        }}
      >
        <Tabs.Screen
          name="cellar"
          options={{
            title: 'Ma Cave',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="wine-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="scan"
          options={{
            title: 'Scanner',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="scan-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="social"
          options={{
            title: 'Communauté',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="people-outline" size={size} color={color} />
            ),
            tabBarBadge: pendingRequests > 0 ? pendingRequests : undefined,
            tabBarBadgeStyle: {
              backgroundColor: Colors.error,
              color: '#fff',
              fontSize: 10,
              fontWeight: '700',
              minWidth: 16,
              height: 16,
              lineHeight: 16,
              borderRadius: 8,
            },
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profil',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-outline" size={size} color={color} />
            ),
          }}
        />
      </Tabs>

      {/* Modale mise à jour obligatoire */}
      <Modal visible={status === 'outdated'} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.card}>
            <View style={styles.iconWrapper}>
              <Ionicons name="arrow-up-circle" size={48} color={Colors.primary} />
            </View>
            <Text style={styles.title}>Mise à jour disponible</Text>
            <Text style={styles.message}>{message}</Text>
            <Pressable
              style={styles.btn}
              onPress={() => Linking.openURL(PLAY_STORE_URL)}
            >
              <Ionicons name="logo-google-playstore" size={18} color={Colors.background} />
              <Text style={styles.btnText}>Mettre à jour</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    gap: 12,
  },
  iconWrapper: { marginBottom: 4 },
  title: { fontSize: 20, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  message: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
    width: '100%',
    justifyContent: 'center',
  },
  btnText: { color: Colors.background, fontWeight: '700', fontSize: 15 },
});
