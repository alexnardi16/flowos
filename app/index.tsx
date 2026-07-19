import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../providers/AuthProvider';

export default function Index() {
  const { session, loading, configured } = useAuth();
  if (loading) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></View>;
  }
  if (configured && !session) return <Redirect href="/login" />;
  return <Redirect href="/(tabs)" />;
}
