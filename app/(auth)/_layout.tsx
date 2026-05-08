import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { View, ActivityIndicator } from 'react-native';
import { Colors } from '../../constants/colors';

export default function AuthLayout() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (session) return <Redirect href="/(tabs)/cellar" />;

  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}
