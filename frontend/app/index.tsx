import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { theme } from '@/src/theme';

export default function Index() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
    } else if (user.role === 'employee') {
      router.replace('/(employee)/menu');
    } else if (user.role === 'cook') {
      router.replace('/(cook)/dashboard');
    } else if (user.role === 'admin') {
      router.replace('/(admin)/dashboard');
    }
  }, [user, loading]);

  return (
    <View style={styles.container} testID="splash-screen">
      <ActivityIndicator size="large" color={theme.color.brand} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color.surface },
});
