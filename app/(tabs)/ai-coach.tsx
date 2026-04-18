import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeIcon as MaterialIcons } from '@/components/ui/SafeIcon';
import { aiCoachService } from '@/services/aiCoachService';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { useAlert, useAuth, getSupabaseClient } from '@/template';
import { FunctionsHttpError } from '@supabase/supabase-js';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  id?: string;
}

interface WeeklyReportStats {
  totalSessions: number;
  totalMins: number;
  totalBallsFaced: number;
  totalRunsScored: number;
  avgIntensity: string;
}

// ─── Markdown-like renderer for report sections ────────────────────────────────
function ReportSection({ title, emoji, content, color }: { title: string; emoji: string; content: string; color: string }) {
  return (
    <View style={[rptStyles.section, { borderLeftColor: color }]}>
      <View style={rptStyles.sectionHeader}>
        <Text style={rptStyles.sectionEmoji}>{emoji}</Text>
        <Text style={[rptStyles.sectionTitle, { color }]}>{title}</Text>
      </View>
      <Text style={rptStyles.sectionBody}>{content.trim()}</Text>
    </View>
  );
}

function parseReport(text: string): { wentWell: string; missing: string; recommendation: string } | null {
  try {
    const wentWellMatch = text.match(/##\s*✅\s*What Went Well\s*\n([\s\S]*?)(?=##|$)/i);
    const missingMatch = text.match(/##\s*⚠️\s*Areas Missing the Objective\s*\n([\s\S]*?)(?=##|$)/i);
    const recMatch = text.match(/##\s*🎯\s*Top Drill Recommendation.*?\n([\s\S]*?)(?=##|$)/i);
    if (!wentWellMatch && !missingMatch && !recMatch) return null;
    return {
      wentWell: (wentWellMatch?.[1] || '').trim(),
      missing: (missingMatch?.[1] || '').trim(),
      recommendation: (recMatch?.[1] || '').trim(),
    };
  } catch { return null; }
}

// ─── Weekly Report Modal ───────────────────────────────────────────────────────
function WeeklyReportModal({
  visible, onClose, report, stats, loading, onGenerate,
}: {
  visible: boolean;
  onClose: () => void;
  report: string | null;
  stats: WeeklyReportStats | null;
  loading: boolean;
  onGenerate: () => void;
}) {
  const parsed = report ? parseReport(report) : null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={rptStyles.overlay}>
        <View style={rptStyles.sheet}>
          <View style={rptStyles.handle} />
          <View style={rptStyles.header}>
            <View style={{ flex: 1 }}>
              <Text style={rptStyles.headerTitle}>Weekly AI Report</Text>
              <Text style={rptStyles.headerSub}>Last 7 days · Powered by OnSpace AI</Text>
            </View>
            <Pressable onPress={onClose} style={rptStyles.closeBtn}>
              <MaterialIcons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={rptStyles.content} showsVerticalScrollIndicator={false}>
            {/* Stats snapshot */}
            {stats && (
              <View style={rptStyles.statsRow}>
                <View style={rptStyles.statChip}>
                  <Text style={rptStyles.statVal}>{stats.totalSessions}</Text>
                  <Text style={rptStyles.statLabel}>Sessions</Text>
                </View>
                <View style={rptStyles.statChip}>
                  <Text style={rptStyles.statVal}>{stats.totalMins}</Text>
                  <Text style={rptStyles.statLabel}>Mins</Text>
                </View>
                <View style={rptStyles.statChip}>
                  <Text style={rptStyles.statVal}>{stats.totalBallsFaced}</Text>
                  <Text style={rptStyles.statLabel}>Balls</Text>
                </View>
                <View style={rptStyles.statChip}>
                  <Text style={rptStyles.statVal}>{stats.avgIntensity}</Text>
                  <Text style={rptStyles.statLabel}>Intensity</Text>
                </View>
              </View>
            )}

            {/* Loading */}
            {loading && (
              <View style={rptStyles.loadingBox}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={rptStyles.loadingText}>Analysing your week...</Text>
                <Text style={rptStyles.loadingSubText}>Our AI coach is reviewing your training data</Text>
              </View>
            )}

            {/* No report yet */}
            {!loading && !report && (
              <View style={rptStyles.emptyBox}>
                <MaterialIcons name="insights" size={52} color={colors.border} />
                <Text style={rptStyles.emptyTitle}>Ready to Analyse Your Week</Text>
                <Text style={rptStyles.emptySub}>
                  The AI coach will review all your sessions, balls faced, intensity ratings, and drill logs from the past 7 days to give you a personalised report.
                </Text>
                <Pressable style={rptStyles.generateBtn} onPress={onGenerate}>
                  <MaterialIcons name="auto-awesome" size={18} color={colors.textLight} />
                  <Text style={rptStyles.generateBtnText}>Generate My Report</Text>
                </Pressable>
              </View>
            )}

            {/* Parsed report */}
            {!loading && report && parsed && (
              <>
                <ReportSection
                  emoji="✅"
                  title="What Went Well"
                  content={parsed.wentWell}
                  color={colors.success}
                />
                <ReportSection
                  emoji="⚠️"
                  title="Areas Missing the Objective"
                  content={parsed.missing}
                  color={colors.warning}
                />
                <ReportSection
                  emoji="🎯"
                  title="Top Drill Recommendation"
                  content={parsed.recommendation}
                  color={colors.primary}
                />
                <Pressable style={[rptStyles.generateBtn, { marginTop: spacing.md }]} onPress={onGenerate}>
                  <MaterialIcons name="refresh" size={16} color={colors.textLight} />
                  <Text style={rptStyles.generateBtnText}>Regenerate Report</Text>
                </Pressable>
              </>
            )}

            {/* Raw report (if parsing failed) */}
            {!loading && report && !parsed && (
              <>
                <Text style={rptStyles.rawReport}>{report}</Text>
                <Pressable style={[rptStyles.generateBtn, { marginTop: spacing.md }]} onPress={onGenerate}>
                  <MaterialIcons name="refresh" size={16} color={colors.textLight} />
                  <Text style={rptStyles.generateBtnText}>Regenerate</Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function AICoachScreen() {
  const { showAlert } = useAlert();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hello! I am your AI Cricket Coach. I can help you improve your batting skills, suggest drills, and create personalized training plans. What would you like to work on today?',
      id: 'welcome-message',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Weekly Report state
  const [showReport, setShowReport] = useState(false);
  const [weeklyReport, setWeeklyReport] = useState<string | null>(null);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyReportStats | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: input.trim(), id: Date.now().toString() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    try {
      const { data, error } = await aiCoachService.chatWithCoach(updatedMessages);
      if (error) {
        showAlert('Error', error);
        setMessages(messages);
        return;
      }
      setMessages([...updatedMessages, { role: 'assistant', content: data || 'Sorry, I could not process that.', id: Date.now().toString() }]);
      setTimeout(() => { scrollViewRef.current?.scrollToEnd({ animated: true }); }, 100);
    } catch {
      showAlert('Error', 'Failed to get response from AI Coach');
      setMessages(messages);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!user?.id) return;
    setReportLoading(true);
    setWeeklyReport(null);
    setWeeklyStats(null);

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.functions.invoke('ai-coach-analysis', {
        body: { userId: user.id, analysisType: 'weekly_report' },
      });

      if (error) {
        let errorMessage = error.message;
        if (error instanceof FunctionsHttpError) {
          try {
            const statusCode = error.context?.status ?? 500;
            const textContent = await error.context?.text();
            errorMessage = `[Code: ${statusCode}] ${textContent || error.message}`;
          } catch { /* use original */ }
        }
        showAlert('Error', errorMessage);
        setReportLoading(false);
        return;
      }

      setWeeklyReport(data?.report || '');
      if (data?.stats) setWeeklyStats(data.stats);
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to generate report');
    } finally {
      setReportLoading(false);
    }
  };

  const handleReportMessage = (messageId: string, messageContent: string) => {
    showAlert(
      'Report Response',
      'Thank you for reporting this AI response. We will review it.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Report', style: 'destructive', onPress: () => showAlert('Reported', 'Thank you for your feedback!') },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <MaterialIcons name="psychology" size={26} color={colors.primary} />
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>AI Batting Coach</Text>
        </View>
        {/* Weekly Report button */}
        <Pressable
          style={styles.weeklyReportBtn}
          onPress={() => setShowReport(true)}
        >
          <MaterialIcons name="insights" size={15} color={colors.primary} />
          <Text style={styles.weeklyReportBtnText}>Weekly Report</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Prominent generate report card at top of chat */}
          <Pressable style={styles.reportCard} onPress={() => { setShowReport(true); if (!weeklyReport && !reportLoading) handleGenerateReport(); }}>
            <View style={styles.reportCardIcon}>
              <MaterialIcons name="auto-awesome" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.reportCardTitle}>Generate My Weekly AI Report</Text>
              <Text style={styles.reportCardSub}>Personalised analysis of your last 7 days training</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={colors.primary} />
          </Pressable>

          {messages.map((message, index) => (
            <View key={message.id || index} style={styles.messageWrapper}>
              <View style={[styles.messageBubble, message.role === 'user' ? styles.userMessage : styles.assistantMessage]}>
                <Text style={[styles.messageText, message.role === 'user' && styles.userMessageText]}>
                  {message.content}
                </Text>
              </View>
              {message.role === 'assistant' && (
                <Pressable
                  style={styles.reportButton}
                  onPress={() => handleReportMessage(message.id || index.toString(), message.content)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialIcons name="flag" size={16} color={colors.textSecondary} />
                </Pressable>
              )}
            </View>
          ))}
          {loading && (
            <View style={[styles.messageBubble, styles.assistantMessage]}>
              <Text style={styles.loadingText}>Thinking...</Text>
            </View>
          )}
        </ScrollView>

        <View style={[styles.inputContainer, { paddingBottom: insets.bottom > 0 ? insets.bottom : spacing.md }]}>
          <TextInput
            style={styles.input}
            placeholder="Ask about drills, technique, training plans..."
            placeholderTextColor="#4B5563"
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            editable={!loading}
          />
          <Pressable
            style={[styles.sendButton, (!input.trim() || loading) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!input.trim() || loading}
          >
            <MaterialIcons name="send" size={24} color={!input.trim() || loading ? colors.disabled : colors.textLight} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <WeeklyReportModal
        visible={showReport}
        onClose={() => setShowReport(false)}
        report={weeklyReport}
        stats={weeklyStats}
        loading={reportLoading}
        onGenerate={handleGenerateReport}
      />
    </SafeAreaView>
  );
}

// ─── Report Modal Styles ───────────────────────────────────────────────────────
const rptStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%', flex: 1 },
  handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  headerSub: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  closeBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  content: { padding: spacing.md, paddingBottom: 48, gap: spacing.md },

  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statChip: { flex: 1, backgroundColor: colors.primary + '10', borderRadius: borderRadius.md, padding: spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: colors.primary + '25' },
  statVal: { fontSize: 18, fontWeight: '900', color: colors.primary },
  statLabel: { fontSize: 10, color: colors.textSecondary, fontWeight: '600', marginTop: 1 },

  loadingBox: { alignItems: 'center', paddingVertical: 48, gap: spacing.md },
  loadingText: { fontSize: 16, fontWeight: '700', color: colors.text },
  loadingSubText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },

  emptyBox: { alignItems: 'center', paddingVertical: 32, gap: spacing.md },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: colors.text, textAlign: 'center' },
  emptySub: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, paddingHorizontal: spacing.md },

  generateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: borderRadius.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.xl,
    alignSelf: 'center',
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  generateBtnText: { fontSize: 15, fontWeight: '800', color: colors.textLight },

  section: {
    backgroundColor: colors.background, borderRadius: borderRadius.lg,
    borderLeftWidth: 4, padding: spacing.md, gap: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionEmoji: { fontSize: 18 },
  sectionTitle: { fontSize: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 },
  sectionBody: { fontSize: 14, color: colors.text, lineHeight: 22 },

  rawReport: { fontSize: 14, color: colors.text, lineHeight: 22 },
});

// ─── Main Screen Styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.md, backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerText: { flex: 1 },
  headerTitle: { ...typography.h3, color: colors.text },
  weeklyReportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primary + '12', paddingHorizontal: spacing.sm + 2,
    paddingVertical: 7, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.primary + '30',
  },
  weeklyReportBtnText: { fontSize: 12, fontWeight: '800', color: colors.primary },

  reportCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    borderWidth: 1.5, borderColor: colors.primary + '40',
    padding: spacing.md, marginBottom: spacing.sm,
  },
  reportCardIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primary + '15', justifyContent: 'center', alignItems: 'center',
  },
  reportCardTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  reportCardSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  keyboardView: { flex: 1 },
  messagesContainer: { flex: 1 },
  messagesContent: { padding: spacing.md, gap: spacing.md },
  messageWrapper: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  messageBubble: { maxWidth: '75%', padding: spacing.md, borderRadius: borderRadius.lg },
  userMessage: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  assistantMessage: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  messageText: { ...typography.body, color: colors.text },
  userMessageText: { color: colors.textLight },
  loadingText: { ...typography.body, color: colors.textSecondary, fontStyle: 'italic' },
  inputContainer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm,
    padding: spacing.md, backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  input: {
    flex: 1, ...typography.body, color: colors.text,
    backgroundColor: colors.background, borderRadius: borderRadius.md,
    padding: spacing.md, maxHeight: 100, borderWidth: 1, borderColor: colors.border,
  },
  sendButton: {
    backgroundColor: colors.primary, width: 48, height: 48,
    borderRadius: borderRadius.full, justifyContent: 'center', alignItems: 'center',
  },
  sendButtonDisabled: { backgroundColor: colors.disabled },
  reportButton: { paddingTop: spacing.md, paddingHorizontal: spacing.xs, opacity: 0.6 },
});
