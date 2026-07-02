import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, RefreshControl, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/src/context/AuthContext';
import { apiCall, wsUrl } from '@/src/api/client';
import { theme } from '@/src/theme';
import { fmtISTDate } from '@/src/utils/datetime';

interface Summary {
  orders_today: number; orders_week: number; total_users: number;
  weekly_trend: { date: string; orders: number }[];
  top_items: { name: string; quantity: number }[];
}

interface PollTrend { date: string; lunch_yes: number; lunch_no: number; snacks_yes: number; snacks_no: number; }

const API = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export default function AdminDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<Summary | null>(null);
  const [polls, setPolls] = useState<PollTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [s, p] = await Promise.all([
        apiCall<Summary>('/api/analytics/summary', user.token),
        apiCall<{ trend: PollTrend[] }>('/api/analytics/polls', user.token),
      ]);
      setData(s); setPolls(p.trend);
    } finally { setLoading(false); setRefreshing(false); }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Live refresh via WebSocket
  useEffect(() => {
    if (!user) return;
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(wsUrl(user.token));
      ws.onmessage = (e) => {
        try {
          const m = JSON.parse(e.data);
          if (m.type === 'poll_vote' || m.type === 'order_new' || m.type === 'order_update') load();
        } catch {}
      };
    } catch {}
    return () => { try { ws?.close(); } catch {} };
  }, [user, load]);

  // Poll fallback every 15s
  useEffect(() => {
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const exportCsv = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API}/api/analytics/export`, { headers: { Authorization: `Bearer ${user.token}` } });
      const text = await res.text();
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const blob = new Blob([text], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `orders_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
        URL.revokeObjectURL(url);
        setMsg('CSV downloaded');
      } else {
        setMsg(`Report ready (${text.split(String.fromCharCode(10)).length - 1} rows)`);
      }
      setTimeout(() => setMsg(''), 2500);
    } catch { setMsg('Export failed'); }
  };

  const todayPoll = polls[0] || { lunch_yes: 0, lunch_no: 0, snacks_yes: 0, snacks_no: 0, date: '' };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.color.brand} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Reports & Analytics</Text>
            <Text style={styles.subtitle}>Live overview · IST</Text>
          </View>
          <Pressable style={styles.exportBtn} onPress={exportCsv} testID="export-csv-btn">
            <Ionicons name="download-outline" size={16} color={theme.color.brand} />
            <Text style={styles.exportText}>Export CSV</Text>
          </Pressable>
        </View>

        {msg ? <Text style={styles.msg}>{msg}</Text> : null}

        {loading ? <ActivityIndicator color={theme.color.brand} style={{ marginTop: 40 }} /> : data && (
          <>
            <View style={styles.kpiGrid}>
              <View style={styles.kpi} testID="kpi-orders">
                <Ionicons name="receipt" size={22} color={theme.color.brand} />
                <Text style={styles.kpiValue}>{data.orders_today}</Text>
                <Text style={styles.kpiLabel}>Orders Today</Text>
              </View>
              <View style={styles.kpi} testID="kpi-week">
                <Ionicons name="calendar" size={22} color={theme.color.brandSecondary} />
                <Text style={styles.kpiValue}>{data.orders_week}</Text>
                <Text style={styles.kpiLabel}>Orders (7d)</Text>
              </View>
              <View style={styles.kpi} testID="kpi-lunch">
                <Ionicons name="restaurant" size={22} color={theme.color.success} />
                <Text style={styles.kpiValue}>{todayPoll.lunch_yes}</Text>
                <Text style={styles.kpiLabel}>Lunch — Yes</Text>
              </View>
              <View style={styles.kpi} testID="kpi-snacks">
                <Ionicons name="cafe" size={22} color={theme.color.info} />
                <Text style={styles.kpiValue}>{todayPoll.snacks_yes}</Text>
                <Text style={styles.kpiLabel}>Snacks — Yes</Text>
              </View>
            </View>

            <View style={styles.chartCard}>
              <Text style={styles.sectionTitle}>Today's Poll Response</Text>
              <View style={styles.pollTallyRow}>
                <View style={styles.pollCell}>
                  <View style={styles.pollHead}>
                    <Ionicons name="restaurant" size={18} color={theme.color.brand} />
                    <Text style={styles.pollKind}>LUNCH</Text>
                  </View>
                  <View style={styles.pollBars}>
                    <View style={styles.pollBarRow}>
                      <Text style={styles.pollIcon}>✅</Text>
                      <Text style={styles.pollBarNum}>{todayPoll.lunch_yes}</Text>
                    </View>
                    <View style={styles.pollBarRow}>
                      <Text style={styles.pollIcon}>❌</Text>
                      <Text style={[styles.pollBarNum, { color: theme.color.error }]}>{todayPoll.lunch_no}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.pollCell}>
                  <View style={styles.pollHead}>
                    <Ionicons name="cafe" size={18} color={theme.color.brand} />
                    <Text style={styles.pollKind}>SNACKS</Text>
                  </View>
                  <View style={styles.pollBars}>
                    <View style={styles.pollBarRow}>
                      <Text style={styles.pollIcon}>✅</Text>
                      <Text style={styles.pollBarNum}>{todayPoll.snacks_yes}</Text>
                    </View>
                    <View style={styles.pollBarRow}>
                      <Text style={styles.pollIcon}>❌</Text>
                      <Text style={[styles.pollBarNum, { color: theme.color.error }]}>{todayPoll.snacks_no}</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.chartCard}>
              <Text style={styles.sectionTitle}>Most Ordered Items</Text>
              {data.top_items.length === 0 ? (
                <Text style={styles.emptyText}>No orders yet</Text>
              ) : data.top_items.map((it, i) => (
                <View key={it.name} style={styles.topRow} testID={`top-item-${i}`}>
                  <View style={styles.topRankBadge}><Text style={styles.topRankText}>{i + 1}</Text></View>
                  <Text style={styles.topName}>{it.name}</Text>
                  <Text style={styles.topQty}>{it.quantity} orders</Text>
                </View>
              ))}
            </View>

            <View style={styles.chartCard}>
              <Text style={styles.sectionTitle}>Poll Participation History</Text>
              {polls.length === 0 ? <Text style={styles.emptyText}>No poll responses yet</Text> : polls.map(p => (
                <View key={p.date} style={styles.pollTrendRow}>
                  <Text style={styles.pollDate}>{fmtISTDate(p.date)}</Text>
                  <Text style={styles.pollStat}>🍛 {p.lunch_yes}/{p.lunch_yes + p.lunch_no}</Text>
                  <Text style={styles.pollStat}>☕ {p.snacks_yes}/{p.snacks_yes + p.snacks_no}</Text>
                </View>
              ))}
            </View>

            <View style={styles.chartCard}>
              <Text style={styles.sectionTitle}>Manage</Text>
              <Pressable style={styles.linkBtn} onPress={() => router.push('/(admin)/users')} testID="manage-users-btn">
                <View style={styles.linkIcon}><Ionicons name="people" size={20} color={theme.color.brand} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.linkText}>Employee & Cook Accounts</Text>
                  <Text style={styles.linkSub}>Add, edit and manage user access</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.color.onSurfaceTertiary} />
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.surface },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg },
  title: { fontSize: theme.font.xxl, fontWeight: '700', color: theme.color.onSurface },
  subtitle: { fontSize: theme.font.sm, color: theme.color.onSurfaceSecondary, marginTop: 2 },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: theme.color.brand, paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.radius.pill },
  exportText: { color: theme.color.brand, fontWeight: '700', fontSize: theme.font.sm },
  msg: { color: theme.color.success, marginBottom: theme.spacing.md, textAlign: 'center', fontWeight: '600' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md, marginBottom: theme.spacing.lg },
  kpi: { width: '47%', padding: theme.spacing.lg, backgroundColor: theme.color.surfaceSecondary, borderRadius: theme.radius.lg, gap: 4 },
  kpiValue: { fontSize: 32, fontWeight: '700', color: theme.color.onSurface, marginTop: theme.spacing.sm },
  kpiLabel: { fontSize: theme.font.sm, color: theme.color.onSurfaceSecondary, fontWeight: '600' },
  chartCard: { backgroundColor: theme.color.surfaceSecondary, borderRadius: theme.radius.lg, padding: theme.spacing.lg, marginBottom: theme.spacing.lg },
  sectionTitle: { fontSize: theme.font.lg, fontWeight: '700', color: theme.color.onSurface, marginBottom: theme.spacing.md },
  emptyText: { color: theme.color.onSurfaceSecondary, textAlign: 'center', paddingVertical: theme.spacing.lg },
  pollTallyRow: { flexDirection: 'row', gap: theme.spacing.md },
  pollCell: { flex: 1, backgroundColor: theme.color.surface, padding: theme.spacing.md, borderRadius: theme.radius.md },
  pollHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: theme.spacing.md },
  pollKind: { fontSize: theme.font.sm, fontWeight: '700', color: theme.color.brand, letterSpacing: 1 },
  pollBars: { gap: theme.spacing.sm },
  pollBarRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  pollIcon: { fontSize: 18 },
  pollBarNum: { fontSize: 22, fontWeight: '700', color: theme.color.success },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.color.border },
  topRankBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.color.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  topRankText: { color: theme.color.brand, fontWeight: '700' },
  topName: { flex: 1, color: theme.color.onSurface, fontSize: theme.font.base, fontWeight: '600' },
  topQty: { color: theme.color.onSurfaceSecondary, fontSize: theme.font.sm, fontWeight: '600' },
  pollTrendRow: { flexDirection: 'row', paddingVertical: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.color.border, gap: theme.spacing.md, alignItems: 'center' },
  pollDate: { flex: 1, fontSize: theme.font.sm, color: theme.color.onSurfaceSecondary, fontWeight: '600' },
  pollStat: { fontSize: theme.font.sm, color: theme.color.onSurface, fontWeight: '700' },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, padding: theme.spacing.md, backgroundColor: theme.color.surface, borderRadius: theme.radius.md },
  linkIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.color.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  linkText: { color: theme.color.onSurface, fontWeight: '700', fontSize: theme.font.base },
  linkSub: { color: theme.color.onSurfaceSecondary, fontSize: theme.font.sm, marginTop: 2 },
});
