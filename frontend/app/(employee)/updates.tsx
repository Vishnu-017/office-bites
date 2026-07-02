import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/src/context/AuthContext';
import { apiCall, wsUrl } from '@/src/api/client';
import { theme } from '@/src/theme';

interface UpdateItem { id: string; title: string; body: string; priority: string; pinned: boolean; created_at: string; }

export default function EmployeeUpdates() {
  const { user } = useAuth();
  const [items, setItems] = useState<UpdateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try { setItems(await apiCall<UpdateItem[]>('/api/updates', user.token)); }
    finally { setLoading(false); setRefreshing(false); }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user) return;
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(wsUrl(user.token));
      ws.onmessage = (e) => { try { const m = JSON.parse(e.data); if (m.type === 'notification') load(); } catch {} };
    } catch {}
    return () => { try { ws?.close(); } catch {} };
  }, [user, load]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}><Text style={styles.title}>Updates</Text></View>
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {loading ? <ActivityIndicator color={theme.color.brand} style={{ marginTop: 40 }} /> : items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="megaphone-outline" size={64} color={theme.color.onSurfaceTertiary} />
            <Text style={styles.emptyText}>No updates yet</Text>
          </View>
        ) : items.map(u => (
          <View key={u.id} style={[styles.card, u.pinned && styles.pinned]} testID={`update-${u.id}`}>
            {u.pinned && (
              <View style={styles.pinRow}>
                <Ionicons name="pin" size={12} color={theme.color.brand} />
                <Text style={styles.pinLabel}>PINNED</Text>
              </View>
            )}
            <View style={styles.titleRow}>
              <Text style={styles.updateTitle}>{u.title}</Text>
              {u.priority === 'high' && (
                <View style={styles.priorityTag}><Text style={styles.priorityText}>HIGH</Text></View>
              )}
            </View>
            <Text style={styles.body}>{u.body}</Text>
            <Text style={styles.time}>{new Date(u.created_at).toLocaleString()}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.surface },
  header: { paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.color.divider },
  title: { fontSize: theme.font.xl, fontWeight: '700', color: theme.color.onSurface },
  empty: { alignItems: 'center', paddingVertical: 80, gap: theme.spacing.md },
  emptyText: { color: theme.color.onSurfaceSecondary, fontSize: theme.font.lg },
  card: { backgroundColor: theme.color.surfaceSecondary, borderRadius: theme.radius.lg, padding: theme.spacing.lg, marginBottom: theme.spacing.md },
  pinned: { borderWidth: 2, borderColor: theme.color.brand, backgroundColor: theme.color.brandTertiary },
  pinRow: { flexDirection: 'row', gap: 4, alignItems: 'center', marginBottom: theme.spacing.sm },
  pinLabel: { color: theme.color.brand, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: theme.spacing.sm },
  updateTitle: { flex: 1, fontSize: theme.font.lg, fontWeight: '700', color: theme.color.onSurface },
  priorityTag: { backgroundColor: theme.color.error, paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.sm },
  priorityText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  body: { fontSize: theme.font.base, color: theme.color.onSurfaceSecondary, marginTop: theme.spacing.sm, lineHeight: 20 },
  time: { fontSize: theme.font.sm, color: theme.color.onSurfaceTertiary, marginTop: theme.spacing.md },
});
