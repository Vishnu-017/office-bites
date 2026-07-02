import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, RefreshControl, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/src/context/AuthContext';
import { apiCall } from '@/src/api/client';
import { theme } from '@/src/theme';

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
      setData(s);
      setPolls(p.trend);
    } finally { setLoading(false); setRefreshing(false); }
  }, [user]);

  useEffect(() => { load(); }, [load]);

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
        setMsg(`Report ready (${text.split('\n').length - 1} rows)`);
      }
      setTimeout(() => setMsg(''), 2500);
    } catch { setMsg('Export failed'); }
  };

  const maxOrders = data?.weekly_trend.reduce((m, d) => Math.max(m, d.orders), 1) || 1;

  const todayPoll = polls[0] || { lunch_yes: 0, lunch_no: 0, snacks_yes: 0, snacks_no: 0, date: '' };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Reports & Analytics</Text>
            <Text style={styles.subtitle}>Today's overview</Text>
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
                <Ionicons name="receipt" size={20} color={theme.color.brand} />
                <Text style={styles.kpiValue}>{data.orders_today}</Text>
                <Text style={styles.kpiLabel}>Orders Today</Text>
              </View>
              <View style={styles.kpi} testID="kpi-week">
                <Ionicons name="calendar" size={20} color={theme.color.brandSecondary} />
                <Text style={styles.kpiValue}>{data.orders_week}</Text>
                <Text style={styles.kpiLabel}>Orders (7d)</Text>
              </View>
              <View style={styles.kpi} testID="kpi-lunch">
                <Ionicons name="restaurant" size={20} color={theme.color.success} />
                <Text style={styles.kpiValue}>{todayPoll.lunch_yes}</Text>
                <Text style={styles.kpiLabel}>Lunch (Yes)</Text>
              </View>
              <View style={styles.kpi} testID="kpi-snacks">
                <Ionicons name="cafe" size={20} color={theme.color.info} />
                <Text style={styles.kpiValue}>{todayPoll.snacks_yes}</Text>
                <Text style={styles.kpiLabel}>Snacks (Yes)</Text>
              </View>
            </View>

            <View style={styles.chartCard}>
              <Text style={styles.sectionTitle}>Today's Poll Response</Text>
              <View style={styles.pollTallyRow}>
                <View style={styles.pollCell}>
                  <Text style={styles.pollKind}>LUNCH</Text>
                  <Text style={styles.pollYes}>✅ {todayPoll.lunch_yes}</Text>
                  <Text style={styles.pollNo}>❌ {todayPoll.lunch_no}</Text>
                </View>
                <View style={styles.pollCell}>
                  <Text style={styles.pollKind}>SNACKS</Text>
                  <Text style={styles.pollYes}>✅ {todayPoll.snacks_yes}</Text>
                  <Text style={styles.pollNo}>❌ {todayPoll.snacks_no}</Text>
                </View>
              </View>
            </View>

            <View style={styles.chartCard}>
              <Text style={styles.sectionTitle}>Weekly Order Volume</Text>
              <View style={styles.chart}>
                {data.weekly_trend.length === 0 ? (
                  <Text style={styles.emptyText}>No orders in the last 7 days</Text>
                ) : data.weekly_trend.map(d => (
                  <View key={d.date} style={styles.bar}>
                    <View style={[styles.barFill, { height: `${(d.orders / maxOrders) * 100}%` }]} />
                    <Text style={styles.barLabel}>{d.date.slice(5)}</Text>
                    <Text style={styles.barValue}>{d.orders}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.chartCard}>
              <Text style={styles.sectionTitle}>Poll Participation Trend</Text>
              {polls.length === 0 ? <Text style={styles.emptyText}>No poll responses yet</Text> : polls.map(p => (
                <View key={p.date} style={styles.pollTrendRow}>
                  <Text style={styles.pollDate}>{p.date}</Text>
                  <Text style={styles.pollStat}>🍛 {p.lunch_yes}/{p.lunch_yes + p.lunch_no}</Text>
                  <Text style={styles.pollStat}>☕ {p.snacks_yes}/{p.snacks_yes + p.snacks_no}</Text>
                </View>
              ))}
            </View>

            <View style={styles.chartCard}>
              <Text style={styles.sectionTitle}>Most Ordered Items</Text>
              {data.top_items.length === 0 ? (
                <Text style={styles.emptyText}>No orders yet</Text>
              ) : data.top_items.map((it, i) => (
                <View key={it.name} style={styles.topRow} testID={`top-item-${i}`}>
                  <Text style={styles.topRank}>#{i + 1}</Text>
                  <Text style={styles.topName}>{it.name}</Text>
                  <Text style={styles.topQty}>{it.quantity} orders</Text>
                </View>
              ))}
            </View>

            <View style={styles.chartCard}>
              <Text style={styles.sectionTitle}>Manage</Text>
              <Pressable style={styles.linkBtn} onPress={() => router.push('/(admin)/users')} testID="manage-users-btn">
                <Ionicons name="people" size={20} color={theme.color.brand} />
                <Text style={styles.linkText}>Employee & Cook Accounts</Text>
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
  subtitle: { fontSize: theme.font.sm, color: theme.color.onSurfaceSecondary },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: theme.color.brand, paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.radius.pill },
  exportText: { color: theme.color.brand, fontWeight: '700', fontSize: theme.font.sm },
  msg: { color: theme.color.success, marginBottom: theme.spacing.md, textAlign: 'center', fontWeight: '600' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md, marginBottom: theme.spacing.lg },
  kpi: { width: '47%', padding: theme.spacing.md, backgroundColor: theme.color.surfaceSecondary, borderRadius: theme.radius.md, gap: 4 },
  kpiValue: { fontSize: theme.font.xxl, fontWeight: '700', color: theme.color.onSurface, marginTop: 4 },
  kpiLabel: { fontSize: theme.font.sm, color: theme.color.onSurfaceSecondary },
  chartCard: { backgroundColor: theme.color.surfaceSecondary, borderRadius: theme.radius.lg, padding: theme.spacing.lg, marginBottom: theme.spacing.lg },
  sectionTitle: { fontSize: theme.font.lg, fontWeight: '700', color: theme.color.onSurface, marginBottom: theme.spacing.md },
  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 140, gap: 6 },
  bar: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barFill: { width: '80%', backgroundColor: theme.color.brand, borderTopLeftRadius: 6, borderTopRightRadius: 6, minHeight: 4 },
  barLabel: { fontSize: 10, color: theme.color.onSurfaceSecondary, marginTop: 4 },
  barValue: { fontSize: 10, fontWeight: '700', color: theme.color.brand },
  emptyText: { color: theme.color.onSurfaceSecondary, textAlign: 'center', paddingVertical: theme.spacing.lg },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.color.border },
  topRank: { fontWeight: '700', color: theme.color.brand, width: 32 },
  topName: { flex: 1, color: theme.color.onSurface, fontSize: theme.font.base, fontWeight: '600' },
  topQty: { color: theme.color.onSurfaceSecondary, fontSize: theme.font.sm },
  pollTallyRow: { flexDirection: 'row', gap: theme.spacing.sm },
  pollCell: { flex: 1, backgroundColor: theme.color.surface, padding: theme.spacing.md, borderRadius: theme.radius.md, alignItems: 'center' },
  pollKind: { fontSize: theme.font.sm, fontWeight: '700', color: theme.color.brand, letterSpacing: 1, marginBottom: theme.spacing.sm },
  pollYes: { fontSize: theme.font.xl, fontWeight: '700', color: theme.color.success },
  pollNo: { fontSize: theme.font.base, color: theme.color.error, marginTop: 4 },
  pollTrendRow: { flexDirection: 'row', paddingVertical: theme.spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.color.border, gap: theme.spacing.md, alignItems: 'center' },
  pollDate: { flex: 1, fontSize: theme.font.sm, color: theme.color.onSurfaceSecondary, fontWeight: '600' },
  pollStat: { fontSize: theme.font.sm, color: theme.color.onSurface, fontWeight: '600' },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, padding: theme.spacing.md, backgroundColor: theme.color.surface, borderRadius: theme.radius.md },
  linkText: { flex: 1, color: theme.color.onSurface, fontWeight: '600', fontSize: theme.font.base },
});
