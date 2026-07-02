import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/src/context/AuthContext';
import { apiCall, wsUrl } from '@/src/api/client';
import { theme, statusColor } from '@/src/theme';

interface Order {
  id: string; employee_id: string; employee_name: string;
  items: { name: string; quantity: number; price: number }[];
  total: number; status: string; created_at: string; updated_at: string;
}

const STATUSES = ['pending', 'accepted', 'preparing', 'ready', 'completed'];
const ACTIVE = new Set(['pending', 'accepted', 'preparing', 'ready']);

export default function EmployeeOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'active' | 'history'>('active');

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const data = await apiCall<Order[]>('/api/orders?scope=mine', user.token);
      setOrders(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user) return;
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(wsUrl(user.token));
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'order_update' || msg.type === 'notification') load();
        } catch {}
      };
    } catch {}
    return () => { try { ws?.close(); } catch {} };
  }, [user, load]);

  const filtered = useMemo(() => orders.filter(o => tab === 'active' ? ACTIVE.has(o.status) : !ACTIVE.has(o.status)), [orders, tab]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>My Orders</Text>
      </View>
      <View style={styles.tabs}>
        <Pressable testID="orders-tab-active" style={[styles.tab, tab === 'active' && styles.tabActive]} onPress={() => setTab('active')}>
          <Text style={[styles.tabText, tab === 'active' && styles.tabTextActive]}>Active ({orders.filter(o => ACTIVE.has(o.status)).length})</Text>
        </Pressable>
        <Pressable testID="orders-tab-history" style={[styles.tab, tab === 'history' && styles.tabActive]} onPress={() => setTab('history')}>
          <Text style={[styles.tabText, tab === 'history' && styles.tabTextActive]}>History ({orders.filter(o => !ACTIVE.has(o.status)).length})</Text>
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {loading ? (
          <ActivityIndicator color={theme.color.brand} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={64} color={theme.color.onSurfaceTertiary} />
            <Text style={styles.emptyText}>{tab === 'active' ? 'No active orders' : 'No past orders'}</Text>
          </View>
        ) : (
          filtered.map(o => (
            <View key={o.id} style={styles.card} testID={`order-card-${o.id}`}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.orderId}>#{o.id.slice(0, 8).toUpperCase()}</Text>
                  <Text style={styles.orderTime}>{new Date(o.created_at).toLocaleString()}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusColor(o.status) }]}>
                  <Text style={styles.statusText}>{o.status.toUpperCase()}</Text>
                </View>
              </View>

              {STATUSES.includes(o.status) && (
                <View style={styles.timeline}>
                  {STATUSES.map((s, idx) => {
                    const currentIdx = STATUSES.indexOf(o.status);
                    const active = idx <= currentIdx;
                    return (
                      <View key={s} style={styles.timelineStep}>
                        <View style={[styles.timelineDot, active && { backgroundColor: theme.color.brand }]}>
                          {active && <Ionicons name="checkmark" size={10} color={theme.color.onBrandPrimary} />}
                        </View>
                        {idx < STATUSES.length - 1 && <View style={[styles.timelineLine, active && idx < currentIdx && { backgroundColor: theme.color.brand }]} />}
                      </View>
                    );
                  })}
                </View>
              )}
              <View style={styles.timelineLabels}>
                {STATUSES.map(s => <Text key={s} style={styles.timelineLabel}>{s}</Text>)}
              </View>

              <View style={styles.divider} />
              {o.items.map((it, i) => (
                <View key={i} style={styles.itemRow}>
                  <Text style={styles.itemName}>{it.name} × {it.quantity}</Text>
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.surface },
  header: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md },
  title: { fontSize: theme.font.xl, fontWeight: '700', color: theme.color.onSurface },
  tabs: { flexDirection: 'row', paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, gap: theme.spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.color.divider },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: theme.radius.pill, backgroundColor: theme.color.surfaceSecondary },
  tabActive: { backgroundColor: theme.color.brand },
  tabText: { color: theme.color.onSurfaceSecondary, fontWeight: '600', fontSize: theme.font.sm },
  tabTextActive: { color: theme.color.onBrandPrimary },
  empty: { alignItems: 'center', paddingVertical: 80, gap: theme.spacing.md },
  emptyText: { fontSize: theme.font.lg, color: theme.color.onSurfaceSecondary },
  card: { backgroundColor: theme.color.surfaceSecondary, borderRadius: theme.radius.lg, padding: theme.spacing.lg, marginBottom: theme.spacing.md },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.spacing.md },
  orderId: { fontSize: theme.font.lg, fontWeight: '700', color: theme.color.onSurface },
  orderTime: { fontSize: theme.font.sm, color: theme.color.onSurfaceSecondary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: theme.radius.pill },
  statusText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  timeline: { flexDirection: 'row', alignItems: 'center', marginTop: theme.spacing.sm },
  timelineStep: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  timelineDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: theme.color.surfaceTertiary, alignItems: 'center', justifyContent: 'center' },
  timelineLine: { flex: 1, height: 2, backgroundColor: theme.color.surfaceTertiary, marginHorizontal: 2 },
  timelineLabels: { flexDirection: 'row', marginTop: 6 },
  timelineLabel: { flex: 1, fontSize: 9, color: theme.color.onSurfaceTertiary, textTransform: 'capitalize', textAlign: 'left' },
  divider: { height: 1, backgroundColor: theme.color.border, marginVertical: theme.spacing.md },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  itemName: { fontSize: theme.font.base, color: theme.color.onSurface },
});
