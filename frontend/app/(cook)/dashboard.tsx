import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/src/context/AuthContext';
import { apiCall, wsUrl } from '@/src/api/client';
import { theme } from '@/src/theme';

interface Order {
  id: string; employee_id: string; employee_name: string;
  items: { name: string; quantity: number; price: number }[];
  total: number; status: string; notes?: string; created_at: string;
}

const FILTERS = [
  { key: 'active', label: 'Active' },
  { key: 'pending', label: 'New' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'ready', label: 'Ready' },
  { key: 'completed', label: 'Done' },
];

const NEXT_ACTION: Record<string, { next: string; label: string; color: string }> = {
  pending: { next: 'accepted', label: 'Accept', color: '#3B82F6' },
  accepted: { next: 'preparing', label: 'Start Prep', color: theme.color.brandSecondary },
  preparing: { next: 'ready', label: 'Mark Ready', color: theme.color.success },
  ready: { next: 'completed', label: 'Mark Done', color: theme.color.info },
};

function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const s = Math.max(0, Math.floor((Date.now() - d) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function CookDashboard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('active');
  const [, tick] = useState(0);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const scope = filter === 'active' ? 'active' : 'all';
      const data = await apiCall<Order[]>(`/api/orders?scope=${scope}`, user.token);
      setOrders(data);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [user, filter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setInterval(() => tick(x => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!user) return;
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(wsUrl(user.token));
      ws.onmessage = (e) => { try { const m = JSON.parse(e.data); if (m.type?.startsWith('order_')) load(); } catch {} };
    } catch {}
    return () => { try { ws?.close(); } catch {} };
  }, [user, load]);

  const filtered = useMemo(() => {
    if (filter === 'active') return orders;
    return orders.filter(o => o.status === filter);
  }, [orders, filter]);

  const updateStatus = async (id: string, next: string) => {
    if (!user) return;
    await apiCall(`/api/orders/${id}/status`, user.token, {
      method: 'PUT',
      body: JSON.stringify({ status: next }),
    });
    load();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Kitchen Display</Text>
          <Text style={styles.subtitle}>{filtered.length} orders</Text>
        </View>
        <View style={styles.liveDot}><View style={styles.dot} /><Text style={styles.liveText}>LIVE</Text></View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {FILTERS.map(f => (
          <Pressable
            key={f.key}
            testID={`cook-filter-${f.key}`}
            style={[styles.chip, filter === f.key && styles.chipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#fff" />}
      >
        {loading ? (
          <ActivityIndicator color={theme.color.brandSecondary} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="checkmark-done-circle" size={72} color={theme.color.kdsTextMuted} />
            <Text style={styles.emptyText}>Kitchen is clear!</Text>
            <Text style={styles.emptySub}>No pending orders.</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {filtered.map(o => {
              const action = NEXT_ACTION[o.status];
              return (
                <View key={o.id} style={styles.ticket} testID={`kds-ticket-${o.id}`}>
                  <View style={styles.ticketHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.ticketName} numberOfLines={1}>{o.employee_name}</Text>
                      <Text style={styles.ticketId}>{o.employee_id} · #{o.id.slice(0, 6).toUpperCase()}</Text>
                    </View>
                    <Text style={styles.ticketTimer}>{timeAgo(o.created_at)}</Text>
                  </View>
                  <View style={styles.tagRow}>
                    <View style={[styles.tag, { backgroundColor: statusBg(o.status) }]}>
                      <Text style={styles.tagText}>{o.status.toUpperCase()}</Text>
                    </View>
                  </View>
                  <View style={styles.divider} />
                  {o.items.map((it, i) => (
                    <View key={i} style={styles.itemRow}>
                      <Text style={styles.itemQty}>×{it.quantity}</Text>
                      <Text style={styles.itemName}>{it.name}</Text>
                    </View>
                  ))}
                  {o.notes ? (
                    <View style={styles.noteBox}>
                      <Text style={styles.noteText}>📝 {o.notes}</Text>
                    </View>
                  ) : null}

                  {action && (
                    <Pressable
                      testID={`kds-action-${o.id}`}
                      style={[styles.actionBtn, { backgroundColor: action.color }]}
                      onPress={() => updateStatus(o.id, action.next)}
                    >
                      <Text style={styles.actionText}>{action.label}</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function statusBg(s: string): string {
  switch (s) {
    case 'pending': return '#F59E0B';
    case 'accepted': return '#3B82F6';
    case 'preparing': return theme.color.brandSecondary;
    case 'ready': return theme.color.success;
    case 'completed': return '#52525B';
    default: return '#52525B';
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.kdsBg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: theme.spacing.lg },
  title: { fontSize: 24, fontWeight: '700', color: theme.color.kdsText },
  subtitle: { fontSize: theme.font.sm, color: theme.color.kdsTextMuted, marginTop: 2 },
  liveDot: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2C2C2E', paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radius.pill },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.color.success },
  liveText: { color: theme.color.kdsText, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  chipRow: { paddingHorizontal: theme.spacing.md, gap: theme.spacing.sm, paddingBottom: theme.spacing.md },
  chip: { paddingHorizontal: 14, height: 36, borderRadius: theme.radius.pill, backgroundColor: theme.color.kdsCard, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  chipActive: { backgroundColor: theme.color.brandSecondary },
  chipText: { color: theme.color.kdsTextMuted, fontSize: theme.font.sm, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
  ticket: { width: '100%', backgroundColor: theme.color.kdsCard, borderRadius: theme.radius.md, padding: theme.spacing.lg, borderLeftWidth: 4, borderLeftColor: theme.color.brandSecondary },
  ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: theme.spacing.sm },
  ticketName: { fontSize: 20, fontWeight: '700', color: theme.color.kdsText },
  ticketId: { fontSize: theme.font.sm, color: theme.color.kdsTextMuted, marginTop: 2, fontFamily: 'monospace' },
  ticketTimer: { fontSize: theme.font.lg, color: theme.color.brandSecondary, fontFamily: 'monospace', fontWeight: '700' },
  tagRow: { flexDirection: 'row', marginTop: theme.spacing.sm },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.sm },
  tagText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  customer: { color: theme.color.kdsTextMuted, fontSize: theme.font.sm, marginTop: theme.spacing.sm },
  divider: { height: 1, backgroundColor: '#2C2C2E', marginVertical: theme.spacing.md },
  itemRow: { flexDirection: 'row', gap: theme.spacing.md, paddingVertical: 4, alignItems: 'center' },
  itemQty: { color: theme.color.brandSecondary, fontWeight: '700', fontSize: theme.font.lg, minWidth: 32 },
  itemName: { color: theme.color.kdsText, fontSize: theme.font.lg, flex: 1 },
  noteBox: { marginTop: theme.spacing.sm, backgroundColor: '#2C2C2E', padding: theme.spacing.sm, borderRadius: theme.radius.sm },
  noteText: { color: theme.color.kdsTextMuted, fontSize: theme.font.sm },
  actionBtn: { marginTop: theme.spacing.md, paddingVertical: 16, borderRadius: theme.radius.md, alignItems: 'center', minHeight: 48 },
  actionText: { color: '#fff', fontSize: theme.font.lg, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 100, gap: theme.spacing.md },
  emptyText: { color: theme.color.kdsText, fontSize: theme.font.xl, fontWeight: '700' },
  emptySub: { color: theme.color.kdsTextMuted, fontSize: theme.font.base },
});
