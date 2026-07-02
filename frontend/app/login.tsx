import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/src/context/AuthContext';
import { theme } from '@/src/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError('');
    if (!employeeId.trim() || !password.trim()) {
      setError('Please enter both Employee ID and password');
      return;
    }
    setLoading(true);
    try {
      const u = await login(employeeId.trim(), password);
      if (u.role === 'employee') router.replace('/(employee)/menu');
      else if (u.role === 'cook') router.replace('/(cook)/dashboard');
      else router.replace('/(admin)/dashboard');
    } catch (e: any) {
      setError(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const quickFill = (id: string, pw: string) => {
    setEmployeeId(id);
    setPassword(pw);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.logoWrap}>
            <View style={styles.logo} testID="app-logo">
              <Ionicons name="restaurant" size={40} color={theme.color.onBrandPrimary} />
            </View>
            <Text style={styles.title}>OfficeBites</Text>
            <Text style={styles.subtitle}>Order your breakfast, before the day begins.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Employee ID or Email</Text>
            <TextInput
              testID="login-employee-id-input"
              style={styles.input}
              placeholder="e.g. EMP001"
              placeholderTextColor={theme.color.onSurfaceTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              value={employeeId}
              onChangeText={setEmployeeId}
            />

            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                testID="login-password-input"
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="••••••••"
                placeholderTextColor={theme.color.onSurfaceTertiary}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <Pressable testID="toggle-password-btn" onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={theme.color.onSurfaceSecondary} />
              </Pressable>
            </View>

            {error ? <Text style={styles.error} testID="login-error">{error}</Text> : null}

            <Pressable testID="login-submit-button" style={[styles.primaryBtn, loading && { opacity: 0.7 }]} onPress={onSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color={theme.color.onBrandPrimary} /> : <Text style={styles.primaryBtnText}>Sign In</Text>}
            </Pressable>
          </View>

          <View style={styles.demoBox} testID="demo-accounts">
            <Text style={styles.demoTitle}>Demo Accounts</Text>
            <Pressable testID="quick-fill-employee" onPress={() => quickFill('EMP001', 'emp123')} style={styles.demoRow}>
              <Ionicons name="person" size={16} color={theme.color.brand} />
              <Text style={styles.demoText}>Employee · EMP001 / emp123</Text>
            </Pressable>
            <Pressable testID="quick-fill-cook" onPress={() => quickFill('cook', 'cook123')} style={styles.demoRow}>
              <Ionicons name="restaurant" size={16} color={theme.color.brand} />
              <Text style={styles.demoText}>Cook · cook / cook123</Text>
            </Pressable>
            <Pressable testID="quick-fill-admin" onPress={() => quickFill('admin', 'admin123')} style={styles.demoRow}>
              <Ionicons name="shield-checkmark" size={16} color={theme.color.brand} />
              <Text style={styles.demoText}>Admin · admin / admin123</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.surface },
  container: { padding: theme.spacing.xl, paddingTop: theme.spacing.xxxl },
  logoWrap: { alignItems: 'center', marginBottom: theme.spacing.xxl },
  logo: {
    width: 72, height: 72, borderRadius: theme.radius.lg, backgroundColor: theme.color.brand,
    alignItems: 'center', justifyContent: 'center', marginBottom: theme.spacing.lg,
  },
  title: { fontSize: 28, fontWeight: '700', color: theme.color.onSurface },
  subtitle: { fontSize: theme.font.base, color: theme.color.onSurfaceSecondary, marginTop: theme.spacing.xs, textAlign: 'center' },
  card: {
    backgroundColor: theme.color.surfaceSecondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  label: { fontSize: theme.font.sm, fontWeight: '600', color: theme.color.onSurfaceSecondary, marginBottom: theme.spacing.xs, marginTop: theme.spacing.sm },
  input: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
    fontSize: theme.font.lg,
    color: theme.color.onSurface,
    borderWidth: 1,
    borderColor: theme.color.border,
    marginBottom: theme.spacing.sm,
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
  eyeBtn: { padding: theme.spacing.sm, backgroundColor: theme.color.surface, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.color.border },
  primaryBtn: {
    backgroundColor: theme.color.brand,
    borderRadius: theme.radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },
  primaryBtnText: { color: theme.color.onBrandPrimary, fontSize: theme.font.lg, fontWeight: '700' },
  error: { color: theme.color.error, fontSize: theme.font.sm, marginTop: theme.spacing.sm },
  demoBox: { padding: theme.spacing.lg, backgroundColor: theme.color.brandTertiary, borderRadius: theme.radius.md },
  demoTitle: { fontSize: theme.font.sm, fontWeight: '700', color: theme.color.onBrandTertiary, marginBottom: theme.spacing.sm },
  demoRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.sm },
  demoText: { color: theme.color.onBrandTertiary, fontSize: theme.font.base, fontWeight: '600' },
});
