import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/src/context/AuthContext';
import { theme } from '@/src/theme';

export default function AdminProfile() {
  const { user, logout } = useAuth();
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
        <Text style={styles.title}>Profile</Text>
        <View style={styles.card}>
          <View style={styles.avatar}><Ionicons name="shield-checkmark" size={40} color="#fff" /></View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.role}>ADMIN · {user?.employee_id}</Text>
        </View>
        <Pressable style={styles.logoutBtn} onPress={async () => { await logout(); router.replace('/login'); }} testID="logout-btn">
          <Ionicons name="log-out-outline" size={20} color={theme.color.error} />
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.surface },
  title: { fontSize: theme.font.xl, fontWeight: '700', color: theme.color.onSurface, marginBottom: theme.spacing.lg },
  card: { alignItems: 'center', padding: theme.spacing.xl, backgroundColor: theme.color.surfaceSecondary, borderRadius: theme.radius.lg, marginBottom: theme.spacing.lg },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: theme.color.brand, alignItems: 'center', justifyContent: 'center', marginBottom: theme.spacing.md },
  name: { fontSize: theme.font.xl, fontWeight: '700', color: theme.color.onSurface },
  role: { fontSize: theme.font.sm, color: theme.color.onSurfaceSecondary, marginTop: 4, letterSpacing: 1 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: theme.spacing.lg, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.color.error },
  logoutText: { color: theme.color.error, fontWeight: '700', fontSize: theme.font.lg },
});
