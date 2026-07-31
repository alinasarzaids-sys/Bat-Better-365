import React, { useState, useRef, useCallback, useEffect } from 'react';
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
  Animated,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeIcon as MaterialIcons } from '@/components/ui/SafeIcon';
import * as ImagePicker from 'expo-image-picker';
import { aiCoachService } from '@/services/aiCoachService';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { useAlert, useAuth, getSupabaseClient } from '@/template';
import { FunctionsHttpError } from '@supabase/supabase-js';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

type MediaMode = 'image' | 'video';

interface PickedMedia {
  uri: string;
  base64: string;
  mimeType: string;
  isVideo: boolean;
  fileName?: string;
  duration?: number;
  fileSize?: number;
}

interface DrillRecommendation {
  name: string;
  description: string;
}

interface ShotAnalysis {
  shotType: string;
  overallScore: number;
  wentWell: string[];
  improvements: ShotImprovement[];
  keyFocus: string;
  drillRecommendation?: DrillRecommendation;
  demoTip: string;
  encouragement: string;
}

interface FollowUpMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function scoreColor(score: number) {
  if (score >= 8) return '#10B981';
  if (score >= 6) return '#F59E0B';
  return '#EF4444';
}

function scoreLabel(score: number) {
  if (score >= 9) return 'Elite';
  if (score >= 8) return 'Excellent';
  if (score >= 7) return 'Solid';
  if (score >= 6) return 'Decent';
  if (score >= 4) return 'Needs Work';
  return 'Major Issues';
}

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

// ─── Animated Score Circle ─────────────────────────────────────────────────────
function AnimatedScoreCircle({ score }: { score: number }) {
  const animVal = useRef(new Animated.Value(0)).current;
  const scaleVal = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(animVal, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(scaleVal, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  const color = scoreColor(score);
  const label = scoreLabel(score);

  return (
    <Animated.View style={[saStyles.scoreCircleWrap, { transform: [{ scale: scaleVal }], opacity: animVal }]}>
      <View style={[saStyles.scoreCircle, { borderColor: color }]}>
        <Text style={[saStyles.scoreNum, { color }]}>{score}</Text>
        <Text style={saStyles.scoreDenom}>/10</Text>
      </View>
      <View style={[saStyles.scoreLabelBadge, { backgroundColor: color + '20', borderColor: color + '40' }]}>
        <Text style={[saStyles.scoreLabelText, { color }]}>{label}</Text>
      </View>
    </Animated.View>
  );
}

// ─── Upload Zone ───────────────────────────────────────────────────────────────
function UploadZone({ mediaMode, onPick }: { mediaMode: MediaMode; onPick: () => void }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Pressable onPress={onPick}>
      {({ pressed }) => (
        <Animated.View style={[
          saStyles.uploadZone,
          pressed && { opacity: 0.85 },
          { transform: [{ scale: pressed ? 0.98 : pulseAnim }] },
        ]}>
          <View style={saStyles.uploadIconRing}>
            <MaterialIcons
              name={mediaMode === 'video' ? 'video-library' : 'add-photo-alternate'}
              size={36}
              color={colors.primary}
            />
          </View>
          <Text style={saStyles.uploadTitle}>
            {mediaMode === 'video' ? 'Tap to add a batting clip' : 'Tap to add a batting photo'}
          </Text>
          <Text style={saStyles.uploadSub}>
            {mediaMode === 'video'
              ? 'Short clips ≤10 sec work best · side-on or front-on'
              : 'Clear side-on or front-on photo · any stance'}
          </Text>
          <View style={saStyles.uploadPill}>
            <MaterialIcons name={mediaMode === 'video' ? 'video-library' : 'photo-library'} size={15} color={colors.textLight} />
            <Text style={saStyles.uploadPillText}>Choose from Gallery</Text>
          </View>
        </Animated.View>
      )}
    </Pressable>
  );
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

// ─── Analysing Overlay ─────────────────────────────────────────────────────────
function AnalysingOverlay({ isVideo }: { isVideo: boolean }) {
  const spinAnim = useRef(new Animated.Value(0)).current;
  const [dotCount, setDotCount] = useState(1);

  useEffect(() => {
    const spin = Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 2000, useNativeDriver: true })
    );
    spin.start();
    const interval = setInterval(() => setDotCount(d => d === 3 ? 1 : d + 1), 500);
    return () => { spin.stop(); clearInterval(interval); };
  }, []);

  const rotate = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const steps = isVideo
    ? ['Uploading video to server', 'Extracting key frames', 'Analysing technique', 'Generating feedback']
    : ['Processing your image', 'Identifying shot type', 'Analysing biomechanics', 'Generating feedback'];

  return (
    <View style={saStyles.analysingOverlay}>
      <Animated.View style={{ transform: [{ rotate }] }}>
        <MaterialIcons name="auto-awesome" size={48} color={colors.primary} />
      </Animated.View>
      <Text style={saStyles.analysingTitle}>
        Analysing{'.'.repeat(dotCount)}
      </Text>
      <View style={saStyles.stepsContainer}>
        {steps.map((step, i) => (
          <View key={i} style={saStyles.stepRow}>
            <MaterialIcons name="check-circle" size={16} color={colors.primary + '60'} />
            <Text style={saStyles.stepRowText}>{step}</Text>
          </View>
        ))}
      </View>
      <Text style={saStyles.analysingSubText}>
        {isVideo ? 'This may take 20–40 seconds' : 'Usually takes 5–10 seconds'}
      </Text>
    </View>
  );
}

// ─── Shot Analysis Tab ─────────────────────────────────────────────────────────
function ShotAnalysisTab() {
  const { showAlert } = useAlert();
  const [mediaMode, setMediaMode] = useState<MediaMode>('image');
  const [pickedMedia, setPickedMedia] = useState<PickedMedia | null>(null);
  const [context, setContext] = useState('');
  const [analysing, setAnalysing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analysis, setAnalysis] = useState<ShotAnalysis | null>(null);
  const [expandedImprovement, setExpandedImprovement] = useState<number | null>(null);
  const [followUpMessages, setFollowUpMessages] = useState<FollowUpMessage[]>([]);
  const [followUpInput, setFollowUpInput] = useState('');
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const resultFadeAnim = useRef(new Animated.Value(0)).current;

  const MAX_VIDEO_BYTES = 9.5 * 1024 * 1024;

  const pickMedia = useCallback(async (mode: MediaMode) => {
    try {
      const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permResult.granted) {
        showAlert(
          'Permission Required',
          permResult.canAskAgain
            ? 'Photo library access is needed to pick a file.'
            : 'Photo/media access was denied. Please enable it in Settings > Apps > Bat Better 365 > Permissions.',
          permResult.canAskAgain
            ? [{ text: 'OK', style: 'cancel' }]
            : [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open Settings', onPress: () => Linking.openSettings() },
              ]
        );
        return;
      }

      const isVideo = mode === 'video';

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: isVideo ? 'videos' : 'images',
        quality: isVideo ? 0.5 : 0.8,
        base64: !isVideo,
        videoMaxDuration: 10,
      });

      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];

      if (isVideo) {
        const fileSizeBytes = asset.fileSize || 0;

        if (fileSizeBytes > MAX_VIDEO_BYTES) {
          showAlert(
            'Video Too Large',
            `The video is ${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB. Please use a clip under 10 seconds (max ~10 MB).`,
          );
          return;
        }

        setPickedMedia({
          uri: asset.uri,
          base64: '',
          mimeType: asset.mimeType || 'video/mp4',
          isVideo: true,
          fileName: asset.uri.split('/').pop() || 'video',
          duration: asset.duration ? Math.round(asset.duration / 1000) : undefined,
          fileSize: fileSizeBytes,
        });
      } else {
        let base64Data = asset.base64 || '';
        if (!base64Data && asset.uri) {
          try {
            const imgRes = await fetch(asset.uri);
            const imgBuf = await imgRes.arrayBuffer();
            const imgBytes = new Uint8Array(imgBuf);
            let imgBinary = '';
            for (let i = 0; i < imgBytes.byteLength; i++) {
              imgBinary += String.fromCharCode(imgBytes[i]);
            }
            base64Data = btoa(imgBinary);
          } catch {
            showAlert('Error', 'Could not read image data. Please try again.');
            return;
          }
        }
        setPickedMedia({
          uri: asset.uri,
          base64: base64Data,
          mimeType: asset.mimeType || 'image/jpeg',
          isVideo: false,
          fileSize: (asset as any).fileSize,
        });
      }

      setAnalysis(null);
      setFollowUpMessages([]);
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to pick media');
    }
  }, [showAlert]);

  const handleAnalyse = async () => {
    if (!pickedMedia) return;
    setAnalysing(true);
    setAnalysis(null);
    setExpandedImprovement(null);
    setFollowUpMessages([]);
    setUploadProgress(0);
    resultFadeAnim.setValue(0);

    try {
      const supabase = getSupabaseClient();
      let requestBody: Record<string, any> = {
        mimeType: pickedMedia.mimeType,
        isVideo: pickedMedia.isVideo,
        shotContext: context.trim() || undefined,
      };

      if (pickedMedia.isVideo) {
        setUploadProgress(20);
        const ext = pickedMedia.mimeType?.includes('mp4') ? 'mp4' : 'mov';
        const filePath = `temp/shot_${Date.now()}.${ext}`;

        const videoResponse = await fetch(pickedMedia.uri);
        const videoBlob = await videoResponse.blob();

        setUploadProgress(40);
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('shot-uploads')
          .upload(filePath, videoBlob, {
            contentType: pickedMedia.mimeType || 'video/mp4',
            upsert: true,
          });

        if (uploadError) {
          showAlert('Upload Failed', uploadError.message);
          return;
        }
        setUploadProgress(60);

        const { data: urlData } = supabase.storage.from('shot-uploads').getPublicUrl(filePath);
        requestBody.mediaUrl = urlData.publicUrl;
        setUploadProgress(80);
      } else {
        requestBody.imageBase64 = pickedMedia.base64;
        setUploadProgress(50);
      }

      const { data, error } = await supabase.functions.invoke('shot-analysis', { body: requestBody });
      setUploadProgress(100);

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
        Animated.timing(resultFadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 400);
      } else if (data?.raw) {
        showAlert('Analysis Result', data.raw);
      } else {
        showAlert('Error', 'Unexpected response from AI');
      }
    } catch (e: any) {
      showAlert('Error', e.message || 'Analysis failed');
    } finally {
      setAnalysing(false);
      setUploadProgress(0);
    }
  };

  const resetAnalysis = () => {
    setPickedMedia(null);
    setAnalysis(null);
    setContext('');
    setExpandedImprovement(null);
    setFollowUpMessages([]);
    setFollowUpInput('');
    resultFadeAnim.setValue(0);
  };

  const handleFollowUp = async () => {
    if (!followUpInput.trim() || followUpLoading || !analysis) return;
    const question = followUpInput.trim();
    const newMessages: FollowUpMessage[] = [...followUpMessages, { role: 'user', content: question }];
    setFollowUpMessages(newMessages);
    setFollowUpInput('');
    setFollowUpLoading(true);
    try {
      const supabase = getSupabaseClient();
      const drillInfo = analysis.drillRecommendation
        ? ` Recommended drill: "${analysis.drillRecommendation.name}" — ${analysis.drillRecommendation.description}`
        : '';
      const improvementDetails = analysis.improvements.map(i => `${i.issue}: ${i.detail} Fix: ${i.fix}`).join('; ');
      const systemContext = `You are an elite cricket batting coach. The player just had their shot analysed. Shot: ${analysis.shotType}, Score: ${analysis.overallScore}/10. What went well: ${analysis.wentWell.join('; ')}. Areas to improve: ${improvementDetails}. Key focus: ${analysis.keyFocus}.${drillInfo} Answer follow-up questions about this analysis. Be specific, practical and encouraging.`;

      const { data, error } = await supabase.functions.invoke('ai-coach-chat', {
        body: { messages: [{ role: 'system', content: systemContext }, ...newMessages.map(m => ({ role: m.role, content: m.content }))] },
      });
      if (error) { showAlert('Error', error.message || 'Failed to get response'); return; }
      const reply = data?.response || data?.message || data?.content || 'Sorry, I could not answer that.';
      setFollowUpMessages([...newMessages, { role: 'assistant', content: reply }]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to get response');
    } finally {
      setFollowUpLoading(false);
    }
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1 }}
      contentContainerStyle={saStyles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Hero */}
      <View style={saStyles.heroCard}>
        <View style={saStyles.heroIconWrap}>
          <MaterialIcons name="videocam" size={26} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={saStyles.heroTitle}>AI Shot Analyser</Text>
          <Text style={saStyles.heroSub}>Upload a photo or clip of your batting shot for instant AI coaching feedback on your technique</Text>
        </View>
      </View>

      {/* Mode toggle */}
      {!pickedMedia && !analysing && (
        <View style={saStyles.modeRow}>
          {(['image', 'video'] as MediaMode[]).map(mode => (
            <Pressable
              key={mode}
              style={[saStyles.modeChip, mediaMode === mode && saStyles.modeChipActive]}
              onPress={() => { setMediaMode(mode); }}
            >
              <MaterialIcons
                name={mode === 'video' ? 'videocam' : 'photo-camera'}
                size={16}
                color={mediaMode === mode ? colors.primary : colors.textSecondary}
              />
              <Text style={[saStyles.modeChipText, mediaMode === mode && saStyles.modeChipTextActive]}>
                {mode === 'video' ? 'Video Clip' : 'Photo'}
              </Text>
              {mode === 'video' && (
                <View style={saStyles.newPill}><Text style={saStyles.newPillText}>NEW</Text></View>
              )}
            </Pressable>
          ))}
        </View>
      )}

      {/* Upload or preview */}
      {!pickedMedia && !analysing && (
        <>
          {mediaMode === 'video' && (
            <View style={saStyles.tipsRow}>
              <MaterialIcons name="info" size={14} color={colors.primary} />
              <Text style={saStyles.tipsText}>Keep clip under 10 sec · Side-on or front-on angle · Max ~10 MB</Text>
            </View>
          )}
          <UploadZone mediaMode={mediaMode} onPick={() => pickMedia(mediaMode)} />
        </>
      )}

      {/* Analysing state */}
      {analysing && <AnalysingOverlay isVideo={pickedMedia?.isVideo || false} />}

      {/* Media preview (after pick, before analyse) */}
      {pickedMedia && !analysis && !analysing && (
        <>
          <View style={saStyles.previewCard}>
            <View style={saStyles.previewCardHeader}>
              <MaterialIcons
                name={pickedMedia.isVideo ? 'videocam' : 'photo'}
                size={16}
                color={colors.primary}
              />
              <Text style={saStyles.previewCardTitle}>
                {pickedMedia.isVideo ? 'Video Ready' : 'Photo Ready'}
              </Text>
              <View style={[saStyles.readyBadge]}>
                <Text style={saStyles.readyBadgeText}>✓ Ready</Text>
              </View>
            </View>

            {pickedMedia.isVideo ? (
              <View style={saStyles.videoPreviewBox}>
                <View style={saStyles.videoPlayBtn}>
                  <MaterialIcons name="play-arrow" size={32} color={colors.textLight} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={saStyles.videoName} numberOfLines={1}>{pickedMedia.fileName || 'video clip'}</Text>
                  <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: 4 }}>
                    {pickedMedia.duration !== undefined && (
                      <View style={saStyles.metaChip}>
                        <MaterialIcons name="timer" size={11} color={colors.textSecondary} />
                        <Text style={saStyles.metaText}>{pickedMedia.duration}s</Text>
                      </View>
                    )}
                    {pickedMedia.fileSize !== undefined && (
                      <View style={saStyles.metaChip}>
                        <MaterialIcons name="storage" size={11} color={colors.textSecondary} />
                        <Text style={saStyles.metaText}>{(pickedMedia.fileSize / (1024 * 1024)).toFixed(1)} MB</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            ) : (
              <Image
                source={{ uri: pickedMedia.uri }}
                style={saStyles.previewImg}
                contentFit="cover"
                transition={200}
              />
            )}

            <Pressable style={saStyles.changeBtn} onPress={resetAnalysis}>
              <MaterialIcons name="swap-horiz" size={14} color={colors.textSecondary} />
              <Text style={saStyles.changeBtnText}>Change {pickedMedia.isVideo ? 'video' : 'photo'}</Text>
            </Pressable>
          </View>

          {/* Context input */}
          <View style={saStyles.contextCard}>
            <Text style={saStyles.contextLabel}>Add context <Text style={saStyles.optional}>(optional)</Text></Text>
            <TextInput
              style={saStyles.contextInput}
              placeholder={`e.g. "Cover drive — I feel I'm falling over at contact"`}
              placeholderTextColor={colors.textSecondary}
              value={context}
              onChangeText={setContext}
              multiline
              maxLength={200}
            />
            <Text style={saStyles.charCount}>{context.length}/200</Text>
          </View>

          {/* Analyse button */}
          <Pressable style={saStyles.analyseBtn} onPress={handleAnalyse}>
            {({ pressed }) => (
              <View style={[saStyles.analyseBtnInner, pressed && { opacity: 0.88 }]}>
                <MaterialIcons name="auto-awesome" size={20} color="#fff" />
                <Text style={saStyles.analyseBtnText}>
                  {pickedMedia.isVideo ? 'Analyse My Video' : 'Analyse My Shot'}
                </Text>
              </View>
            )}
          </Pressable>
        </>
      )}

      {/* ── RESULTS ── */}
      {analysis && (
        <Animated.View style={[saStyles.results, { opacity: resultFadeAnim }]}>

          {/* Score header */}
          <View style={saStyles.scoreHeader}>
            <AnimatedScoreCircle score={analysis.overallScore} />
            <View style={{ flex: 1 }}>
              <Text style={saStyles.shotTypeTag}>Shot Identified</Text>
              <Text style={saStyles.shotTypeName}>{analysis.shotType}</Text>
              <Text style={saStyles.encouragementText}>{analysis.encouragement}</Text>
            </View>
          </View>

          {/* Thumbnail */}
          {pickedMedia && !pickedMedia.isVideo && (
            <Image
              source={{ uri: pickedMedia.uri }}
              style={saStyles.resultThumb}
              contentFit="cover"
              transition={200}
            />
          )}

          {/* What went well */}
          <View style={saStyles.sectionCard}>
            <View style={saStyles.sectionCardHeader}>
              <View style={[saStyles.sectionDot, { backgroundColor: '#10B981' }]} />
              <Text style={saStyles.sectionCardTitle}>What You Did Well</Text>
            </View>
            {analysis.wentWell.map((point, i) => (
              <View key={i} style={saStyles.bulletRow}>
                <Text style={[saStyles.bulletMark, { color: '#10B981' }]}>✓</Text>
                <Text style={saStyles.bulletText}>{point}</Text>
              </View>
            ))}
          </View>

          {/* Improvements — expandable */}
          <View style={saStyles.sectionCard}>
            <View style={saStyles.sectionCardHeader}>
              <View style={[saStyles.sectionDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={saStyles.sectionCardTitle}>Areas to Improve</Text>
            </View>
            {analysis.improvements.map((imp, i) => (
              <Pressable
                key={i}
                style={saStyles.improvCard}
                onPress={() => setExpandedImprovement(expandedImprovement === i ? null : i)}
              >
                <View style={saStyles.improvHeader}>
                  <View style={saStyles.improvNumBadge}>
                    <Text style={saStyles.improvNum}>{i + 1}</Text>
                  </View>
                  <Text style={saStyles.improvIssue}>{imp.issue}</Text>
                  <MaterialIcons
                    name={expandedImprovement === i ? 'expand-less' : 'expand-more'}
                    size={20}
                    color={colors.textSecondary}
                  />
                </View>
                {expandedImprovement === i && (
                  <View style={saStyles.improvBody}>
                    <Text style={saStyles.improvDetail}>{imp.detail}</Text>
                    <View style={saStyles.fixBox}>
                      <MaterialIcons name="fitness-center" size={13} color={colors.primary} />
                      <Text style={saStyles.fixText}><Text style={{ fontWeight: '700' }}>Fix: </Text>{imp.fix}</Text>
                    </View>
                  </View>
                )}
              </Pressable>
            ))}
          </View>

          {/* Key focus */}
          <View style={saStyles.focusCard}>
            <View style={saStyles.focusHeader}>
              <MaterialIcons name="flag" size={17} color={colors.primary} />
              <Text style={saStyles.focusTitle}>Your #1 Focus Right Now</Text>
            </View>
            <Text style={saStyles.focusText}>{analysis.keyFocus}</Text>
          </View>

          {/* Drill recommendation */}
          {analysis.drillRecommendation && (
            <View style={saStyles.drillCard}>
              <View style={saStyles.drillHeader}>
                <View style={saStyles.drillIconWrap}>
                  <MaterialIcons name="fitness-center" size={16} color={colors.textLight} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={saStyles.drillLabel}>Recommended Drill</Text>
                  <Text style={saStyles.drillName}>{analysis.drillRecommendation.name}</Text>
                </View>
              </View>
              <Text style={saStyles.drillDesc}>{analysis.drillRecommendation.description}</Text>
            </View>
          )}

          {/* Demo tip */}
          <View style={saStyles.demoCard}>
            <View style={saStyles.demoHeader}>
              <MaterialIcons name="lightbulb" size={16} color="#F59E0B" />
              <Text style={saStyles.demoTitle}>Technique Visualisation</Text>
            </View>
            <Text style={saStyles.demoText}>"{analysis.demoTip}"</Text>
          </View>

          {/* Follow-up Q&A */}
          <View style={saStyles.qaCard}>
            <View style={saStyles.qaHeader}>
              <MaterialIcons name="chat" size={16} color={colors.primary} />
              <Text style={saStyles.qaTitle}>Ask a Follow-up Question</Text>
            </View>
            {followUpMessages.length > 0 && (
              <View style={saStyles.qaMessages}>
                {followUpMessages.map((msg, i) => (
                  <View key={i} style={[saStyles.qaBubble, msg.role === 'user' ? saStyles.qaUserBubble : saStyles.qaAiBubble]}>
                    <Text style={[saStyles.qaBubbleText, msg.role === 'user' && saStyles.qaUserText]}>
                      {msg.content}
                    </Text>
                  </View>
                ))}
                {followUpLoading && (
                  <View style={saStyles.qaAiBubble}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={{ fontSize: 12, color: colors.textSecondary }}>Thinking...</Text>
                    </View>
                  </View>
                )}
              </View>
            )}
            <View style={saStyles.qaInputRow}>
              <TextInput
                style={saStyles.qaInput}
                placeholder='e.g. "How do I fix my head position?"'
                placeholderTextColor={colors.textSecondary}
                value={followUpInput}
                onChangeText={setFollowUpInput}
                multiline
                maxLength={300}
                editable={!followUpLoading}
              />
              <Pressable
                style={[saStyles.qaSendBtn, (!followUpInput.trim() || followUpLoading) && saStyles.qaSendBtnDisabled]}
                onPress={handleFollowUp}
                disabled={!followUpInput.trim() || followUpLoading}
              >
                <MaterialIcons name="send" size={17} color="#fff" />
              </Pressable>
            </View>
          </View>

          {/* Analyse again */}
          <Pressable style={saStyles.resetBtn} onPress={resetAnalysis}>
            <MaterialIcons name="refresh" size={18} color={colors.primary} />
            <Text style={saStyles.resetBtnText}>Analyse Another Shot</Text>
          </Pressable>
        </Animated.View>
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
          <Pressable key={p} style={chatStyles.quickChip} onPress={() => setInput(p)}>
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
          <MaterialIcons name="send" size={22} color="#fff" />
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
  const [activeTab, setActiveTab] = useState<'chat' | 'analysis'>('analysis');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <MaterialIcons name="psychology" size={24} color={colors.primary} />
        <Text style={styles.headerTitle}>AI Batting Coach</Text>
      </View>

      <View style={styles.tabBar}>
        {[
          { key: 'chat', label: 'AI Chat', icon: 'chat' },
          { key: 'analysis', label: 'Shot Analyser', icon: 'videocam' },
        ].map(tab => (
          <Pressable
            key={tab.key}
            style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab.key as any)}
          >
            <MaterialIcons
              name={tab.icon as any}
              size={17}
              color={activeTab === tab.key ? colors.primary : colors.textSecondary}
            />
            <Text style={[styles.tabBtnText, activeTab === tab.key && styles.tabBtnTextActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {activeTab === 'chat' ? <AIChatTab /> : <ShotAnalysisTab />}
    </SafeAreaView>
  );
}

// ─── Shot Analysis Styles ──────────────────────────────────────────────────────
const saStyles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: 48 },

  heroCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.primary + '10', borderRadius: borderRadius.xl,
    borderWidth: 1, borderColor: colors.primary + '25', padding: spacing.md,
  },
  heroIconWrap: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: colors.primary + '18', justifyContent: 'center', alignItems: 'center',
  },
  heroTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  heroSub: { fontSize: 12, color: colors.textSecondary, lineHeight: 17, marginTop: 2 },

  modeRow: {
    flexDirection: 'row', gap: spacing.sm,
  },
  modeChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    borderWidth: 1.5, borderColor: colors.border,
  },
  modeChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  modeChipText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  modeChipTextActive: { color: colors.primary },
  newPill: {
    backgroundColor: '#10B981', borderRadius: 3,
    paddingHorizontal: 4, paddingVertical: 1,
  },
  newPillText: { fontSize: 8, fontWeight: '900', color: '#fff' },

  tipsRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.primary + '08', borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.primary + '20',
    padding: spacing.sm + 2, paddingHorizontal: spacing.md,
  },
  tipsText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 17 },

  // Upload zone
  uploadZone: {
    alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.xl + 8,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 2, borderStyle: 'dashed', borderColor: colors.primary + '40',
  },
  uploadIconRing: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.primary + '12',
    borderWidth: 2, borderColor: colors.primary + '25',
    justifyContent: 'center', alignItems: 'center',
  },
  uploadTitle: { fontSize: 16, fontWeight: '800', color: colors.text, textAlign: 'center' },
  uploadSub: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 19 },
  uploadPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: borderRadius.full,
    paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.lg,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  uploadPillText: { fontSize: 14, fontWeight: '800', color: '#fff' },

  // Analysing overlay
  analysingOverlay: {
    alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.xl + 8,
    backgroundColor: colors.surface, borderRadius: borderRadius.xl,
    borderWidth: 1, borderColor: colors.primary + '25',
    padding: spacing.xl,
  },
  analysingTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  analysingSubText: { fontSize: 12, color: colors.textSecondary },
  stepsContainer: { gap: spacing.xs, alignSelf: 'stretch', paddingHorizontal: spacing.md },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepRowText: { fontSize: 13, color: colors.textSecondary },

  // Preview card
  previewCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.xl,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  previewCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  previewCardTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text },
  readyBadge: {
    backgroundColor: '#10B981' + '20', borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm, paddingVertical: 2,
    borderWidth: 1, borderColor: '#10B981' + '40',
  },
  readyBadgeText: { fontSize: 11, fontWeight: '700', color: '#10B981' },
  videoPreviewBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md, backgroundColor: '#0A0A0A', minHeight: 80,
  },
  videoPlayBtn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  videoName: { fontSize: 13, fontWeight: '700', color: '#fff' },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 11, color: colors.textSecondary },
  previewImg: { width: '100%', height: 220 },
  changeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    padding: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border,
  },
  changeBtnText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },

  // Context
  contextCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.xs,
  },
  contextLabel: { fontSize: 13, fontWeight: '700', color: colors.text },
  optional: { fontSize: 12, fontWeight: '400', color: colors.textSecondary },
  contextInput: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
    minHeight: 70,
    textAlignVertical: 'top',
    fontSize: 14,
  },
  charCount: { fontSize: 11, color: colors.textSecondary, textAlign: 'right' },

  // Analyse button
  analyseBtn: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  analyseBtnInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md + 4,
  },
  analyseBtnText: { fontSize: 17, fontWeight: '900', color: '#fff', letterSpacing: 0.2 },

  // Results
  results: { gap: spacing.md },

  scoreHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: borderRadius.xl,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  scoreCircleWrap: { alignItems: 'center', gap: 6 },
  scoreCircle: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 3.5, justifyContent: 'center', alignItems: 'center',
    flexDirection: 'row',
    backgroundColor: colors.background,
  },
  scoreNum: { fontSize: 28, fontWeight: '900', lineHeight: 32 },
  scoreDenom: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginTop: 8 },
  scoreLabelBadge: {
    borderRadius: borderRadius.full, borderWidth: 1,
    paddingHorizontal: spacing.sm, paddingVertical: 2,
  },
  scoreLabelText: { fontSize: 11, fontWeight: '800' },

  shotTypeTag: { fontSize: 10, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6 },
  shotTypeName: { fontSize: 18, fontWeight: '900', color: colors.text, marginTop: 2 },
  encouragementText: { fontSize: 12, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },

  resultThumb: {
    width: '100%', height: 180, borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },

  sectionCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.xl,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm,
  },
  sectionCardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 2 },
  sectionDot: { width: 10, height: 10, borderRadius: 5 },
  sectionCardTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  bulletRow: { flexDirection: 'row', gap: spacing.sm, paddingLeft: 2 },
  bulletMark: { fontSize: 15, fontWeight: '700', width: 20, lineHeight: 22 },
  bulletText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 21 },

  improvCard: {
    backgroundColor: colors.background, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: '#F59E0B' + '35',
    overflow: 'hidden',
  },
  improvHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.sm + 4, paddingHorizontal: spacing.md,
  },
  improvNumBadge: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#F59E0B', justifyContent: 'center', alignItems: 'center',
  },
  improvNum: { fontSize: 11, fontWeight: '900', color: '#fff' },
  improvIssue: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.text },
  improvBody: { padding: spacing.md, paddingTop: 4, gap: spacing.sm },
  improvDetail: { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
  fixBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: colors.primary + '10', borderRadius: borderRadius.sm,
    padding: spacing.sm + 2, borderLeftWidth: 3, borderLeftColor: colors.primary,
  },
  fixText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 19 },

  focusCard: {
    backgroundColor: colors.primary + '08', borderRadius: borderRadius.xl,
    borderWidth: 1.5, borderColor: colors.primary + '30', padding: spacing.md, gap: spacing.sm,
  },
  focusHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  focusTitle: { fontSize: 13, fontWeight: '800', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.4 },
  focusText: { fontSize: 14, color: colors.text, lineHeight: 22, fontWeight: '600' },

  drillCard: {
    backgroundColor: '#10B981' + '08', borderRadius: borderRadius.xl,
    borderWidth: 1, borderColor: '#10B981' + '30', padding: spacing.md, gap: spacing.sm,
  },
  drillHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  drillIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center',
  },
  drillLabel: { fontSize: 10, fontWeight: '700', color: '#10B981', textTransform: 'uppercase', letterSpacing: 0.5 },
  drillName: { fontSize: 15, fontWeight: '800', color: colors.text },
  drillDesc: { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },

  demoCard: {
    backgroundColor: '#F59E0B' + '08', borderRadius: borderRadius.xl,
    borderWidth: 1, borderColor: '#F59E0B' + '30', padding: spacing.md, gap: spacing.sm,
  },
  demoHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  demoTitle: { fontSize: 13, fontWeight: '800', color: '#F59E0B', textTransform: 'uppercase', letterSpacing: 0.4 },
  demoText: { fontSize: 14, color: colors.text, lineHeight: 22, fontStyle: 'italic' },

  qaCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.xl,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm,
  },
  qaHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  qaTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  qaMessages: { gap: spacing.sm },
  qaBubble: {
    maxWidth: '88%', padding: spacing.sm + 2, paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
  },
  qaUserBubble: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  qaAiBubble: {
    alignSelf: 'flex-start', backgroundColor: colors.background,
    borderWidth: 1, borderColor: colors.border,
    minWidth: 48, minHeight: 36, justifyContent: 'center',
  },
  qaBubbleText: { fontSize: 13, color: colors.text, lineHeight: 19 },
  qaUserText: { color: '#fff' },
  qaInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: spacing.xs },
  qaInput: {
    flex: 1, ...typography.body, color: colors.text,
    backgroundColor: colors.background, borderRadius: borderRadius.md,
    padding: spacing.sm + 2, borderWidth: 1, borderColor: colors.border,
    maxHeight: 80, fontSize: 13,
  },
  qaSendBtn: {
    backgroundColor: colors.primary, width: 42, height: 42,
    borderRadius: 21, justifyContent: 'center', alignItems: 'center',
  },
  qaSendBtnDisabled: { backgroundColor: colors.disabled },

  resetBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    borderWidth: 1.5, borderColor: colors.primary, borderRadius: borderRadius.xl,
    paddingVertical: spacing.md, backgroundColor: 'transparent',
    marginBottom: spacing.md,
  },
  resetBtnText: { fontSize: 14, fontWeight: '700', color: colors.primary },
});

// ─── Chat Styles ───────────────────────────────────────────────────────────────
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
  userMessageText: { color: '#fff' },
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
  generateBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
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
});
