/**
 * Super Admin Panel (In-App)
 * Accessible only to the designated super admin email
 * Features: View all academies, generate invoices, mark paid, lock/unlock academies
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  ActivityIndicator, RefreshControl, TextInput, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SafeIcon as MaterialIcons } from '@/components/ui/SafeIcon';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth, useAlert, getSupabaseClient } from '@/template';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { FunctionsHttpError } from '@supabase/supabase-js';

// ─── CHANGE THIS TO YOUR ADMIN EMAIL ────────────────────────────────────────
const SUPER_ADMIN_EMAIL = 'admin@batbetter365.com';

const STATUS_COLORS: Record<string, string> = {
  trial: colors.primary,
  active: '#22C55E',
  locked: colors.error,
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || colors.textSecondary;
  return (
    <View style={[sb.badge, { backgroundColor: color + '20', borderColor: color + '60' }]}>
      <View style={[sb.dot, { backgroundColor: color }]} />
      <Text style={[sb.text, { color }]}>{status.toUpperCase()}</Text>
    </View>
  );
}
const sb = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
});

// ─── Academy Row Component ────────────────────────────────────────────────────
function AcademyRow({ academy, onAction }: {
  academy: any;
  onAction: (action: 'invoice' | 'mark-paid' | 'lock' | 'unlock', academy: any) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const daysLeft = academy.trial_end_date
    ? Math.ceil((new Date(academy.trial_end_date).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <Pressable style={ar.card} onPress={() => setExpanded(e => !e)}>
      <View style={ar.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={ar.name}>{academy.name}</Text>
          {academy.description ? <Text style={ar.desc}>{academy.description}</Text> : null}
          <Text style={ar.email}>{academy.owner_email || 'No email'}</Text>
          {academy.owner_phone ? <Text style={ar.phone}>{academy.owner_phone}</Text> : null}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <StatusBadge status={academy.billing_status} />
          <Text style={ar.players}>{academy._playerCount ?? '?'} players</Text>
        </View>
        <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={18} color={colors.textSecondary} style={{ marginLeft: 4 }} />
      </View>

      {expanded && (
        <View style={ar.expanded}>
          {/* Billing Info */}
          <View style={ar.infoGrid}>
            {academy.trial_start_date && (
              <View style={ar.infoItem}>
                <Text style={ar.infoLabel}>Trial Start</Text>
                <Text style={ar.infoVal}>{academy.trial_start_date}</Text>
              </View>
            )}
            {academy.trial_end_date && (
              <View style={ar.infoItem}>
                <Text style={ar.infoLabel}>Trial End</Text>
                <Text style={[ar.infoVal, daysLeft !== null && daysLeft <= 5 && { color: colors.error }]}>
                  {academy.trial_end_date}
                  {daysLeft !== null && ` (${daysLeft}d)`}
                </Text>
              </View>
            )}
            {academy.next_billing_date && (
              <View style={ar.infoItem}>
                <Text style={ar.infoLabel}>Next Billing</Text>
                <Text style={ar.infoVal}>{academy.next_billing_date}</Text>
              </View>
            )}
            <View style={ar.infoItem}>
              <Text style={ar.infoLabel}>Rate</Text>
              <Text style={ar.infoVal}>{academy.currency} {academy.price_per_player}/player</Text>
            </View>
          </View>

          {/* Invoice history */}
          {(academy._invoices || []).length > 0 && (
            <View style={ar.invoicesSection}>
              <Text style={ar.invoicesTitle}>Recent Invoices</Text>
              {academy._invoices.slice(0, 3).map((inv: any) => (
                <View key={inv.id} style={ar.invoiceRow}>
                  <Text style={ar.invNum}>{inv.invoice_number}</Text>
                  <Text style={ar.invAmt}>{inv.currency} {inv.total_amount?.toLocaleString()}</Text>
                  <View style={[ar.invStatus, { backgroundColor: inv.status === 'paid' ? '#22C55E20' : colors.error + '20' }]}>
                    <Text style={[ar.invStatusText, { color: inv.status === 'paid' ? '#22C55E' : colors.error }]}>{inv.status}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Actions */}
          <View style={ar.actionsRow}>
            <Pressable style={[ar.actionBtn, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '40' }]}
              onPress={() => onAction('invoice', academy)}>
              <MaterialIcons name="receipt" size={14} color={colors.primary} />
              <Text style={[ar.actionBtnText, { color: colors.primary }]}>Generate Invoice</Text>
            </Pressable>

            {(academy._invoices || []).some((inv: any) => inv.status === 'unpaid') && (
              <Pressable style={[ar.actionBtn, { backgroundColor: '#22C55E20', borderColor: '#22C55E60' }]}
                onPress={() => onAction('mark-paid', academy)}>
                <MaterialIcons name="check-circle" size={14} color="#22C55E" />
                <Text style={[ar.actionBtnText, { color: '#22C55E' }]}>Mark Paid</Text>
              </Pressable>
            )}

            {academy.billing_status !== 'locked' ? (
              <Pressable style={[ar.actionBtn, { backgroundColor: colors.error + '15', borderColor: colors.error + '40' }]}
                onPress={() => onAction('lock', academy)}>
                <MaterialIcons name="lock" size={14} color={colors.error} />
                <Text style={[ar.actionBtnText, { color: colors.error }]}>Lock</Text>
              </Pressable>
            ) : (
              <Pressable style={[ar.actionBtn, { backgroundColor: '#22C55E20', borderColor: '#22C55E60' }]}
                onPress={() => onAction('unlock', academy)}>
                <MaterialIcons name="lock-open" size={14} color="#22C55E" />
                <Text style={[ar.actionBtnText, { color: '#22C55E' }]}>Unlock</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
    </Pressable>
  );
}

const ar = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  name: { fontSize: 15, fontWeight: '800', color: colors.text },
  desc: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  email: { fontSize: 12, color: colors.primary, marginTop: 3 },
  phone: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  players: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  expanded: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.sm, paddingTop: spacing.sm, gap: spacing.sm },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  infoItem: { flex: 1, minWidth: '45%', backgroundColor: colors.background, borderRadius: borderRadius.md, padding: spacing.sm },
  infoLabel: { fontSize: 10, color: colors.textSecondary, fontWeight: '700', textTransform: 'uppercase' },
  infoVal: { fontSize: 13, color: colors.text, fontWeight: '700', marginTop: 2 },
  invoicesSection: { gap: spacing.xs },
  invoicesTitle: { fontSize: 11, color: colors.textSecondary, fontWeight: '700', textTransform: 'uppercase' },
  invoiceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  invNum: { fontSize: 12, color: colors.text, fontWeight: '600', flex: 1 },
  invAmt: { fontSize: 12, color: colors.text, fontWeight: '700' },
  invStatus: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  invStatusText: { fontSize: 10, fontWeight: '800' },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 7, borderRadius: borderRadius.md, borderWidth: 1 },
  actionBtnText: { fontSize: 12, fontWeight: '700' },
});

// ─── Main Admin Panel ─────────────────────────────────────────────────────────
export default function AdminPanelScreen() {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [academies, setAcademies] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Not super admin → kick out
  if (user?.email && user.email !== SUPER_ADMIN_EMAIL) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <MaterialIcons name="block" size={48} color={colors.error} />
          <Text style={styles.unauthorizedText}>Access Denied</Text>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const load = useCallback(async () => {
    const supabase = getSupabaseClient();

    const { data: acads } = await supabase
      .from('academies')
      .select('*')
      .order('created_at', { ascending: false });

    if (!acads) { setLoading(false); return; }

    // Fetch player counts and invoices for each academy
    const enriched = await Promise.all(acads.map(async (a: any) => {
      const [{ count: pCount }, { data: invData }] = await Promise.all([
        supabase.from('academy_members').select('*', { count: 'exact', head: true })
          .eq('academy_id', a.id).eq('role', 'player').eq('status', 'approved').eq('is_active', true),
        supabase.from('billing_invoices').select('*').eq('academy_id', a.id).order('created_at', { ascending: false }).limit(5),
      ]);
      return { ...a, _playerCount: pCount ?? 0, _invoices: invData || [] };
    }));

    setAcademies(enriched);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handleAction = async (action: 'invoice' | 'mark-paid' | 'lock' | 'unlock', academy: any) => {
    const supabase = getSupabaseClient();

    if (action === 'invoice') {
      setActionLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('generate-invoice', {
          body: { academy_id: academy.id, triggered_by: user?.email },
        });

        let errorMessage = '';
        if (error) {
          if (error instanceof FunctionsHttpError) {
            try { const t = await error.context?.text(); errorMessage = t || error.message; } catch { errorMessage = error.message; }
          } else { errorMessage = error.message; }
        }

        setActionLoading(false);
        if (errorMessage) { showAlert('Error', errorMessage); return; }

        await load();
        showAlert('Invoice Generated',
          `Invoice ${data.invoice?.invoice_number} sent to ${academy.owner_email}\n` +
          `${data.invoice?.player_count} players × ${academy.currency} ${academy.price_per_player} = ${academy.currency} ${data.invoice?.total_amount?.toLocaleString()}`
        );
      } catch (e: any) {
        setActionLoading(false);
        showAlert('Error', e.message);
      }
      return;
    }

    if (action === 'mark-paid') {
      const unpaidInvoice = (academy._invoices || []).find((inv: any) => inv.status === 'unpaid');
      if (!unpaidInvoice) { showAlert('No Invoice', 'No unpaid invoice found for this academy.'); return; }

      setActionLoading(true);
      const { error } = await supabase.rpc('mark_academy_paid', {
        p_academy_id: academy.id,
        p_invoice_id: unpaidInvoice.id,
        p_paid_by: user?.email || 'Admin',
      });
      setActionLoading(false);

      if (error) { showAlert('Error', error.message); return; }
      await load();
      showAlert('Paid & Renewed', `${academy.name} is now active. Next billing date set to 30 days from today.`);
      return;
    }

    if (action === 'lock') {
      setActionLoading(true);
      await supabase.from('academies').update({ billing_status: 'locked' }).eq('id', academy.id);
      setActionLoading(false);
      await load();
      showAlert('Locked', `${academy.name} has been locked. All members will see the locked screen.`);
      return;
    }

    if (action === 'unlock') {
      setActionLoading(true);
      const nextDate = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
      await supabase.from('academies').update({ billing_status: 'active', next_billing_date: nextDate }).eq('id', academy.id);
      setActionLoading(false);
      await load();
      showAlert('Unlocked', `${academy.name} is now active. Next billing date: ${nextDate}.`);
    }
  };

  const filtered = academies.filter(a =>
    !search || a.name?.toLowerCase().includes(search.toLowerCase()) ||
    a.owner_email?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: academies.length,
    trial: academies.filter(a => a.billing_status === 'trial').length,
    active: academies.filter(a => a.billing_status === 'active').length,
    locked: academies.filter(a => a.billing_status === 'locked').length,
    totalPlayers: academies.reduce((sum, a) => sum + (a._playerCount || 0), 0),
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backIconBtn} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Super Admin Panel</Text>
          <Text style={styles.headerSub}>Bat Better 365</Text>
        </View>
        {actionLoading && <ActivityIndicator color={colors.primary} />}
      </View>

      {/* Stats bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={styles.statsScroll} contentContainerStyle={styles.statsContent}>
        {[
          { label: 'Academies', val: stats.total, color: colors.primary },
          { label: 'Trial', val: stats.trial, color: colors.warning },
          { label: 'Active', val: stats.active, color: '#22C55E' },
          { label: 'Locked', val: stats.locked, color: colors.error },
          { label: 'Total Players', val: stats.totalPlayers, color: colors.mental },
        ].map((s, i) => (
          <View key={i} style={[styles.statChip, { borderColor: s.color + '40' }]}>
            <Text style={[styles.statVal, { color: s.color }]}>{s.val}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Search */}
      <View style={styles.searchRow}>
        <MaterialIcons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search academies or emails..."
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
        />
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="shield" size={48} color={colors.border} />
              <Text style={styles.emptyText}>No academies found</Text>
            </View>
          ) : (
            filtered.map(a => (
              <AcademyRow key={a.id} academy={a} onAction={handleAction} />
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { ...typography.h4, color: colors.text, fontWeight: '800' },
  headerSub: { fontSize: 11, color: colors.textSecondary },
  backIconBtn: { width: 40, height: 40, justifyContent: 'center' },
  statsScroll: { maxHeight: 68, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  statsContent: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm, alignItems: 'center' },
  statChip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: borderRadius.lg, backgroundColor: colors.background, borderWidth: 1.5, alignItems: 'center', minWidth: 80 },
  statVal: { fontSize: 20, fontWeight: '900' },
  statLabel: { fontSize: 10, color: colors.textSecondary, fontWeight: '600', marginTop: 1 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, margin: spacing.md, backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.md, paddingBottom: 80 },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: spacing.md },
  emptyText: { fontSize: 16, color: colors.textSecondary, fontWeight: '600' },
  unauthorizedText: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' },
  backBtn: { marginTop: spacing.md, backgroundColor: colors.primary, borderRadius: borderRadius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.xl },
  backBtnText: { fontSize: 15, color: colors.textLight, fontWeight: '700' },
});
