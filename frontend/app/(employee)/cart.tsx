import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/src/context/AuthContext';
import { apiCall } from '@/src/api/client';
import { theme } from '@/src/theme';

const CART_KEY = 'officebites_cart_v1';

interface MenuItem { id: string; name: string; price: number; available: boolean; stock: number; }

async function getCart(): Promise<Record<string, number>> {
  try {
    if (typeof window !== 'undefined' && (window as any).localStorage) {
      const raw = (window as any).localStorage.getItem(CART_KEY);
      return raw ? JSON.parse(raw) : {};
    }
  } catch {}
  return (globalThis as any).__officebites_cart || {};
}
async function saveCart(cart: Record<string, number>) {
  try {
    if (typeof window !== 'undefined' && (window as any).localStorage) {
      (window as any).localStorage.setItem(CART_KEY, JSON.stringify(cart));
    }
  } catch {}
  (globalThis as any).__officebites_cart = cart;
}

export default function Cart() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    const [m, c] = await Promise.all([apiCall<MenuItem[]>('/api/menu', user.token), getCart()]);
    setItems(m);
    setCart(c);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const lines = Object.entries(cart)
    .map(([id, qty]) => ({ item: items.find(i => i.id === id)!, qty }))
    .filter(l => l.item);

  const total = lines.reduce((sum, l) => sum + l.item.price * l.qty, 0);

  const updateQty = async (id: string, delta: number) => {
    const next = { ...cart };
    const q = (next[id] || 0) + delta;
    if (q <= 0) delete next[id]; else next[id] = q;
    setCart(next);
    await saveCart(next);
  };

  const submit = async () => {
    if (lines.length === 0) return;
    setSubmitting(true);
    setMsg('');
    try {
      await apiCall('/api/orders', user!.token, {
        method: 'POST',
        body: JSON.stringify({
          items: lines.map(l => ({ item_id: l.item.id, name: l.item.name, price: l.item.price, quantity: l.qty })),
          notes,
        }),
      });
      await saveCart({});
      setCart({});
      setMsg('Order placed successfully!');
      setTimeout(() => router.replace('/(employee)/orders'), 700);
    } catch (e: any) {
      setMsg(e.message || 'Failed to place order');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <SafeAreaView style={styles.safe}><ActivityIndicator style={{ marginTop: 40 }} color={theme.color.brand} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="back-btn"><Ionicons name="chevron-back" size={26} color={theme.color.onSurface} /></Pressable>
        <Text style={styles.title}>Your Cart</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 200 }}>
        {lines.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="cart-outline" size={64} color={theme.color.onSurfaceTertiary} />
            <Text style={styles.emptyText}>Your cart is empty</Text>
            <Pressable style={styles.emptyBtn} onPress={() => router.replace('/(employee)/menu')}>
              <Text style={styles.emptyBtnText}>Browse Menu</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {lines.map(l => (
              <View key={l.item.id} style={styles.line} testID={`cart-line-${l.item.id}`}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lineName}>{l.item.name}</Text>
                </View>
                <View style={styles.qtyRow}>
                  <Pressable style={styles.qtyBtn} onPress={() => updateQty(l.item.id, -1)} testID={`cart-dec-${l.item.id}`}>
                    <Ionicons name="remove" size={16} color={theme.color.brand} />
                  </Pressable>
                  <Text style={styles.qtyText}>{l.qty}</Text>
                  <Pressable style={styles.qtyBtn} onPress={() => updateQty(l.item.id, 1)} testID={`cart-inc-${l.item.id}`}>
                    <Ionicons name="add" size={16} color={theme.color.brand} />
                  </Pressable>
                </View>
              </View>
            ))}
            <TextInput
              testID="order-notes-input"
              style={styles.notes}
              placeholder="Add notes (e.g. less spicy)..."
              placeholderTextColor={theme.color.onSurfaceTertiary}
              value={notes}
              onChangeText={setNotes}
              multiline
            />
            {msg ? <Text style={[styles.msg, msg.startsWith('Order placed') && { color: theme.color.success }]}>{msg}</Text> : null}
          </>
        )}
      </ScrollView>

      {lines.length > 0 && (
        <View style={styles.checkoutBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.totalLabel}>Total items</Text>
            <Text style={styles.totalAmount}>{lines.reduce((s, l) => s + l.qty, 0)}</Text>
          </View>
          <Pressable style={[styles.submitBtn, submitting && { opacity: 0.6 }]} onPress={submit} disabled={submitting} testID="place-order-btn">
            {submitting ? <ActivityIndicator color={theme.color.onBrandPrimary} /> : <Text style={styles.submitText}>Place Order</Text>}
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.color.divider },
  title: { fontSize: theme.font.xl, fontWeight: '700', color: theme.color.onSurface },
  empty: { alignItems: 'center', paddingVertical: 60, gap: theme.spacing.lg },
  emptyText: { fontSize: theme.font.lg, color: theme.color.onSurfaceSecondary },
  emptyBtn: { backgroundColor: theme.color.brand, paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing.md, borderRadius: theme.radius.pill },
  emptyBtnText: { color: theme.color.onBrandPrimary, fontWeight: '700' },
  line: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.color.divider },
  lineName: { fontSize: theme.font.lg, fontWeight: '600', color: theme.color.onSurface },
  linePrice: { fontSize: theme.font.sm, color: theme.color.onSurfaceSecondary, marginTop: 2 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.color.brandTertiary, borderRadius: theme.radius.pill, paddingHorizontal: 4 },
  qtyBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontWeight: '700', color: theme.color.brand, minWidth: 20, textAlign: 'center' },
  lineTotal: { fontSize: theme.font.lg, fontWeight: '700', color: theme.color.onSurface, minWidth: 60, textAlign: 'right' },
  notes: { marginTop: theme.spacing.lg, backgroundColor: theme.color.surfaceSecondary, borderRadius: theme.radius.md, padding: theme.spacing.md, minHeight: 60, color: theme.color.onSurface },
  msg: { marginTop: theme.spacing.md, color: theme.color.error, textAlign: 'center' },
  checkoutBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: theme.color.surface, borderTopWidth: 1, borderTopColor: theme.color.border, padding: theme.spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.lg },
  totalLabel: { fontSize: theme.font.sm, color: theme.color.onSurfaceSecondary },
  totalAmount: { fontSize: theme.font.xxl, fontWeight: '700', color: theme.color.onSurface },
  submitBtn: { flex: 1, backgroundColor: theme.color.brand, paddingVertical: 16, borderRadius: theme.radius.md, alignItems: 'center' },
  submitText: { color: theme.color.onBrandPrimary, fontWeight: '700', fontSize: theme.font.lg },
});
