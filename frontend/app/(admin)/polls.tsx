import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Modal, Switch, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/src/context/AuthContext';
import { apiCall, wsUrl } from '@/src/api/client';
import { theme } from '@/src/theme';
import { fmtISTFriendly } from '@/src/utils/datetime';

interface Poll { id: string; kind: string; title: string; description: string; date: string; closes_at: string; active: boolean; yes_count?: number; no_count?: number; }
interface Response { employee_id: string; employee_name: string; response: string; voted_at: string; }

const todayStr = () => new Date().toISOString().slice(0, 10);
const defaultClose = () => { const d = new Date(); d.setHours(11, 0, 0, 0); return d.toISOString(); };

// Build ISO from IST parts (date YYYY-MM-DD, hour 1-12, min 0-59, ampm)
function buildISTIso(date: string, hour12: number, minute: number, ampm: 'AM' | 'PM'): string {
  let h = hour12 % 12;
  if (ampm === 'PM') h += 12;
  // interpret as IST (UTC+5:30), so subtract 5:30 to get UTC
  const [y, m, d] = date.split('-').map(Number);
  const local = new Date(Date.UTC(y, (m || 1) - 1, d || 1, h, minute));
  const utcMs = local.getTime() - (5 * 60 + 30) * 60 * 1000;
  return new Date(utcMs).toISOString();
}
function extractIST(iso: string): { date: string; hour: number; minute: number; ampm: 'AM' | 'PM' } {
  try {
    const d = new Date(iso);
    // Get IST parts via toLocaleString
    const parts = d.toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '');
    // format: "DD/MM/YYYY HH:MM"
    const [dp, tp] = parts.split(' ');
    const [dd, mm, yy] = dp.split('/');
    const [hh, mi] = tp.split(':').map(Number);
    const ampm: 'AM' | 'PM' = hh >= 12 ? 'PM' : 'AM';
    const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
    return { date: `${yy}-${mm}-${dd}`, hour: h12, minute: mi, ampm };
  } catch {
    return { date: todayStr(), hour: 11, minute: 0, ampm: 'AM' };
  }
}

export default function AdminPolls() {
  const { user } = useAuth();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState<'new' | Poll | null>(null);
  const [form, setForm] = useState({ kind: 'lunch', title: '', description: '', date: todayStr(), closes_at: defaultClose(), active: true });
  const [timeParts, setTimeParts] = useState<{ hour: number; minute: number; ampm: 'AM' | 'PM' }>({ hour: 11, minute: 0, ampm: 'AM' });
  const [responsesModal, setResponsesModal] = useState<Poll | null>(null);
  const [responses, setResponses] = useState<{ yes: Response[]; no: Response[] }>({ yes: [], no: [] });

  const load = useCallback(async () => {
    if (!user) return;
    setPolls(await apiCall<Poll[]>('/api/polls', user.token));
    setLoading(false); setRefreshing(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Live refresh on any vote
  useEffect(() => {
    if (!user) return;
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(wsUrl(user.token));
      ws.onmessage = (e) => { try { const m = JSON.parse(e.data); if (m.type === 'poll_vote') load(); } catch {} };
    } catch {}
    return () => { try { ws?.close(); } catch {} };
  }, [user, load]);

  useEffect(() => { const t = setInterval(load, 10000); return () => clearInterval(t); }, [load]);

  const openNew = (kind: string) => {
    setForm({ kind, title: '', description: '', date: todayStr(), closes_at: defaultClose(), active: true });
    setTimeParts({ hour: 11, minute: 0, ampm: 'AM' });
    setModal('new');
  };
  const openEdit = (p: Poll) => {
    const parts = extractIST(p.closes_at);
    setForm({ kind: p.kind, title: p.title, description: p.description, date: parts.date, closes_at: p.closes_at, active: p.active });
    setTimeParts({ hour: parts.hour, minute: parts.minute, ampm: parts.ampm });
    setModal(p);
  };

  const save = async () => {
    if (!user) return;
    const closesIso = buildISTIso(form.date, timeParts.hour, timeParts.minute, timeParts.ampm);
    try {
      if (modal === 'new') {
        await apiCall('/api/polls', user.token, { method: 'POST', body: JSON.stringify({ ...form, closes_at: closesIso }) });
      } else if (modal) {
        const { kind: _k, ...rest } = form as any;
        await apiCall(`/api/polls/${(modal as Poll).id}`, user.token, { method: 'PUT', body: JSON.stringify({ ...rest, closes_at: closesIso }) });
      }
      setModal(null); load();
    } catch (e: any) { alert?.(e.message); }
  };

  const del = async (p: Poll) => {
    if (!user) return;
    await apiCall(`/api/polls/${p.id}`, user.token, { method: 'DELETE' });
    load();
  };

  const openResponses = async (p: Poll) => {
    if (!user) return;
    const data = await apiCall<any>(`/api/polls/${p.id}/responses`, user.token);
    setResponses({ yes: data.yes, no: data.no });
    setResponsesModal(p);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Food Poll Management</Text>
        <View style={styles.headerBtns}>
          <Pressable style={styles.addBtn} onPress={() => openNew('lunch')} testID="new-lunch-poll">
            <Ionicons name="add" size={16} color="#fff" /><Text style={styles.addText}>Lunch</Text>
          </Pressable>
          <Pressable style={styles.addBtn} onPress={() => openNew('snacks')} testID="new-snacks-poll">
            <Ionicons name="add" size={16} color="#fff" /><Text style={styles.addText}>Snacks</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.color.brand} />}
      >
        {loading ? <ActivityIndicator color={theme.color.brand} style={{ marginTop: 40 }} /> : polls.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="pie-chart-outline" size={56} color={theme.color.onSurfaceTertiary} />
            <Text style={styles.emptyText}>No polls yet. Create today's Lunch & Snacks polls above.</Text>
          </View>
        ) : polls.map(p => (
          <View key={p.id} style={styles.card} testID={`admin-poll-${p.id}`}>
            <View style={styles.cardHead}>
              <View style={[styles.kindTag, { backgroundColor: p.kind === 'lunch' ? theme.color.brand : theme.color.brandSecondary }]}>
                <Text style={styles.kindText}>{p.kind.toUpperCase()}</Text>
              </View>
              <Text style={styles.date}>{p.date}</Text>
              {!p.active && <View style={styles.inactiveTag}><Text style={styles.inactiveText}>INACTIVE</Text></View>}
            </View>
            <Text style={styles.pollTitle}>{p.title}</Text>
            {p.description ? <Text style={styles.pollDesc}>{p.description}</Text> : null}
            <Text style={styles.meta}>Closes: {fmtISTFriendly(p.closes_at)}</Text>
            <View style={styles.tallyRow}>
              <View style={styles.tallyCell}>
                <Text style={styles.tallyNum}>{p.yes_count || 0}</Text>
                <Text style={styles.tallyLabel}>Yes</Text>
              </View>
              <View style={styles.tallyCell}>
                <Text style={styles.tallyNum}>{p.no_count || 0}</Text>
                <Text style={styles.tallyLabel}>No</Text>
              </View>
              <View style={styles.tallyCell}>
                <Text style={styles.tallyNum}>{(p.yes_count || 0) + (p.no_count || 0)}</Text>
                <Text style={styles.tallyLabel}>Total</Text>
              </View>
            </View>
            <View style={styles.actions}>
              <Pressable style={styles.actionBtn} onPress={() => openResponses(p)} testID={`view-responses-${p.id}`}>
                <Ionicons name="people" size={14} color={theme.color.brand} />
                <Text style={styles.actionText}>Responses</Text>
              </Pressable>
              <Pressable style={styles.actionBtn} onPress={() => openEdit(p)}>
                <Ionicons name="pencil" size={14} color={theme.color.onSurface} />
                <Text style={styles.actionText}>Edit</Text>
              </Pressable>
              <Pressable style={styles.actionBtn} onPress={() => del(p)}>
                <Ionicons name="trash" size={14} color={theme.color.error} />
                <Text style={[styles.actionText, { color: theme.color.error }]}>Delete</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal visible={modal !== null} animationType="slide" transparent onRequestClose={() => setModal(null)}>
        <View style={styles.modalBg}>
          <ScrollView contentContainerStyle={styles.modalCard}>
            <Text style={styles.modalTitle}>{modal === 'new' ? `New ${form.kind} Poll` : 'Edit Poll'}</Text>
            <TextInput style={styles.input} placeholder="Title (e.g. Today's Lunch: Veg Biryani)" placeholderTextColor={theme.color.onSurfaceTertiary} value={form.title} onChangeText={t => setForm({ ...form, title: t })} testID="poll-form-title" />
            <TextInput style={styles.input} placeholder="Description (e.g. Will you have lunch today?)" placeholderTextColor={theme.color.onSurfaceTertiary} value={form.description} onChangeText={t => setForm({ ...form, description: t })} testID="poll-form-desc" />
            <Text style={styles.rowLabel}>Poll date (YYYY-MM-DD)</Text>
            <TextInput style={styles.input} placeholder="2026-02-15" placeholderTextColor={theme.color.onSurfaceTertiary} value={form.date} onChangeText={t => setForm({ ...form, date: t })} />
            <Text style={styles.rowLabel}>Closes at (IST)</Text>
            <View style={styles.timeRow}>
              <TextInput
                style={styles.timeInput}
                placeholder="hh"
                placeholderTextColor={theme.color.onSurfaceTertiary}
                keyboardType="numeric"
                maxLength={2}
                value={String(timeParts.hour)}
                onChangeText={t => { const n = parseInt(t) || 0; setTimeParts({ ...timeParts, hour: Math.max(1, Math.min(12, n)) }); }}
                testID="poll-time-hour"
              />
              <Text style={styles.timeColon}>:</Text>
              <TextInput
                style={styles.timeInput}
                placeholder="mm"
                placeholderTextColor={theme.color.onSurfaceTertiary}
                keyboardType="numeric"
                maxLength={2}
                value={String(timeParts.minute).padStart(2, '0')}
                onChangeText={t => { const n = parseInt(t) || 0; setTimeParts({ ...timeParts, minute: Math.max(0, Math.min(59, n)) }); }}
                testID="poll-time-min"
              />
              <View style={styles.ampmGroup}>
                {(['AM', 'PM'] as const).map(ap => (
                  <Pressable
                    key={ap}
                    testID={`poll-time-${ap.toLowerCase()}`}
                    style={[styles.ampmBtn, timeParts.ampm === ap && { backgroundColor: theme.color.brand }]}
                    onPress={() => setTimeParts({ ...timeParts, ampm: ap })}
                  >
                    <Text style={[styles.ampmText, timeParts.ampm === ap && { color: '#fff' }]}>{ap}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Active</Text>
              <Switch value={form.active} onValueChange={v => setForm({ ...form, active: v })} trackColor={{ true: theme.color.brand, false: theme.color.surfaceTertiary }} />
            </View>
            <View style={styles.modalActions}>
              <Pressable style={[styles.modalBtn, { backgroundColor: theme.color.surfaceTertiary }]} onPress={() => setModal(null)}><Text style={{ fontWeight: '700', color: theme.color.onSurface }}>Cancel</Text></Pressable>
              <Pressable style={[styles.modalBtn, { backgroundColor: theme.color.brand }]} onPress={save} testID="poll-form-save"><Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text></Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={responsesModal !== null} animationType="slide" transparent onRequestClose={() => setResponsesModal(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{responsesModal?.title}</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              <Text style={styles.sectionHeader}>✅ Yes ({responses.yes.length})</Text>
              {responses.yes.map((r, i) => <Text key={i} style={styles.respRow}>{r.employee_name} · {r.employee_id}</Text>)}
              <Text style={styles.sectionHeader}>❌ No ({responses.no.length})</Text>
              {responses.no.map((r, i) => <Text key={i} style={styles.respRow}>{r.employee_name} · {r.employee_id}</Text>)}
            </ScrollView>
            <Pressable style={[styles.modalBtn, { backgroundColor: theme.color.brand, marginTop: 16 }]} onPress={() => setResponsesModal(null)}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.surface },
  header: { padding: theme.spacing.lg, gap: theme.spacing.sm },
  title: { fontSize: theme.font.xxl, fontWeight: '700', color: theme.color.onSurface },
  headerBtns: { flexDirection: 'row', gap: theme.spacing.sm },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.color.brand, paddingHorizontal: theme.spacing.md, paddingVertical: 8, borderRadius: theme.radius.pill },
  addText: { color: '#fff', fontWeight: '700', fontSize: theme.font.sm },
  empty: { alignItems: 'center', paddingVertical: 60, gap: theme.spacing.md },
  emptyText: { color: theme.color.onSurfaceSecondary, textAlign: 'center' },
  card: { padding: theme.spacing.lg, backgroundColor: theme.color.surfaceSecondary, borderRadius: theme.radius.md, marginBottom: theme.spacing.sm },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  kindTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.sm },
  kindText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  date: { color: theme.color.onSurfaceSecondary, fontSize: theme.font.sm },
  inactiveTag: { backgroundColor: theme.color.onSurfaceTertiary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.sm },
  inactiveText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  pollTitle: { fontSize: theme.font.lg, fontWeight: '700', color: theme.color.onSurface, marginTop: theme.spacing.sm },
  pollDesc: { color: theme.color.onSurfaceSecondary, marginTop: 2 },
  meta: { color: theme.color.onSurfaceTertiary, fontSize: theme.font.sm, marginTop: 4 },
  tallyRow: { flexDirection: 'row', marginTop: theme.spacing.md, gap: theme.spacing.sm },
  tallyCell: { flex: 1, backgroundColor: theme.color.surface, padding: theme.spacing.sm, borderRadius: theme.radius.sm, alignItems: 'center' },
  tallyNum: { fontSize: theme.font.xxl, fontWeight: '700', color: theme.color.brand },
  tallyLabel: { fontSize: theme.font.sm, color: theme.color.onSurfaceSecondary },
  actions: { flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.md },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { color: theme.color.onSurface, fontWeight: '600', fontSize: theme.font.sm },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: theme.color.surface, padding: theme.spacing.lg, borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg },
  modalTitle: { fontSize: theme.font.xl, fontWeight: '700', marginBottom: theme.spacing.md, color: theme.color.onSurface, textTransform: 'capitalize' },
  input: { backgroundColor: theme.color.surfaceSecondary, padding: theme.spacing.md, borderRadius: theme.radius.md, marginBottom: theme.spacing.sm, color: theme.color.onSurface },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: theme.spacing.sm },
  rowLabel: { color: theme.color.onSurface, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md },
  modalBtn: { flex: 1, padding: theme.spacing.md, borderRadius: theme.radius.md, alignItems: 'center' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  timeInput: { backgroundColor: theme.color.surfaceSecondary, padding: theme.spacing.md, borderRadius: theme.radius.md, color: theme.color.onSurface, width: 60, textAlign: 'center', fontSize: theme.font.lg, fontWeight: '700' },
  timeColon: { fontSize: theme.font.xl, fontWeight: '700', color: theme.color.onSurface },
  ampmGroup: { flexDirection: 'row', marginLeft: theme.spacing.sm, backgroundColor: theme.color.surfaceSecondary, borderRadius: theme.radius.pill, padding: 3 },
  ampmBtn: { paddingHorizontal: theme.spacing.md, paddingVertical: 8, borderRadius: theme.radius.pill },
  ampmText: { fontWeight: '700', color: theme.color.onSurfaceSecondary, fontSize: theme.font.sm },
  sectionHeader: { fontSize: theme.font.lg, fontWeight: '700', color: theme.color.onSurface, marginTop: theme.spacing.md, marginBottom: theme.spacing.sm },
  respRow: { paddingVertical: 6, color: theme.color.onSurfaceSecondary, fontSize: theme.font.base },
});
