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

// ─── Types ─────────────────────────────────────────────────────────────────────
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

// ─── Helpers ───────────────────────────────────────────────────────────────────
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

            {loading && (
              <View style={rptStyles.loadingBox}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={rptStyles.loadingText}>Analysing your week...</Text>
                <Text style={rptStyles.loadingSubText}>Our AI coach is reviewing your training data</Text>
              </View>
            )}

            {!loading && !report && (
              <View style={rptStyles.emptyBox}>
                <MaterialIcons name="insights" size={52} color={colors.border} />
                <Text style={rptStyles.emptyTitle}>Ready to Analyse Your Week</Text>
                <Text style={rptStyles.emptySub}>
                  The AI coach will review all your sessions, balls faced, intensity ratings, and drill logs from the past 7 days.
                </Text>
                <Pressable style={rptStyles.generateBtn} onPress={onGenerate}>
                  <MaterialIcons name="auto-awesome" size={18} color={colors.textLight} />
                  <Text style={rptStyles.generateBtnText}>Generate My Report</Text>
                </Pressable>
              </View>
            )}

            {!loading && report && parsed && (
              <>
                <ReportSection emoji="✅" title="What Went Well" content={parsed.wentWell} color={colors.success} />
                <ReportSection emoji="⚠️" title="Areas Missing the Objective" content={parsed.missing} color={colors.warning} />
                <ReportSection emoji="🎯" title="Top Drill Recommendation" content={parsed.recommendation} color={colors.primary} />
                <Pressable style={[rptStyles.generateBtn, { marginTop: spacing.md }]} onPress={onGenerate}>
                  <MaterialIcons name="refresh" size={16} color={colors.textLight} />
                  <Text style={rptStyles.generateBtnText}>Regenerate Report</Text>
                </Pressable>
              </>
            )}

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
  const scrollViewRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hello! I am your AI Cricket Coach. I can help you improve your batting skills, suggest drills, and create personalised training plans. What would you like to work on today?',
      id: 'welcome-message',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

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
      setMessages([...updatedMessages, {
        role: 'assistant',
        content: data || 'Sorry, I could not process that.',
        id: Date.now().toString(),
      }]);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <MaterialIcons name="psychology" size={22} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>AI Batting Coach</Text>
          <Text style={styles.headerSub}>Powered by OnSpace AI</Text>
        </View>
        <Pressable
          style={styles.reportBtn}
          onPress={() => {
            setShowReport(true);
            if (!weeklyReport && !reportLoading) handleGenerateReport();
          }}
        >
          <MaterialIcons name="auto-awesome" size={16} color={colors.primary} />
          <Text style={styles.reportBtnText}>Weekly Report</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={{ flex: 1 }}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((message, index) => (
            <View key={message.id || index} style={styles.messageWrapper}>
              {message.role === 'assistant' && (
                <View style={styles.aiBadge}>
                  <MaterialIcons name="psychology" size={14} color={colors.primary} />
                </View>
              )}
              <View style={[
                styles.messageBubble,
                message.role === 'user' ? styles.userMessage : styles.assistantMessage,
              ]}>
                <Text style={[styles.messageText, message.role === 'user' && styles.userMessageText]}>
                  {message.content}
                </Text>
              </View>
            </View>
          ))}

          {loading && (
            <View style={styles.messageWrapper}>
              <View style={styles.aiBadge}>
                <MaterialIcons name="psychology" size={14} color={colors.primary} />
              </View>
              <View style={[styles.messageBubble, styles.assistantMessage]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.loadingText}>Thinking...</Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Quick prompts */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.quickPromptsContainer}
          contentContainerStyle={styles.quickPromptsContent}
        >
          {[
            'Improve my cover drive',
            'Fix my footwork',
            'Build a training plan',
            'How to face fast bowling',
            'Improve my pull shot',
            'Mental tips for batting',
          ].map((p) => (
            <Pressable key={p} style={styles.quickChip} onPress={() => setInput(p)}>
              <Text style={styles.quickChipText}>{p}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Input bar */}
        <View style={[styles.inputContainer, { paddingBottom: insets.bottom > 0 ? insets.bottom : spacing.md }]}>
          <TextInput
            style={styles.input}
            placeholder="Ask about drills, technique, training plans..."
            placeholderTextColor={colors.textSecondary}
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
            <MaterialIcons name="send" size={22} color="#fff" />
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

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.md, backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  headerSub: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  reportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.primary + '12', borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderWidth: 1, borderColor: colors.primary + '30',
  },
  reportBtnText: { fontSize: 12, fontWeight: '700', color: colors.primary },

  messagesContent: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.lg },

  messageWrapper: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  aiBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center', alignItems: 'center',
    marginTop: 2, flexShrink: 0,
  },
  messageBubble: {
    flex: 1, maxWidth: '88%', padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  userMessage: {
    alignSelf: 'flex-end', backgroundColor: colors.primary,
    marginLeft: 36,
  },
  assistantMessage: {
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  messageText: { ...typography.body, color: colors.text, lineHeight: 22 },
  userMessageText: { color: '#fff' },
  loadingText: { ...typography.body, color: colors.textSecondary, fontStyle: 'italic' },

  quickPromptsContainer: {
    maxHeight: 46,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  quickPromptsContent: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    gap: spacing.sm, flexDirection: 'row', alignItems: 'center',
  },
  quickChip: {
    paddingHorizontal: spacing.md, paddingVertical: 7,
    backgroundColor: colors.primary + '12', borderRadius: borderRadius.full,
    borderWidth: 1, borderColor: colors.primary + '30',
  },
  quickChipText: { fontSize: 12, fontWeight: '600', color: colors.primary },

  inputContainer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm,
    padding: spacing.md, backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  input: {
    flex: 1, ...typography.body, color: colors.text,
    backgroundColor: colors.background, borderRadius: borderRadius.md,
    padding: spacing.md, maxHeight: 100,
    borderWidth: 1, borderColor: colors.border,
  },
  sendButton: {
    backgroundColor: colors.primary, width: 48, height: 48,
    borderRadius: borderRadius.full, justifyContent: 'center', alignItems: 'center',
  },
  sendButtonDisabled: { backgroundColor: colors.disabled },
});

// ─── Report Modal Styles ───────────────────────────────────────────────────────
const rptStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '92%', flex: 1,
  },
  handle: {
    width: 40, height: 4, backgroundColor: colors.border,
    borderRadius: 2, alignSelf: 'center', marginTop: 10,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  headerSub: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  closeBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  content: { padding: spacing.md, paddingBottom: 48, gap: spacing.md },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statChip: {
    flex: 1, backgroundColor: colors.primary + '10', borderRadius: borderRadius.md,
    padding: spacing.sm, alignItems: 'center',
    borderWidth: 1, borderColor: colors.primary + '25',
  },
  statVal: { fontSize: 18, fontWeight: '900', color: colors.primary },
  statLabel: { fontSize: 10, color: colors.textSecondary, fontWeight: '600', marginTop: 1 },
  loadingBox: { alignItems: 'center', paddingVertical: 48, gap: spacing.md },
  loadingText: { fontSize: 16, fontWeight: '700', color: colors.text },
  loadingSubText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
  emptyBox: { alignItems: 'center', paddingVertical: 32, gap: spacing.md },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: colors.text, textAlign: 'center' },
  emptySub: {
    fontSize: 13, color: colors.textSecondary, textAlign: 'center',
    lineHeight: 20, paddingHorizontal: spacing.md,
  },
  generateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: borderRadius.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.xl, alignSelf: 'center',
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  generateBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  section: {
    backgroundColor: colors.background, borderRadius: borderRadius.lg,
    borderLeftWidth: 4, padding: spacing.md, gap: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionEmoji: { fontSize: 18 },
  sectionTitle: {
    fontSize: 14, fontWeight: '800',
    textTransform: 'uppercase', letterSpacing: 0.5, flex: 1,
  },
  sectionBody: { fontSize: 14, color: colors.text, lineHeight: 22 },
  rawReport: { fontSize: 14, color: colors.text, lineHeight: 22 },
});
