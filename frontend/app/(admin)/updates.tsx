import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Modal, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/src/context/AuthContext';
import { apiCall } from '@/src/api/client';
import { theme } from '@/src/theme';

interface UpdateItem { id: string; title: string; body: string; priority: string; pinned: boolean; created_at: string; }

export default function AdminUpdates() {
  const { user } = useAuth();
  const [items, setItems] = useState<UpdateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'new' | UpdateItem | null>(null);
  const [form, setForm] = useState({ title: '', body: '', priority: 'normal', pinned: false });

  const load = useCallback(async () => {
    if (!user) return;
    setItems(await apiCall<UpdateItem[]>('/api/updates', user.token));
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setForm({ title: '', body: '', priority: 'normal', pinned: false }); setModal('new'); };
  const openEdit = (u: UpdateItem) => { setForm({ title: u.title, body: u.body, priority: u.priority, pinned: u.pinned }); setModal(u); };

  const save = async () => {
    if (!user) return;
    if (!form.title || !form.body) return;
    try {
      if (modal === 'new') await apiCall('/api/updates', user.token, { method: 'POST', body: JSON.stringify(form) });
      else if (modal) await apiCall(`/api/updates/${(modal as UpdateItem).id}`, user.token, { method: 'PUT', body: JSON.stringify(form) });
      setModal(null); load();
    } catch (e: any) { alert?.(e.message); }
  };

  const del = async (u: UpdateItem) => {
    if (!user) return;
    await apiCall(`/api/updates/${u.id}`, user.token, { method: 'DELETE' });
    load();
  };

  const togglePin = async (u: UpdateItem) => {
    if (!user) return;
    await apiCall(`/api/updates/${u.id}`, user.token, { method: 'PUT', body: JSON.stringify({ pinned: !u.pinned }) });
    load();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Updates</Text>
        <Pressable style={styles.addBtn} onPress={openNew} testID="admin-update-add">
          <Ionicons name="add" size={18} color="#fff" /><Text style={styles.addText}>New</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 40 }}>
        {loading ? <ActivityIndicator color={theme.color.brand} style={{ marginTop: 40 }} /> : items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="megaphone-outline" size={56} color={theme.color.onSurfaceTertiary} />
            <Text style={styles.emptyText}>No updates yet. Post the first announcement.</Text>
          </View>
        ) : items.map(u => (
          <View key={u.id} style={[styles.card, u.pinned && styles.pinned]} testID={`admin-update-${u.id}`}>
            <View style={styles.titleRow}>
              <Text style={styles.cardTitle}>{u.title}</Text>
              {u.priority === 'high' && <View style={styles.priTag}><Text style={styles.priText}>HIGH</Text></View>}
            </View>
            <Text style={styles.body}>{u.body}</Text>
            <Text style={styles.time}>{new Date(u.created_at).toLocaleString()}</Text>
            <View style={styles.actions}>
              <Pressable style={styles.iconBtn} onPress={() => togglePin(u)} testID={`pin-${u.id}`}>
                <Ionicons name={u.pinned ? 'pin' : 'pin-outline'} size={16} color={theme.color.brand} />
                <Text style={styles.iconLabel}>{u.pinned ? 'Unpin' : 'Pin'}</Text>
              </Pressable>
              <Pressable style={styles.iconBtn} onPress={() => openEdit(u)}>
                <Ionicons name="pencil" size={16} color={theme.color.onSurface} />
                <Text style={styles.iconLabel}>Edit</Text>
              </Pressable>
              <Pressable style={styles.iconBtn} onPress={() => del(u)} testID={`admin-update-del-${u.id}`}>
                <Ionicons name="trash" size={16} color={theme.color.error} />
                <Text style={[styles.iconLabel, { color: theme.color.error }]}>Delete</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal visible={modal !== null} animationType="slide" transparent onRequestClose={() => setModal(null)}>
        <View style={styles.modalBg}>
          <ScrollView contentContainerStyle={styles.modalCard}>
            <Text style={styles.modalTitle}>{modal === 'new' ? 'New Update' : 'Edit Update'}</Text>
            <TextInput style={styles.input} placeholder="Title" placeholderTextColor={theme.color.onSurfaceTertiary} value={form.title} onChangeText={t => setForm({ ...form, title: t })} testID="update-form-title" />
            <TextInput style={[styles.input, { minHeight: 100 }]} placeholder="Message" placeholderTextColor={theme.color.onSurfaceTertiary} multiline value={form.body} onChangeText={t => setForm({ ...form, body: t })} testID="update-form-body" />
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Priority</Text>
              <View style={styles.pillRow}>
                {['normal', 'high'].map(p => (
                  <Pressable key={p} style={[styles.pill, form.priority === p && { backgroundColor: theme.color.brand }]} onPress={() => setForm({ ...form, priority: p })}>
                    <Text style={[styles.pillText, form.priority === p && { color: '#fff' }]}>{p}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Pin to top</Text>
              <Switch value={form.pinned} onValueChange={v => setForm({ ...form, pinned: v })} trackColor={{ true: theme.color.brand, false: theme.color.surfaceTertiary }} />
            </View>
            <View style={styles.modalActions}>
              <Pressable style={[styles.modalBtn, { backgroundColor: theme.color.surfaceTertiary }]} onPress={() => setModal(null)}><Text style={{ fontWeight: '700', color: theme.color.onSurface }}>Cancel</Text></Pressable>
              <Pressable style={[styles.modalBtn, { backgroundColor: theme.color.brand }]} onPress={save} testID="update-form-save"><Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text></Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.surface },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: theme.spacing.lg },
  title: { fontSize: theme.font.xxl, fontWeight: '700', color: theme.color.onSurface },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.color.brand, paddingHorizontal: theme.spacing.md, paddingVertical: 8, borderRadius: theme.radius.pill },
  addText: { color: '#fff', fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 60, gap: theme.spacing.md },
  emptyText: { color: theme.color.onSurfaceSecondary, textAlign: 'center' },
  card: { padding: theme.spacing.lg, backgroundColor: theme.color.surfaceSecondary, borderRadius: theme.radius.md, marginBottom: theme.spacing.sm },
  pinned: { borderWidth: 2, borderColor: theme.color.brand, backgroundColor: theme.color.brandTertiary },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: theme.spacing.sm },
  cardTitle: { flex: 1, fontSize: theme.font.lg, fontWeight: '700', color: theme.color.onSurface },
  priTag: { backgroundColor: theme.color.error, paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.sm },
  priText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  body: { color: theme.color.onSurfaceSecondary, marginTop: 4 },
  time: { color: theme.color.onSurfaceTertiary, fontSize: theme.font.sm, marginTop: theme.spacing.sm },
  actions: { flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.md },
  iconBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconLabel: { fontSize: theme.font.sm, color: theme.color.onSurface, fontWeight: '600' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: theme.color.surface, padding: theme.spacing.lg, borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg },
  modalTitle: { fontSize: theme.font.xl, fontWeight: '700', marginBottom: theme.spacing.md, color: theme.color.onSurface },
  input: { backgroundColor: theme.color.surfaceSecondary, padding: theme.spacing.md, borderRadius: theme.radius.md, marginBottom: theme.spacing.sm, color: theme.color.onSurface },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: theme.spacing.sm },
  rowLabel: { color: theme.color.onSurface, fontWeight: '600' },
  pillRow: { flexDirection: 'row', gap: theme.spacing.sm },
  pill: { paddingHorizontal: theme.spacing.md, paddingVertical: 6, backgroundColor: theme.color.surfaceSecondary, borderRadius: theme.radius.pill },
  pillText: { color: theme.color.onSurfaceSecondary, fontWeight: '600', textTransform: 'capitalize' },
  modalActions: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md },
  modalBtn: { flex: 1, padding: theme.spacing.md, borderRadius: theme.radius.md, alignItems: 'center' },
});
