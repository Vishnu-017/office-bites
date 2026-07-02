import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/src/context/AuthContext';
import { apiCall, wsUrl } from '@/src/api/client';
import { theme } from '@/src/theme';

interface Notif { id: string; title: string; body: string; created_at: string; read: boolean; }

export default function Notifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const data = await apiCall<Notif[]>('/api/notifications', user.token);
      setItems(data);
    } finally { setLoading(false); setRefreshing(false); }
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

  const markAll = async () => {
    if (!user) return;
    await apiCall('/api/notifications/read-all', user.token, { method: 'POST' });
    load();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        {items.some(i => !i.read) && (
          <Pressable onPress={markAll} testID="mark-all-read"><Text style={styles.markAll}>Mark all read</Text></Pressable>
        )}
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
        {loading ? <ActivityIndicator color={theme.color.brand} style={{ marginTop: 40 }} /> : items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={56} color={theme.color.onSurfaceTertiary} />
            <Text style={styles.emptyText}>No notifications</Text>
          </View>
        ) : items.map(n => (
          <View key={n.id} style={[styles.card, !n.read && styles.unread]} testID={`notif-${n.id}`}>
            <View style={styles.iconWrap}><Ionicons name="notifications" size={18} color={theme.color.brand} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.notifTitle}>{n.title}</Text>
              <Text style={styles.notifBody}>{n.body}</Text>
              <Text style={styles.notifTime}>{new Date(n.created_at).toLocaleString()}</Text>
            </View>
            {!n.read && <View style={styles.dot} />}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.surface },
  header: { paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.color.divider, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: theme.font.xl, fontWeight: '700', color: theme.color.onSurface },
  markAll: { color: theme.color.brand, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 80, gap: theme.spacing.md },
  emptyText: { fontSize: theme.font.lg, color: theme.color.onSurfaceSecondary },
  card: { flexDirection: 'row', gap: theme.spacing.md, padding: theme.spacing.md, backgroundColor: theme.color.surfaceSecondary, borderRadius: theme.radius.md, marginBottom: theme.spacing.sm, alignItems: 'flex-start' },
  unread: { backgroundColor: theme.color.brandTertiary },
  iconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.color.surface, alignItems: 'center', justifyContent: 'center' },
  notifTitle: { fontSize: theme.font.base, fontWeight: '700', color: theme.color.onSurface },
  notifBody: { fontSize: theme.font.sm, color: theme.color.onSurfaceSecondary, marginTop: 2 },
  notifTime: { fontSize: 11, color: theme.color.onSurfaceTertiary, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.color.brand, marginTop: 6 },
});
