import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  ActivityIndicator, Share, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SafeIcon as MaterialIcons } from '@/components/ui/SafeIcon';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { academyService } from '@/services/academyService';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

const PRICE_PER_PLAYER = 550;
const CURRENCY = 'PKR';
const CURRENCY_SYMBOL = '₨';

function formatNumber(n: number) {
  return n.toLocaleString('en-PK');
}

function getMonthLabel() {
  return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function getDateLabel() {
  return new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
}

interface AuditData {
  academies: number;
  players: number;
  coaches: number;
  totalMembers: number;
  perAcademy: Array<{ id: string; name: string; players: number; coaches: number }>;
}

interface AppStats {
  total_users: number;
  individual_users: number;
  academy_users: number;
  no_mode: number;
  total_academies: number;
  active_players: number;
  inactive_players: number;
  active_coaches: number;
  total_training_logs: number;
  total_sessions_planned: number;
}

function buildPdfHtml(data: AuditData, stats: AppStats): string {
  const totalRevenue = data.players * PRICE_PER_PLAYER;
  const perAcademyRows = data.perAcademy.map((a, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${a.name}</strong></td>
      <td style="text-align:center">${a.players}</td>
      <td style="text-align:center">${a.coaches}</td>
      <td style="text-align:right; color:#1a7a4a; font-weight:800">${CURRENCY_SYMBOL}${formatNumber(a.players * PRICE_PER_PLAYER)}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Bat Better 365 — Admin Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1a1a2e; background: #fff; padding: 40px; font-size: 14px; line-height: 1.5; }

    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1a7a4a; padding-bottom: 20px; margin-bottom: 30px; }
    .logo-block h1 { font-size: 26px; font-weight: 900; color: #1a7a4a; letter-spacing: -0.5px; }
    .logo-block p { font-size: 13px; color: #888; margin-top: 3px; }
    .date-block { text-align: right; }
    .date-block .report-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #888; }
    .date-block .report-date { font-size: 15px; font-weight: 700; color: #1a1a2e; margin-top: 2px; }
    .date-block .period { font-size: 12px; color: #888; margin-top: 2px; }

    h2 { font-size: 16px; font-weight: 800; color: #1a7a4a; margin-bottom: 14px; padding-bottom: 6px; border-bottom: 1px solid #e5e5e5; text-transform: uppercase; letter-spacing: 0.5px; }
    h3 { font-size: 13px; font-weight: 700; color: #444; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }

    .section { margin-bottom: 36px; }

    /* Stats Grid */
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 10px; }
    .stat-card { background: #f8fffe; border: 1px solid #d4edda; border-radius: 10px; padding: 16px; text-align: center; }
    .stat-card .val { font-size: 32px; font-weight: 900; color: #1a7a4a; line-height: 1; }
    .stat-card .lbl { font-size: 11px; color: #888; margin-top: 5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; }

    .stats-grid-2 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
    .stat-card-blue { background: #f0f7ff; border-color: #bee3f8; }
    .stat-card-blue .val { color: #1a56db; }
    .stat-card-orange { background: #fffbf0; border-color: #fde8a8; }
    .stat-card-orange .val { color: #d97706; }

    /* Revenue Hero */
    .revenue-hero { background: linear-gradient(135deg, #1a7a4a 0%, #2d9d6a 100%); border-radius: 14px; padding: 28px; color: white; text-align: center; margin-bottom: 20px; }
    .revenue-hero .label { font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; opacity: 0.8; }
    .revenue-hero .amount { font-size: 48px; font-weight: 900; margin: 8px 0; letter-spacing: -1px; }
    .revenue-hero .sub { font-size: 14px; opacity: 0.8; }
    .revenue-hero .formula { margin-top: 14px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.3); font-size: 13px; opacity: 0.85; }

    /* Table */
    table { width: 100%; border-collapse: collapse; border-radius: 8px; overflow: hidden; }
    thead { background: #1a7a4a; color: white; }
    thead th { padding: 11px 14px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; }
    tbody tr:nth-child(even) { background: #f8fffe; }
    tbody tr { border-bottom: 1px solid #eee; }
    tbody td { padding: 12px 14px; font-size: 13px; }
    .no-data { text-align: center; color: #aaa; padding: 30px; font-style: italic; }

    /* Info Box */
    .info-box { background: #f0f7ff; border-left: 4px solid #1a56db; border-radius: 0 8px 8px 0; padding: 14px 18px; margin-bottom: 16px; }
    .info-box p { font-size: 12.5px; color: #444; line-height: 1.6; }
    .info-box strong { color: #1a56db; }

    .lock-box { background: #fffbf0; border-left: 4px solid #d97706; border-radius: 0 8px 8px 0; padding: 14px 18px; margin-bottom: 16px; }
    .lock-box p { font-size: 12.5px; color: #444; line-height: 1.6; }

    /* Footer */
    .footer { margin-top: 50px; padding-top: 20px; border-top: 2px solid #e5e5e5; display: flex; justify-content: space-between; font-size: 11px; color: #aaa; }
    .footer strong { color: #1a7a4a; }

    .badge { display: inline-block; background: #e8f5e9; color: #1a7a4a; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 700; }
    .badge-red { background: #fee2e2; color: #dc2626; }
    .badge-blue { background: #dbeafe; color: #1a56db; }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <div class="logo-block">
      <h1>🏏 Bat Better 365</h1>
      <p>Admin Report — Confidential</p>
    </div>
    <div class="date-block">
      <div class="report-label">Generated On</div>
      <div class="report-date">${getDateLabel()}</div>
      <div class="period">Period: ${getMonthLabel()}</div>
    </div>
  </div>

  <!-- Section 1: App-Wide User Stats -->
  <div class="section">
    <h2>📱 App Users Overview</h2>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="val">${stats.total_users}</div>
        <div class="lbl">Total Registered Users</div>
      </div>
      <div class="stat-card stat-card-blue">
        <div class="val" style="color:#1a56db">${stats.individual_users}</div>
        <div class="lbl">Individual Mode</div>
      </div>
      <div class="stat-card stat-card-orange">
        <div class="val" style="color:#d97706">${stats.academy_users}</div>
        <div class="lbl">Academy Mode</div>
      </div>
      <div class="stat-card" style="background:#f9f9f9; border-color:#ddd;">
        <div class="val" style="color:#999">${stats.no_mode}</div>
        <div class="lbl">No Mode Selected</div>
      </div>
    </div>

    <div style="margin-top: 14px;">
      <div class="stats-grid-2">
        <div class="stat-card">
          <div class="val">${stats.total_training_logs}</div>
          <div class="lbl">Total Training Logs</div>
        </div>
        <div class="stat-card">
          <div class="val">${stats.total_sessions_planned}</div>
          <div class="lbl">Sessions Planned</div>
        </div>
        <div class="stat-card">
          <div class="val">${stats.total_academies}</div>
          <div class="lbl">Academies Created</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Section 2: Revenue -->
  <div class="section">
    <h2>💰 Monthly Revenue (Academy)</h2>
    <div class="revenue-hero">
      <div class="label">Total Revenue Owed This Month</div>
      <div class="amount">${CURRENCY_SYMBOL}${formatNumber(totalRevenue)}</div>
      <div class="sub">${CURRENCY} per month</div>
      <div class="formula">${data.players} Active Players × ${CURRENCY_SYMBOL}${formatNumber(PRICE_PER_PLAYER)} ${CURRENCY}/player</div>
    </div>

    <div class="lock-box">
      <p>
        <strong>🔒 Device-Locked · Active-Only Billing:</strong>
        Each player device is locked (1 phone = 1 player account). Only <strong>Active</strong> players count toward revenue.
        Coaches can deactivate former players, removing them from billing immediately.
        ${stats.inactive_players > 0 ? `<br/><strong>${stats.inactive_players} deactivated player(s)</strong> are excluded from billing this month.` : ''}
      </p>
    </div>
  </div>

  <!-- Section 3: Academy Summary -->
  <div class="section">
    <h2>🏫 Academy Breakdown</h2>
    <div class="stats-grid-2" style="margin-bottom:20px;">
      <div class="stat-card">
        <div class="val">${data.academies}</div>
        <div class="lbl">Active Academies</div>
      </div>
      <div class="stat-card">
        <div class="val">${data.players}</div>
        <div class="lbl">Billed Players</div>
      </div>
      <div class="stat-card stat-card-orange">
        <div class="val" style="color:#d97706">${data.coaches}</div>
        <div class="lbl">Active Coaches</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Academy Name</th>
          <th style="text-align:center">Players</th>
          <th style="text-align:center">Coaches</th>
          <th style="text-align:right">Revenue (${CURRENCY})</th>
        </tr>
      </thead>
      <tbody>
        ${data.perAcademy.length > 0 ? perAcademyRows : `<tr><td colspan="5" class="no-data">No academies found</td></tr>`}
      </tbody>
    </table>
  </div>

  <!-- Section 4: Notes -->
  <div class="section">
    <h2>📋 Billing Notes</h2>
    <div class="info-box">
      <p>
        <strong>Rate:</strong> ${CURRENCY_SYMBOL}${formatNumber(PRICE_PER_PLAYER)} ${CURRENCY} per active player per month.<br/>
        <strong>Billing:</strong> Only players with <span class="badge">Active</span> status are included in revenue calculations.<br/>
        <strong>Device Lock:</strong> Each player code is tied to one physical device to prevent sharing.<br/>
        <strong>Adjustments:</strong> Coaches can deactivate players who have left; they are removed from the next billing cycle immediately.
      </p>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div><strong>Bat Better 365</strong> — Admin Report · Confidential</div>
    <div>Generated: ${getDateLabel()} · ${getMonthLabel()}</div>
  </div>

</body>
</html>
  `;
}

export default function AcademyAuditScreen() {
  const router = useRouter();
  const [data, setData] = useState<AuditData | null>(null);
  const [stats, setStats] = useState<AppStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const load = useCallback(async () => {
    const [auditRes, statsRes] = await Promise.all([
      academyService.getMonthlyAuditData(),
      academyService.getAppStats(),
    ]);
    setData(auditRes.data);
    setStats(statsRes.data);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const totalRevenue = data ? data.players * PRICE_PER_PLAYER : 0;

  const handleGeneratePDF = async () => {
    if (!data || !stats) return;
    setPdfLoading(true);
    try {
      const html = buildPdfHtml(data, stats);
      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
        margins: { top: 0, right: 0, bottom: 0, left: 0 },
      });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Bat Better 365 — Admin Report',
          UTI: 'com.adobe.pdf',
        });
      }
    } catch (e) {
      console.error('PDF generation error:', e);
    }
    setPdfLoading(false);
  };

  const handleShare = async () => {
    if (!data || !stats) return;
    const lines = [
      `📊 BAT BETTER 365 — Admin Report`,
      `Generated: ${getDateLabel()}`,
      ``,
      `📱 App Users`,
      `▸ Total Registered: ${stats.total_users}`,
      `▸ Individual Mode:  ${stats.individual_users}`,
      `▸ Academy Mode:     ${stats.academy_users}`,
      `▸ No Mode Selected: ${stats.no_mode}`,
      ``,
      `🏫 Academy Stats`,
      `▸ Active Academies:     ${data.academies}`,
      `▸ Active Players (billed): ${data.players}`,
      `▸ Active Coaches:       ${data.coaches}`,
      `▸ Total Training Logs:  ${stats.total_training_logs}`,
      ``,
      `💰 Revenue`,
      `▸ Price/Player: ${CURRENCY_SYMBOL}${formatNumber(PRICE_PER_PLAYER)} ${CURRENCY}/month`,
      `▸ Total Owed:   ${CURRENCY_SYMBOL}${formatNumber(totalRevenue)} ${CURRENCY}`,
      ``,
      `📋 Per Academy`,
      ...data.perAcademy.map((a, i) =>
        `${i + 1}. ${a.name}\n   Players: ${a.players} · Coaches: ${a.coaches} · Revenue: ${CURRENCY_SYMBOL}${formatNumber(a.players * PRICE_PER_PLAYER)} ${CURRENCY}`
      ),
      ``,
      `Generated by Bat Better 365 Admin`,
    ];
    await Share.share({ message: lines.join('\n') });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Admin Report</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Admin Report</Text>
        <Pressable style={styles.shareBtn} onPress={handleShare}>
          <MaterialIcons name="share" size={22} color={colors.primary} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Period Banner */}
        <View style={styles.periodBanner}>
          <MaterialIcons name="calendar-month" size={18} color={colors.textLight} />
          <Text style={styles.periodText}>{getMonthLabel()} Report</Text>
        </View>

        {/* PDF Export Button */}
        <Pressable
          style={[styles.pdfBtn, pdfLoading && { opacity: 0.6 }]}
          onPress={handleGeneratePDF}
          disabled={pdfLoading}
        >
          {pdfLoading ? (
            <>
              <ActivityIndicator color={colors.textLight} size="small" />
              <Text style={styles.pdfBtnText}>Generating PDF...</Text>
            </>
          ) : (
            <>
              <MaterialIcons name="picture-as-pdf" size={20} color={colors.textLight} />
              <Text style={styles.pdfBtnText}>Download PDF Report</Text>
            </>
          )}
        </Pressable>

        {/* ── App Users Section ── */}
        <View style={styles.sectionHeader}>
          <MaterialIcons name="people" size={16} color={colors.text} />
          <Text style={styles.sectionTitle}>App Users</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.primary + '15' }]}>
            <Text style={[styles.statNumber, { color: colors.primary }]}>{stats?.total_users ?? 0}</Text>
            <Text style={styles.statLabel}>Total{'\n'}Users</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#1a56db' + '15' }]}>
            <Text style={[styles.statNumber, { color: '#1a56db' }]}>{stats?.individual_users ?? 0}</Text>
            <Text style={styles.statLabel}>Individual{'\n'}Mode</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.warning + '15' }]}>
            <Text style={[styles.statNumber, { color: colors.warning }]}>{stats?.academy_users ?? 0}</Text>
            <Text style={styles.statLabel}>Academy{'\n'}Mode</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.border + '60' }]}>
            <Text style={[styles.statNumber, { color: colors.textSecondary }]}>{stats?.no_mode ?? 0}</Text>
            <Text style={styles.statLabel}>No Mode{'\n'}Set</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.success + '15' }]}>
            <MaterialIcons name="event-note" size={20} color={colors.success} />
            <Text style={[styles.statNumber, { color: colors.success }]}>{stats?.total_training_logs ?? 0}</Text>
            <Text style={styles.statLabel}>Training{'\n'}Logs</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.mental + '15' }]}>
            <MaterialIcons name="calendar-today" size={20} color={colors.mental} />
            <Text style={[styles.statNumber, { color: colors.mental }]}>{stats?.total_sessions_planned ?? 0}</Text>
            <Text style={styles.statLabel}>Sessions{'\n'}Planned</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.technical + '15' }]}>
            <MaterialIcons name="shield" size={20} color={colors.technical} />
            <Text style={[styles.statNumber, { color: colors.technical }]}>{stats?.total_academies ?? 0}</Text>
            <Text style={styles.statLabel}>Academies{'\n'}Created</Text>
          </View>
        </View>

        {/* ── Revenue Section ── */}
        <View style={styles.revenueCard}>
          <Text style={styles.revenueLabel}>Total Revenue Owed</Text>
          <Text style={styles.revenueAmount}>
            {CURRENCY_SYMBOL}{formatNumber(totalRevenue)}
          </Text>
          <Text style={styles.revenueSub}>{CURRENCY} per month</Text>
          <View style={styles.revenueDivider} />
          <Text style={styles.revenueFormulaText}>
            {data?.players ?? 0} active players × {CURRENCY_SYMBOL}{formatNumber(PRICE_PER_PLAYER)} {CURRENCY}
          </Text>
        </View>

        {/* ── Academy Stats ── */}
        <View style={styles.sectionHeader}>
          <MaterialIcons name="shield" size={16} color={colors.text} />
          <Text style={styles.sectionTitle}>Academy Stats</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.primary + '15' }]}>
            <MaterialIcons name="domain" size={22} color={colors.primary} />
            <Text style={[styles.statNumber, { color: colors.primary }]}>{data?.academies ?? 0}</Text>
            <Text style={styles.statLabel}>Active{'\n'}Academies</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.success + '15' }]}>
            <MaterialIcons name="people" size={22} color={colors.success} />
            <Text style={[styles.statNumber, { color: colors.success }]}>{data?.players ?? 0}</Text>
            <Text style={styles.statLabel}>Billed{'\n'}Players</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.warning + '15' }]}>
            <MaterialIcons name="sports" size={22} color={colors.warning} />
            <Text style={[styles.statNumber, { color: colors.warning }]}>{data?.coaches ?? 0}</Text>
            <Text style={styles.statLabel}>Active{'\n'}Coaches</Text>
          </View>
        </View>

        {stats && stats.inactive_players > 0 && (
          <View style={styles.inactiveNote}>
            <MaterialIcons name="person-off" size={14} color={colors.error} />
            <Text style={styles.inactiveNoteText}>
              {stats.inactive_players} deactivated player(s) excluded from billing
            </Text>
          </View>
        )}

        {/* Device Lock Notice */}
        <View style={styles.lockCard}>
          <MaterialIcons name="phonelink-lock" size={20} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.lockTitle}>Device-Locked · Active-Only Billing</Text>
            <Text style={styles.lockSub}>
              Each player is device-locked (1 device = 1 player). Only <Text style={{ fontWeight: '800', color: colors.primary }}>Active</Text> players count toward revenue.
            </Text>
          </View>
        </View>

        {/* Per-Academy Breakdown */}
        <View style={styles.sectionHeader}>
          <MaterialIcons name="list-alt" size={16} color={colors.text} />
          <Text style={styles.sectionTitle}>Per Academy Breakdown</Text>
        </View>

        {(data?.perAcademy ?? []).length === 0 && (
          <View style={styles.emptyCard}>
            <MaterialIcons name="inbox" size={40} color={colors.border} />
            <Text style={styles.emptyText}>No academies found</Text>
          </View>
        )}

        {(data?.perAcademy ?? []).map((a, i) => {
          const rev = a.players * PRICE_PER_PLAYER;
          return (
            <View key={a.id} style={styles.academyRow}>
              <View style={styles.academyNum}>
                <Text style={styles.academyNumText}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.academyName}>{a.name}</Text>
                <View style={styles.academyMeta}>
                  <View style={styles.metaBadge}>
                    <MaterialIcons name="people" size={11} color={colors.primary} />
                    <Text style={styles.metaBadgeText}>{a.players} Players</Text>
                  </View>
                  <View style={styles.metaBadge}>
                    <MaterialIcons name="sports" size={11} color={colors.warning} />
                    <Text style={[styles.metaBadgeText, { color: colors.warning }]}>{a.coaches} Coaches</Text>
                  </View>
                </View>
              </View>
              <View style={styles.academyRevenue}>
                <Text style={styles.academyRevenueAmount}>{CURRENCY_SYMBOL}{formatNumber(rev)}</Text>
                <Text style={styles.academyRevenueSub}>{CURRENCY}</Text>
              </View>
            </View>
          );
        })}

        {/* Export Buttons */}
        <View style={styles.exportRow}>
          <Pressable
            style={[styles.exportBtn, pdfLoading && { opacity: 0.6 }]}
            onPress={handleGeneratePDF}
            disabled={pdfLoading}
          >
            {pdfLoading ? (
              <ActivityIndicator color={colors.textLight} size="small" />
            ) : (
              <MaterialIcons name="picture-as-pdf" size={18} color={colors.textLight} />
            )}
            <Text style={styles.exportBtnText}>{pdfLoading ? 'Generating...' : 'Export PDF'}</Text>
          </Pressable>
          <Pressable style={[styles.exportBtn, { backgroundColor: colors.primaryDark + 'cc' }]} onPress={handleShare}>
            <MaterialIcons name="ios-share" size={18} color={colors.textLight} />
            <Text style={styles.exportBtnText}>Share Text</Text>
          </Pressable>
        </View>

        <Text style={styles.footerNote}>
          Pull to refresh for the latest counts.{'\n'}
          Prices shown are {CURRENCY_SYMBOL}{formatNumber(PRICE_PER_PLAYER)} {CURRENCY} per active player/month.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { ...typography.h4, color: colors.text, fontWeight: '700', flex: 1 },
  shareBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end' },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: 60, gap: spacing.md },

  periodBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.primaryDark, borderRadius: borderRadius.md,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
  },
  periodText: { fontSize: 14, fontWeight: '700', color: colors.textLight },

  pdfBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: '#dc2626', paddingVertical: spacing.md, borderRadius: borderRadius.md,
    shadowColor: '#dc2626', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  pdfBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.xs,
  },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: colors.text },

  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statCard: {
    flex: 1, borderRadius: borderRadius.lg, padding: spacing.sm,
    alignItems: 'center', gap: 3,
  },
  statNumber: { fontSize: 26, fontWeight: '900', lineHeight: 30 },
  statLabel: { fontSize: 10, color: colors.textSecondary, fontWeight: '600', textAlign: 'center', lineHeight: 13 },

  revenueCard: {
    backgroundColor: colors.primary, borderRadius: borderRadius.xl,
    padding: spacing.xl, alignItems: 'center',
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  revenueLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  revenueAmount: { fontSize: 42, fontWeight: '900', color: colors.textLight, letterSpacing: -1, marginTop: 4 },
  revenueSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  revenueDivider: { width: '60%', height: 1, backgroundColor: 'rgba(255,255,255,0.25)', marginVertical: spacing.md },
  revenueFormulaText: { fontSize: 14, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },

  inactiveNote: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.error + '10', borderRadius: borderRadius.md,
    padding: spacing.sm, borderWidth: 1, borderColor: colors.error + '25',
  },
  inactiveNoteText: { fontSize: 12, color: colors.error, fontWeight: '600' },

  lockCard: {
    flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start',
    backgroundColor: colors.primary + '10', borderRadius: borderRadius.lg,
    padding: spacing.md, borderWidth: 1, borderColor: colors.primary + '30',
  },
  lockTitle: { fontSize: 13, fontWeight: '800', color: colors.text, marginBottom: 3 },
  lockSub: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },

  emptyCard: {
    alignItems: 'center', paddingVertical: 40, gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  emptyText: { fontSize: 14, color: colors.textSecondary },

  academyRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  academyNum: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.primary + '20', justifyContent: 'center', alignItems: 'center',
  },
  academyNumText: { fontSize: 13, fontWeight: '900', color: colors.primary },
  academyName: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 4 },
  academyMeta: { flexDirection: 'row', gap: 6 },
  metaBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.primary + '12', paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  metaBadgeText: { fontSize: 10, fontWeight: '700', color: colors.primary },
  academyRevenue: { alignItems: 'flex-end' },
  academyRevenueAmount: { fontSize: 16, fontWeight: '900', color: colors.success },
  academyRevenueSub: { fontSize: 10, color: colors.textSecondary, fontWeight: '600' },

  exportRow: { flexDirection: 'row', gap: spacing.sm },
  exportBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#dc2626', paddingVertical: spacing.md, borderRadius: borderRadius.md,
  },
  exportBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  footerNote: {
    fontSize: 12, color: colors.textSecondary, textAlign: 'center', lineHeight: 18,
  },
});
