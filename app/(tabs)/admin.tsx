/**
 * Super Admin Dashboard (Tab)
 * Visible ONLY when logged in as alinasarzaids@gmail.com
 * Three sections:
 *   1. Global Stats  — Total Academies / Active Players / Pending Payments
 *   2. Billing Engine — Manual "Run Daily Billing" trigger
 *   3. Academy Ledger — Scrollable cards per academy with WhatsApp, status, Mark Paid
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  ActivityIndicator, RefreshControl, Linking, Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SafeIcon as MaterialIcons } from '@/components/ui/SafeIcon';
import { useFocusEffect } from 'expo-router';
import { useAuth, useAlert, getSupabaseClient } from '@/template';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { FunctionsHttpError } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPER_ADMIN_EMAIL = 'alinasarzaids@gmail.com';
const LAST_RUN_KEY = '@bb365_billing_last_run';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

function formatLastRun(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' at ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

// ─── Status config ─────────────────────────────────────────────────────────────
type BillingStatus = 'trial' | 'active' | 'locked' | 'invoice_sent';

function getStatusConfig(academy: any): { label: string; color: string; dot: string } {
  const hasUnpaid = (academy._invoices || []).some((inv: any) => inv.status === 'unpaid');
  const status = academy.billing_status as string;

  if (status === 'locked') return { label: 'Locked — Unpaid', color: colors.error, dot: '🔴' };
  if (hasUnpaid) return { label: 'Invoice Sent — Awaiting Payment', color: colors.warning, dot: '🟡' };
  if (status === 'trial') {
    const days = daysUntil(academy.trial_end_date);
    const suffix = days !== null ? ` (${days > 0 ? `${days}d left` : 'EXPIRED'})` : '';
    return { label: `Trial${suffix}`, color: colors.primary, dot: '🔵' };
  }
  if (status === 'active') {
    const days = daysUntil(academy.next_billing_date);
    const suffix = days !== null ? ` (Renews in ${days}d)` : '';
    return { label: `Active${suffix}`, color: '#22C55E', dot: '🟢' };
  }
  return { label: status, color: colors.textSecondary, dot: '⚪' };
}

// ─── Academy Card ─────────────────────────────────────────────────────────────
function AcademyCard({ academy, onMarkPaid, onLock, onUnlock, onGenerateInvoice, loadingId }: {
  academy: any;
  onMarkPaid: (a: any) => void;
  onLock: (a: any) => void;
  onUnlock: (a: any) => void;
  onGenerateInvoice: (a: any) => void;
  loadingId: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const statusConfig = getStatusConfig(academy);
  const hasUnpaid = (academy._invoices || []).some((inv: any) => inv.status === 'unpaid');
  const isLocked = academy.billing_status === 'locked';
  const isLoading = loadingId === academy.id;
  const daysLeft = academy.trial_end_date
    ? daysUntil(academy.trial_end_date)
    : academy.next_billing_date
    ? daysUntil(academy.next_billing_date)
    : null;

  const openWhatsApp = () => {
    if (!academy.owner_phone) return;
    const clean = academy.owner_phone.replace(/\D/g, '');
    const msg = encodeURIComponent(
      `Hi! This is a message from Bat Better 365 regarding your academy "${academy.name}".`
    );
    Linking.openURL(`whatsapp://send?phone=${clean}&text=${msg}`).catch(() =>
      Linking.openURL(`https://wa.me/${clean}?text=${msg}`)
    );
  };

  return (
    <View style={ac.card}>
      {/* ── Top row ── */}
      <Pressable style={ac.topRow} onPress={() => setExpanded(e => !e)}>
        <View style={[ac.statusDot, { backgroundColor: statusConfig.color + '25', borderColor: statusConfig.color + '50' }]}>
          <Text style={{ fontSize: 16 }}>{statusConfig.dot}</Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={ac.name} numberOfLines={1}>{academy.name}</Text>
          {academy.description ? (
            <Text style={ac.org} numberOfLines={1}>{academy.description}</Text>
          ) : null}
          <View style={[ac.statusRow]}>
            <Text style={[ac.statusLabel, { color: statusConfig.color }]}>{statusConfig.label}</Text>
          </View>
        </View>

        <View style={{ alignItems: 'flex-end', gap: 4, marginLeft: spacing.xs }}>
          <View style={ac.playerBadge}>
            <MaterialIcons name="people" size={11} color={colors.primary} />
            <Text style={ac.playerCount}>{academy._playerCount ?? 0} players</Text>
          </View>
          {daysLeft !== null && daysLeft <= 5 && daysLeft > 0 && (
            <View style={ac.urgentBadge}>
              <MaterialIcons name="warning" size={10} color={colors.error} />
              <Text style={ac.urgentText}>{daysLeft}d left</Text>
            </View>
          )}
          <MaterialIcons
            name={expanded ? 'expand-less' : 'expand-more'}
            size={18}
            color={colors.textSecondary}
          />
        </View>
      </Pressable>

      {/* ── Quick action row (always visible) ── */}
      <View style={ac.quickActions}>
        {/* WhatsApp */}
        {academy.owner_phone ? (
          <Pressable style={ac.waBtn} onPress={openWhatsApp} hitSlop={6}>
            <MaterialIcons name="chat" size={14} color="#25D366" />
            <Text style={ac.waBtnText}>{academy.owner_phone}</Text>
          </Pressable>
        ) : (
          <Text style={ac.noPhone}>No phone on file</Text>
        )}

        {/* Mark Paid / Unlock */}
        {(hasUnpaid || isLocked) && (
          <Pressable
            style={[ac.markPaidBtn, isLoading && { opacity: 0.6 }]}
            onPress={() => onMarkPaid(academy)}
            disabled={isLoading || loadingId !== null}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <MaterialIcons name="check-circle" size={14} color="#fff" />
                <Text style={ac.markPaidText}>Mark Paid & Renew</Text>
              </>
            )}
          </Pressable>
        )}
      </View>

      {/* ── Expanded details ── */}
      {expanded && (
        <View style={ac.expanded}>
          {/* Billing dates */}
          <View style={ac.infoRow}>
            {academy.trial_start_date && (
              <View style={ac.infoChip}>
                <Text style={ac.infoChipLabel}>Trial Start</Text>
                <Text style={ac.infoChipVal}>{academy.trial_start_date}</Text>
              </View>
            )}
            {academy.trial_end_date && (
              <View style={ac.infoChip}>
                <Text style={ac.infoChipLabel}>Trial End</Text>
                <Text style={[ac.infoChipVal, daysLeft !== null && daysLeft <= 5 && { color: colors.error }]}>
                  {academy.trial_end_date}
                </Text>
              </View>
            )}
            {academy.next_billing_date && (
              <View style={ac.infoChip}>
                <Text style={ac.infoChipLabel}>Next Billing</Text>
                <Text style={ac.infoChipVal}>{academy.next_billing_date}</Text>
              </View>
            )}
          </View>

          {/* Email */}
          {academy.owner_email && (
            <View style={ac.emailRow}>
              <MaterialIcons name="email" size={13} color={colors.textSecondary} />
              <Text style={ac.emailText}>{academy.owner_email}</Text>
            </View>
          )}

          {/* ── Bank Payout Details ── */}
          {(academy.bank_name || academy.account_name || academy.account_number) && (
            <View style={ac.bankSection}>
              <View style={ac.bankSectionHeader}>
                <MaterialIcons name="account-balance" size={13} color={colors.warning} />
                <Text style={ac.bankSectionTitle}>Academy Payout Details</Text>
              </View>
              {academy.bank_name ? (
                <View style={ac.bankRow}>
                  <Text style={ac.bankLabel}>Bank</Text>
                  <Text style={ac.bankVal}>{academy.bank_name}</Text>
                </View>
              ) : null}
              {academy.account_name ? (
                <View style={ac.bankRow}>
                  <Text style={ac.bankLabel}>Account Name</Text>
                  <Text style={ac.bankVal}>{academy.account_name}</Text>
                </View>
              ) : null}
              {academy.account_number ? (
                <View style={ac.bankRow}>
                  <Text style={ac.bankLabel}>Account No.</Text>
                  <Text style={[ac.bankVal, { fontFamily: 'monospace', letterSpacing: 0.8, fontWeight: '800' }]}>{academy.account_number}</Text>
                </View>
              ) : null}
            </View>
          )}

          {/* ── Academy Codes ── */}
          <View style={ac.codesSection}>
            <View style={ac.bankSectionHeader}>
              <MaterialIcons name="vpn-key" size={13} color={colors.primary} />
              <Text style={[ac.bankSectionTitle, { color: colors.primary }]}>Academy Codes</Text>
            </View>
            <View style={ac.codesRow}>
              {academy.coach_code ? (
                <View style={[ac.codeChip, { borderColor: colors.warning + '50', backgroundColor: colors.warning + '08' }]}>
                  <Text style={[ac.codeChipLabel, { color: colors.warning }]}>COACH CODE</Text>
                  <Text style={[ac.codeChipVal, { color: colors.warning }]}>{academy.coach_code}</Text>
                </View>
              ) : null}
              {academy.player_code ? (
                <View style={[ac.codeChip, { borderColor: colors.primary + '50', backgroundColor: colors.primary + '08' }]}>
                  <Text style={[ac.codeChipLabel, { color: colors.primary }]}>PLAYER CODE</Text>
                  <Text style={[ac.codeChipVal, { color: colors.primary }]}>{academy.player_code}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Recent invoices */}
          {(academy._invoices || []).length > 0 && (
            <View style={ac.invoiceSection}>
              <Text style={ac.invoiceSectionTitle}>Recent Invoices</Text>
              {academy._invoices.slice(0, 3).map((inv: any) => (
                <View key={inv.id} style={ac.invoiceRow}>
                  <Text style={ac.invNum}>{inv.invoice_number}</Text>
                  <Text style={ac.invDue}>Due {inv.due_date}</Text>
                  <Text style={ac.invAmt}>{inv.currency} {inv.total_amount?.toLocaleString()}</Text>
                  <View style={[ac.invBadge, { backgroundColor: inv.status === 'paid' ? '#22C55E20' : colors.warning + '20' }]}>
                    <Text style={[ac.invBadgeText, { color: inv.status === 'paid' ? '#22C55E' : colors.warning }]}>
                      {inv.status === 'paid' ? 'Paid' : 'Unpaid'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Secondary actions */}
          <View style={ac.secondaryActions}>
            <Pressable
              style={ac.secBtn}
              onPress={() => onGenerateInvoice(academy)}
              disabled={loadingId !== null}
            >
              <MaterialIcons name="receipt" size={13} color={colors.primary} />
              <Text style={[ac.secBtnText, { color: colors.primary }]}>Generate Invoice</Text>
            </Pressable>

            {!isLocked ? (
              <Pressable
                style={[ac.secBtn, { borderColor: colors.error + '40' }]}
                onPress={() => onLock(academy)}
                disabled={loadingId !== null}
              >
                <MaterialIcons name="lock" size={13} color={colors.error} />
                <Text style={[ac.secBtnText, { color: colors.error }]}>Lock Academy</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[ac.secBtn, { borderColor: '#22C55E60' }]}
                onPress={() => onUnlock(academy)}
                disabled={loadingId !== null}
              >
                <MaterialIcons name="lock-open" size={13} color="#22C55E" />
                <Text style={[ac.secBtnText, { color: '#22C55E' }]}>Unlock Academy</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const ac = StyleSheet.create({
  card: {
    backgroundColor: colors.surface, borderRadius: borderRadius.xl,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  statusDot: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  name: { fontSize: 15, fontWeight: '800', color: colors.text },
  org: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  statusRow: { marginTop: 3 },
  statusLabel: { fontSize: 11, fontWeight: '700' },
  playerBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.primary + '15', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10 },
  playerCount: { fontSize: 11, fontWeight: '800', color: colors.primary },
  urgentBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: colors.error + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  urgentText: { fontSize: 10, fontWeight: '800', color: colors.error },
  quickActions: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingBottom: spacing.md, paddingTop: 0, gap: spacing.sm,
  },
  waBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#25D36615', paddingHorizontal: spacing.sm, paddingVertical: 7, borderRadius: borderRadius.md, borderWidth: 1, borderColor: '#25D36630', flex: 1 },
  waBtnText: { fontSize: 12, color: '#25D366', fontWeight: '700', flex: 1 },
  noPhone: { fontSize: 11, color: colors.textSecondary, fontStyle: 'italic', flex: 1 },
  markPaidBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#22C55E', paddingHorizontal: spacing.md, paddingVertical: 9,
    borderRadius: borderRadius.md,
    shadowColor: '#22C55E', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  markPaidText: { fontSize: 12, fontWeight: '900', color: '#fff' },
  expanded: { borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.md, gap: spacing.sm },
  infoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  infoChip: { flex: 1, minWidth: '28%', backgroundColor: colors.background, borderRadius: borderRadius.md, padding: spacing.sm },
  infoChipLabel: { fontSize: 9, color: colors.textSecondary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoChipVal: { fontSize: 12, color: colors.text, fontWeight: '700', marginTop: 2 },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  emailText: { fontSize: 12, color: colors.textSecondary },
  invoiceSection: { gap: spacing.xs },
  invoiceSectionTitle: { fontSize: 11, color: colors.textSecondary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  invoiceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: colors.border + '40' },
  invNum: { fontSize: 12, fontWeight: '600', color: colors.text, flex: 1 },
  invDue: { fontSize: 10, color: colors.textSecondary },
  invAmt: { fontSize: 12, fontWeight: '700', color: colors.text },
  invBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  invBadgeText: { fontSize: 10, fontWeight: '800' },
  bankSection: {
    backgroundColor: colors.warning + '08', borderRadius: borderRadius.md,
    padding: spacing.sm + 2, borderWidth: 1, borderColor: colors.warning + '30', gap: 6,
  },
  bankSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
  bankSectionTitle: { fontSize: 11, fontWeight: '800', color: colors.warning, textTransform: 'uppercase', letterSpacing: 0.5 },
  bankRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 3 },
  bankLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600', minWidth: 90 },
  bankVal: { fontSize: 12, color: colors.text, fontWeight: '700', flex: 1, textAlign: 'right' },
  codesSection: { gap: 6 },
  codesRow: { flexDirection: 'row', gap: spacing.sm },
  codeChip: { flex: 1, borderRadius: borderRadius.md, borderWidth: 1.5, padding: spacing.sm, alignItems: 'center', gap: 4 },
  codeChipLabel: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  codeChipVal: { fontSize: 18, fontWeight: '900', letterSpacing: 4 },
  secondaryActions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  secBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.sm, paddingVertical: 7, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.primary + '40' },
  secBtnText: { fontSize: 12, fontWeight: '700' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AdminDashboardTab() {
  const { user } = useAuth();
  const { showAlert } = useAlert();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [academies, setAcademies] = useState<any[]>([]);
  const [globalStats, setGlobalStats] = useState({ totalAcademies: 0, totalPlayers: 0, pendingPayments: 0 });
  const [search, setSearch] = useState('');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [billingRunning, setBillingRunning] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [billingResult, setBillingResult] = useState<string | null>(null);

  // Not admin
  if (user?.email && user.email !== SUPER_ADMIN_EMAIL) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <MaterialIcons name="block" size={48} color={colors.error} />
          <Text style={styles.accessDenied}>Access Denied</Text>
        </View>
      </SafeAreaView>
    );
  }

  const load = useCallback(async () => {
    const supabase = getSupabaseClient();

    try {
      // Load last run timestamp in parallel
      const [adminDataResult, lr] = await Promise.all([
        supabase.functions.invoke('get-admin-data', { body: {} }),
        AsyncStorage.getItem(LAST_RUN_KEY),
      ]);

      setLastRun(lr);

      const { data, error } = adminDataResult;

      if (error) {
        let errMsg = error.message;
        try {
          const { FunctionsHttpError } = await import('@supabase/supabase-js');
          if (error instanceof FunctionsHttpError) {
            const t = await error.context?.text();
            errMsg = t || error.message;
          }
        } catch {}
        console.warn('get-admin-data error:', errMsg);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (!data?.academies) {
        console.warn('get-admin-data returned no academies');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      setAcademies(data.academies);
      setGlobalStats(data.globalStats);
    } catch (e) {
      console.error('Admin load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); };

  // ─── Run Daily Billing ────────────────────────────────────────────────────
  const handleRunBilling = async () => {
    const now = new Date().toISOString();
    setBillingRunning(true);
    setBillingResult(null);

    const supabase = getSupabaseClient();
    try {
      const { data, error } = await supabase.functions.invoke('run-billing', { body: {} });

      let errMsg = '';
      if (error) {
        if (error instanceof FunctionsHttpError) {
          try { const t = await error.context?.text(); errMsg = t || error.message; } catch { errMsg = error.message; }
        } else { errMsg = error.message; }
      }

      setBillingRunning(false);

      if (errMsg) {
        showAlert('Billing Error', errMsg);
        return;
      }

      await AsyncStorage.setItem(LAST_RUN_KEY, now);
      setLastRun(now);

      const count = data?.academies_processed ?? 0;
      setBillingResult(
        count === 0
          ? 'No academies due in the next 5 days. All good!'
          : `${count} invoice${count > 1 ? 's' : ''} generated & emailed.`
      );
      await load();
    } catch (e: any) {
      setBillingRunning(false);
      showAlert('Error', e.message);
    }
  };

  // ─── Mark Paid ────────────────────────────────────────────────────────────
  const handleMarkPaid = async (academy: any) => {
    const unpaid = (academy._invoices || []).find((inv: any) => inv.status === 'unpaid');
    const supabase = getSupabaseClient();
    setLoadingId(academy.id);

    if (unpaid) {
      await supabase.rpc('mark_academy_paid', {
        p_academy_id: academy.id,
        p_invoice_id: unpaid.id,
        p_paid_by: user?.email || 'Admin',
      });
    } else {
      // No invoice yet — just unlock and set next billing date
      const nextDate = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
      await supabase.from('academies').update({ billing_status: 'active', next_billing_date: nextDate }).eq('id', academy.id);
    }

    setLoadingId(null);
    await load();
    showAlert('Renewed', `${academy.name} is now active for 30 more days.`);
  };

  const handleLock = async (academy: any) => {
    const supabase = getSupabaseClient();
    setLoadingId(academy.id);
    await supabase.from('academies').update({ billing_status: 'locked' }).eq('id', academy.id);
    setLoadingId(null);
    await load();
  };

  const handleUnlock = async (academy: any) => {
    const supabase = getSupabaseClient();
    setLoadingId(academy.id);
    const nextDate = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
    await supabase.from('academies').update({ billing_status: 'active', next_billing_date: nextDate }).eq('id', academy.id);
    setLoadingId(null);
    await load();
    showAlert('Unlocked', `${academy.name} active. Next billing: ${nextDate}.`);
  };

  const handleGenerateInvoice = async (academy: any) => {
    const supabase = getSupabaseClient();
    setLoadingId(academy.id);
    try {
      const { data, error } = await supabase.functions.invoke('generate-invoice', {
        body: { academy_id: academy.id, triggered_by: user?.email },
      });
      let errMsg = '';
      if (error) {
        if (error instanceof FunctionsHttpError) {
          try { const t = await error.context?.text(); errMsg = t || error.message; } catch { errMsg = error.message; }
        } else { errMsg = error.message; }
      }
      setLoadingId(null);
      if (errMsg) { showAlert('Error', errMsg); return; }
      await load();
      showAlert('Invoice Sent', `Invoice emailed to ${academy.owner_email || 'owner'}.\n${data?.invoice?.player_count || 0} players · PKR ${data?.invoice?.net_payable?.toLocaleString() || 0}`);
    } catch (e: any) {
      setLoadingId(null);
      showAlert('Error', e.message);
    }
  };

  const filtered = academies.filter(a =>
    !search.trim() ||
    a.name?.toLowerCase().includes(search.toLowerCase()) ||
    a.owner_email?.toLowerCase().includes(search.toLowerCase()) ||
    a.owner_phone?.includes(search)
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={[styles.crownCircle]}>
          <Text style={{ fontSize: 20 }}>👑</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Super Admin</Text>
          <Text style={styles.headerSub}>Bat Better · Control Panel</Text>
        </View>
        {(loadingId || billingRunning) && <ActivityIndicator color={colors.primary} />}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* ══ SECTION 1: GLOBAL STATS ══ */}
        <View style={styles.statsSection}>
          <View style={[styles.statCard, { borderColor: colors.primary + '40' }]}>
            <View style={[styles.statIcon, { backgroundColor: colors.primary + '15' }]}>
              <MaterialIcons name="shield" size={20} color={colors.primary} />
            </View>
            <Text style={[styles.statVal, { color: colors.primary }]}>{globalStats.totalAcademies}</Text>
            <Text style={styles.statLabel}>Total{'\n'}Academies</Text>
          </View>

          <View style={[styles.statCard, { borderColor: '#22C55E60' }]}>
            <View style={[styles.statIcon, { backgroundColor: '#22C55E15' }]}>
              <MaterialIcons name="people" size={20} color="#22C55E" />
            </View>
            <Text style={[styles.statVal, { color: '#22C55E' }]}>{globalStats.totalPlayers}</Text>
            <Text style={styles.statLabel}>Active{'\n'}Players</Text>
          </View>

          <View style={[styles.statCard, { borderColor: globalStats.pendingPayments > 0 ? colors.error + '60' : colors.border }]}>
            <View style={[styles.statIcon, { backgroundColor: globalStats.pendingPayments > 0 ? colors.error + '15' : colors.border + '60' }]}>
              <MaterialIcons name="receipt-long" size={20} color={globalStats.pendingPayments > 0 ? colors.error : colors.textSecondary} />
            </View>
            <Text style={[styles.statVal, { color: globalStats.pendingPayments > 0 ? colors.error : colors.textSecondary }]}>
              {globalStats.pendingPayments}
            </Text>
            <Text style={styles.statLabel}>Pending{'\n'}Payments</Text>
          </View>
        </View>

        {/* ══ SECTION 2: BILLING ENGINE ══ */}
        <View style={styles.sectionPad}>
          <View style={styles.billingCard}>
            <View style={styles.billingHeader}>
              <View style={[styles.billingIconCircle]}>
                <MaterialIcons name="bolt" size={24} color={colors.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.billingTitle}>Billing Engine</Text>
                <Text style={styles.billingLastRun}>Last run: {formatLastRun(lastRun)}</Text>
              </View>
            </View>

            <Pressable
              style={[styles.billingBtn, billingRunning && styles.billingBtnDisabled]}
              onPress={handleRunBilling}
              disabled={billingRunning || loadingId !== null}
            >
              {billingRunning ? (
                <>
                  <ActivityIndicator color="#fff" />
                  <Text style={styles.billingBtnText}>Processing...</Text>
                </>
              ) : (
                <>
                  <MaterialIcons name="send" size={20} color="#fff" />
                  <Text style={styles.billingBtnText}>Run Daily Billing</Text>
                </>
              )}
            </Pressable>

            <Text style={styles.billingHint}>
              Scans all academies. Sends an 850 PKR invoice email to any academy exactly 5 days from expiration. Press once per day only.
            </Text>

            {billingResult ? (
              <View style={styles.billingResult}>
                <MaterialIcons name="check-circle" size={16} color="#22C55E" />
                <Text style={styles.billingResultText}>{billingResult}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ══ SECTION 3: ACADEMY LEDGER ══ */}
        <View style={styles.sectionPad}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Academy Ledger</Text>
            <Text style={styles.sectionCount}>{academies.length} academies</Text>
          </View>

          {/* Search */}
          <View style={styles.searchRow}>
            <MaterialIcons name="search" size={16} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search name, email or phone..."
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
            />
            {search ? (
              <Pressable onPress={() => setSearch('')} hitSlop={8}>
                <MaterialIcons name="close" size={16} color={colors.textSecondary} />
              </Pressable>
            ) : null}
          </View>

          {loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="shield" size={44} color={colors.border} />
              <Text style={styles.emptyText}>
                {search ? 'No matches found' : 'No academies registered yet'}
              </Text>
            </View>
          ) : (
            filtered.map(a => (
              <AcademyCard
                key={a.id}
                academy={a}
                onMarkPaid={handleMarkPaid}
                onLock={handleLock}
                onUnlock={handleUnlock}
                onGenerateInvoice={handleGenerateInvoice}
                loadingId={loadingId}
              />
            ))
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  accessDenied: { fontSize: 20, fontWeight: '800', color: colors.text },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  crownCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.warning + '20',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.warning + '40',
  },
  headerTitle: { fontSize: 18, fontWeight: '900', color: colors.text },
  headerSub: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },

  // Stats
  statsSection: {
    flexDirection: 'row', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingTop: spacing.md,
  },
  statCard: {
    flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.xl,
    borderWidth: 1.5, padding: spacing.md, alignItems: 'center', gap: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  statIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  statVal: { fontSize: 28, fontWeight: '900', lineHeight: 32 },
  statLabel: { fontSize: 10, color: colors.textSecondary, fontWeight: '600', textAlign: 'center', lineHeight: 14 },

  // Billing Engine
  sectionPad: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  billingCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.xl,
    borderWidth: 1.5, borderColor: colors.warning + '40',
    padding: spacing.md, gap: spacing.md,
    shadowColor: colors.warning, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 3,
  },
  billingHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  billingIconCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.warning + '20',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.warning + '40',
  },
  billingTitle: { fontSize: 16, fontWeight: '900', color: colors.text },
  billingLastRun: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  billingBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.warning, borderRadius: borderRadius.md,
    paddingVertical: spacing.md + 4,
    shadowColor: colors.warning, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
  },
  billingBtnDisabled: { opacity: 0.55, shadowOpacity: 0 },
  billingBtnText: { fontSize: 17, fontWeight: '900', color: '#fff' },
  billingHint: { fontSize: 12, color: colors.textSecondary, lineHeight: 18, textAlign: 'center' },
  billingResult: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: '#22C55E15', borderRadius: borderRadius.md,
    padding: spacing.md, borderWidth: 1, borderColor: '#22C55E40',
  },
  billingResultText: { fontSize: 13, color: '#22C55E', fontWeight: '700', flex: 1 },

  // Ledger
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: colors.text },
  sectionCount: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    marginBottom: spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },
  loadingState: { paddingVertical: 48, alignItems: 'center' },
  emptyState: { paddingVertical: 48, alignItems: 'center', gap: spacing.md },
  emptyText: { fontSize: 15, color: colors.textSecondary, fontWeight: '600', textAlign: 'center' },
});
