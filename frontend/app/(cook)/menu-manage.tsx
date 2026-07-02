import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/src/context/AuthContext';
import { apiCall } from '@/src/api/client';
import { theme } from '@/src/theme';

interface MenuItem { id: string; name: string; description: string; price: number; image_url: string; category: string; available: boolean; stock: number; }

export default function CookMenuManage() {
  const { user } = useAuth();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<MenuItem | 'new' | null>(null);
  const [form, setForm] = useState({ name: '', description: '', price: '', image_url: '', category: 'Breakfast', stock: '50' });

  const load = useCallback(async () => {
    if (!user) return;
    const data = await apiCall<MenuItem[]>('/api/menu', user.token);
    setItems(data);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setForm({ name: '', description: '', price: '', image_url: '', category: 'Breakfast', stock: '50' });
    setModal('new');
  };
  const openEdit = (item: MenuItem) => {
    setForm({
      name: item.name, description: item.description, price: String(item.price),
      image_url: item.image_url, category: item.category, stock: String(item.stock),
    });
    setModal(item);
  };

  const save = async () => {
    if (!user) return;
    const payload = {
      name: form.name, description: form.description,
      price: parseFloat(form.price) || 0, image_url: form.image_url,
      category: form.category, stock: parseInt(form.stock) || 0,
    };
    if (modal === 'new') {
      await apiCall('/api/menu', user.token, { method: 'POST', body: JSON.stringify({ ...payload, available: true }) });
    } else if (modal) {
      await apiCall(`/api/menu/${(modal as MenuItem).id}`, user.token, { method: 'PUT', body: JSON.stringify(payload) });
    }
    setModal(null);
    load();
  };

  const toggleAvail = async (item: MenuItem) => {
    if (!user) return;
    await apiCall(`/api/menu/${item.id}`, user.token, { method: 'PUT', body: JSON.stringify({ available: !item.available }) });
    load();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Today's Menu</Text>
        <Pressable style={styles.addBtn} onPress={openNew} testID="menu-add-btn">
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addBtnText}>Add</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 40 }}>
        {loading ? <ActivityIndicator color={theme.color.brandSecondary} style={{ marginTop: 40 }} /> : items.map(item => (
          <View key={item.id} style={styles.card} testID={`menu-manage-${item.id}`}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>{item.category} · Stock: {item.stock}</Text>
            </View>
            <Pressable
              style={[styles.availBtn, { backgroundColor: item.available ? theme.color.success : '#3F3F46' }]}
              onPress={() => toggleAvail(item)}
              testID={`toggle-avail-${item.id}`}
            >
              <Text style={styles.availText}>{item.available ? 'Available' : 'Sold Out'}</Text>
            </Pressable>
            <Pressable onPress={() => openEdit(item)} style={styles.editBtn} testID={`edit-${item.id}`}>
              <Ionicons name="pencil" size={16} color={theme.color.kdsText} />
            </Pressable>
          </View>
        ))}
      </ScrollView>

      <Modal visible={modal !== null} animationType="slide" transparent onRequestClose={() => setModal(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{modal === 'new' ? 'Add Menu Item' : 'Edit Menu Item'}</Text>
            <TextInput style={styles.input} placeholder="Name" placeholderTextColor="#71717A" value={form.name} onChangeText={t => setForm({ ...form, name: t })} testID="form-name" />
            <TextInput style={styles.input} placeholder="Description" placeholderTextColor="#71717A" value={form.description} onChangeText={t => setForm({ ...form, description: t })} testID="form-desc" />
            <TextInput style={styles.input} placeholder="Image URL" placeholderTextColor="#71717A" value={form.image_url} onChangeText={t => setForm({ ...form, image_url: t })} testID="form-image" />
            <TextInput style={styles.input} placeholder="Category" placeholderTextColor="#71717A" value={form.category} onChangeText={t => setForm({ ...form, category: t })} testID="form-category" />
            <TextInput style={styles.input} placeholder="Stock" placeholderTextColor="#71717A" value={form.stock} onChangeText={t => setForm({ ...form, stock: t })} keyboardType="numeric" testID="form-stock" />
            <View style={styles.modalActions}>
              <Pressable style={[styles.modalBtn, { backgroundColor: '#3F3F46' }]} onPress={() => setModal(null)}><Text style={styles.modalBtnText}>Cancel</Text></Pressable>
              <Pressable style={[styles.modalBtn, { backgroundColor: theme.color.brandSecondary }]} onPress={save} testID="form-save"><Text style={styles.modalBtnText}>Save</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.kdsBg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: theme.spacing.lg },
  title: { fontSize: 24, fontWeight: '700', color: theme.color.kdsText },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.color.brandSecondary, paddingHorizontal: theme.spacing.md, paddingVertical: 8, borderRadius: theme.radius.pill },
  addBtnText: { color: '#fff', fontWeight: '700' },
  card: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, padding: theme.spacing.md, backgroundColor: theme.color.kdsCard, borderRadius: theme.radius.md, marginBottom: theme.spacing.sm },
  name: { color: theme.color.kdsText, fontSize: theme.font.lg, fontWeight: '700' },
  meta: { color: theme.color.kdsTextMuted, fontSize: theme.font.sm, marginTop: 2 },
  availBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radius.pill },
  availText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  editBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#2C2C2E', alignItems: 'center', justifyContent: 'center' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: theme.color.kdsCard, padding: theme.spacing.lg, borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg },
  modalTitle: { color: theme.color.kdsText, fontSize: theme.font.xl, fontWeight: '700', marginBottom: theme.spacing.md },
  input: { backgroundColor: '#2C2C2E', color: theme.color.kdsText, padding: theme.spacing.md, borderRadius: theme.radius.md, marginBottom: theme.spacing.sm },
  modalActions: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md },
  modalBtn: { flex: 1, padding: theme.spacing.md, borderRadius: theme.radius.md, alignItems: 'center' },
  modalBtnText: { color: '#fff', fontWeight: '700' },
});
