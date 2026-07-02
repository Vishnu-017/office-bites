import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/src/context/AuthContext';
import { apiCall } from '@/src/api/client';
import { theme } from '@/src/theme';

interface User { id: string; employee_id: string; name: string; email?: string; role: string; active: boolean; }

export default function AdminUsers() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'new' | User | null>(null);
  const [form, setForm] = useState({ employee_id: '', name: '', email: '', password: '', role: 'employee', active: true });

  const load = useCallback(async () => {
    if (!user) return;
    const data = await apiCall<User[]>('/api/users', user.token);
    setUsers(data);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setForm({ employee_id: '', name: '', email: '', password: '', role: 'employee', active: true }); setModal('new'); };
  const openEdit = (u: User) => { setForm({ employee_id: u.employee_id, name: u.name, email: u.email || '', password: '', role: u.role, active: u.active }); setModal(u); };

  const save = async () => {
    if (!user) return;
    try {
      if (modal === 'new') {
        await apiCall('/api/users', user.token, { method: 'POST', body: JSON.stringify(form) });
      } else if (modal) {
        const upd: any = { name: form.name, email: form.email || null, role: form.role, active: form.active };
        if (form.password) upd.password = form.password;
        await apiCall(`/api/users/${(modal as User).employee_id}`, user.token, { method: 'PUT', body: JSON.stringify(upd) });
      }
      setModal(null); load();
    } catch (e: any) {
      alert?.(e.message);
    }
  };

  const del = async (u: User) => {
    if (!user) return;
    try {
      await apiCall(`/api/users/${u.employee_id}`, user.token, { method: 'DELETE' });
      load();
    } catch (e: any) { alert?.(e.message); }
  };

  const roleColor = (r: string) => r === 'admin' ? theme.color.brand : r === 'cook' ? theme.color.brandSecondary : theme.color.info;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Users</Text>
        <Pressable style={styles.addBtn} onPress={openNew} testID="admin-user-add"><Ionicons name="add" size={18} color="#fff" /><Text style={styles.addBtnText}>Add</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 40 }}>
        {loading ? <ActivityIndicator color={theme.color.brand} style={{ marginTop: 40 }} /> : users.map(u => (
          <View key={u.id} style={styles.card} testID={`admin-user-${u.employee_id}`}>
            <View style={[styles.roleTag, { backgroundColor: roleColor(u.role) }]}><Text style={styles.roleText}>{u.role.slice(0, 1).toUpperCase()}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{u.name}</Text>
              <Text style={styles.meta}>{u.employee_id} · {u.role} {u.active ? '' : '· (disabled)'}</Text>
            </View>
            <Pressable style={styles.iconBtn} onPress={() => openEdit(u)}><Ionicons name="pencil" size={16} color={theme.color.onSurface} /></Pressable>
            {u.employee_id !== user?.employee_id && (
              <Pressable style={styles.iconBtn} onPress={() => del(u)} testID={`admin-user-del-${u.employee_id}`}><Ionicons name="trash" size={16} color={theme.color.error} /></Pressable>
            )}
          </View>
        ))}
      </ScrollView>

      <Modal visible={modal !== null} animationType="slide" transparent onRequestClose={() => setModal(null)}>
        <View style={styles.modalBg}>
          <ScrollView contentContainerStyle={styles.modalCard} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>{modal === 'new' ? 'Add User' : 'Edit User'}</Text>
            {modal === 'new' && (
              <TextInput style={styles.input} placeholder="Employee ID" placeholderTextColor={theme.color.onSurfaceTertiary} autoCapitalize="none" value={form.employee_id} onChangeText={t => setForm({ ...form, employee_id: t })} />
            )}
            <TextInput style={styles.input} placeholder="Name" placeholderTextColor={theme.color.onSurfaceTertiary} value={form.name} onChangeText={t => setForm({ ...form, name: t })} />
            <TextInput style={styles.input} placeholder="Email (optional)" placeholderTextColor={theme.color.onSurfaceTertiary} autoCapitalize="none" value={form.email} onChangeText={t => setForm({ ...form, email: t })} />
            <TextInput style={styles.input} placeholder={modal === 'new' ? 'Password' : 'New password (leave blank to keep)'} placeholderTextColor={theme.color.onSurfaceTertiary} secureTextEntry value={form.password} onChangeText={t => setForm({ ...form, password: t })} />
            <Text style={styles.label}>Role</Text>
            <View style={styles.roleRow}>
              {['employee', 'cook', 'admin'].map(r => (
                <Pressable key={r} style={[styles.rolePill, form.role === r && { backgroundColor: theme.color.brand }]} onPress={() => setForm({ ...form, role: r })}>
                  <Text style={[styles.rolePillText, form.role === r && { color: '#fff' }]}>{r}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.modalActions}>
              <Pressable style={[styles.modalBtn, { backgroundColor: theme.color.surfaceTertiary }]} onPress={() => setModal(null)}><Text style={{ fontWeight: '700', color: theme.color.onSurface }}>Cancel</Text></Pressable>
              <Pressable style={[styles.modalBtn, { backgroundColor: theme.color.brand }]} onPress={save} testID="admin-user-save"><Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text></Pressable>
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
  addBtnText: { color: '#fff', fontWeight: '700' },
  card: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, padding: theme.spacing.md, backgroundColor: theme.color.surfaceSecondary, borderRadius: theme.radius.md, marginBottom: theme.spacing.sm },
  roleTag: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  roleText: { color: '#fff', fontWeight: '700' },
  name: { color: theme.color.onSurface, fontSize: theme.font.lg, fontWeight: '700' },
  meta: { color: theme.color.onSurfaceSecondary, fontSize: theme.font.sm, marginTop: 2 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.color.surface, borderWidth: 1, borderColor: theme.color.border, alignItems: 'center', justifyContent: 'center' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: theme.color.surface, padding: theme.spacing.lg, borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg },
  modalTitle: { fontSize: theme.font.xl, fontWeight: '700', marginBottom: theme.spacing.md, color: theme.color.onSurface },
  input: { backgroundColor: theme.color.surfaceSecondary, padding: theme.spacing.md, borderRadius: theme.radius.md, marginBottom: theme.spacing.sm, color: theme.color.onSurface },
  label: { fontSize: theme.font.sm, color: theme.color.onSurfaceSecondary, marginTop: theme.spacing.sm, marginBottom: theme.spacing.sm, fontWeight: '600' },
  roleRow: { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
  rolePill: { paddingHorizontal: theme.spacing.md, paddingVertical: 8, backgroundColor: theme.color.surfaceSecondary, borderRadius: theme.radius.pill },
  rolePillText: { color: theme.color.onSurfaceSecondary, fontWeight: '600', textTransform: 'capitalize' },
  modalActions: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md },
  modalBtn: { flex: 1, padding: theme.spacing.md, borderRadius: theme.radius.md, alignItems: 'center' },
});
