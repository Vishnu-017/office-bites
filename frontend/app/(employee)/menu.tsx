import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/src/context/AuthContext';
import { apiCall } from '@/src/api/client';
import { theme } from '@/src/theme';

interface MenuItem {
  id: string; name: string; description: string; price: number;
  image_url: string; category: string; available: boolean; stock: number;
}

const CART_KEY = 'officebites_cart_v1';

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

export default function EmployeeMenu() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('All');
  const [cart, setCart] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const data = await apiCall<MenuItem[]>('/api/menu', user.token);
      setItems(data);
    } catch (e) {
      console.log('menu fetch error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { load(); getCart().then(setCart); }, [load]);

  const categories = useMemo(() => {
    const set = new Set<string>(['All']);
    items.forEach(i => set.add(i.category || 'Other'));
    return Array.from(set);
  }, [items]);

  const filtered = useMemo(() => items.filter(i =>
    (category === 'All' || i.category === category) &&
    (search === '' || i.name.toLowerCase().includes(search.toLowerCase()))
  ), [items, search, category]);

  const updateQty = async (itemId: string, delta: number) => {
    const next = { ...cart };
    const q = (next[itemId] || 0) + delta;
    if (q <= 0) delete next[itemId]; else next[itemId] = q;
    setCart(next);
    await saveCart(next);
  };

  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const featured = items[0];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: cartCount > 0 ? 120 : 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {user?.name.split(' ')[0]} 👋</Text>
            <Text style={styles.subtitle}>Today's Breakfast Menu</Text>
          </View>
        </View>

        {featured && (
          <View style={styles.hero}>
            <Image source={featured.image_url} style={styles.heroImage} contentFit="cover" transition={300} />
            <LinearGradient colors={['transparent', 'rgba(26,26,26,0.85)']} style={styles.heroScrim} />
            <View style={styles.heroText}>
              <Text style={styles.heroBadge}>TODAY'S SPECIAL</Text>
              <Text style={styles.heroName}>{featured.name}</Text>
            </View>
          </View>
        )}

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={theme.color.onSurfaceTertiary} />
          <TextInput
            testID="menu-search-input"
            placeholder="Search items..."
            placeholderTextColor={theme.color.onSurfaceTertiary}
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {categories.map(cat => (
            <Pressable
              key={cat}
              testID={`category-chip-${cat}`}
              style={[styles.chip, category === cat && styles.chipActive]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>{cat}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={theme.color.brand} />
        ) : (
          <View style={styles.grid}>
            {filtered.map(item => {
              const qty = cart[item.id] || 0;
              return (
                <View key={item.id} style={styles.card} testID={`menu-item-${item.id}`}>
                  <Image source={item.image_url} style={styles.cardImage} contentFit="cover" />
                  {!item.available && <View style={styles.unavailable}><Text style={styles.unavailableText}>Sold Out</Text></View>}
                  <View style={styles.cardBody}>
                    <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
                    <View style={styles.cardFooter}>
                      {qty === 0 ? (
                        <Pressable
                          testID={`add-btn-${item.id}`}
                          style={[styles.addBtn, !item.available && { opacity: 0.4 }]}
                          disabled={!item.available}
                          onPress={() => updateQty(item.id, 1)}
                        >
                          <Ionicons name="add" size={16} color={theme.color.onBrandPrimary} />
                          <Text style={styles.addText}>Add</Text>
                        </Pressable>
                      ) : (
                        <View style={styles.qtyRow}>
                          <Pressable testID={`dec-btn-${item.id}`} style={styles.qtyBtn} onPress={() => updateQty(item.id, -1)}>
                            <Ionicons name="remove" size={16} color={theme.color.brand} />
                          </Pressable>
                          <Text style={styles.qtyText}>{qty}</Text>
                          <Pressable testID={`inc-btn-${item.id}`} style={styles.qtyBtn} onPress={() => updateQty(item.id, 1)}>
                            <Ionicons name="add" size={16} color={theme.color.brand} />
                          </Pressable>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {cartCount > 0 && (
        <Pressable style={styles.cartCta} onPress={() => router.push('/(employee)/cart')} testID="view-cart-cta">
          <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{cartCount}</Text></View>
          <Text style={styles.cartCtaText}>View Cart</Text>
          <Ionicons name="arrow-forward" size={18} color={theme.color.onBrandPrimary} />
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.surface },
  header: { paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting: { fontSize: theme.font.xl, fontWeight: '700', color: theme.color.onSurface },
  subtitle: { fontSize: theme.font.base, color: theme.color.onSurfaceSecondary, marginTop: 2 },
  hero: {
    marginHorizontal: theme.spacing.lg,
    height: 180,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    marginBottom: theme.spacing.lg,
  },
  heroImage: { ...StyleSheet.absoluteFillObject },
  heroScrim: { ...StyleSheet.absoluteFillObject },
  heroText: { position: 'absolute', bottom: theme.spacing.lg, left: theme.spacing.lg, right: theme.spacing.lg },
  heroBadge: { color: theme.color.brandTertiary, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 4 },
  heroName: { color: theme.color.onSurfaceInverse, fontSize: theme.font.xxl, fontWeight: '700' },
  heroPrice: { color: theme.color.onSurfaceInverse, fontSize: theme.font.lg, marginTop: 4 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm,
    marginHorizontal: theme.spacing.lg, backgroundColor: theme.color.surfaceSecondary,
    borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.md, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: theme.font.base, color: theme.color.onSurface },
  chipRow: { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.sm, paddingVertical: theme.spacing.md },
  chip: { paddingHorizontal: theme.spacing.md, height: 36, borderRadius: theme.radius.pill, backgroundColor: theme.color.surfaceSecondary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  chipActive: { backgroundColor: theme.color.brand },
  chipText: { color: theme.color.onSurfaceSecondary, fontSize: theme.font.sm, fontWeight: '600' },
  chipTextActive: { color: theme.color.onBrandPrimary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: theme.spacing.md, gap: theme.spacing.md },
  card: {
    width: '47%', backgroundColor: theme.color.surface, borderRadius: theme.radius.md, overflow: 'hidden',
    borderWidth: 1, borderColor: theme.color.border,
  },
  cardImage: { width: '100%', height: 120, backgroundColor: theme.color.surfaceTertiary },
  unavailable: { position: 'absolute', top: 8, right: 8, backgroundColor: theme.color.error, paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.radius.sm },
  unavailableText: { color: theme.color.onError, fontSize: 10, fontWeight: '700' },
  cardBody: { padding: theme.spacing.md },
  cardName: { fontSize: theme.font.base, fontWeight: '700', color: theme.color.onSurface },
  cardDesc: { fontSize: theme.font.sm, color: theme.color.onSurfaceSecondary, marginTop: 2, minHeight: 32 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: theme.spacing.sm },
  cardPrice: { fontSize: theme.font.lg, fontWeight: '700', color: theme.color.brand },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.color.brand, paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radius.pill },
  addText: { color: theme.color.onBrandPrimary, fontWeight: '700', fontSize: theme.font.sm },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.color.brandTertiary, borderRadius: theme.radius.pill, paddingHorizontal: 4 },
  qtyBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.pill },
  qtyText: { fontSize: theme.font.base, fontWeight: '700', color: theme.color.brand, minWidth: 20, textAlign: 'center' },
  cartCta: {
    position: 'absolute', bottom: 16, left: theme.spacing.lg, right: theme.spacing.lg,
    backgroundColor: theme.color.brand, borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.lg, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  cartBadge: { backgroundColor: theme.color.onBrandPrimary, borderRadius: theme.radius.pill, minWidth: 24, height: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  cartBadgeText: { color: theme.color.brand, fontWeight: '700', fontSize: theme.font.sm },
  cartCtaText: { color: theme.color.onBrandPrimary, fontWeight: '700', fontSize: theme.font.lg, flex: 1, textAlign: 'center' },
});
