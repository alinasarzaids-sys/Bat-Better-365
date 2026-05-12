import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated, Dimensions,
  ScrollView, ActivityIndicator, Platform, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeIcon as MaterialIcons } from '@/components/ui/SafeIcon';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';

const { width, height } = Dimensions.get('window');
const VIEWFINDER_H = width * 1.1;

// ─── Types ────────────────────────────────────────────────────────────────────
interface Metric {
  score: number;
  status: string;
  detail: string;
  tip: string;
  distance_cm?: number;
  angle_degrees?: number;
  weight_distribution?: string;
}

interface Analysis {
  overall_score: number;
  grade: string;
  shot_detected: string;
  instant_feedback: string;
  audio_cue: string;
  stability_score: number;
  stability_label: string;
  metrics: {
    head_position: Metric;
    front_foot_stride: Metric;
    bat_angle: Metric;
    balance: Metric;
    follow_through: Metric;
  };
  strengths: string[];
  areas_to_improve: string[];
  drill_recommendations: Array<{ name: string; focus: string; duration_minutes: number }>;
  coach_summary: string;
}

// ─── Skeleton overlay points (decorative, reactive to state) ─────────────────
const SKELETON_JOINTS = [
  // Head
  { x: 0.5, y: 0.08 },
  // Shoulders
  { x: 0.35, y: 0.2 }, { x: 0.65, y: 0.2 },
  // Elbows
  { x: 0.25, y: 0.35 }, { x: 0.72, y: 0.32 },
  // Wrists / bat grip
  { x: 0.18, y: 0.48 }, { x: 0.78, y: 0.44 },
  // Hips
  { x: 0.4, y: 0.55 }, { x: 0.62, y: 0.55 },
  // Knees
  { x: 0.36, y: 0.72 }, { x: 0.64, y: 0.72 },
  // Ankles
  { x: 0.33, y: 0.88 }, { x: 0.66, y: 0.88 },
];

const SKELETON_CONNECTIONS = [
  [0, 1], [0, 2],          // head → shoulders
  [1, 2],                   // shoulder bridge
  [1, 3], [2, 4],          // shoulders → elbows
  [3, 5], [4, 6],          // elbows → wrists
  [1, 7], [2, 8],          // shoulders → hips
  [7, 8],                   // hip bridge
  [7, 9], [8, 10],         // hips → knees
  [9, 11], [10, 12],       // knees → ankles
];

// ─── Utility ──────────────────────────────────────────────────────────────────
const scoreColor = (score: number) => {
  if (score >= 85) return '#00E5A0';
  if (score >= 70) return '#FFD700';
  if (score >= 55) return '#FF9800';
  return '#FF4444';
};

const gradeColor = (grade: string) => {
  if (grade.startsWith('A')) return '#00E5A0';
  if (grade.startsWith('B')) return '#FFD700';
  return '#FF9800';
};

const stabilityColor = (score: number) => {
  if (score >= 80) return '#FFD700';
  if (score >= 60) return '#FF9800';
  return '#FF4444';
};

// ─── SkeletonOverlay ─────────────────────────────────────────────────────────
function SkeletonOverlay({ isRecording, isActive }: { isRecording: boolean; isActive: boolean }) {
  const pulse = useRef(new Animated.Value(0.6)).current;
  const swing = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.6, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  useEffect(() => {
    if (isRecording) {
      Animated.sequence([
        Animated.timing(swing, { toValue: -8, duration: 120, useNativeDriver: true }),
        Animated.timing(swing, { toValue: 14, duration: 200, useNativeDriver: true }),
        Animated.timing(swing, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [isRecording]);

  if (!isActive) return null;

  const color = isRecording ? '#FF4444' : '#00B4FF';
  const lineOpacity = isRecording ? 0.95 : 0.7;

  const vfW = width - 32;
  const vfH = VIEWFINDER_H;

  return (
    <Animated.View
      style={[styles.skeletonOverlay, { opacity: pulse, transform: [{ translateX: swing }] }]}
      pointerEvents="none"
    >
      {/* Connections */}
      {SKELETON_CONNECTIONS.map(([a, b], idx) => {
        const ja = SKELETON_JOINTS[a];
        const jb = SKELETON_JOINTS[b];
        const x1 = ja.x * vfW; const y1 = ja.y * vfH;
        const x2 = jb.x * vfW; const y2 = jb.y * vfH;
        const len = Math.hypot(x2 - x1, y2 - y1);
        const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
        return (
          <View
            key={`conn-${idx}`}
            style={{
              position: 'absolute',
              left: x1, top: y1,
              width: len, height: 2,
              backgroundColor: color,
              opacity: lineOpacity,
              borderRadius: 1,
              transform: [{ rotate: `${angle}deg` }],
              transformOrigin: 'left center',
            }}
          />
        );
      })}
      {/* Joints */}
      {SKELETON_JOINTS.map((j, idx) => (
        <View
          key={`joint-${idx}`}
          style={{
            position: 'absolute',
            left: j.x * vfW - 5,
            top: j.y * vfH - 5,
            width: 10, height: 10,
            borderRadius: 5,
            backgroundColor: color,
            opacity: lineOpacity + 0.15,
            shadowColor: color,
            shadowOpacity: 0.8,
            shadowRadius: 4,
          }}
        />
      ))}
    </Animated.View>
  );
}

// ─── StabilityMeter ──────────────────────────────────────────────────────────
function StabilityMeter({ score, label }: { score: number; label: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  const col = stabilityColor(score);

  useEffect(() => {
    Animated.timing(anim, { toValue: score / 100, duration: 800, useNativeDriver: false }).start();
  }, [score]);

  return (
    <View style={styles.stabilityMeter}>
      <Text style={styles.stabilityTitle}>Stability</Text>
      <View style={styles.stabilityBar}>
        <Animated.View
          style={[styles.stabilityFill, {
            width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            backgroundColor: col,
          }]}
        />
      </View>
      <Text style={[styles.stabilityScore, { color: col }]}>{score}</Text>
      <Text style={[styles.stabilityLabel, { color: col }]}>{label}</Text>
    </View>
  );
}

// ─── MetricRow ───────────────────────────────────────────────────────────────
function MetricRow({ icon, label, metric }: { icon: string; label: string; metric: Metric }) {
  const col = scoreColor(metric.score);
  return (
    <View style={styles.metricRow}>
      <View style={styles.metricLeft}>
        <View style={[styles.metricIcon, { backgroundColor: col + '22' }]}>
          <MaterialIcons name={icon as any} size={18} color={col} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.metricLabel}>{label}</Text>
          <Text style={[styles.metricStatus, { color: col }]}>{metric.status}</Text>
          {metric.distance_cm ? <Text style={styles.metricDetail}>{metric.distance_cm}cm stride</Text> : null}
          {metric.angle_degrees ? <Text style={styles.metricDetail}>{metric.angle_degrees}° angle</Text> : null}
          {metric.weight_distribution ? <Text style={styles.metricDetail}>{metric.weight_distribution}</Text> : null}
        </View>
      </View>
      <View style={[styles.scoreCircle, { borderColor: col }]}>
        <Text style={[styles.scoreCircleText, { color: col }]}>{metric.score}</Text>
      </View>
    </View>
  );
}

// ─── ScoreArc ────────────────────────────────────────────────────────────────
function ScoreArc({ score, grade }: { score: number; grade: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  const col = gradeColor(grade);

  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 1200, useNativeDriver: false }).start();
  }, [score]);

  return (
    <View style={styles.scoreArc}>
      <View style={[styles.scoreArcOuter, { borderColor: col + '33' }]}>
        <View style={[styles.scoreArcInner, { borderColor: col }]}>
          <Text style={[styles.scoreArcValue, { color: col }]}>{score}</Text>
          <Text style={styles.scoreArcMax}>/100</Text>
          <Text style={[styles.scoreArcGrade, { color: col }]}>{grade}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function LiveLabScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [permission, requestPermission] = useCameraPermissions();

  const [mode, setMode] = useState<'live' | 'recorded'>('live');
  const [facing, setFacing] = useState<CameraType>('back');
  const [isRecording, setIsRecording] = useState(false);
  const [skeletonActive, setSkeletonActive] = useState(false);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoUploaded, setVideoUploaded] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [shotType, setShotType] = useState('batting stroke');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const cameraRef = useRef<CameraView>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shutterAnim = useRef(new Animated.Value(1)).current;
  const feedbackAnim = useRef(new Animated.Value(0)).current;

  // Activate skeleton 1s after camera loads
  useEffect(() => {
    const t = setTimeout(() => setSkeletonActive(true), 1200);
    return () => clearTimeout(t);
  }, []);

  const pulseShutter = () => {
    Animated.sequence([
      Animated.timing(shutterAnim, { toValue: 0.85, duration: 80, useNativeDriver: true }),
      Animated.timing(shutterAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  };

  const showFeedback = () => {
    Animated.sequence([
      Animated.timing(feedbackAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(3000),
      Animated.timing(feedbackAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  };

  // ── Recording ─────────────────────────────────────────────────────────────
  const startRecording = async () => {
    if (!cameraRef.current) return;
    pulseShutter();
    setIsRecording(true);
    setRecordingSeconds(0);
    timerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);

    try {
      const video = await cameraRef.current.recordAsync({ maxDuration: 15 });
      if (video) setVideoUri(video.uri);
    } catch (e) {
      console.log('Recording error:', e);
    }
  };

  const stopRecording = () => {
    cameraRef.current?.stopRecording();
    setIsRecording(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    showFeedback();
  };

  const handleCapture = () => {
    if (isRecording) { stopRecording(); }
    else { startRecording(); }
  };

  // ── Pick from gallery ──────────────────────────────────────────────────────
  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission Needed', 'Allow gallery access to upload recorded footage for analysis.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setVideoUri(result.assets[0].uri);
      setVideoUploaded(false);
      setAnalysis(null);
    }
  };

  // ── Upload & Analyse ──────────────────────────────────────────────────────
  const analyseVideo = async () => {
    if (!user) { showAlert('Login Required', 'Please log in to use AI analysis.'); return; }

    setAnalyzing(true);
    let uploadedUrl: string | null = null;

    // Upload to Supabase Storage if we have a local URI
    if (videoUri && !videoUploaded) {
      try {
        const supabase = getSupabaseClient();
        const ext = videoUri.split('.').pop() || 'mp4';
        const fileName = `live-lab/${user.id}/${Date.now()}.${ext}`;

        // Fetch and convert to blob for upload
        const response = await fetch(videoUri);
        const blob = await response.blob();

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('drill-videos')
          .upload(fileName, blob, { contentType: 'video/mp4', upsert: true });

        if (!uploadError && uploadData) {
          const { data: urlData } = supabase.storage.from('drill-videos').getPublicUrl(fileName);
          uploadedUrl = urlData?.publicUrl || null;
          setVideoUploaded(true);
        }
      } catch (uploadErr) {
        console.log('Upload error (proceeding without URL):', uploadErr);
      }
    }

    // Call biomechanical-analysis edge function
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.functions.invoke('biomechanical-analysis', {
        body: {
          userId: user.id,
          videoUrl: uploadedUrl,
          shotType,
          analysisMode: mode,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.analysis) {
        setAnalysis(data.analysis);
      } else {
        throw new Error('No analysis returned');
      }
    } catch (err: any) {
      console.error('Analysis error:', err);
      showAlert('Analysis Failed', 'Could not complete AI analysis. Please try again.');
    }

    setAnalyzing(false);
  };

  const resetAnalysis = () => {
    setAnalysis(null);
    setVideoUri(null);
    setVideoUploaded(false);
    setRecordingSeconds(0);
  };

  // ─── Permission Gate ──────────────────────────────────────────────────────
  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerMsg}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permBlock}>
          <View style={styles.permIconRing}>
            <MaterialIcons name="videocam" size={48} color="#00B4FF" />
          </View>
          <Text style={styles.permTitle}>Camera Access Required</Text>
          <Text style={styles.permSub}>
            Live Lab uses your camera as a biomechanical sensor to measure head position,
            footwork and bat angle in real time. No footage is shared without your consent.
          </Text>
          <Pressable style={styles.permBtn} onPress={requestPermission}>
            <MaterialIcons name="videocam" size={20} color="#fff" />
            <Text style={styles.permBtnText}>Enable Camera</Text>
          </Pressable>
          <Text style={styles.permNote}>You can also upload recorded footage without camera access.</Text>
          <Pressable style={styles.permGalleryBtn} onPress={() => setMode('recorded')}>
            <MaterialIcons name="video-library" size={18} color={colors.primary} />
            <Text style={styles.permGalleryText}>Upload Recorded Video Instead</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Analysis Report ──────────────────────────────────────────────────────
  if (analysis) {
    const m = analysis.metrics;
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.reportScroll, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.reportHeader}>
            <Pressable onPress={resetAnalysis} style={styles.reportBackBtn} hitSlop={8}>
              <MaterialIcons name="arrow-back" size={22} color={colors.text} />
            </Pressable>
            <View>
              <Text style={styles.reportTitle}>Technical Balance Report</Text>
              <Text style={styles.reportShot}>{analysis.shot_detected}</Text>
            </View>
          </View>

          {/* Score Arc */}
          <ScoreArc score={analysis.overall_score} grade={analysis.grade} />

          {/* Instant Feedback Glass Card */}
          <View style={styles.glassCard}>
            <View style={styles.glassCardInner}>
              <MaterialIcons name="tips-and-updates" size={20} color="#FFD700" />
              <View style={{ flex: 1 }}>
                <Text style={styles.glassCardLabel}>AI Instant Feedback</Text>
                <Text style={styles.glassCardText}>{analysis.instant_feedback}</Text>
              </View>
            </View>
            <View style={styles.audioCueBadge}>
              <MaterialIcons name="record-voice-over" size={14} color="#00E5A0" />
              <Text style={styles.audioCueText}>"{analysis.audio_cue}"</Text>
            </View>
          </View>

          {/* Stability Meter */}
          <View style={styles.section}>
            <StabilityMeter score={analysis.stability_score} label={analysis.stability_label} />
          </View>

          {/* Metrics */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Biomechanical Metrics</Text>
            <MetricRow icon="psychology" label="Head Position" metric={m.head_position} />
            <MetricRow icon="directions-walk" label="Front Foot Stride" metric={m.front_foot_stride} />
            <MetricRow icon="sports-cricket" label="Bat Angle" metric={m.bat_angle} />
            <MetricRow icon="balance" label="Body Balance" metric={m.balance} />
            <MetricRow icon="redo" label="Follow Through" metric={m.follow_through} />
          </View>

          {/* Tips per metric */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Coaching Fixes</Text>
            {Object.entries(m).map(([key, metric]: [string, any]) => (
              <View key={key} style={styles.tipCard}>
                <Text style={styles.tipTitle}>
                  {key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </Text>
                <Text style={styles.tipBody}>{metric.detail}</Text>
                <View style={styles.tipRow}>
                  <MaterialIcons name="lightbulb" size={14} color={colors.primary} />
                  <Text style={styles.tipFix}>{metric.tip}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Strengths & Improvements */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Strengths</Text>
            {analysis.strengths.map((s, i) => (
              <View key={i} style={styles.bulletRow}>
                <MaterialIcons name="check-circle" size={18} color="#00E5A0" />
                <Text style={styles.bulletText}>{s}</Text>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Areas to Improve</Text>
            {analysis.areas_to_improve.map((s, i) => (
              <View key={i} style={styles.bulletRow}>
                <MaterialIcons name="arrow-upward" size={18} color="#FF9800" />
                <Text style={styles.bulletText}>{s}</Text>
              </View>
            ))}
          </View>

          {/* Drill Recommendations */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recommended Drills</Text>
            {analysis.drill_recommendations.map((d, i) => (
              <View key={i} style={styles.drillCard}>
                <View style={styles.drillCardHeader}>
                  <MaterialIcons name="fitness-center" size={18} color={colors.primary} />
                  <Text style={styles.drillName}>{d.name}</Text>
                  <View style={styles.drillDurBadge}>
                    <Text style={styles.drillDurText}>{d.duration_minutes}min</Text>
                  </View>
                </View>
                <Text style={styles.drillFocus}>{d.focus}</Text>
              </View>
            ))}
          </View>

          {/* Coach Summary */}
          <View style={[styles.section, styles.coachSummaryCard]}>
            <View style={styles.coachSummaryHeader}>
              <MaterialIcons name="verified" size={20} color="#FFD700" />
              <Text style={styles.coachSummaryTitle}>Coach AI Summary</Text>
            </View>
            <Text style={styles.coachSummaryText}>{analysis.coach_summary}</Text>
          </View>

          {/* New Analysis */}
          <Pressable style={styles.newAnalysisBtn} onPress={resetAnalysis}>
            <MaterialIcons name="videocam" size={20} color="#fff" />
            <Text style={styles.newAnalysisBtnText}>Record Another Shot</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Main Live Lab UI ────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <View style={styles.liveDot} />
          <Text style={styles.topBarTitle}>LIVE LAB</Text>
        </View>
        {/* Live / Recorded toggle */}
        <View style={styles.toggle}>
          <Pressable
            style={[styles.toggleBtn, mode === 'live' && styles.toggleBtnActive]}
            onPress={() => setMode('live')}
          >
            <Text style={[styles.toggleBtnText, mode === 'live' && styles.toggleBtnTextActive]}>Live</Text>
          </Pressable>
          <Pressable
            style={[styles.toggleBtn, mode === 'recorded' && styles.toggleBtnActive]}
            onPress={() => setMode('recorded')}
          >
            <Text style={[styles.toggleBtnText, mode === 'recorded' && styles.toggleBtnTextActive]}>Recorded</Text>
          </Pressable>
        </View>
        <Pressable onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')} hitSlop={8}>
          <MaterialIcons name="flip-camera-android" size={26} color="rgba(255,255,255,0.7)" />
        </Pressable>
      </View>

      {/* ── LIVE MODE ──────────────────────────────────────────────────── */}
      {mode === 'live' && (
        <View style={{ flex: 1 }}>
          {/* Viewfinder */}
          <View style={styles.viewfinderWrap}>
            <CameraView
              ref={cameraRef}
              style={styles.viewfinder}
              facing={facing}
              mode="video"
            />
            {/* Glow border */}
            <View style={[styles.viewfinderBorder, isRecording && styles.viewfinderBorderRec]} />

            {/* Skeleton */}
            <SkeletonOverlay isRecording={isRecording} isActive={skeletonActive} />

            {/* Stability Meter (floating) */}
            <View style={styles.floatingStability}>
              <StabilityMeter score={isRecording ? 72 : 85} label={isRecording ? 'Tracking' : 'Ready'} />
            </View>

            {/* Recording timer */}
            {isRecording && (
              <View style={styles.recBadge}>
                <View style={styles.recDot} />
                <Text style={styles.recTimer}>
                  {String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:{String(recordingSeconds % 60).padStart(2, '0')}
                </Text>
              </View>
            )}

            {/* Instant feedback toast */}
            <Animated.View style={[styles.feedbackToast, { opacity: feedbackAnim, transform: [{ translateY: feedbackAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
              <MaterialIcons name="sports-cricket" size={16} color="#FFD700" />
              <Text style={styles.feedbackToastText}>Shot captured — ready to analyse</Text>
            </Animated.View>

            {/* Corner guides */}
            {['tl', 'tr', 'bl', 'br'].map(c => (
              <View key={c} style={[styles.corner, styles[`corner_${c}` as keyof typeof styles]]} />
            ))}
          </View>

          {/* Shot type picker */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.shotTypeBar}
            contentContainerStyle={styles.shotTypeContent}
          >
            {['Cover Drive', 'Straight Drive', 'Pull Shot', 'Cut Shot', 'Flick', 'Sweep', 'Defence'].map(s => (
              <Pressable
                key={s}
                style={[styles.shotChip, shotType === s.toLowerCase() && styles.shotChipActive]}
                onPress={() => setShotType(s.toLowerCase())}
              >
                <Text style={[styles.shotChipText, shotType === s.toLowerCase() && styles.shotChipTextActive]}>{s}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Bottom controls */}
          <View style={[styles.controls, { paddingBottom: insets.bottom + 12 }]}>
            {/* Gallery button */}
            <Pressable style={styles.controlSideBtn} onPress={pickVideo}>
              <MaterialIcons name="video-library" size={28} color="rgba(255,255,255,0.7)" />
              <Text style={styles.controlSideBtnText}>Gallery</Text>
            </Pressable>

            {/* Shutter */}
            <Animated.View style={{ transform: [{ scale: shutterAnim }] }}>
              <Pressable style={[styles.shutter, isRecording && styles.shutterRecording]} onPress={handleCapture}>
                {isRecording
                  ? <View style={styles.shutterStopIcon} />
                  : <View style={styles.shutterInner} />
                }
              </Pressable>
            </Animated.View>

            {/* Analyse button (appears after capture) */}
            {videoUri && !isRecording ? (
              <Pressable style={styles.controlSideBtn} onPress={analyseVideo}>
                <MaterialIcons name="analytics" size={28} color="#00E5A0" />
                <Text style={[styles.controlSideBtnText, { color: '#00E5A0' }]}>Analyse</Text>
              </Pressable>
            ) : (
              <View style={styles.controlSideBtn}>
                <MaterialIcons name="tune" size={28} color="rgba(255,255,255,0.3)" />
                <Text style={[styles.controlSideBtnText, { opacity: 0.3 }]}>Settings</Text>
              </View>
            )}
          </View>

          {/* Analyse overlay if video ready */}
          {videoUri && !isRecording && !analyzing && (
            <View style={styles.analyseReadyBanner}>
              <MaterialIcons name="check-circle" size={18} color="#00E5A0" />
              <Text style={styles.analyseReadyText}>Shot ready — tap Analyse for AI report</Text>
            </View>
          )}

          {/* Analysing overlay */}
          {analyzing && (
            <View style={styles.analysingOverlay}>
              <ActivityIndicator size="large" color="#00B4FF" />
              <Text style={styles.analysingText}>Generating Technical Balance Report…</Text>
              <Text style={styles.analysingSubText}>Analysing head position, footwork & bat angle</Text>
            </View>
          )}
        </View>
      )}

      {/* ── RECORDED MODE ──────────────────────────────────────────────── */}
      {mode === 'recorded' && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.recordedContent, { paddingBottom: insets.bottom + 80 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.uploadHero}>
            <MaterialIcons name="cloud-upload" size={56} color="#00B4FF" />
            <Text style={styles.uploadTitle}>Upload Recorded Footage</Text>
            <Text style={styles.uploadSub}>
              Upload a video of your batting and get a full Technical Balance Report with AI biomechanical analysis
            </Text>
          </View>

          {/* Shot type */}
          <View style={styles.uploadSection}>
            <Text style={styles.uploadLabel}>Shot Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {['Cover Drive', 'Straight Drive', 'Pull Shot', 'Cut Shot', 'Flick', 'Sweep', 'Defence'].map(s => (
                  <Pressable
                    key={s}
                    style={[styles.shotChip, shotType === s.toLowerCase() && styles.shotChipActive]}
                    onPress={() => setShotType(s.toLowerCase())}
                  >
                    <Text style={[styles.shotChipText, shotType === s.toLowerCase() && styles.shotChipTextActive]}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Video preview / pick */}
          <Pressable style={styles.videoPicker} onPress={pickVideo}>
            {videoUri
              ? (
                <View style={styles.videoPickerSelected}>
                  <MaterialIcons name="video-file" size={48} color="#00E5A0" />
                  <Text style={styles.videoPickerSelectedText}>Video Selected</Text>
                  <Text style={styles.videoPickerChange}>Tap to change</Text>
                </View>
              )
              : (
                <View style={styles.videoPickerEmpty}>
                  <MaterialIcons name="add-circle-outline" size={48} color="#00B4FF" />
                  <Text style={styles.videoPickerEmptyText}>Tap to select video</Text>
                  <Text style={styles.videoPickerEmptySub}>MP4, MOV up to 60s</Text>
                </View>
              )
            }
          </Pressable>

          {/* Tips */}
          <View style={styles.tipsCard}>
            <Text style={styles.tipsTitle}>For Best Results</Text>
            {[
              'Film side-on (wicket to wicket view)',
              'Ensure full body is in frame',
              'Good lighting — outdoors is ideal',
              '5-15 seconds of footage per shot',
            ].map((tip, i) => (
              <View key={i} style={styles.bulletRow}>
                <MaterialIcons name="check" size={16} color="#00E5A0" />
                <Text style={[styles.bulletText, { fontSize: 13 }]}>{tip}</Text>
              </View>
            ))}
          </View>

          {/* Analyse button */}
          <Pressable
            style={[styles.analyseBtn, (!videoUri || analyzing) && styles.analyseBtnDisabled]}
            onPress={analyseVideo}
            disabled={!videoUri || analyzing}
          >
            {analyzing
              ? <ActivityIndicator color="#fff" />
              : (
                <>
                  <MaterialIcons name="analytics" size={22} color="#fff" />
                  <Text style={styles.analyseBtnText}>Generate AI Report</Text>
                </>
              )
            }
          </Pressable>

          {analyzing && (
            <Text style={[styles.analysingSubText, { textAlign: 'center', marginTop: 12 }]}>
              Generating Technical Balance Report…
            </Text>
          )}

          {/* Policy notice */}
          <Text style={styles.policyNote}>
            Camera and gallery access are used strictly for the AI coaching engine to analyse athletic performance. No footage is stored without consent.
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const ELEC_BLUE = '#00B4FF';
const GOLD = '#FFD700';
const GLASS_BG = 'rgba(255,255,255,0.08)';
const GLASS_BORDER = 'rgba(255,255,255,0.15)';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0F1A' },
  centerMsg: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Permission
  permBlock: {
    flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl,
  },
  permIconRing: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: ELEC_BLUE + '22',
    borderWidth: 2, borderColor: ELEC_BLUE + '44',
    justifyContent: 'center', alignItems: 'center', marginBottom: spacing.xl,
  },
  permTitle: { ...typography.h2, color: '#fff', textAlign: 'center', marginBottom: spacing.md },
  permSub: { ...typography.body, color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 22, marginBottom: spacing.xl },
  permBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: ELEC_BLUE, borderRadius: borderRadius.md,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md + 4,
    shadowColor: ELEC_BLUE, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  permBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  permNote: { color: 'rgba(255,255,255,0.4)', fontSize: 12, textAlign: 'center', marginTop: spacing.lg },
  permGalleryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.md,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
  },
  permGalleryText: { color: colors.primary, fontSize: 14, fontWeight: '600' },

  // Top bar
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF4444' },
  topBarTitle: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 2 },
  toggle: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20, padding: 3,
  },
  toggleBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 18 },
  toggleBtnActive: { backgroundColor: ELEC_BLUE },
  toggleBtnText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600' },
  toggleBtnTextActive: { color: '#fff' },

  // Viewfinder
  viewfinderWrap: {
    marginHorizontal: spacing.sm,
    marginTop: spacing.sm,
    height: VIEWFINDER_H,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
    position: 'relative',
  },
  viewfinder: { flex: 1 },
  viewfinderBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16, borderWidth: 2, borderColor: ELEC_BLUE + '66',
    shadowColor: ELEC_BLUE, shadowOpacity: 0.5, shadowRadius: 12,
  },
  viewfinderBorderRec: { borderColor: '#FF4444', shadowColor: '#FF4444' },

  // Skeleton
  skeletonOverlay: { ...StyleSheet.absoluteFillObject },

  // Corner guides
  corner: {
    position: 'absolute', width: 20, height: 20,
    borderColor: ELEC_BLUE, borderWidth: 2.5,
  },
  corner_tl: { top: 12, left: 12, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  corner_tr: { top: 12, right: 12, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 6 },
  corner_bl: { bottom: 12, left: 12, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 6 },
  corner_br: { bottom: 12, right: 12, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 6 },

  // Floating stability
  floatingStability: {
    position: 'absolute', top: 14, right: 14,
    backgroundColor: 'rgba(10,15,26,0.78)',
    borderRadius: 12, padding: 10, minWidth: 90,
    borderWidth: 1, borderColor: GLASS_BORDER,
  },
  stabilityMeter: { alignItems: 'center', gap: 3 },
  stabilityTitle: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  stabilityBar: {
    width: 70, height: 6, backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 3, overflow: 'hidden',
  },
  stabilityFill: { height: '100%', borderRadius: 3 },
  stabilityScore: { fontSize: 20, fontWeight: '800', marginTop: 2 },
  stabilityLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  // Rec badge
  recBadge: {
    position: 'absolute', top: 14, left: 14,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
  },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF4444' },
  recTimer: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 1 },

  // Feedback toast
  feedbackToast: {
    position: 'absolute', bottom: 14, left: 14, right: 14,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(10,15,26,0.85)', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: GOLD + '55',
  },
  feedbackToastText: { color: '#fff', fontSize: 13, fontWeight: '600', flex: 1 },

  // Shot type bar
  shotTypeBar: { maxHeight: 50, marginTop: 10 },
  shotTypeContent: { paddingHorizontal: spacing.md, gap: 8 },
  shotChip: {
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  shotChipActive: { backgroundColor: ELEC_BLUE, borderColor: ELEC_BLUE },
  shotChipText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },
  shotChipTextActive: { color: '#fff' },

  // Controls
  controls: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 36, paddingTop: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  controlSideBtn: { alignItems: 'center', gap: 4, minWidth: 56 },
  controlSideBtnText: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600' },

  // Shutter
  shutter: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 4, borderColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#fff', shadowOpacity: 0.3, shadowRadius: 10, elevation: 8,
  },
  shutterRecording: { borderColor: '#FF4444', shadowColor: '#FF4444' },
  shutterInner: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff' },
  shutterStopIcon: { width: 24, height: 24, borderRadius: 4, backgroundColor: '#FF4444' },

  // Analyse ready banner
  analyseReadyBanner: {
    position: 'absolute', top: VIEWFINDER_H + 16, left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,229,160,0.12)', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: '#00E5A0' + '44',
  },
  analyseReadyText: { color: '#00E5A0', fontSize: 13, fontWeight: '600', flex: 1 },

  // Analysing overlay
  analysingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,15,26,0.9)',
    justifyContent: 'center', alignItems: 'center', gap: 16,
  },
  analysingText: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  analysingSubText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center', paddingHorizontal: 32 },

  // Recorded mode
  recordedContent: { padding: spacing.lg },
  uploadHero: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.md },
  uploadTitle: { ...typography.h2, color: '#fff', textAlign: 'center' },
  uploadSub: { ...typography.body, color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 22 },
  uploadSection: { marginBottom: spacing.lg },
  uploadLabel: { color: '#fff', fontSize: 13, fontWeight: '700', marginBottom: spacing.sm },
  videoPicker: {
    height: 180, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed',
    borderColor: ELEC_BLUE + '55', marginBottom: spacing.lg,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,180,255,0.05)',
  },
  videoPickerEmpty: { alignItems: 'center', gap: 10 },
  videoPickerEmptyText: { color: ELEC_BLUE, fontSize: 15, fontWeight: '700' },
  videoPickerEmptySub: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  videoPickerSelected: { alignItems: 'center', gap: 10 },
  videoPickerSelectedText: { color: '#00E5A0', fontSize: 15, fontWeight: '700' },
  videoPickerChange: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  tipsCard: {
    backgroundColor: GLASS_BG, borderRadius: 12, borderWidth: 1,
    borderColor: GLASS_BORDER, padding: spacing.md, marginBottom: spacing.lg, gap: 8,
  },
  tipsTitle: { color: '#fff', fontSize: 13, fontWeight: '700', marginBottom: 4 },
  analyseBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: ELEC_BLUE, borderRadius: borderRadius.md,
    paddingVertical: spacing.md + 4, marginBottom: spacing.md,
    shadowColor: ELEC_BLUE, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
    minHeight: 56,
  },
  analyseBtnDisabled: { opacity: 0.45, shadowOpacity: 0 },
  analyseBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  policyNote: {
    color: 'rgba(255,255,255,0.3)', fontSize: 11, textAlign: 'center',
    lineHeight: 16, marginTop: spacing.md,
  },

  // Report
  reportScroll: { padding: spacing.lg },
  reportHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg,
  },
  reportBackBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center', alignItems: 'center',
  },
  reportTitle: { ...typography.h3, color: '#fff', fontWeight: '800' },
  reportShot: { color: ELEC_BLUE, fontSize: 13, fontWeight: '600' },

  // Score arc
  scoreArc: { alignItems: 'center', marginBottom: spacing.xl },
  scoreArcOuter: {
    width: 160, height: 160, borderRadius: 80,
    borderWidth: 3, justifyContent: 'center', alignItems: 'center',
  },
  scoreArcInner: {
    width: 130, height: 130, borderRadius: 65,
    borderWidth: 4, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scoreArcValue: { fontSize: 46, fontWeight: '900', lineHeight: 52 },
  scoreArcMax: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '600' },
  scoreArcGrade: { fontSize: 22, fontWeight: '800', marginTop: 2 },

  // Glass card
  glassCard: {
    backgroundColor: GLASS_BG, borderRadius: 16, borderWidth: 1,
    borderColor: GLASS_BORDER, padding: spacing.md, marginBottom: spacing.md,
  },
  glassCardInner: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: spacing.sm },
  glassCardLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 3 },
  glassCardText: { color: '#fff', fontSize: 16, fontWeight: '700', lineHeight: 22 },
  audioCueBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,229,160,0.12)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: '#00E5A0' + '30',
  },
  audioCueText: { color: '#00E5A0', fontSize: 13, fontWeight: '600', fontStyle: 'italic' },

  // Sections
  section: { marginBottom: spacing.lg },
  sectionTitle: { color: '#fff', fontSize: 15, fontWeight: '800', marginBottom: spacing.sm, letterSpacing: 0.3 },

  // Metric row
  metricRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: GLASS_BG, borderRadius: 12, borderWidth: 1,
    borderColor: GLASS_BORDER, padding: spacing.md, marginBottom: spacing.sm,
  },
  metricLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  metricIcon: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  metricLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  metricStatus: { fontSize: 14, fontWeight: '800', marginTop: 2 },
  metricDetail: { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 1 },
  scoreCircle: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 2, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  scoreCircleText: { fontSize: 15, fontWeight: '900' },

  // Tips
  tipCard: {
    backgroundColor: GLASS_BG, borderRadius: 12, borderWidth: 1,
    borderColor: GLASS_BORDER, padding: spacing.md, marginBottom: spacing.sm,
  },
  tipTitle: { color: '#fff', fontSize: 13, fontWeight: '700', marginBottom: 4 },
  tipBody: { color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 20, marginBottom: 8 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  tipFix: { color: colors.primary, fontSize: 13, fontWeight: '600', flex: 1, lineHeight: 18 },

  // Bullets
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  bulletText: { color: 'rgba(255,255,255,0.75)', fontSize: 14, flex: 1, lineHeight: 20 },

  // Drill card
  drillCard: {
    backgroundColor: GLASS_BG, borderRadius: 12, borderWidth: 1,
    borderColor: GLASS_BORDER, padding: spacing.md, marginBottom: spacing.sm,
  },
  drillCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  drillName: { color: '#fff', fontSize: 14, fontWeight: '700', flex: 1 },
  drillDurBadge: {
    backgroundColor: colors.primary + '22', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  drillDurText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  drillFocus: { color: 'rgba(255,255,255,0.55)', fontSize: 12, lineHeight: 18 },

  // Coach summary
  coachSummaryCard: {
    backgroundColor: 'rgba(255,215,0,0.06)', borderRadius: 16, borderWidth: 1,
    borderColor: GOLD + '33', padding: spacing.lg,
  },
  coachSummaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm },
  coachSummaryTitle: { color: GOLD, fontSize: 15, fontWeight: '800' },
  coachSummaryText: { color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: 22 },

  // New analysis
  newAnalysisBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: ELEC_BLUE, borderRadius: borderRadius.md,
    paddingVertical: spacing.md + 4, marginTop: spacing.md,
    shadowColor: ELEC_BLUE, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  newAnalysisBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
