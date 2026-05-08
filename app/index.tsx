import { Redirect } from 'expo-router';
import { useAuth } from '../lib/auth';
import { View, ActivityIndicator } from 'react-native';
import { Colors } from '../constants/colors';

export default function Index() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (session) return <Redirect href="/(tabs)/cellar" />;
  return <Redirect href="/(auth)/login" />;
}
