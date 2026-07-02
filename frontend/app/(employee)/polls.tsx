import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/src/context/AuthContext';
import { apiCall, wsUrl } from '@/src/api/client';
import { theme } from '@/src/theme';
import { fmtISTFriendly } from '@/src/utils/datetime';

interface Poll { id: string; kind: string; title: string; description: string; date: string; closes_at: string; active: boolean; }
interface Item { poll: Poll; my_vote: string | null; yes_count: number; no_count: number; }

export default function EmployeePolls() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    try { setItems(await apiCall<Item[]>('/api/polls/today', user.token)); }
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

  const vote = async (pollId: string, response: 'yes' | 'no') => {
    if (!user) return;
    setMsg('');
    try {
      await apiCall(`/api/polls/${pollId}/vote`, user.token, { method: 'POST', body: JSON.stringify({ response }) });
      setMsg('Your response has been saved');
      setTimeout(() => setMsg(''), 2000);
      load();
    } catch (e: any) {
      setMsg(e.message || 'Failed to vote');
    }
  };

  const lunch = items.find(i => i.poll.kind === 'lunch');
  const snacks = items.find(i => i.poll.kind === 'snacks');

  const renderPoll = (label: string, icon: any, item?: Item) => {
    if (!item) {
      return (
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Ionicons name={icon} size={22} color={theme.color.brand} />
            <Text style={styles.pollLabel}>{label}</Text>
          </View>
          <Text style={styles.empty}>No poll available for today.</Text>
        </View>
      );
    }
    const closed = !item.poll.active || new Date(item.poll.closes_at).getTime() < Date.now();
    return (
      <View style={styles.card} testID={`poll-${item.poll.kind}`}>
        <View style={styles.cardHead}>
          <Ionicons name={icon} size={22} color={theme.color.brand} />
          <Text style={styles.pollLabel}>{label}</Text>
          {closed && <View style={styles.closedTag}><Text style={styles.closedText}>CLOSED</Text></View>}
        </View>
        <Text style={styles.pollTitle}>{item.poll.title}</Text>
        {item.poll.description ? <Text style={styles.pollDesc}>{item.poll.description}</Text> : null}
        <Text style={styles.closesAt}>Closes: {fmtISTFriendly(item.poll.closes_at)}</Text>

        <View style={styles.voteRow}>
          <Pressable
            testID={`vote-${item.poll.kind}-yes`}
            disabled={closed}
            style={[styles.voteBtn, item.my_vote === 'yes' && styles.voteBtnActiveYes, closed && { opacity: 0.5 }]}
            onPress={() => vote(item.poll.id, 'yes')}
          >
            <Ionicons name="checkmark-circle" size={22} color={item.my_vote === 'yes' ? '#fff' : theme.color.success} />
            <Text style={[styles.voteText, item.my_vote === 'yes' && { color: '#fff' }]}>Yes</Text>
          </Pressable>
          <Pressable
            testID={`vote-${item.poll.kind}-no`}
            disabled={closed}
            style={[styles.voteBtn, item.my_vote === 'no' && styles.voteBtnActiveNo, closed && { opacity: 0.5 }]}
            onPress={() => vote(item.poll.id, 'no')}
          >
            <Ionicons name="close-circle" size={22} color={item.my_vote === 'no' ? '#fff' : theme.color.error} />
            <Text style={[styles.voteText, item.my_vote === 'no' && { color: '#fff' }]}>No</Text>
          </Pressable>
        </View>

        {item.my_vote && (
          <Text style={styles.yourVote}>Your response: <Text style={{ fontWeight: '700', color: theme.color.brand }}>{item.my_vote.toUpperCase()}</Text></Text>
        )}
        <View style={styles.tally}>
          <Text style={styles.tallyText}>👍 {item.yes_count} Yes · 👎 {item.no_count} No</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}><Text style={styles.title}>Food Polls</Text></View>
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {msg ? <Text style={styles.msg}>{msg}</Text> : null}
        {loading ? <ActivityIndicator color={theme.color.brand} style={{ marginTop: 40 }} /> : (
          <>
            {renderPoll('Lunch Poll', 'restaurant', lunch)}
            {renderPoll('Snacks Poll', 'cafe', snacks)}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.surface },
  header: { paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.color.divider },
  title: { fontSize: theme.font.xl, fontWeight: '700', color: theme.color.onSurface },
  msg: { color: theme.color.success, marginBottom: theme.spacing.md, textAlign: 'center', fontWeight: '600' },
  card: { backgroundColor: theme.color.surfaceSecondary, borderRadius: theme.radius.lg, padding: theme.spacing.lg, marginBottom: theme.spacing.md },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
  pollLabel: { fontSize: theme.font.sm, fontWeight: '700', color: theme.color.brand, letterSpacing: 1, textTransform: 'uppercase' },
  closedTag: { marginLeft: 'auto', backgroundColor: theme.color.onSurfaceTertiary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.sm },
  closedText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  pollTitle: { fontSize: theme.font.xl, fontWeight: '700', color: theme.color.onSurface, marginTop: theme.spacing.sm },
  pollDesc: { fontSize: theme.font.base, color: theme.color.onSurfaceSecondary, marginTop: 4 },
  closesAt: { fontSize: theme.font.sm, color: theme.color.onSurfaceTertiary, marginTop: theme.spacing.sm },
  voteRow: { flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.lg },
  voteBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.color.surface, paddingVertical: 14, borderRadius: theme.radius.md, borderWidth: 2, borderColor: theme.color.border },
  voteBtnActiveYes: { backgroundColor: theme.color.success, borderColor: theme.color.success },
  voteBtnActiveNo: { backgroundColor: theme.color.error, borderColor: theme.color.error },
  voteText: { fontSize: theme.font.lg, fontWeight: '700', color: theme.color.onSurface },
  yourVote: { marginTop: theme.spacing.md, textAlign: 'center', color: theme.color.onSurfaceSecondary },
  tally: { marginTop: theme.spacing.sm, paddingTop: theme.spacing.sm, borderTopWidth: 1, borderTopColor: theme.color.border },
  tallyText: { textAlign: 'center', color: theme.color.onSurfaceSecondary, fontSize: theme.font.sm },
  empty: { color: theme.color.onSurfaceSecondary, textAlign: 'center', paddingVertical: theme.spacing.lg },
});
