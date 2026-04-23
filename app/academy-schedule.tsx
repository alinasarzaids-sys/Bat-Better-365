import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator,
  Modal, TextInput, RefreshControl, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SafeIcon as MaterialIcons } from '@/components/ui/SafeIcon';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useAuth, useAlert, getSupabaseClient } from '@/template';
import { academyService, AcademySession, AcademySquad } from '@/services/academyService';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────
interface PlanBlock {
  id: string;
  startTime: string;
  endTime: string;
  activities: string[];
  notes: string;
}

interface ScheduleEntry {
  id: string;
  source: 'academy' | 'personal';
  title: string;
  date: string;
  time: string;
  location?: string;
  sessionType: string;
  notes?: string;
  squadId?: string | null;
  createdBy?: string;
  rawAcademy?: AcademySession;
  rawPersonalId?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function todayStr() { return new Date().toISOString().split('T')[0]; }
function now12() {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}
function formatDateReadable(dateStr: string) {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return dateStr; }
}
function formatTime12(time: string) {
  try {
    const [h, m] = time.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
  } catch { return time; }
}
function parsePlanBlocks(notes?: string): PlanBlock[] {
  if (!notes) return [];
  try {
    const start = notes.indexOf('PLAN_BLOCKS:');
    if (start === -1) return [];
    const json = notes.slice(start + 12);
    const blocks = JSON.parse(json);
    return blocks.map((b: any) => ({
      ...b,
      activities: Array.isArray(b.activities) ? b.activities : b.activity ? [b.activity] : [],
    }));
  } catch { return []; }
}
function parseObjectives(notes?: string): string[] {
  if (!notes) return [];
  try {
    const start = notes.indexOf('OBJECTIVES:');
    if (start === -1) return [];
    const end = notes.indexOf('PLAN_BLOCKS:');
    const slice = end === -1 ? notes.slice(start + 11) : notes.slice(start + 11, end);
    return JSON.parse(slice.trim().split('\n')[0]);
  } catch { return []; }
}
function parseCoachNotes(notes?: string): string {
  if (!notes) return '';
  let result = notes;
  for (const m of ['OBJECTIVES:', 'PLAN_BLOCKS:']) {
    const idx = result.indexOf(m);
    if (idx !== -1) result = result.slice(0, idx);
  }
  return result.trim();
}
function buildNotes(coachNotes: string, objectives: string[], planBlocks: PlanBlock[]): string {
  let out = '';
  if (coachNotes.trim()) out += coachNotes.trim() + '\n';
  if (objectives.filter(Boolean).length) out += `OBJECTIVES:${JSON.stringify(objectives.filter(Boolean))}\n`;
  if (planBlocks.length) out += `PLAN_BLOCKS:${JSON.stringify(planBlocks)}`;
  return out;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const ACTIVITIES = ['Batting', 'Bowling', 'Fielding', 'Keeping', 'Fitness', 'Warm-up', 'Cool-down', 'Team Talk', 'Match Sim'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const SESSION_TYPE_COLORS: Record<string, string> = {
  Training: colors.primary, Fielding: colors.tactical, Batting: colors.technical,
  Bowling: colors.physical, Fitness: colors.physical, Match: colors.error,
};
function typeColor(t: string) { return SESSION_TYPE_COLORS[t] || colors.primary; }

const SOURCE_COLORS = {
  academy: { bg: colors.primary + '18', text: colors.primary, border: colors.primary + '40' },
  personal: { bg: colors.success + '18', text: colors.success, border: colors.success + '40' },
};

// ─── Shared picker styles ─────────────────────────────────────────────────────
const tp = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.xl, width: '100%', maxWidth: 340 },
  pickerLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600', textAlign: 'center', marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  display: { fontSize: 32, fontWeight: '900', color: colors.primary, textAlign: 'center', marginBottom: spacing.lg, letterSpacing: 1 },
  columns: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginBottom: spacing.lg },
  col: { alignItems: 'center', minWidth: 56 },
  colLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600', marginBottom: 4 },
  colValue: { fontSize: 38, fontWeight: '900', color: colors.text, lineHeight: 46, textAlign: 'center' },
  colInput: { borderBottomWidth: 2, borderBottomColor: colors.primary + '60', minWidth: 56, paddingVertical: 2, backgroundColor: 'transparent' },
  arrowBtn: { padding: 4 },
  colon: { fontSize: 32, fontWeight: '900', color: colors.textSecondary, paddingBottom: 8 },
  ampmCol: { alignItems: 'center', gap: 4, marginLeft: 4 },
  ampmBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: borderRadius.md, minWidth: 48, alignItems: 'center', borderWidth: 1.5 },
  ampmText: { fontSize: 14, fontWeight: '800' },
  btnRow: { flexDirection: 'row', gap: spacing.sm },
  cancelBtn: { flex: 1, alignItems: 'center', paddingVertical: spacing.md, borderRadius: borderRadius.md, borderWidth: 1.5, borderColor: colors.border },
  cancelText: { fontSize: 15, fontWeight: '700', color: colors.textSecondary },
  confirmBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.primary },
  confirmText: { fontSize: 15, fontWeight: '700', color: colors.textLight },
});

// ─── Inline Date Picker ────────────────────────────────────────────────────────
function InlineDatePicker({ value, onChange, onClose }: {
  value: string; onChange: (v: string) => void; onClose: () => void;
}) {
  const parts = (value || todayStr()).split('-').map(Number);
  const [year, setYear] = useState(parts[0] || new Date().getFullYear());
  const [month, setMonth] = useState(parts[1] || new Date().getMonth() + 1);
  const [day, setDay] = useState(parts[2] || new Date().getDate());
  const daysInMonth = new Date(year, month, 0).getDate();
  const safeDay = Math.min(day, daysInMonth);
  const formatted = `${String(safeDay).padStart(2, '0')} ${MONTHS[month - 1]} ${year}`;
  const [dayText, setDayText] = useState(String(safeDay).padStart(2, '0'));
  const [monthText, setMonthText] = useState(String(month).padStart(2, '0'));
  const [yearText, setYearText] = useState(String(year));
  React.useEffect(() => { setDayText(String(Math.min(day, daysInMonth)).padStart(2, '0')); }, [day, month, year]);
  React.useEffect(() => { setMonthText(String(month).padStart(2, '0')); }, [month]);
  React.useEffect(() => { setYearText(String(year)); }, [year]);

  const handleConfirm = () => {
    const fd = parseInt(dayText, 10); const fm = parseInt(monthText, 10); const fy = parseInt(yearText, 10);
    const finalDay = (!isNaN(fd) && fd >= 1 && fd <= daysInMonth) ? fd : safeDay;
    const finalMonth = (!isNaN(fm) && fm >= 1 && fm <= 12) ? fm : month;
    const finalYear = (!isNaN(fy) && fy >= 2020) ? fy : year;
    onChange(`${finalYear}-${String(finalMonth).padStart(2, '0')}-${String(finalDay).padStart(2, '0')}`);
    onClose();
  };

  return (
    <View style={inl.box}>
      <Text style={inl.display}>{formatted}</Text>
      <View style={inl.cols}>
        <View style={inl.col}>
          <Text style={inl.colLabel}>Day</Text>
          <Pressable style={inl.arrowBtn} onPress={() => setDay(d => d >= daysInMonth ? 1 : d + 1)} hitSlop={8}>
            <MaterialIcons name="keyboard-arrow-up" size={28} color={colors.success} />
          </Pressable>
          <TextInput style={inl.colInput} value={dayText} onChangeText={setDayText}
            onBlur={() => { const n = parseInt(dayText, 10); if (!isNaN(n) && n >= 1 && n <= daysInMonth) setDay(n); else setDayText(String(safeDay).padStart(2, '0')); }}
            keyboardType="number-pad" maxLength={2} selectTextOnFocus />
          <Pressable style={inl.arrowBtn} onPress={() => setDay(d => d <= 1 ? daysInMonth : d - 1)} hitSlop={8}>
            <MaterialIcons name="keyboard-arrow-down" size={28} color={colors.success} />
          </Pressable>
        </View>
        <View style={[inl.col, { minWidth: 60 }]}>
          <Text style={inl.colLabel}>Month</Text>
          <Pressable style={inl.arrowBtn} onPress={() => setMonth(m => m >= 12 ? 1 : m + 1)} hitSlop={8}>
            <MaterialIcons name="keyboard-arrow-up" size={28} color={colors.success} />
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <TextInput style={inl.colInput} value={monthText} onChangeText={setMonthText}
              onBlur={() => { const n = parseInt(monthText, 10); if (!isNaN(n) && n >= 1 && n <= 12) setMonth(n); else setMonthText(String(month).padStart(2, '0')); }}
              keyboardType="number-pad" maxLength={2} selectTextOnFocus />
            <Text style={{ fontSize: 10, color: colors.success, fontWeight: '700', marginTop: 2 }}>{MONTHS[(parseInt(monthText, 10) || month) - 1] || ''}</Text>
          </View>
          <Pressable style={inl.arrowBtn} onPress={() => setMonth(m => m <= 1 ? 12 : m - 1)} hitSlop={8}>
            <MaterialIcons name="keyboard-arrow-down" size={28} color={colors.success} />
          </Pressable>
        </View>
        <View style={[inl.col, { minWidth: 72 }]}>
          <Text style={inl.colLabel}>Year</Text>
          <Pressable style={inl.arrowBtn} onPress={() => setYear(y => y + 1)} hitSlop={8}>
            <MaterialIcons name="keyboard-arrow-up" size={28} color={colors.success} />
          </Pressable>
          <TextInput style={[inl.colInput, { minWidth: 64, fontSize: 18 }]} value={yearText} onChangeText={setYearText}
            onBlur={() => { const n = parseInt(yearText, 10); if (!isNaN(n) && n >= 2020) setYear(n); else setYearText(String(year)); }}
            keyboardType="number-pad" maxLength={4} selectTextOnFocus />
          <Pressable style={inl.arrowBtn} onPress={() => setYear(y => Math.max(2020, y - 1))} hitSlop={8}>
            <MaterialIcons name="keyboard-arrow-down" size={28} color={colors.success} />
          </Pressable>
        </View>
      </View>
      <View style={tp.btnRow}>
        <Pressable style={tp.cancelBtn} onPress={onClose}><Text style={tp.cancelText}>Cancel</Text></Pressable>
        <Pressable style={[tp.confirmBtn, { backgroundColor: colors.success }]} onPress={handleConfirm}>
          <MaterialIcons name="check" size={18} color={colors.textLight} />
          <Text style={tp.confirmText}>Set Date</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Inline Time Picker ────────────────────────────────────────────────────────
function InlineTimePicker({ value, onChange, onClose }: {
  value: string; onChange: (v: string) => void; onClose: () => void;
}) {
  const [hh, mm] = (value || '10:00').split(':').map(Number);
  const [hour, setHour] = useState(isNaN(hh) ? 10 : hh);
  const [minute, setMinute] = useState(isNaN(mm) ? 0 : mm);
  const isPM = hour >= 12;
  const h12 = hour % 12 || 12;
  const formatted = `${String(h12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`;
  const [hourText, setHourText] = useState(String(h12).padStart(2, '0'));
  const [minText, setMinText] = useState(String(minute).padStart(2, '0'));
  React.useEffect(() => { setHourText(String(hour % 12 || 12).padStart(2, '0')); }, [hour]);
  React.useEffect(() => { setMinText(String(minute).padStart(2, '0')); }, [minute]);

  const commitHour = (t: string) => {
    const n = parseInt(t, 10);
    if (!isNaN(n) && n >= 1 && n <= 12) setHour(isPM ? (n === 12 ? 12 : n + 12) : (n === 12 ? 0 : n));
    else setHourText(String(hour % 12 || 12).padStart(2, '0'));
  };
  const commitMin = (t: string) => {
    const n = parseInt(t, 10);
    if (!isNaN(n) && n >= 0 && n <= 59) setMinute(n);
    else setMinText(String(minute).padStart(2, '0'));
  };
  const handleConfirm = () => {
    const fh = parseInt(hourText, 10); const fm = parseInt(minText, 10);
    const finalHour = (!isNaN(fh) && fh >= 1 && fh <= 12) ? (isPM ? (fh === 12 ? 12 : fh + 12) : (fh === 12 ? 0 : fh)) : hour;
    const finalMin = (!isNaN(fm) && fm >= 0 && fm <= 59) ? fm : minute;
    onChange(`${String(finalHour).padStart(2, '0')}:${String(finalMin).padStart(2, '0')}`);
    onClose();
  };

  return (
    <View style={inl.box}>
      <Text style={inl.display}>{formatted}</Text>
      <View style={inl.cols}>
        <View style={inl.col}>
          <Text style={inl.colLabel}>Hour</Text>
          <Pressable style={inl.arrowBtn} onPress={() => setHour(h => (h + 1) % 24)} hitSlop={8}>
            <MaterialIcons name="keyboard-arrow-up" size={28} color={colors.success} />
          </Pressable>
          <TextInput style={inl.colInput} value={hourText} onChangeText={setHourText}
            onBlur={() => commitHour(hourText)} keyboardType="number-pad" maxLength={2} selectTextOnFocus />
          <Pressable style={inl.arrowBtn} onPress={() => setHour(h => (h - 1 + 24) % 24)} hitSlop={8}>
            <MaterialIcons name="keyboard-arrow-down" size={28} color={colors.success} />
          </Pressable>
        </View>
        <Text style={[tp.colon, { color: colors.text, fontSize: 24, paddingBottom: 0, alignSelf: 'center' }]}>:</Text>
        <View style={inl.col}>
          <Text style={inl.colLabel}>Min</Text>
          <Pressable style={inl.arrowBtn} onPress={() => setMinute(m => (m + 1) % 60)} hitSlop={8}>
            <MaterialIcons name="keyboard-arrow-up" size={28} color={colors.success} />
          </Pressable>
          <TextInput style={inl.colInput} value={minText} onChangeText={setMinText}
            onBlur={() => commitMin(minText)} keyboardType="number-pad" maxLength={2} selectTextOnFocus />
          <Pressable style={inl.arrowBtn} onPress={() => setMinute(m => (m - 1 + 60) % 60)} hitSlop={8}>
            <MaterialIcons name="keyboard-arrow-down" size={28} color={colors.success} />
          </Pressable>
        </View>
        <View style={[tp.ampmCol, { marginTop: 20 }]}>
          <Pressable style={[tp.ampmBtn, !isPM ? { backgroundColor: colors.success, borderColor: colors.success } : { backgroundColor: 'transparent', borderColor: colors.border }]}
            onPress={() => { if (hour >= 12) setHour(h => h - 12); }}>
            <Text style={[tp.ampmText, { color: !isPM ? colors.textLight : colors.textSecondary }]}>AM</Text>
          </Pressable>
          <Pressable style={[tp.ampmBtn, isPM ? { backgroundColor: colors.success, borderColor: colors.success } : { backgroundColor: 'transparent', borderColor: colors.border }]}
            onPress={() => { if (hour < 12) setHour(h => h + 12); }}>
            <Text style={[tp.ampmText, { color: isPM ? colors.textLight : colors.textSecondary }]}>PM</Text>
          </Pressable>
        </View>
      </View>
      <View style={tp.btnRow}>
        <Pressable style={tp.cancelBtn} onPress={onClose}><Text style={tp.cancelText}>Cancel</Text></Pressable>
        <Pressable style={[tp.confirmBtn, { backgroundColor: colors.success }]} onPress={handleConfirm}>
          <MaterialIcons name="check" size={18} color={colors.textLight} />
          <Text style={tp.confirmText}>Set Time</Text>
        </Pressable>
      </View>
    </View>
  );
}

const inl = StyleSheet.create({
  box: { backgroundColor: colors.background, borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1.5, borderColor: colors.success + '60', marginTop: 6, marginBottom: 4 },
  display: { fontSize: 22, fontWeight: '900', color: colors.success, textAlign: 'center', marginBottom: spacing.md },
  cols: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: spacing.md },
  col: { alignItems: 'center', minWidth: 52 },
  colLabel: { fontSize: 10, color: colors.textSecondary, fontWeight: '600', marginBottom: 4 },
  colInput: { fontSize: 26, fontWeight: '900', color: colors.success, textAlign: 'center', minWidth: 44, borderBottomWidth: 2, borderBottomColor: colors.success + '80', paddingVertical: 2, backgroundColor: 'transparent' },
  arrowBtn: { padding: 2 },
});

// ─── Time Picker Modal ────────────────────────────────────────────────────────
function TimePickerModal({ visible, value, onConfirm, onClose, label }: {
  visible: boolean; value: string; onConfirm: (v: string) => void; onClose: () => void; label?: string;
}) {
  const [hour, setHour] = useState(0);
  const [minute, setMinute] = useState(0);
  React.useEffect(() => {
    if (visible) { const [h, m] = (value || '00:00').split(':').map(Number); setHour(isNaN(h) ? 0 : h); setMinute(isNaN(m) ? 0 : m); }
  }, [visible, value]);
  const isPM = hour >= 12; const h12 = hour % 12 || 12;
  const formatted = `${String(h12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`;
  const [hourText, setHourText] = React.useState(String(h12).padStart(2, '0'));
  const [minText, setMinText] = React.useState(String(minute).padStart(2, '0'));
  React.useEffect(() => { setHourText(String(h12).padStart(2, '0')); }, [hour]);
  React.useEffect(() => { setMinText(String(minute).padStart(2, '0')); }, [minute]);
  const commitH = (t: string) => { const n = parseInt(t, 10); if (!isNaN(n) && n >= 1 && n <= 12) setHour(isPM ? (n === 12 ? 12 : n + 12) : (n === 12 ? 0 : n)); else setHourText(String(h12).padStart(2, '0')); };
  const commitM = (t: string) => { const n = parseInt(t, 10); if (!isNaN(n) && n >= 0 && n <= 59) setMinute(n); else setMinText(String(minute).padStart(2, '0')); };
  const handleConfirm = () => {
    let fh = hour; let fm = minute;
    const th = parseInt(hourText, 10); const tm = parseInt(minText, 10);
    if (!isNaN(th) && th >= 1 && th <= 12) fh = isPM ? (th === 12 ? 12 : th + 12) : (th === 12 ? 0 : th);
    if (!isNaN(tm) && tm >= 0 && tm <= 59) fm = tm;
    onConfirm(`${String(fh).padStart(2, '0')}:${String(fm).padStart(2, '0')}`);
    onClose();
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={tp.overlay} onPress={onClose}>
        <Pressable style={tp.card} onPress={e => e.stopPropagation()}>
          {label ? <Text style={tp.pickerLabel}>{label}</Text> : null}
          <Text style={tp.display}>{formatted}</Text>
          <View style={tp.columns}>
            <View style={tp.col}>
              <Text style={tp.colLabel}>Hour</Text>
              <Pressable style={tp.arrowBtn} onPress={() => setHour(h => (h + 1) % 24)} hitSlop={8}><MaterialIcons name="keyboard-arrow-up" size={32} color={colors.primary} /></Pressable>
              <TextInput style={[tp.colValue, tp.colInput]} value={hourText} onChangeText={setHourText} onBlur={() => commitH(hourText)} keyboardType="number-pad" maxLength={2} selectTextOnFocus />
              <Pressable style={tp.arrowBtn} onPress={() => setHour(h => (h - 1 + 24) % 24)} hitSlop={8}><MaterialIcons name="keyboard-arrow-down" size={32} color={colors.primary} /></Pressable>
            </View>
            <Text style={tp.colon}>:</Text>
            <View style={tp.col}>
              <Text style={tp.colLabel}>Min</Text>
              <Pressable style={tp.arrowBtn} onPress={() => setMinute(m => (m + 1) % 60)} hitSlop={8}><MaterialIcons name="keyboard-arrow-up" size={32} color={colors.primary} /></Pressable>
              <TextInput style={[tp.colValue, tp.colInput]} value={minText} onChangeText={setMinText} onBlur={() => commitM(minText)} keyboardType="number-pad" maxLength={2} selectTextOnFocus />
              <Pressable style={tp.arrowBtn} onPress={() => setMinute(m => (m - 1 + 60) % 60)} hitSlop={8}><MaterialIcons name="keyboard-arrow-down" size={32} color={colors.primary} /></Pressable>
            </View>
            <View style={tp.ampmCol}>
              <Text style={tp.colLabel}>&nbsp;</Text>
              <Pressable style={[tp.ampmBtn, !isPM ? { backgroundColor: colors.primary, borderColor: colors.primary } : { backgroundColor: 'transparent', borderColor: colors.border }]} onPress={() => { if (hour >= 12) setHour(h => h - 12); }}>
                <Text style={[tp.ampmText, { color: !isPM ? colors.textLight : colors.textSecondary }]}>AM</Text>
              </Pressable>
              <Pressable style={[tp.ampmBtn, isPM ? { backgroundColor: colors.primary, borderColor: colors.primary } : { backgroundColor: 'transparent', borderColor: colors.border }]} onPress={() => { if (hour < 12) setHour(h => h + 12); }}>
                <Text style={[tp.ampmText, { color: isPM ? colors.textLight : colors.textSecondary }]}>PM</Text>
              </Pressable>
            </View>
          </View>
          <View style={tp.btnRow}>
            <Pressable style={tp.cancelBtn} onPress={onClose}><Text style={tp.cancelText}>Cancel</Text></Pressable>
            <Pressable style={tp.confirmBtn} onPress={handleConfirm}><MaterialIcons name="check" size={18} color={colors.textLight} /><Text style={tp.confirmText}>Set Time</Text></Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Date Picker Modal ────────────────────────────────────────────────────────
function DatePickerModal({ visible, value, onConfirm, onClose, label }: {
  visible: boolean; value: string; onConfirm: (v: string) => void; onClose: () => void; label?: string;
}) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [day, setDay] = useState(new Date().getDate());
  React.useEffect(() => {
    if (visible) {
      const parts = (value || '').split('-').map(Number);
      setYear(parts[0] || new Date().getFullYear()); setMonth(parts[1] || new Date().getMonth() + 1); setDay(parts[2] || new Date().getDate());
    }
  }, [visible, value]);
  const daysInMonth = new Date(year, month, 0).getDate();
  const clampedDay = Math.min(day, daysInMonth);
  const [dayText, setDayText] = React.useState(String(clampedDay).padStart(2, '0'));
  const [monthText, setMonthText] = React.useState(String(month).padStart(2, '0'));
  const [yearText, setYearText] = React.useState(String(year));
  React.useEffect(() => { setDayText(String(clampedDay).padStart(2, '0')); }, [day, month, year]);
  React.useEffect(() => { setMonthText(String(month).padStart(2, '0')); }, [month]);
  React.useEffect(() => { setYearText(String(year)); }, [year]);
  const formatted = `${String(clampedDay).padStart(2, '0')} ${MONTHS[month - 1]} ${year}`;
  const handleConfirm = () => {
    const fd = parseInt(dayText, 10);
    const fm = parseInt(monthText, 10);
    const fy = parseInt(yearText, 10);
    const finalDay = (!isNaN(fd) && fd >= 1 && fd <= daysInMonth) ? fd : day;
    const finalMonth = (!isNaN(fm) && fm >= 1 && fm <= 12) ? fm : month;
    const finalYear = (!isNaN(fy) && fy >= 2020 && fy <= 2099) ? fy : year;
    const dm = new Date(finalYear, finalMonth, 0).getDate();
    const safeD = Math.min(finalDay, dm);
    onConfirm(`${finalYear}-${String(finalMonth).padStart(2, '0')}-${String(safeD).padStart(2, '0')}`);
    onClose();
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={tp.overlay} onPress={onClose}>
        <Pressable style={tp.card} onPress={e => e.stopPropagation()}>
          {label ? <Text style={tp.pickerLabel}>{label}</Text> : null}
          <Text style={tp.display}>{formatted}</Text>
          <View style={tp.columns}>
            <View style={tp.col}>
              <Text style={tp.colLabel}>Day</Text>
              <Pressable style={tp.arrowBtn} onPress={() => setDay(d => d >= daysInMonth ? 1 : d + 1)} hitSlop={8}><MaterialIcons name="keyboard-arrow-up" size={32} color={colors.primary} /></Pressable>
              <TextInput style={[tp.colValue, tp.colInput]} value={dayText} onChangeText={setDayText} onBlur={() => { const n = parseInt(dayText, 10); if (!isNaN(n) && n >= 1 && n <= daysInMonth) setDay(n); else setDayText(String(clampedDay).padStart(2, '0')); }} keyboardType="number-pad" maxLength={2} selectTextOnFocus />
              <Pressable style={tp.arrowBtn} onPress={() => setDay(d => d <= 1 ? daysInMonth : d - 1)} hitSlop={8}><MaterialIcons name="keyboard-arrow-down" size={32} color={colors.primary} /></Pressable>
            </View>
            <View style={[tp.col, { minWidth: 52 }]}>
              <Text style={tp.colLabel}>Month (1-12)</Text>
              <Pressable style={tp.arrowBtn} onPress={() => setMonth(m => m >= 12 ? 1 : m + 1)} hitSlop={8}><MaterialIcons name="keyboard-arrow-up" size={32} color={colors.primary} /></Pressable>
              <View style={{ alignItems: 'center' }}>
                <TextInput style={[tp.colValue, tp.colInput, { fontSize: 26 }]} value={monthText} onChangeText={setMonthText} onBlur={() => { const n = parseInt(monthText, 10); if (!isNaN(n) && n >= 1 && n <= 12) setMonth(n); else setMonthText(String(month).padStart(2, '0')); }} keyboardType="number-pad" maxLength={2} selectTextOnFocus />
                <Text style={{ fontSize: 10, color: colors.textSecondary, fontWeight: '600', marginTop: 2 }}>{MONTHS[(parseInt(monthText, 10) || month) - 1] || ''}</Text>
              </View>
              <Pressable style={tp.arrowBtn} onPress={() => setMonth(m => m <= 1 ? 12 : m - 1)} hitSlop={8}><MaterialIcons name="keyboard-arrow-down" size={32} color={colors.primary} /></Pressable>
            </View>
            <View style={[tp.col, { minWidth: 72 }]}>
              <Text style={tp.colLabel}>Year</Text>
              <Pressable style={tp.arrowBtn} onPress={() => setYear(y => y + 1)} hitSlop={8}><MaterialIcons name="keyboard-arrow-up" size={32} color={colors.primary} /></Pressable>
              <TextInput style={[tp.colValue, tp.colInput, { fontSize: 24 }]} value={yearText} onChangeText={setYearText} onBlur={() => { const n = parseInt(yearText, 10); if (!isNaN(n) && n >= 2020 && n <= 2099) setYear(n); else setYearText(String(year)); }} keyboardType="number-pad" maxLength={4} selectTextOnFocus />
              <Pressable style={tp.arrowBtn} onPress={() => setYear(y => Math.max(2020, y - 1))} hitSlop={8}><MaterialIcons name="keyboard-arrow-down" size={32} color={colors.primary} /></Pressable>
            </View>
          </View>
          <View style={tp.btnRow}>
            <Pressable style={tp.cancelBtn} onPress={onClose}><Text style={tp.cancelText}>Cancel</Text></Pressable>
            <Pressable style={tp.confirmBtn} onPress={handleConfirm}><MaterialIcons name="check" size={18} color={colors.textLight} /><Text style={tp.confirmText}>Set Date</Text></Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DateField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const display = (() => { try { const [y, m, d] = value.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return value; } })();
  return (
    <>
      {label ? <Text style={modal.label}>{label}</Text> : null}
      <Pressable style={[modal.input, { flexDirection: 'row', alignItems: 'center', gap: 6 }]} onPress={() => setOpen(true)}>
        <MaterialIcons name="calendar-today" size={16} color={colors.primary} />
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{display}</Text>
      </Pressable>
      <DatePickerModal visible={open} value={value} onConfirm={onChange} onClose={() => setOpen(false)} label={label} />
    </>
  );
}

function TimeField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {label ? <Text style={pb.timeLabel}>{label}</Text> : null}
      <Pressable style={[pb.timeInput, { flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'center' }]} onPress={() => setOpen(true)}>
        <MaterialIcons name="access-time" size={14} color={colors.primary} />
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{formatTime12(value)}</Text>
      </Pressable>
      <TimePickerModal visible={open} value={value} onConfirm={onChange} onClose={() => setOpen(false)} label={label} />
    </>
  );
}

// ─── Plan Block Editor ────────────────────────────────────────────────────────
function PlanBlockEditor({ blocks, onChange, sessionColor }: { blocks: PlanBlock[]; onChange: (b: PlanBlock[]) => void; sessionColor: string }) {
  const addBlock = () => {
    const last = blocks[blocks.length - 1];
    const startT = last ? last.endTime : now12();
    const [h, m] = startT.split(':').map(Number);
    const end = new Date(2000, 0, 1, h, m + 30);
    const endT = `${end.getHours().toString().padStart(2, '0')}:${end.getMinutes().toString().padStart(2, '0')}`;
    onChange([...blocks, { id: Date.now().toString(), startTime: startT, endTime: endT, activities: ['Batting'], notes: '' }]);
  };
  const updateField = (id: string, field: keyof PlanBlock, value: any) => onChange(blocks.map(b => b.id === id ? { ...b, [field]: value } : b));
  const toggleActivity = (id: string, activity: string) => onChange(blocks.map(b => {
    if (b.id !== id) return b;
    const has = b.activities.includes(activity);
    const next = has ? b.activities.filter(a => a !== activity) : [...b.activities, activity];
    return { ...b, activities: next.length ? next : [activity] };
  }));
  return (
    <View style={pb.wrapper}>
      {blocks.map((block, idx) => (
        <View key={block.id} style={[pb.block, { borderLeftColor: sessionColor }]}>
          <View style={pb.blockHeader}>
            <Text style={[pb.blockNum, { color: sessionColor }]}>Block {idx + 1}</Text>
            <Pressable onPress={() => onChange(blocks.filter(b => b.id !== block.id))} hitSlop={6}><MaterialIcons name="remove-circle-outline" size={20} color={colors.error} /></Pressable>
          </View>
          <View style={pb.timeRow}>
            <View style={pb.timeField}><TimeField label="Start" value={block.startTime} onChange={v => updateField(block.id, 'startTime', v)} /></View>
            <MaterialIcons name="arrow-forward" size={16} color={colors.textSecondary} style={{ marginTop: 20 }} />
            <View style={pb.timeField}><TimeField label="End" value={block.endTime} onChange={v => updateField(block.id, 'endTime', v)} /></View>
          </View>
          <Text style={[pb.timeLabel, { marginTop: 6, marginBottom: 4 }]}>Activities</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 5 }}>
              {ACTIVITIES.map(a => { const sel = block.activities.includes(a); return <Pressable key={a} style={[pb.activityChip, sel && { backgroundColor: sessionColor, borderColor: sessionColor }]} onPress={() => toggleActivity(block.id, a)}><Text style={[pb.activityChipText, sel && { color: colors.textLight }]}>{a}</Text></Pressable>; })}
            </View>
          </ScrollView>
          <TextInput style={pb.blockNotes} value={block.notes} onChangeText={v => updateField(block.id, 'notes', v)} placeholder="Notes & drills…" placeholderTextColor={colors.textSecondary} multiline />
        </View>
      ))}
      <Pressable style={[pb.addBlockBtn, { borderColor: sessionColor }]} onPress={addBlock}>
        <MaterialIcons name="add-circle" size={18} color={sessionColor} />
        <Text style={[pb.addBlockText, { color: sessionColor }]}>Add Training Block</Text>
      </Pressable>
    </View>
  );
}

const pb = StyleSheet.create({
  wrapper: { gap: spacing.sm },
  block: { backgroundColor: colors.background, borderRadius: borderRadius.md, borderLeftWidth: 3, padding: spacing.sm, gap: spacing.xs },
  blockHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  blockNum: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  timeRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  timeField: { minWidth: 64 },
  timeLabel: { fontSize: 10, color: colors.textSecondary, fontWeight: '600', marginBottom: 2 },
  timeInput: { backgroundColor: colors.surface, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 8, paddingVertical: 6, fontSize: 14, color: colors.text, fontWeight: '700', textAlign: 'center', width: 64 },
  activityChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  activityChipText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  blockNotes: { backgroundColor: colors.surface, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm, paddingVertical: 6, fontSize: 13, color: colors.text, minHeight: 36, marginTop: 4 },
  addBlockBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderRadius: borderRadius.md, borderStyle: 'dashed', paddingVertical: 10 },
  addBlockText: { fontSize: 13, fontWeight: '700' },
});

// ─── Session Card ─────────────────────────────────────────────────────────────
function SessionCard({ entry, isCoach, academyId, userId, today, router, onEditAcademy, onEditPersonal, memberPosition }: {
  entry: ScheduleEntry; isCoach: boolean; academyId: string; userId: string; today: string;
  router: any; onEditAcademy: (s: AcademySession) => void; onEditPersonal: (entry: ScheduleEntry) => void;
  memberPosition?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const color = typeColor(entry.sessionType);
  const isToday = entry.date === today;
  const isPast = entry.date < today;
  const isMissed = isPast && !isCoach;
  const isDone = isPast && isCoach;
  const isAcademy = entry.source === 'academy';
  const isPersonal = entry.source === 'personal';
  const canEdit = isCoach ? isAcademy : (isPersonal && entry.createdBy === userId);
  const planBlocks = parsePlanBlocks(entry.notes);
  const objectives = parseObjectives(entry.notes);
  const coachNotes = parseCoachNotes(entry.notes);
  const hasPlan = planBlocks.length > 0 || objectives.length > 0 || !!coachNotes;
  const sourceC = SOURCE_COLORS[entry.source];
  const stripeColor = isMissed ? colors.error : isPersonal ? colors.success : color;

  return (
    <Pressable style={[styles.sessionCard, isToday && styles.sessionCardToday, isMissed && styles.sessionCardMissed, isDone && styles.sessionCardPast]} onPress={() => setExpanded(e => !e)} activeOpacity={0.85}>
      <View style={[styles.sessionStripe, { backgroundColor: isMissed ? colors.error : isDone ? colors.border : stripeColor }]} />
      <View style={styles.sessionContent}>
        <View style={styles.sessionTop}>
          <View style={{ flex: 1 }}>
            <View style={styles.sessionTitleRow}>
              <Text style={[styles.sessionTitle, isMissed && { color: colors.error }, isDone && { color: colors.textSecondary }]}>{entry.title}</Text>
              {isToday && <View style={styles.todayBadge}><Text style={styles.todayBadgeText}>TODAY</Text></View>}
              {isMissed && <View style={styles.missedBadge}><MaterialIcons name="cancel" size={12} color={colors.textLight} /><Text style={styles.missedBadgeText}>MISSED</Text></View>}
              {isDone && <View style={styles.doneBadge}><MaterialIcons name="check-circle" size={12} color={colors.success} /><Text style={styles.doneBadgeText}>Done</Text></View>}
            </View>
            <Text style={styles.sessionMeta}>{formatDateReadable(entry.date)} · {formatTime12(entry.time)}{entry.location ? ` · ${entry.location}` : ''}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <View style={[styles.typeBadge, { backgroundColor: isPast ? colors.border : color + '20' }]}>
              <Text style={[styles.typeBadgeText, { color: isPast ? colors.textSecondary : color }]}>{entry.sessionType}</Text>
            </View>
            <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={18} color={colors.textSecondary} />
          </View>
        </View>
        <View style={styles.sourceBadgeRow}>
          <View style={[styles.sourceBadge, { backgroundColor: sourceC.bg, borderColor: sourceC.border }]}>
            <MaterialIcons name={isAcademy ? 'shield' : 'person'} size={10} color={sourceC.text} />
            <Text style={[styles.sourceBadgeText, { color: sourceC.text }]}>{isAcademy ? 'Academy Session' : 'Personal Session'}</Text>
          </View>
        </View>
        {!expanded && planBlocks.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.xs }}>
            <View style={{ flexDirection: 'row', gap: 5 }}>
              {planBlocks.map(b => (
                <View key={b.id} style={[styles.blockPreviewChip, { backgroundColor: color + '15', borderColor: color + '40' }]}>
                  <Text style={[styles.blockPreviewTime, { color }]}>{formatTime12(b.startTime)}</Text>
                  <Text style={[styles.blockPreviewActivity, { color }]}>{(b.activities?.length ? b.activities : ['Training']).join(' + ')}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
        {expanded && hasPlan && (
          <View style={styles.planContainer}>
            {objectives.length > 0 && (
              <View style={styles.planSection}>
                <View style={styles.planSectionHeader}><MaterialIcons name="flag" size={14} color={colors.warning} /><Text style={[styles.planSectionTitle, { color: colors.warning }]}>Session Objectives</Text></View>
                {objectives.map((o, i) => (
                  <View key={i} style={styles.objRow}>
                    <View style={[styles.objNum, { backgroundColor: colors.warning }]}><Text style={styles.objNumText}>{i + 1}</Text></View>
                    <Text style={styles.objText}>{o}</Text>
                  </View>
                ))}
              </View>
            )}
            {planBlocks.length > 0 && (
              <View style={styles.planSection}>
                <View style={styles.planSectionHeader}><MaterialIcons name="schedule" size={14} color={color} /><Text style={[styles.planSectionTitle, { color }]}>Training Plan</Text></View>
                {planBlocks.map((b, i) => (
                  <View key={b.id} style={[styles.planBlockRow, i < planBlocks.length - 1 && styles.planBlockRowBorder]}>
                    <View style={[styles.planBlockTimeCol, { backgroundColor: color + '12' }]}>
                      <Text style={[styles.planBlockTime, { color }]}>{formatTime12(b.startTime)}</Text>
                      <Text style={styles.planBlockArrow}>↓</Text>
                      <Text style={[styles.planBlockTime, { color }]}>{formatTime12(b.endTime)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.planBlockActivity}>{(b.activities?.length ? b.activities : ['Training']).join(' + ')}</Text>
                      {b.notes ? <Text style={styles.planBlockNotes}>{b.notes}</Text> : null}
                    </View>
                  </View>
                ))}
              </View>
            )}
            {coachNotes ? (
              <View style={styles.planSection}>
                <View style={styles.planSectionHeader}><MaterialIcons name="notes" size={14} color={colors.textSecondary} /><Text style={[styles.planSectionTitle, { color: colors.textSecondary }]}>Coach Notes</Text></View>
                <Text style={styles.coachNoteText}>{coachNotes}</Text>
              </View>
            ) : null}
          </View>
        )}
        {!isCoach && !isPast && (
          <Pressable style={[styles.startSessionBtn, isPersonal && { backgroundColor: colors.success }]}
            onPress={() => router.push({ pathname: '/academy-log', params: { academyId, position: memberPosition || 'Batsman', isAcademyMember: 'true' } } as any)}>
            <MaterialIcons name="play-circle-filled" size={18} color={colors.textLight} />
            <Text style={styles.startSessionBtnText}>Start Session</Text>
          </Pressable>
        )}
        {!isCoach && isMissed && (
          <Pressable style={styles.logLateBtn}
            onPress={() => router.push({ pathname: '/academy-log', params: { academyId, position: memberPosition || 'Batsman', isAcademyMember: 'true' } } as any)}>
            <MaterialIcons name="edit" size={16} color={colors.textLight} />
            <Text style={styles.logLateBtnText}>Log Late — Did this session?</Text>
          </Pressable>
        )}
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginTop: spacing.xs }}>
          {isCoach && isAcademy && !isPast && (
            <Pressable style={styles.actionBtn} onPress={() => router.push({ pathname: '/academy-attendance', params: { academyId } } as any)}>
              <MaterialIcons name="fact-check" size={13} color={colors.primary} /><Text style={styles.actionBtnText}>Attendance</Text>
            </Pressable>
          )}
          {canEdit && (
            <Pressable style={[styles.actionBtn, { backgroundColor: colors.warning + '15' }]}
              onPress={() => { if (isCoach && isAcademy && entry.rawAcademy) onEditAcademy(entry.rawAcademy); else onEditPersonal(entry); }}>
              <MaterialIcons name="edit" size={13} color={colors.warning} /><Text style={[styles.actionBtnText, { color: colors.warning }]}>Edit</Text>
            </Pressable>
          )}
          {!isCoach && isAcademy && expanded && (
            <View style={[styles.actionBtn, { backgroundColor: colors.border + '60' }]}>
              <MaterialIcons name="lock-outline" size={13} color={colors.textSecondary} /><Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>Coach-managed session</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// ─── Edit Academy Session Modal ────────────────────────────────────────────────
function EditAcademySessionModal({ visible, session, onClose, onSaved }: {
  visible: boolean; session: AcademySession | null; onClose: () => void; onSaved: () => void;
}) {
  const { showAlert } = useAlert();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayStr());
  const [time, setTime] = useState(now12());
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [objectives, setObjectives] = useState<string[]>(['', '']);
  const [planBlocks, setPlanBlocks] = useState<PlanBlock[]>([]);
  const [saving, setSaving] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const sessionColor = colors.primary;

  React.useEffect(() => {
    if (session && visible) {
      setTitle(session.title); setDate(session.session_date); setTime(session.session_time);
      setLocation(session.location || ''); setNotes(parseCoachNotes(session.notes));
      const objs = parseObjectives(session.notes);
      setObjectives(objs.length ? objs : ['', '']);
      setPlanBlocks(parsePlanBlocks(session.notes));
    }
  }, [session, visible]);

  const handleSave = async () => {
    if (!session) return;
    if (!title.trim()) { showAlert('Error', 'Session title is required'); return; }
    setSaving(true);
    const { error } = await academyService.updateSession(session.id, {
      title: title.trim(), session_date: date, session_time: time,
      location: location.trim() || undefined,
      notes: buildNotes(notes, objectives, planBlocks) || undefined,
    });
    setSaving(false);
    if (error) { showAlert('Error', error); return; }
    onClose(); onSaved();
    showAlert('Saved', 'Session updated successfully.');
  };

  if (!session) return null;
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={modal.overlay}>
        <View style={modal.sheet}>
          <View style={modal.handle} />
          <View style={modal.header}>
            <Text style={modal.headerTitle}>Edit Session</Text>
            <Pressable onPress={onClose} style={modal.closeBtn}><MaterialIcons name="close" size={22} color={colors.text} /></Pressable>
          </View>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={modal.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              <View style={modal.sectionBlock}>
                <View style={modal.sectionHeader}><MaterialIcons name="event" size={16} color={sessionColor} /><Text style={modal.sectionTitle}>Session Details</Text></View>
                <Text style={modal.label}>Title *</Text>
                <TextInput style={modal.input} value={title} onChangeText={setTitle} placeholder="e.g. Tuesday Nets" placeholderTextColor={colors.textSecondary} />
                <DateField label="Date" value={date} onChange={setDate} />
                <Text style={modal.label}>Time</Text>
                <Pressable style={[modal.input, { flexDirection: 'row', alignItems: 'center', gap: 6 }]} onPress={() => setShowTimePicker(true)}>
                  <MaterialIcons name="access-time" size={16} color={sessionColor} />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{formatTime12(time)}</Text>
                </Pressable>
                <TimePickerModal visible={showTimePicker} value={time} onConfirm={setTime} onClose={() => setShowTimePicker(false)} label="Session Time" />
                <Text style={modal.label}>Location (Optional)</Text>
                <TextInput style={modal.input} value={location} onChangeText={setLocation} placeholder="e.g. Main Oval" placeholderTextColor={colors.textSecondary} />
              </View>
              <View style={modal.sectionBlock}>
                <View style={modal.sectionHeader}><MaterialIcons name="flag" size={16} color={colors.warning} /><Text style={[modal.sectionTitle, { color: colors.warning }]}>Objectives</Text></View>
                {objectives.map((obj, i) => (
                  <View key={i} style={modal.objRow}>
                    <View style={[modal.objNum, { backgroundColor: colors.warning }]}><Text style={modal.objNumText}>{i + 1}</Text></View>
                    <TextInput style={[modal.input, { flex: 1 }]} value={obj} onChangeText={v => { const arr = [...objectives]; arr[i] = v; setObjectives(arr); }} placeholder={`Objective ${i + 1}…`} placeholderTextColor={colors.textSecondary} />
                    {i === objectives.length - 1 && <Pressable onPress={() => setObjectives(o => [...o, ''])} hitSlop={6}><MaterialIcons name="add-circle" size={22} color={colors.warning} /></Pressable>}
                  </View>
                ))}
              </View>
              <View style={modal.sectionBlock}>
                <View style={modal.sectionHeader}><MaterialIcons name="schedule" size={16} color={sessionColor} /><Text style={modal.sectionTitle}>Training Plan</Text></View>
                <PlanBlockEditor blocks={planBlocks} onChange={setPlanBlocks} sessionColor={sessionColor} />
              </View>
              <View style={modal.sectionBlock}>
                <View style={modal.sectionHeader}><MaterialIcons name="notes" size={16} color={colors.textSecondary} /><Text style={modal.sectionTitle}>Coach Notes</Text></View>
                <TextInput style={[modal.input, { minHeight: 64, textAlignVertical: 'top' }]} value={notes} onChangeText={setNotes} multiline placeholder="Anything players should know…" placeholderTextColor={colors.textSecondary} />
              </View>
              <Pressable style={[modal.submitBtn, { backgroundColor: sessionColor, marginTop: spacing.md, marginBottom: spacing.xl }, saving && { opacity: 0.6 }]} onPress={handleSave}>
                {saving ? <ActivityIndicator color={colors.textLight} /> : <><MaterialIcons name="save" size={18} color={colors.textLight} /><Text style={modal.submitBtnText}>Save Changes</Text></>}
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Personal Session Modal ────────────────────────────────────────────────────
function PersonalSessionModal({ visible, editEntry, userId, onClose, onSaved }: {
  visible: boolean; editEntry: ScheduleEntry | null; userId: string; onClose: () => void; onSaved: () => void;
}) {
  const { showAlert } = useAlert();
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(todayStr());
  const [time, setTime] = useState(now12());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  React.useEffect(() => {
    if (visible) {
      if (editEntry) { setTitle(editEntry.title); setDate(editEntry.date); setTime(editEntry.time); setNotes(editEntry.notes || ''); }
      else { setTitle(''); setDate(todayStr()); setTime(now12()); setNotes(''); }
      setShowDatePicker(false); setShowTimePicker(false);
    }
  }, [visible, editEntry]);

  const displayDate = (() => { try { const [y, m, d] = date.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return date; } })();

  const handleSave = async () => {
    if (!title.trim()) { showAlert('Error', 'Please enter a title'); return; }
    setSaving(true);
    const supabase = getSupabaseClient();
    const scheduledDate = `${date}T${time}:00`;
    if (editEntry?.rawPersonalId) {
      const { error } = await supabase.from('sessions').update({ title: title.trim(), scheduled_date: scheduledDate, notes: notes || null }).eq('id', editEntry.rawPersonalId).eq('user_id', userId);
      setSaving(false);
      if (error) { showAlert('Error', error.message); return; }
    } else {
      const { error } = await supabase.from('sessions').insert({ user_id: userId, title: title.trim(), scheduled_date: scheduledDate, session_type: 'Structured', status: 'planned', notes: notes || null });
      setSaving(false);
      if (error) { showAlert('Error', error.message); return; }
    }
    onClose(); onSaved();
    showAlert('Saved', editEntry ? 'Personal session updated.' : 'Personal session added to your schedule.');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={modal.overlay}>
        <View style={modal.sheet}>
          <View style={modal.handle} />
          <View style={modal.header}>
            <Text style={modal.headerTitle}>{editEntry ? 'Edit Personal Session' : 'Add Personal Session'}</Text>
            <Pressable onPress={onClose} style={modal.closeBtn}><MaterialIcons name="close" size={22} color={colors.text} /></Pressable>
          </View>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={modal.content} keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
              <View style={[modal.sectionBlock, { backgroundColor: colors.success + '10', borderColor: colors.success + '30' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <MaterialIcons name="person" size={16} color={colors.success} />
                  <Text style={{ fontSize: 12, color: colors.success, fontWeight: '700' }}>Personal Session</Text>
                </View>
                <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 17 }}>This session is only visible to you. Academy sessions are created by your coach.</Text>
              </View>
              <View style={modal.sectionBlock}>
                <View style={modal.sectionHeader}><MaterialIcons name="event" size={16} color={colors.success} /><Text style={modal.sectionTitle}>Session Details</Text></View>
                <Text style={modal.label}>Title *</Text>
                <TextInput style={modal.input} value={title} onChangeText={setTitle} placeholder="e.g. Solo batting practice" placeholderTextColor={colors.textSecondary} />
                <Text style={[modal.label, { marginTop: spacing.sm }]}>Date</Text>
                <Pressable style={[modal.input, { flexDirection: 'row', alignItems: 'center', gap: 6 }]} onPress={() => { setShowTimePicker(false); setShowDatePicker(v => !v); }}>
                  <MaterialIcons name="calendar-today" size={16} color={colors.success} />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, flex: 1 }}>{displayDate}</Text>
                  <MaterialIcons name={showDatePicker ? 'expand-less' : 'expand-more'} size={16} color={colors.textSecondary} />
                </Pressable>
                {showDatePicker && <InlineDatePicker value={date} onChange={(v) => { setDate(v); setShowDatePicker(false); }} onClose={() => setShowDatePicker(false)} />}
                <Text style={[modal.label, { marginTop: spacing.sm }]}>Time</Text>
                <Pressable style={[modal.input, { flexDirection: 'row', alignItems: 'center', gap: 6 }]} onPress={() => { setShowDatePicker(false); setShowTimePicker(v => !v); }}>
                  <MaterialIcons name="access-time" size={16} color={colors.success} />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, flex: 1 }}>{formatTime12(time)}</Text>
                  <MaterialIcons name={showTimePicker ? 'expand-less' : 'expand-more'} size={16} color={colors.textSecondary} />
                </Pressable>
                {showTimePicker && <InlineTimePicker value={time} onChange={(v) => { setTime(v); setShowTimePicker(false); }} onClose={() => setShowTimePicker(false)} />}
                <Text style={[modal.label, { marginTop: spacing.sm }]}>Notes (Optional)</Text>
                <TextInput style={[modal.input, { minHeight: 64, textAlignVertical: 'top' }]} value={notes} onChangeText={setNotes} multiline placeholder="What do you plan to work on?" placeholderTextColor={colors.textSecondary} />
              </View>
              <Pressable style={[modal.submitBtn, { backgroundColor: colors.success, marginTop: spacing.md, marginBottom: spacing.xl }, saving && { opacity: 0.6 }]} onPress={handleSave}>
                {saving ? <ActivityIndicator color={colors.textLight} /> : <><MaterialIcons name="save" size={18} color={colors.textLight} /><Text style={modal.submitBtnText}>{editEntry ? 'Save Changes' : 'Add to Schedule'}</Text></>}
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Monthly Calendar View ────────────────────────────────────────────────────
// Dots match the legend: green filled = Completed, red filled = Missed, outlined = Upcoming (blue=academy, green=personal)
function MonthlyCalendar({ entries, isCoach, today, loggedDates, onDayPress }: {
  entries: ScheduleEntry[];
  isCoach: boolean;
  today: string;
  loggedDates: Set<string>;
  onDayPress: (dateStr: string, dayEntries: ScheduleEntry[]) => void;
}) {
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());

  const firstDay = new Date(calYear, calMonth, 1);
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const startDow = (firstDay.getDay() + 6) % 7;

  const entriesByDate: Record<string, ScheduleEntry[]> = {};
  entries.forEach(e => {
    if (!entriesByDate[e.date]) entriesByDate[e.date] = [];
    entriesByDate[e.date].push(e);
  });

  const prevMonth = () => { if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); } else setCalMonth(m => m - 1); };
  const nextMonth = () => { if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); } else setCalMonth(m => m + 1); };

  const DAYS_HDR = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const cells: (number | null)[] = [...Array(startDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View style={cal.container}>
      <View style={cal.navRow}>
        <Pressable onPress={prevMonth} style={cal.navBtn} hitSlop={8}><MaterialIcons name="chevron-left" size={26} color={colors.primary} /></Pressable>
        <Text style={cal.monthLabel}>{MONTHS[calMonth]} {calYear}</Text>
        <Pressable onPress={nextMonth} style={cal.navBtn} hitSlop={8}><MaterialIcons name="chevron-right" size={26} color={colors.primary} /></Pressable>
      </View>
      <View style={cal.daysHeader}>
        {DAYS_HDR.map((d, i) => <Text key={i} style={cal.dayHdr}>{d}</Text>)}
      </View>
      <View style={cal.grid}>
        {cells.map((day, idx) => {
          if (!day) return <View key={String(idx)} style={cal.cell} />;
          const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayEntries = entriesByDate[dateStr] || [];
          const isToday = dateStr === today;
          const hasSessions = dayEntries.length > 0;
          const isFuture = dateStr > today;
          const isPast = dateStr < today;
          const isCompleted = loggedDates.has(dateStr);

          return (
            <Pressable
              key={String(idx)}
              style={[cal.cell, isToday && cal.cellToday, hasSessions && !isToday && cal.cellHasSessions]}
              onPress={() => hasSessions && onDayPress(dateStr, dayEntries)}
              disabled={!hasSessions}
            >
              <Text style={[cal.dayNum, isToday && cal.dayNumToday, isPast && !hasSessions && cal.dayNumPast, isFuture && !hasSessions && cal.dayNumFuture]}>{day}</Text>
              {dayEntries.length > 0 && (
                <View style={cal.dotsRow}>
                  {dayEntries.slice(0, 3).map((e, di) => {
                    // Match legend: Completed=green filled, Missed=red filled, Upcoming=outlined dot
                    if (isFuture || isToday) {
                      // Upcoming: outlined ring (blue for academy, green for personal)
                      const ringColor = e.source === 'personal' ? colors.success : colors.primary;
                      return <View key={di} style={[cal.dot, { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: ringColor }]} />;
                    } else if (isPast) {
                      // Past: green if logged (completed), red if not (missed)
                      return <View key={di} style={[cal.dot, { backgroundColor: isCompleted ? colors.success : colors.error }]} />;
                    }
                    return <View key={di} style={[cal.dot, { backgroundColor: colors.border }]} />;
                  })}
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
      {/* Calendar legend matching the list view legend */}
      <View style={[cal.legendRow, { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.md }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={[cal.dot, { backgroundColor: colors.success }]} />
          <Text style={cal.legendHint}>Completed</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={[cal.dot, { backgroundColor: colors.error }]} />
          <Text style={cal.legendHint}>Missed</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={[cal.dot, { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.primary }]} />
          <Text style={cal.legendHint}>Upcoming</Text>
        </View>
      </View>
    </View>
  );
}

const cal = StyleSheet.create({
  container: { backgroundColor: colors.surface, borderRadius: borderRadius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  navBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  monthLabel: { fontSize: 17, fontWeight: '800', color: colors.text },
  daysHeader: { flexDirection: 'row', marginBottom: 4 },
  dayHdr: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 0.9, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  cellToday: { backgroundColor: colors.primary + '15', borderRadius: borderRadius.md },
  cellHasSessions: { backgroundColor: colors.background, borderRadius: borderRadius.md },
  dayNum: { fontSize: 13, fontWeight: '600', color: colors.text },
  dayNumToday: { color: colors.primary, fontWeight: '900' },
  dayNumPast: { color: colors.textSecondary },
  dayNumFuture: { color: colors.text },
  dotsRow: { flexDirection: 'row', gap: 2, marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  legendRow: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  legendHint: { fontSize: 10, color: colors.textSecondary, fontWeight: '600' },
});

// ─── Day Sessions Bottom Sheet ─────────────────────────────────────────────────
function DaySessionsModal({ visible, dateStr, entries, onClose, router, academyId, isCoach, memberPosition }: {
  visible: boolean; dateStr: string; entries: ScheduleEntry[]; onClose: () => void;
  router: any; academyId: string; isCoach: boolean; memberPosition?: string;
}) {
  const formattedDate = (() => { try { const [y, m, d] = dateStr.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' }); } catch { return dateStr; } })();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '70%' }}>
          <View style={{ width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 10 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{formattedDate}</Text>
            <Pressable onPress={onClose} hitSlop={8}><MaterialIcons name="close" size={22} color={colors.text} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 40, gap: spacing.sm }} showsVerticalScrollIndicator={false}>
            {entries.map(e => {
              const color = typeColor(e.sessionType);
              const [hh, mm] = (e.time || '10:00').split(':').map(Number);
              const period = hh >= 12 ? 'PM' : 'AM'; const h12 = hh % 12 || 12;
              const timeStr = `${h12}:${String(mm).padStart(2, '0')} ${period}`;
              return (
                <View key={e.id} style={{ backgroundColor: colors.background, borderRadius: borderRadius.lg, padding: spacing.md, borderLeftWidth: 3, borderLeftColor: color, borderWidth: 1, borderColor: colors.border, gap: spacing.xs }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>{e.title}</Text>
                      <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{timeStr}{e.location ? ` · ${e.location}` : ''}</Text>
                    </View>
                    <View style={{ backgroundColor: color + '20', borderRadius: borderRadius.sm, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ fontSize: 10, fontWeight: '800', color }}>{e.sessionType}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <MaterialIcons name={e.source === 'academy' ? 'shield' : 'person'} size={11} color={e.source === 'academy' ? colors.primary : colors.success} />
                    <Text style={{ fontSize: 10, color: e.source === 'academy' ? colors.primary : colors.success, fontWeight: '700' }}>{e.source === 'academy' ? 'Academy' : 'Personal'}</Text>
                  </View>
                  {!isCoach && (
                    <Pressable style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: borderRadius.md, paddingVertical: spacing.sm, marginTop: 4 }}
                      onPress={() => { onClose(); router.push({ pathname: '/academy-log', params: { academyId, position: memberPosition || 'Batsman', isAcademyMember: 'true' } } as any); }}>
                      <MaterialIcons name="play-circle-filled" size={16} color={colors.textLight} />
                      <Text style={{ fontSize: 13, fontWeight: '800', color: colors.textLight }}>Log This Session</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── AI Session Planner Modal ───────────────────────────────────────────────
function AIPlannerModal({ visible, sessionColor, onApply, onClose }: {
  visible: boolean;
  sessionColor: string;
  onApply: (title: string, objectives: string[], blocks: PlanBlock[], coachNotes: string) => void;
  onClose: () => void;
}) {
  const [sessionType, setSessionType] = useState('Training');
  const [duration, setDuration] = useState('90');
  const [level, setLevel] = useState('Mixed');
  const [focusArea, setFocusArea] = useState('');
  const [squadSize, setSquadSize] = useState('12');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const SESSION_TYPES = ['Training', 'Batting', 'Bowling', 'Fielding', 'Fitness', 'Match Sim'];
  const LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Mixed'];

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    try {
      const supabase = getSupabaseClient();
      const { data, error: fnErr } = await supabase.functions.invoke('ai-session-planner', {
        body: {
          sessionType,
          durationMinutes: parseInt(duration, 10) || 90,
          playerLevel: level,
          focusArea: focusArea.trim() || sessionType,
          squadSize,
          additionalNotes: notes.trim() || undefined,
        },
      });
      if (fnErr || !data?.plan) {
        setError('AI generation failed. Please try again.');
        setLoading(false);
        return;
      }
      const plan = data.plan;
      const startTime = now12();
      const [baseH, baseM] = startTime.split(':').map(Number);
      const planBlocks: PlanBlock[] = (plan.blocks || []).map((b: any, i: number) => {
        const startMins = (baseH * 60 + baseM) + (b.startOffset || 0);
        const endMins = startMins + (b.durationMinutes || 15);
        const fmt = (m: number) => {
          const h = Math.floor(m / 60) % 24;
          const mn = m % 60;
          return `${String(h).padStart(2, '0')}:${String(mn).padStart(2, '0')}`;
        };
        return {
          id: `ai_${i}_${Date.now()}`,
          startTime: fmt(startMins),
          endTime: fmt(endMins),
          activities: Array.isArray(b.activities) ? b.activities : ['Batting'],
          notes: [b.drills, b.coachingPoints].filter(Boolean).join('\n'),
        };
      });
      onApply(
        plan.title || sessionType,
        (plan.objectives || []).filter(Boolean),
        planBlocks,
        plan.coachNotes || '',
      );
      onClose();
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
    }
    setLoading(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={aiPlanStyles.overlay}>
        <View style={aiPlanStyles.sheet}>
          <View style={aiPlanStyles.handle} />
          <View style={aiPlanStyles.header}>
            <View style={aiPlanStyles.headerLeft}>
              <View style={[aiPlanStyles.aiIcon, { backgroundColor: sessionColor + '20' }]}>
                <MaterialIcons name="auto-awesome" size={18} color={sessionColor} />
              </View>
              <Text style={aiPlanStyles.headerTitle}>AI Session Planner</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}><MaterialIcons name="close" size={22} color={colors.text} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={aiPlanStyles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={aiPlanStyles.desc}>
              Describe your session and AI will generate objectives, training blocks, and drill suggestions instantly.
            </Text>

            <Text style={aiPlanStyles.label}>Session Focus</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: spacing.sm }}>
                {SESSION_TYPES.map(t => (
                  <Pressable key={t} style={[aiPlanStyles.chip, sessionType === t && { backgroundColor: sessionColor, borderColor: sessionColor }]} onPress={() => setSessionType(t)}>
                    <Text style={[aiPlanStyles.chipText, sessionType === t && { color: colors.textLight }]}>{t}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <Text style={aiPlanStyles.label}>Player Level</Text>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: spacing.sm }}>
              {LEVELS.map(l => (
                <Pressable key={l} style={[aiPlanStyles.chip, level === l && { backgroundColor: sessionColor, borderColor: sessionColor }]} onPress={() => setLevel(l)}>
                  <Text style={[aiPlanStyles.chipText, level === l && { color: colors.textLight }]}>{l}</Text>
                </Pressable>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={aiPlanStyles.label}>Duration (mins)</Text>
                <TextInput style={aiPlanStyles.input} value={duration} onChangeText={setDuration} keyboardType="number-pad" maxLength={3} placeholder="90" placeholderTextColor={colors.textSecondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={aiPlanStyles.label}>Squad Size</Text>
                <TextInput style={aiPlanStyles.input} value={squadSize} onChangeText={setSquadSize} keyboardType="number-pad" maxLength={3} placeholder="12" placeholderTextColor={colors.textSecondary} />
              </View>
            </View>

            <Text style={aiPlanStyles.label}>Specific Focus (Optional)</Text>
            <TextInput style={aiPlanStyles.input} value={focusArea} onChangeText={setFocusArea} placeholder="e.g. Cover drive, yorker bowling, slip catching..." placeholderTextColor={colors.textSecondary} />

            <Text style={aiPlanStyles.label}>Additional Notes (Optional)</Text>
            <TextInput style={[aiPlanStyles.input, { minHeight: 56, textAlignVertical: 'top' }]} value={notes} onChangeText={setNotes} multiline placeholder="e.g. Match tomorrow, work on confidence under pressure..." placeholderTextColor={colors.textSecondary} />

            {error ? (
              <View style={aiPlanStyles.errorBox}>
                <MaterialIcons name="error-outline" size={16} color={colors.error} />
                <Text style={aiPlanStyles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable style={[aiPlanStyles.generateBtn, { backgroundColor: sessionColor }, loading && { opacity: 0.65 }]} onPress={handleGenerate} disabled={loading}>
              {loading ? (
                <><ActivityIndicator color={colors.textLight} /><Text style={aiPlanStyles.generateBtnText}>Generating Plan...</Text></>
              ) : (
                <><MaterialIcons name="auto-awesome" size={20} color={colors.textLight} /><Text style={aiPlanStyles.generateBtnText}>Generate Session Plan</Text></>
              )}
            </Pressable>
            <Text style={aiPlanStyles.aiNote}>AI fills in title, objectives and training blocks. You can edit everything after.</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const aiPlanStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  aiIcon: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { ...typography.h4, color: colors.text, fontWeight: '700' },
  content: { padding: spacing.md, paddingBottom: 48, gap: spacing.xs },
  desc: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginBottom: spacing.sm },
  label: { fontSize: 12, color: colors.text, fontWeight: '700', marginBottom: 5, marginTop: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: borderRadius.full, backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.border },
  chipText: { fontSize: 12, color: colors.text, fontWeight: '700' },
  input: { backgroundColor: colors.background, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 14, color: colors.text },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.error + '12', borderRadius: borderRadius.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.error + '40' },
  errorText: { fontSize: 12, color: colors.error, flex: 1 },
  generateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md + 2, borderRadius: borderRadius.md, marginTop: spacing.md },
  generateBtnText: { fontSize: 16, color: colors.textLight, fontWeight: '700' },
  aiNote: { fontSize: 11, color: colors.textSecondary, textAlign: 'center', lineHeight: 16, marginTop: 6 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AcademyScheduleScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const { showAlert } = useAlert();

  const academyId = params.academyId as string;
  const isCoach = params.isCoach === 'true';
  const memberPosition = (params.memberPosition as string) || 'Batsman';

  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [squads, setSquads] = useState<AcademySquad[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [squadFilter, setSquadFilter] = useState<string | null>(null);
  // Logged dates for calendar status coloring (player only)
  const [loggedDates, setLoggedDates] = useState<Set<string>>(new Set());

  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selectedCalDate, setSelectedCalDate] = useState('');
  const [selectedCalEntries, setSelectedCalEntries] = useState<ScheduleEntry[]>([]);
  const [showDayModal, setShowDayModal] = useState(false);

  const [showCreateCoach, setShowCreateCoach] = useState(false);
  const [editingAcademySession, setEditingAcademySession] = useState<AcademySession | null>(null);
  const [showEditAcademy, setShowEditAcademy] = useState(false);
  const [editingPersonalEntry, setEditingPersonalEntry] = useState<ScheduleEntry | null>(null);
  const [showPersonalModal, setShowPersonalModal] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState(todayStr());
  const [newTime, setNewTime] = useState(now12());
  const [newLocation, setNewLocation] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newPlanBlocks, setNewPlanBlocks] = useState<PlanBlock[]>([]);
  const [newObjectives, setNewObjectives] = useState<string[]>(['', '']);
  const [newSquadId, setNewSquadId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showCreateTimePicker, setShowCreateTimePicker] = useState(false);
  const [showAIPlanner, setShowAIPlanner] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [sessRes, squadsRes] = await Promise.all([
      academyService.getAcademySessions(academyId),
      academyService.getSquads(academyId),
    ]);
    setSquads(squadsRes.data || []);

    const academyEntries: ScheduleEntry[] = (sessRes.data || []).map(s => ({
      id: `academy_${s.id}`,
      source: 'academy' as const,
      title: s.title,
      date: s.session_date,
      time: s.session_time,
      location: s.location,
      sessionType: s.session_type,
      notes: s.notes,
      squadId: (s as any).squad_id,
      createdBy: (s as any).created_by,
      rawAcademy: s,
    }));

    let personalEntries: ScheduleEntry[] = [];
    if (!isCoach) {
      try {
        const supabase = getSupabaseClient();
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - 30);
        const { data: personalSessions } = await supabase
          .from('sessions')
          .select('id, title, scheduled_date, session_type, status, notes, user_id')
          .eq('user_id', user.id)
          .gte('scheduled_date', fromDate.toISOString())
          .order('scheduled_date', { ascending: true });
        personalEntries = (personalSessions || []).map(s => {
          const dt = new Date(s.scheduled_date);
          const dateStr = dt.toISOString().split('T')[0];
          const timeStr = `${dt.getHours().toString().padStart(2, '0')}:${dt.getMinutes().toString().padStart(2, '0')}`;
          return { id: `personal_${s.id}`, source: 'personal' as const, title: s.title, date: dateStr, time: timeStr, sessionType: s.session_type, notes: s.notes || undefined, createdBy: s.user_id, rawPersonalId: s.id };
        });

        // Fetch logged dates for calendar dot coloring
        const { data: logs } = await supabase
          .from('academy_training_logs')
          .select('log_date')
          .eq('user_id', user.id)
          .eq('academy_id', academyId);
        setLoggedDates(new Set((logs || []).map((l: any) => l.log_date)));
      } catch (_) {}
    }

    setEntries([...academyEntries, ...personalEntries]);
    setLoading(false);
  }, [user, academyId, isCoach]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const resetCoachForm = () => {
    setNewTitle(''); setNewDate(todayStr()); setNewTime(now12());
    setNewLocation(''); setNewNotes(''); setNewPlanBlocks([]); setNewObjectives(['', '']); setNewSquadId(null);
  };

  const handleCreate = async () => {
    if (!user) return;
    if (!newTitle.trim()) { showAlert('Error', 'Please enter a session title'); return; }
    setCreating(true);
    const { error } = await academyService.createSession({
      academy_id: academyId, title: newTitle.trim(), session_date: newDate,
      session_time: newTime, location: newLocation.trim() || undefined,
      session_type: 'Training', notes: buildNotes(newNotes, newObjectives, newPlanBlocks) || undefined,
      created_by: user.id, squad_id: newSquadId || null,
    });
    setCreating(false);
    if (error) { showAlert('Error', error); return; }
    setShowCreateCoach(false); resetCoachForm(); await load();
    showAlert('Session Created', 'Players can now see this session.');
  };

  const today = todayStr();
  const filteredEntries = squadFilter
    ? entries.filter(e => !e.squadId || e.squadId === squadFilter || e.source === 'personal')
    : entries;

  const windowStart = new Date(); windowStart.setDate(windowStart.getDate() - 7);
  const windowStartStr = windowStart.toISOString().split('T')[0];
  const windowEnd = new Date(); windowEnd.setDate(windowEnd.getDate() + 30);
  const windowEndStr = windowEnd.toISOString().split('T')[0];

  const windowedEntries = filteredEntries.filter(e => e.date >= windowStartStr && e.date <= windowEndStr);
  const upcoming = windowedEntries.filter(e => e.date >= today).sort((a, b) => a.date !== b.date ? a.date.localeCompare(b.date) : a.time.localeCompare(b.time));
  const past = windowedEntries.filter(e => e.date < today).sort((a, b) => b.date !== a.date ? b.date.localeCompare(a.date) : b.time.localeCompare(a.time));
  const calendarEntries = filteredEntries;
  const userId = user?.id || '';

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}><MaterialIcons name="arrow-back" size={24} color={colors.text} /></Pressable>
          <Text style={styles.headerTitle}>Schedule</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><MaterialIcons name="arrow-back" size={24} color={colors.text} /></Pressable>
        <Text style={styles.headerTitle}>Schedule</Text>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          {!isCoach && (
            <Pressable style={styles.addPersonalBtn} onPress={() => { setEditingPersonalEntry(null); setShowPersonalModal(true); }}>
              <Text style={styles.addPersonalBtnText}>+ Personal Session</Text>
            </Pressable>
          )}
          {isCoach && (
            <Pressable style={styles.addBtn} onPress={() => { resetCoachForm(); setShowCreateCoach(true); }}>
              <MaterialIcons name="add" size={22} color={colors.primary} />
            </Pressable>
          )}
        </View>
      </View>

      {/* List / Calendar toggle */}
      <View style={viewToggle.bar}>
        <Pressable style={[viewToggle.btn, viewMode === 'list' && viewToggle.btnActive]} onPress={() => setViewMode('list')}>
          <MaterialIcons name="view-list" size={16} color={viewMode === 'list' ? colors.primary : colors.textSecondary} />
          <Text style={[viewToggle.btnText, viewMode === 'list' && viewToggle.btnTextActive]}>List View</Text>
        </Pressable>
        <Pressable style={[viewToggle.btn, viewMode === 'calendar' && viewToggle.btnActive]} onPress={() => setViewMode('calendar')}>
          <MaterialIcons name="calendar-today" size={16} color={viewMode === 'calendar' ? colors.primary : colors.textSecondary} />
          <Text style={[viewToggle.btnText, viewMode === 'calendar' && viewToggle.btnTextActive]}>Calendar</Text>
        </Pressable>
      </View>

      {squads.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={{ maxHeight: 52, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}
          contentContainerStyle={{ flexDirection: 'row', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm, alignItems: 'center' }}>
          <Pressable style={[schedSq.chip, !squadFilter && schedSq.chipAll]} onPress={() => setSquadFilter(null)}>
            <Text style={[schedSq.chipText, !squadFilter && schedSq.chipTextActive]}>All</Text>
          </Pressable>
          {squads.map(sq => (
            <Pressable key={sq.id} style={[schedSq.chip, squadFilter === sq.id && { backgroundColor: sq.color, borderColor: sq.color }]} onPress={() => setSquadFilter(squadFilter === sq.id ? null : sq.id)}>
              <View style={[schedSq.dot, { backgroundColor: squadFilter === sq.id ? 'rgba(255,255,255,0.7)' : sq.color }]} />
              <Text style={[schedSq.chipText, squadFilter === sq.id && schedSq.chipTextActive]}>{sq.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {!isCoach && (
        <View style={styles.legendBar}>
          <View style={styles.legendItem}><MaterialIcons name="shield" size={11} color={colors.primary} /><Text style={[styles.legendText, { color: colors.primary }]}>Academy</Text></View>
          <View style={styles.legendItem}><MaterialIcons name="person" size={11} color={colors.success} /><Text style={[styles.legendText, { color: colors.success }]}>Personal</Text></View>
          <View style={styles.legendItem}><MaterialIcons name="check-circle" size={11} color={colors.success} /><Text style={styles.legendText}>Done</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.primary }]} /><Text style={styles.legendText}>Upcoming</Text></View>
          <View style={styles.legendItem}><MaterialIcons name="cancel" size={11} color={colors.error} /><Text style={[styles.legendText, { color: colors.error }]}>Missed</Text></View>
        </View>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>

        {viewMode === 'calendar' && (
          <>
            <MonthlyCalendar
              entries={calendarEntries}
              isCoach={isCoach}
              today={today}
              loggedDates={loggedDates}
              onDayPress={(dateStr, dayEntries) => { setSelectedCalDate(dateStr); setSelectedCalEntries(dayEntries); setShowDayModal(true); }}
            />
          </>
        )}

        {viewMode === 'list' && (
          <>
            {upcoming.length === 0 && past.length === 0 && (
              <View style={styles.emptyState}>
                <MaterialIcons name="event-note" size={64} color={colors.border} />
                <Text style={styles.emptyTitle}>No sessions scheduled</Text>
                <Text style={styles.emptySub}>{isCoach ? 'Tap + to create a session' : 'Your coach will schedule sessions'}</Text>
              </View>
            )}
            {upcoming.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Upcoming ({upcoming.length}) · Tap to see plan</Text>
                {upcoming.map(e => (
                  <SessionCard key={e.id} entry={e} isCoach={isCoach} academyId={academyId} userId={userId} today={today} router={router}
                    memberPosition={memberPosition}
                    onEditAcademy={s => { setEditingAcademySession(s); setShowEditAcademy(true); }}
                    onEditPersonal={ent => { setEditingPersonalEntry(ent); setShowPersonalModal(true); }} />
                ))}
              </>
            )}
            {past.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>Recent / Missed ({past.length})</Text>
                {past.map(e => (
                  <SessionCard key={e.id} entry={e} isCoach={isCoach} academyId={academyId} userId={userId} today={today} router={router}
                    memberPosition={memberPosition}
                    onEditAcademy={s => { setEditingAcademySession(s); setShowEditAcademy(true); }}
                    onEditPersonal={ent => { setEditingPersonalEntry(ent); setShowPersonalModal(true); }} />
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>

      <AIPlannerModal
        visible={showAIPlanner}
        sessionColor={colors.primary}
        onClose={() => setShowAIPlanner(false)}
        onApply={(aiTitle, aiObjectives, aiBlocks, aiNotes) => {
          if (aiTitle) setNewTitle(aiTitle);
          setNewObjectives(aiObjectives.length ? aiObjectives : ['', '']);
          setNewPlanBlocks(aiBlocks);
          setNewNotes(aiNotes);
        }}
      />
      <DaySessionsModal visible={showDayModal} dateStr={selectedCalDate} entries={selectedCalEntries} isCoach={isCoach} academyId={academyId} memberPosition={memberPosition} router={router} onClose={() => setShowDayModal(false)} />
      <EditAcademySessionModal visible={showEditAcademy} session={editingAcademySession} onClose={() => { setShowEditAcademy(false); setEditingAcademySession(null); }} onSaved={load} />
      <PersonalSessionModal visible={showPersonalModal} editEntry={editingPersonalEntry} userId={userId} onClose={() => { setShowPersonalModal(false); setEditingPersonalEntry(null); }} onSaved={load} />

      {/* Create Academy Session (coaches only) */}
      <Modal visible={showCreateCoach} animationType="slide" transparent onRequestClose={() => setShowCreateCoach(false)}>
        <View style={modal.overlay}>
          <View style={modal.sheet}>
            <View style={modal.handle} />
            <View style={modal.header}>
              <Text style={modal.headerTitle}>Plan Session</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Pressable style={modal.aiBadgeBtn} onPress={() => setShowAIPlanner(true)}>
                  <MaterialIcons name="auto-awesome" size={14} color={colors.primary} />
                  <Text style={modal.aiBadgeBtnText}>AI Plan</Text>
                </Pressable>
                <Pressable onPress={() => setShowCreateCoach(false)} style={modal.closeBtn}>
                  <MaterialIcons name="close" size={22} color={colors.text} />
                </Pressable>
              </View>
            </View>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <ScrollView contentContainerStyle={modal.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                <View style={modal.sectionBlock}>
                  <View style={modal.sectionHeader}><MaterialIcons name="event" size={16} color={colors.primary} /><Text style={modal.sectionTitle}>Session Details</Text></View>
                  <Text style={modal.label}>Title *</Text>
                  <TextInput style={modal.input} value={newTitle} onChangeText={setNewTitle} placeholder="e.g. Tuesday Nets" placeholderTextColor={colors.textSecondary} />
                  <DateField label="Date" value={newDate} onChange={setNewDate} />
                  <Text style={modal.label}>Time</Text>
                  <Pressable style={[modal.input, { flexDirection: 'row', alignItems: 'center', gap: 6 }]} onPress={() => setShowCreateTimePicker(true)}>
                    <MaterialIcons name="access-time" size={16} color={colors.primary} />
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{formatTime12(newTime)}</Text>
                  </Pressable>
                  <TimePickerModal visible={showCreateTimePicker} value={newTime} onConfirm={setNewTime} onClose={() => setShowCreateTimePicker(false)} label="Session Time" />
                  <Text style={modal.label}>Location (Optional)</Text>
                  <TextInput style={modal.input} value={newLocation} onChangeText={setNewLocation} placeholder="e.g. Main Oval" placeholderTextColor={colors.textSecondary} />
                  {squads.length > 0 && (
                    <>
                      <Text style={modal.label}>Squad</Text>
                      <View style={modal.chipRow}>
                        <Pressable style={[modal.chip, !newSquadId && { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => setNewSquadId(null)}>
                          <Text style={[modal.chipText, !newSquadId && modal.chipTextActive]}>All Squads</Text>
                        </Pressable>
                        {squads.map(sq => (
                          <Pressable key={sq.id} style={[modal.chip, newSquadId === sq.id && { backgroundColor: sq.color, borderColor: sq.color }]} onPress={() => setNewSquadId(newSquadId === sq.id ? null : sq.id)}>
                            <Text style={[modal.chipText, newSquadId === sq.id && modal.chipTextActive]}>{sq.name}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </>
                  )}
                </View>
                <View style={modal.sectionBlock}>
                  <View style={modal.sectionHeader}><MaterialIcons name="flag" size={16} color={colors.warning} /><Text style={[modal.sectionTitle, { color: colors.warning }]}>Objectives</Text></View>
                  {newObjectives.map((obj, i) => (
                    <View key={i} style={modal.objRow}>
                      <View style={[modal.objNum, { backgroundColor: colors.warning }]}><Text style={modal.objNumText}>{i + 1}</Text></View>
                      <TextInput style={[modal.input, { flex: 1 }]} value={obj} onChangeText={v => { const arr = [...newObjectives]; arr[i] = v; setNewObjectives(arr); }} placeholder={`Objective ${i + 1}…`} placeholderTextColor={colors.textSecondary} />
                      {i === newObjectives.length - 1 && <Pressable onPress={() => setNewObjectives(o => [...o, ''])} hitSlop={6}><MaterialIcons name="add-circle" size={22} color={colors.warning} /></Pressable>}
                    </View>
                  ))}
                </View>
                <View style={modal.sectionBlock}>
                  <View style={modal.sectionHeader}><MaterialIcons name="schedule" size={16} color={colors.primary} /><Text style={modal.sectionTitle}>Training Plan</Text><Text style={modal.sectionHint}>Visible to players</Text></View>
                  <PlanBlockEditor blocks={newPlanBlocks} onChange={setNewPlanBlocks} sessionColor={colors.primary} />
                </View>
                <View style={modal.sectionBlock}>
                  <View style={modal.sectionHeader}><MaterialIcons name="notes" size={16} color={colors.textSecondary} /><Text style={modal.sectionTitle}>Coach Notes (Optional)</Text></View>
                  <TextInput style={[modal.input, { minHeight: 64, textAlignVertical: 'top' }]} value={newNotes} onChangeText={setNewNotes} multiline placeholder="Anything players should know…" placeholderTextColor={colors.textSecondary} />
                </View>
                <Pressable style={[modal.submitBtn, { backgroundColor: colors.primary, marginTop: spacing.md, marginBottom: spacing.xl }, creating && { opacity: 0.6 }]} onPress={handleCreate}>
                  {creating ? <ActivityIndicator color={colors.textLight} /> : <><MaterialIcons name="event" size={18} color={colors.textLight} /><Text style={modal.submitBtnText}>Create Session</Text></>}
                </Pressable>
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const modal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%', flex: 1 },
  handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { ...typography.h4, color: colors.text, fontWeight: '700' },
  closeBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  content: { padding: spacing.md, paddingBottom: 80, gap: spacing.sm },
  sectionBlock: { backgroundColor: colors.background, borderRadius: borderRadius.lg, padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.xs },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.text },
  sectionHint: { fontSize: 11, color: colors.textSecondary, fontStyle: 'italic', marginLeft: 4, flex: 1 },
  label: { fontSize: 12, color: colors.text, fontWeight: '600', marginBottom: 3 },
  input: { backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 14, color: colors.text },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: borderRadius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: colors.textLight },
  objRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 5 },
  objNum: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  objNumText: { fontSize: 11, fontWeight: '900', color: colors.textLight },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md, borderRadius: borderRadius.md },
  submitBtnText: { fontSize: 16, color: colors.textLight, fontWeight: '700' },
  aiBadgeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary + '15', borderRadius: borderRadius.full, paddingHorizontal: spacing.sm + 2, paddingVertical: 6, borderWidth: 1, borderColor: colors.primary + '40' },
  aiBadgeBtnText: { fontSize: 12, color: colors.primary, fontWeight: '800' },
});

const schedSq = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm + 2, paddingVertical: 5, borderRadius: borderRadius.full, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  chipAll: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: colors.textLight },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
});

const viewToggle = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.sm + 2, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  btnActive: { borderBottomColor: colors.primary, backgroundColor: colors.primary + '08' },
  btnText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  btnTextActive: { color: colors.primary },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { ...typography.h4, color: colors.text, fontWeight: '700', flex: 1 },
  addBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end' },
  addPersonalBtn: { backgroundColor: colors.success + '18', borderWidth: 1, borderColor: colors.success + '60', borderRadius: borderRadius.md, paddingHorizontal: spacing.sm + 2, paddingVertical: 8 },
  addPersonalBtnText: { fontSize: 12, color: colors.success, fontWeight: '800' },
  legendBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 8, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: 80, gap: spacing.xs },
  sectionLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '700', marginBottom: spacing.xs, marginTop: spacing.xs, letterSpacing: 0.3 },
  sessionCard: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: borderRadius.lg, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  sessionCardToday: { borderColor: colors.primary + '80', borderWidth: 2 },
  sessionCardPast: { opacity: 0.7 },
  sessionCardMissed: { borderColor: colors.error + '60', borderWidth: 1.5, backgroundColor: colors.error + '04' },
  sessionStripe: { width: 5 },
  sessionContent: { flex: 1, padding: spacing.md, gap: 4 },
  sessionTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  sessionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  sessionTitle: { fontSize: 15, color: colors.text, fontWeight: '700' },
  sessionMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 2, lineHeight: 16 },
  todayBadge: { backgroundColor: colors.primary, paddingHorizontal: spacing.xs + 2, paddingVertical: 2, borderRadius: borderRadius.sm },
  todayBadgeText: { fontSize: 9, color: colors.textLight, fontWeight: '800' },
  doneBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.success + '18', paddingHorizontal: 6, paddingVertical: 2, borderRadius: borderRadius.sm },
  doneBadgeText: { fontSize: 9, color: colors.success, fontWeight: '800' },
  missedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.error, paddingHorizontal: 6, paddingVertical: 2, borderRadius: borderRadius.sm },
  missedBadgeText: { fontSize: 9, color: colors.textLight, fontWeight: '900', letterSpacing: 0.4 },
  typeBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: borderRadius.sm },
  typeBadgeText: { fontSize: 10, fontWeight: '700' },
  sourceBadgeRow: { flexDirection: 'row', marginTop: 2 },
  sourceBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: borderRadius.sm, borderWidth: 1 },
  sourceBadgeText: { fontSize: 10, fontWeight: '700' },
  blockPreviewChip: { borderWidth: 1, borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3, alignItems: 'center' },
  blockPreviewTime: { fontSize: 9, fontWeight: '700' },
  blockPreviewActivity: { fontSize: 11, fontWeight: '800', marginTop: 1 },
  planContainer: { gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border + '60', paddingTop: spacing.sm, marginTop: spacing.xs },
  planSection: { gap: spacing.xs },
  planSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 },
  planSectionTitle: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  planBlockRow: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs, alignItems: 'center' },
  planBlockRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border + '40' },
  planBlockTimeCol: { borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: 4, alignItems: 'center', minWidth: 70 },
  planBlockTime: { fontSize: 11, fontWeight: '800' },
  planBlockArrow: { fontSize: 10, color: colors.textSecondary },
  planBlockActivity: { fontSize: 14, fontWeight: '700', color: colors.text },
  planBlockNotes: { fontSize: 12, color: colors.textSecondary, lineHeight: 16, marginTop: 2 },
  objRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.xs },
  objNum: { width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', flexShrink: 0, marginTop: 2 },
  objNumText: { fontSize: 11, fontWeight: '900', color: colors.textLight },
  objText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 },
  coachNoteText: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: colors.primary + '15', paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.sm },
  actionBtnText: { fontSize: 11, color: colors.primary, fontWeight: '700' },
  startSessionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.primary, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: borderRadius.md, marginTop: spacing.sm },
  startSessionBtnText: { fontSize: 13, fontWeight: '800', color: colors.textLight },
  logLateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.warning, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: borderRadius.md, marginTop: spacing.sm },
  logLateBtnText: { fontSize: 13, fontWeight: '800', color: colors.textLight },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: spacing.md },
  emptyTitle: { fontSize: 16, color: colors.text, fontWeight: '700' },
  emptySub: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 19, paddingHorizontal: spacing.md },
});
