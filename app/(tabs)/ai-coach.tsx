import React, { useState, useRef, useCallback } from 'react';
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
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeIcon as MaterialIcons } from '@/components/ui/SafeIcon';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
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

interface ShotImprovement {
  issue: string;
  detail: string;
  fix: string;
}

interface ShotAnalysis {
  shotType: string;
  overallScore: number;
  wentWell: string[];
  improvements: ShotImprovement[];
  keyFocus: string;
  demoTip: string;
  encouragement: string;
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

// Score circle colour
function scoreColor(score: number) {
  if (score >= 8) return colors.success;
  if (score >= 6) return '#F59E0B';
  return '#EF4444';
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

// ─── Shot Analysis Tab ─────────────────────────────────────────────────────────
function ShotAnalysisTab() {
  const { showAlert } = useAlert();
  const [pickedImage, setPickedImage] = useState<{ uri: string; base64: string; mimeType: string } | null>(null);
  const [context, setContext] = useState('');
  const [analysing, setAnalysing] = useState(false);
  const [analysis, setAnalysis] = useState<ShotAnalysis | null>(null);
  const [expandedImprovement, setExpandedImprovement] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const pickImage = useCallback(async (fromCamera: boolean) => {
    try {
      let permResult;
      if (fromCamera) {
        permResult = await ImagePicker.requestCameraPermissionsAsync();
      } else {
        permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      }

      if (!permResult.granted) {
        const canAskAgain = permResult.canAskAgain;
        showAlert(
          'Permission Required',
          canAskAgain
            ? (fromCamera ? 'Camera access is needed to capture your shot.' : 'Photo library access is needed to pick an image.')
            : (fromCamera
                ? 'Camera access was denied. Please enable it in your device Settings > Apps > Bat Better 365 > Permissions.'
                : 'Photo access was denied. Please enable it in your device Settings > Apps > Bat Better 365 > Permissions.'),
          canAskAgain
            ? [{ text: 'OK', style: 'cancel' }]
            : [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open Settings', onPress: () => Linking.openSettings() },
              ]
        );
        return;
      }

      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.7, base64: true })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.7, base64: true });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];

      let base64Data = asset.base64 || '';

      // Fallback: read file as base64 if not provided
      if (!base64Data && asset.uri) {
        base64Data = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }

      const mimeType = asset.mimeType || 'image/jpeg';
      setPickedImage({ uri: asset.uri, base64: base64Data, mimeType });
      setAnalysis(null);
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to pick image');
    }
  }, [showAlert]);

  const handleAnalyse = async () => {
    if (!pickedImage) return;
    setAnalysing(true);
    setAnalysis(null);
    setExpandedImprovement(null);

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.functions.invoke('shot-analysis', {
        body: {
          imageBase64: pickedImage.base64,
          mimeType: pickedImage.mimeType,
          shotContext: context.trim() || undefined,
        },
      });

      if (error) {
        let msg = error.message;
        if (error instanceof FunctionsHttpError) {
          try { msg = await error.context?.text() || msg; } catch { /* noop */ }
        }
        showAlert('Analysis Failed', msg);
        return;
      }

      if (data?.analysis) {
        setAnalysis(data.analysis);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
      } else if (data?.raw) {
        showAlert('Analysis Result', data.raw);
      } else {
        showAlert('Error', 'Unexpected response from AI');
      }
    } catch (e: any) {
      showAlert('Error', e.message || 'Analysis failed');
    } finally {
      setAnalysing(false);
    }
  };

  const resetAnalysis = () => {
    setPickedImage(null);
    setAnalysis(null);
    setContext('');
    setExpandedImprovement(null);
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1 }}
      contentContainerStyle={saStyles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Hero card */}
      <View style={saStyles.heroCard}>
        <View style={saStyles.heroIcon}>
          <MaterialIcons name="videocam" size={28} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={saStyles.heroTitle}>Shot Analyser</Text>
          <Text style={saStyles.heroSub}>Upload a photo or screenshot of your batting shot and get instant AI coaching feedback</Text>
        </View>
      </View>

      {/* Step 1: Upload */}
      <View style={saStyles.stepCard}>
        <View style={saStyles.stepHeader}>
          <View style={saStyles.stepBadge}><Text style={saStyles.stepNum}>1</Text></View>
          <Text style={saStyles.stepTitle}>Upload Your Shot</Text>
        </View>

        {!pickedImage ? (
          <View style={saStyles.uploadZone}>
            <MaterialIcons name="add-photo-alternate" size={40} color={colors.textSecondary} />
            <Text style={saStyles.uploadTitle}>Add a batting photo</Text>
            <Text style={saStyles.uploadSub}>A clear side-on or front-on image works best</Text>
            <View style={saStyles.uploadBtns}>
              <Pressable style={saStyles.uploadBtn} onPress={() => pickImage(true)}>
                <MaterialIcons name="camera-alt" size={18} color={colors.textLight} />
                <Text style={saStyles.uploadBtnText}>Camera</Text>
              </Pressable>
              <Pressable style={[saStyles.uploadBtn, saStyles.uploadBtnOutline]} onPress={() => pickImage(false)}>
                <MaterialIcons name="photo-library" size={18} color={colors.primary} />
                <Text style={[saStyles.uploadBtnText, { color: colors.primary }]}>Gallery</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={saStyles.imagePreview}>
            <Image
              source={{ uri: pickedImage.uri }}
              style={saStyles.previewImg}
              contentFit="cover"
              transition={200}
            />
            {!analysis && (
              <Pressable style={saStyles.changeImgBtn} onPress={resetAnalysis}>
                <MaterialIcons name="swap-horiz" size={14} color={colors.textSecondary} />
                <Text style={saStyles.changeImgText}>Change image</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>

      {/* Step 2: Context (optional) */}
      {pickedImage && !analysis && (
        <View style={saStyles.stepCard}>
          <View style={saStyles.stepHeader}>
            <View style={saStyles.stepBadge}><Text style={saStyles.stepNum}>2</Text></View>
            <Text style={saStyles.stepTitle}>Add Context <Text style={saStyles.optional}>(Optional)</Text></Text>
          </View>
          <TextInput
            style={saStyles.contextInput}
            placeholder={`e.g. "This is my cover drive, I feel I'm falling over" or "Pull shot against a short ball"`}
            placeholderTextColor={colors.textSecondary}
            value={context}
            onChangeText={setContext}
            multiline
            maxLength={200}
          />
          <Text style={saStyles.charCount}>{context.length}/200</Text>
        </View>
      )}

      {/* Analyse button */}
      {pickedImage && !analysis && (
        <Pressable
          style={[saStyles.analyseBtn, analysing && saStyles.analyseBtnDisabled]}
          onPress={handleAnalyse}
          disabled={analysing}
        >
          {analysing ? (
            <>
              <ActivityIndicator size="small" color={colors.textLight} />
              <Text style={saStyles.analyseBtnText}>Analysing your technique...</Text>
            </>
          ) : (
            <>
              <MaterialIcons name="auto-awesome" size={20} color={colors.textLight} />
              <Text style={saStyles.analyseBtnText}>Analyse My Shot</Text>
            </>
          )}
        </Pressable>
      )}

      {/* Analysis Results */}
      {analysis && (
        <View style={saStyles.resultsContainer}>

          {/* Score header */}
          <View style={saStyles.scoreCard}>
            <View style={[saStyles.scoreCircle, { borderColor: scoreColor(analysis.overallScore) }]}>
              <Text style={[saStyles.scoreNum, { color: scoreColor(analysis.overallScore) }]}>{analysis.overallScore}</Text>
              <Text style={saStyles.scoreDenom}>/10</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={saStyles.shotTypeLabel}>Shot Identified</Text>
              <Text style={saStyles.shotTypeName}>{analysis.shotType}</Text>
              <Text style={saStyles.encouragement}>{analysis.encouragement}</Text>
            </View>
          </View>

          {/* What went well */}
          <View style={saStyles.resultSection}>
            <View style={saStyles.resultSectionHeader}>
              <View style={[saStyles.resultDot, { backgroundColor: colors.success }]} />
              <Text style={saStyles.resultSectionTitle}>What You Did Well</Text>
            </View>
            {analysis.wentWell.map((point, i) => (
              <View key={i} style={saStyles.bulletRow}>
                <Text style={[saStyles.bulletDot, { color: colors.success }]}>✓</Text>
                <Text style={saStyles.bulletText}>{point}</Text>
              </View>
            ))}
          </View>

          {/* Areas to improve */}
          <View style={saStyles.resultSection}>
            <View style={saStyles.resultSectionHeader}>
              <View style={[saStyles.resultDot, { backgroundColor: colors.warning }]} />
              <Text style={saStyles.resultSectionTitle}>Areas to Improve</Text>
            </View>
            {analysis.improvements.map((imp, i) => (
              <Pressable
                key={i}
                style={saStyles.improvementCard}
                onPress={() => setExpandedImprovement(expandedImprovement === i ? null : i)}
              >
                <View style={saStyles.improvementHeader}>
                  <MaterialIcons name="warning" size={15} color={colors.warning} />
                  <Text style={saStyles.improvementIssue}>{imp.issue}</Text>
                  <MaterialIcons
                    name={expandedImprovement === i ? 'expand-less' : 'expand-more'}
                    size={20}
                    color={colors.textSecondary}
                  />
                </View>
                {expandedImprovement === i && (
                  <View style={saStyles.improvementBody}>
                    <Text style={saStyles.improvementDetail}>{imp.detail}</Text>
                    <View style={saStyles.fixBox}>
                      <MaterialIcons name="fitness-center" size={14} color={colors.primary} />
                      <Text style={saStyles.fixText}>{imp.fix}</Text>
                    </View>
                  </View>
                )}
              </Pressable>
            ))}
          </View>

          {/* Key focus */}
          <View style={saStyles.keyFocusCard}>
            <View style={saStyles.keyFocusHeader}>
              <MaterialIcons name="flag" size={18} color={colors.primary} />
              <Text style={saStyles.keyFocusTitle}>Your #1 Focus Right Now</Text>
            </View>
            <Text style={saStyles.keyFocusText}>{analysis.keyFocus}</Text>
          </View>

          {/* Demo tip */}
          <View style={saStyles.demoCard}>
            <View style={saStyles.demoHeader}>
              <MaterialIcons name="lightbulb" size={18} color="#F59E0B" />
              <Text style={saStyles.demoTitle}>Visualise the Correct Technique</Text>
            </View>
            <Text style={saStyles.demoText}>{analysis.demoTip}</Text>
          </View>

          {/* Analyse again */}
          <Pressable style={saStyles.resetBtn} onPress={resetAnalysis}>
            <MaterialIcons name="refresh" size={18} color={colors.primary} />
            <Text style={saStyles.resetBtnText}>Analyse Another Shot</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

// ─── AI Chat Tab ───────────────────────────────────────────────────────────────
function AIChatTab() {
  const { showAlert } = useAlert();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hello! I am your AI Cricket Coach. I can help you improve your batting skills, suggest drills, and create personalised training plans. What would you like to work on today?',
      id: 'welcome-message',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1 }}
        contentContainerStyle={chatStyles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Weekly report card */}
        <Pressable
          style={chatStyles.reportCard}
          onPress={() => { setShowReport(true); if (!weeklyReport && !reportLoading) handleGenerateReport(); }}
        >
          <View style={chatStyles.reportCardIcon}>
            <MaterialIcons name="auto-awesome" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={chatStyles.reportCardTitle}>Generate My Weekly AI Report</Text>
            <Text style={chatStyles.reportCardSub}>Personalised analysis of your last 7 days training</Text>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={colors.primary} />
        </Pressable>

        {messages.map((message, index) => (
          <View key={message.id || index} style={chatStyles.messageWrapper}>
            <View style={[chatStyles.messageBubble, message.role === 'user' ? chatStyles.userMessage : chatStyles.assistantMessage]}>
              <Text style={[chatStyles.messageText, message.role === 'user' && chatStyles.userMessageText]}>
                {message.content}
              </Text>
            </View>
          </View>
        ))}

        {loading && (
          <View style={[chatStyles.messageBubble, chatStyles.assistantMessage]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={chatStyles.loadingText}>Thinking...</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Quick prompts */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={chatStyles.quickPromptsContainer}
        contentContainerStyle={chatStyles.quickPromptsContent}
      >
        {[
          'Improve my cover drive',
          'Fix my footwork',
          'Build a training plan',
          'How to face fast bowling',
          'Improve my pull shot',
          'Mental tips for batting',
        ].map((p) => (
          <Pressable key={p} style={chatStyles.quickChip} onPress={() => { setInput(p); }}>
            <Text style={chatStyles.quickChipText}>{p}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={[chatStyles.inputContainer, { paddingBottom: insets.bottom > 0 ? insets.bottom : spacing.md }]}>
        <TextInput
          style={chatStyles.input}
          placeholder="Ask about drills, technique, training plans..."
          placeholderTextColor={colors.textSecondary}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={500}
          editable={!loading}
        />
        <Pressable
          style={[chatStyles.sendButton, (!input.trim() || loading) && chatStyles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || loading}
        >
          <MaterialIcons name="send" size={22} color={!input.trim() || loading ? colors.disabled : colors.textLight} />
        </Pressable>
      </View>

      <WeeklyReportModal
        visible={showReport}
        onClose={() => setShowReport(false)}
        report={weeklyReport}
        stats={weeklyStats}
        loading={reportLoading}
        onGenerate={handleGenerateReport}
      />
    </KeyboardAvoidingView>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function AICoachScreen() {
  const [activeTab, setActiveTab] = useState<'chat' | 'analysis'>('chat');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <MaterialIcons name="psychology" size={24} color={colors.primary} />
        <Text style={styles.headerTitle}>AI Batting Coach</Text>
      </View>

      {/* Tab switcher */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tabBtn, activeTab === 'chat' && styles.tabBtnActive]}
          onPress={() => setActiveTab('chat')}
        >
          <MaterialIcons name="chat" size={17} color={activeTab === 'chat' ? colors.primary : colors.textSecondary} />
          <Text style={[styles.tabBtnText, activeTab === 'chat' && styles.tabBtnTextActive]}>AI Chat</Text>
        </Pressable>
        <Pressable
          style={[styles.tabBtn, activeTab === 'analysis' && styles.tabBtnActive]}
          onPress={() => setActiveTab('analysis')}
        >
          <MaterialIcons name="videocam" size={17} color={activeTab === 'analysis' ? colors.primary : colors.textSecondary} />
          <Text style={[styles.tabBtnText, activeTab === 'analysis' && styles.tabBtnTextActive]}>Shot Analyser</Text>
          <View style={styles.newBadge}><Text style={styles.newBadgeText}>NEW</Text></View>
        </Pressable>
      </View>

      {/* Tab content */}
      {activeTab === 'chat' ? <AIChatTab /> : <ShotAnalysisTab />}
    </SafeAreaView>
  );
}

// ─── Shot Analysis Styles ──────────────────────────────────────────────────────
const saStyles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: 40 },

  heroCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.primary + '10', borderRadius: borderRadius.lg,
    borderWidth: 1, borderColor: colors.primary + '25', padding: spacing.md,
  },
  heroIcon: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: colors.primary + '15', justifyContent: 'center', alignItems: 'center',
  },
  heroTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  heroSub: { fontSize: 12, color: colors.textSecondary, lineHeight: 17, marginTop: 2 },

  stepCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.md,
  },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepBadge: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  stepNum: { fontSize: 13, fontWeight: '900', color: colors.textLight },
  stepTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  optional: { fontSize: 12, fontWeight: '400', color: colors.textSecondary },

  uploadZone: {
    alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.xl, paddingHorizontal: spacing.md,
    backgroundColor: colors.background, borderRadius: borderRadius.md,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border,
  },
  uploadTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  uploadSub: { fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
  uploadBtns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, borderRadius: borderRadius.md,
    paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md + 4,
  },
  uploadBtnOutline: {
    backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.primary,
  },
  uploadBtnText: { fontSize: 14, fontWeight: '700', color: colors.textLight },

  imagePreview: { gap: spacing.sm },
  previewImg: { width: '100%', height: 220, borderRadius: borderRadius.md },
  changeImgBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'center',
  },
  changeImgText: { fontSize: 12, color: colors.textSecondary },

  contextInput: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: { fontSize: 11, color: colors.textSecondary, textAlign: 'right' },

  analyseBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.primary, borderRadius: borderRadius.lg,
    paddingVertical: spacing.md + 2,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
  },
  analyseBtnDisabled: { backgroundColor: colors.disabled, shadowOpacity: 0 },
  analyseBtnText: { fontSize: 16, fontWeight: '800', color: colors.textLight },

  resultsContainer: { gap: spacing.md },

  scoreCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  scoreCircle: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 3, justifyContent: 'center', alignItems: 'center',
    flexDirection: 'row', alignItems: 'baseline',
    backgroundColor: colors.background,
  },
  scoreNum: { fontSize: 24, fontWeight: '900' },
  scoreDenom: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginLeft: 1 },
  shotTypeLabel: { fontSize: 10, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  shotTypeName: { fontSize: 17, fontWeight: '800', color: colors.text, marginTop: 1 },
  encouragement: { fontSize: 12, color: colors.textSecondary, marginTop: 3, lineHeight: 17 },

  resultSection: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm,
  },
  resultSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  resultDot: { width: 10, height: 10, borderRadius: 5 },
  resultSectionTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  bulletRow: { flexDirection: 'row', gap: spacing.sm, paddingLeft: spacing.xs },
  bulletDot: { fontSize: 14, fontWeight: '700', width: 18 },
  bulletText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 20 },

  improvementCard: {
    backgroundColor: colors.background, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.warning + '40', overflow: 'hidden',
  },
  improvementHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.sm + 2, paddingHorizontal: spacing.md,
  },
  improvementIssue: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.text },
  improvementBody: { padding: spacing.md, paddingTop: 0, gap: spacing.sm },
  improvementDetail: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  fixBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: colors.primary + '10', borderRadius: borderRadius.sm,
    padding: spacing.sm, borderLeftWidth: 3, borderLeftColor: colors.primary,
  },
  fixText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 },

  keyFocusCard: {
    backgroundColor: colors.primary + '08', borderRadius: borderRadius.lg,
    borderWidth: 1.5, borderColor: colors.primary + '30', padding: spacing.md, gap: spacing.sm,
  },
  keyFocusHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  keyFocusTitle: { fontSize: 13, fontWeight: '800', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.4 },
  keyFocusText: { fontSize: 14, color: colors.text, lineHeight: 21, fontWeight: '600' },

  demoCard: {
    backgroundColor: '#F59E0B10', borderRadius: borderRadius.lg,
    borderWidth: 1, borderColor: '#F59E0B30', padding: spacing.md, gap: spacing.sm,
  },
  demoHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  demoTitle: { fontSize: 13, fontWeight: '800', color: '#F59E0B', textTransform: 'uppercase', letterSpacing: 0.4 },
  demoText: { fontSize: 14, color: colors.text, lineHeight: 21, fontStyle: 'italic' },

  resetBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    borderWidth: 1.5, borderColor: colors.primary, borderRadius: borderRadius.lg,
    paddingVertical: spacing.md, backgroundColor: 'transparent',
  },
  resetBtnText: { fontSize: 14, fontWeight: '700', color: colors.primary },
});

// ─── Chat Tab Styles ───────────────────────────────────────────────────────────
const chatStyles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md },
  reportCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    borderWidth: 1.5, borderColor: colors.primary + '40', padding: spacing.md,
  },
  reportCardIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primary + '15', justifyContent: 'center', alignItems: 'center',
  },
  reportCardTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  reportCardSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  messageWrapper: { flexDirection: 'row', alignItems: 'flex-start' },
  messageBubble: { maxWidth: '80%', padding: spacing.md, borderRadius: borderRadius.lg },
  userMessage: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  assistantMessage: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  messageText: { ...typography.body, color: colors.text, lineHeight: 22 },
  userMessageText: { color: colors.textLight },
  loadingText: { ...typography.body, color: colors.textSecondary, fontStyle: 'italic' },
  quickPromptsContainer: { maxHeight: 46, borderTopWidth: 1, borderTopColor: colors.border },
  quickPromptsContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm, flexDirection: 'row', alignItems: 'center' },
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
    padding: spacing.md, maxHeight: 100, borderWidth: 1, borderColor: colors.border,
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
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%', flex: 1 },
  handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  headerSub: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  closeBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  content: { padding: spacing.md, paddingBottom: 48, gap: spacing.md },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statChip: {
    flex: 1, backgroundColor: colors.primary + '10', borderRadius: borderRadius.md,
    padding: spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: colors.primary + '25',
  },
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
    paddingVertical: spacing.md, paddingHorizontal: spacing.xl, alignSelf: 'center',
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

// ─── Main Styles ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.md, backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { ...typography.h3, color: colors.text, flex: 1 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    paddingHorizontal: spacing.md, gap: spacing.sm,
  },
  tabBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: spacing.md - 2, paddingHorizontal: spacing.sm,
    borderBottomWidth: 2.5, borderBottomColor: 'transparent', marginBottom: -1,
  },
  tabBtnActive: { borderBottomColor: colors.primary },
  tabBtnText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  tabBtnTextActive: { color: colors.primary, fontWeight: '800' },
  newBadge: {
    backgroundColor: colors.success, borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  newBadgeText: { fontSize: 9, fontWeight: '900', color: colors.textLight, letterSpacing: 0.3 },
});
