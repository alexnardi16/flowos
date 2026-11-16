import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { palette } from '@/components/ui';
import { useAuth } from '../providers/AuthProvider';

export default function Index() {
  const { session, loading, configured } = useAuth();
  if (loading) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.bg }}><ActivityIndicator color={palette.primary}/></View>;
  }
  if (configured && !session) return <Redirect href="/login" />;
  return <Redirect href="/today" />;
}
