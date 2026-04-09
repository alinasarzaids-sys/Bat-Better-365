import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator,
  Modal, TextInput, RefreshControl, KeyboardAvoidingView, Platform, TouchableOpacity,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useAuth, useAlert } from '@/template';
import { academyService, AcademySession } from '@/services/academyService';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

// ─── Training Plan Block ──────────────────────────────────────────────────────
interface PlanBlock {
  id: string;
  startTime: string;    // "07:15"
  endTime: string;      // "07:45"
  activities: string[]; // ["Batting", "Bowling"] — multi-select
  notes: string;        // notes + drills go here
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function now12() {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
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
    // Backward compat: convert old single `activity` string to array
    return blocks.map((b: any) => ({
      ...b,
      activities: Array.isArray(b.activities)
        ? b.activities
        : b.activity ? [b.activity] : [],
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
  const markers = ['OBJECTIVES:', 'PLAN_BLOCKS:'];
  let result = notes;
  for (const m of markers) {
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

// ─── Activity Pill Options ────────────────────────────────────────────────────
const ACTIVITIES = ['Batting', 'Bowling', 'Fielding', 'Keeping', 'Fitness', 'Warm-up', 'Cool-down', 'Team Talk', 'Match Sim'];
const SESSION_TYPES = ['Training'];

const TYPE_COLORS: Record<string, string> = {
  Training: colors.primary, Match: colors.error, Fitness: colors.physical,
  Fielding: colors.tactical, Batting: colors.technical, Bowling: colors.physical,
};

// ─── Shared picker sheet styles ──────────────────────────────────────────────
const tp = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.xl, width: '100%', maxWidth: 340, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 16 },
  pickerLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600', textAlign: 'center', marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  display: { fontSize: 32, fontWeight: '900', color: colors.primary, textAlign: 'center', marginBottom: spacing.lg, letterSpacing: 1 },
  columns: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: 6, marginBottom: spacing.lg },
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

// ─── Time Picker Component ───────────────────────────────────────────────────
function TimePickerModal({ visible, value, onConfirm, onClose, label }: {
  visible: boolean;
  value: string;
  onConfirm: (v: string) => void;
  onClose: () => void;
  label?: string;
}) {
  const parseTime = (t: string) => {
    const [h, m] = (t || '00:00').split(':').map(Number);
    return { h: isNaN(h) ? 0 : h, m: isNaN(m) ? 0 : m };
  };

  const [hour, setHour] = useState(0);
  const [minute, setMinute] = useState(0);

  React.useEffect(() => {
    if (visible) {
      const { h, m } = parseTime(value);
      setHour(h);
      setMinute(m);
    }
  }, [visible, value]);

  const isPM = hour >= 12;
  const h12 = hour % 12 || 12;
  const formatted = `${String(h12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`;

  const incHour = () => setHour(h => (h + 1) % 24);
  const decHour = () => setHour(h => (h - 1 + 24) % 24);
  const incMin = () => setMinute(m => (m + 1) % 60);
  const decMin = () => setMinute(m => (m - 1 + 60) % 60);
  const setAM = () => { if (hour >= 12) setHour(h => h - 12); };
  const setPM = () => { if (hour < 12) setHour(h => h + 12); };

  // Manual text editing
  const [hourText, setHourText] = React.useState(String(h12).padStart(2, '0'));
  const [minText, setMinText] = React.useState(String(minute).padStart(2, '0'));
  React.useEffect(() => { setHourText(String(h12).padStart(2, '0')); }, [hour]);
  React.useEffect(() => { setMinText(String(minute).padStart(2, '0')); }, [minute]);

  const commitHourText = (txt: string) => {
    const n = parseInt(txt, 10);
    if (!isNaN(n) && n >= 1 && n <= 12) {
      setHour(isPM ? (n === 12 ? 12 : n + 12) : (n === 12 ? 0 : n));
    } else {
      setHourText(String(h12).padStart(2, '0'));
    }
  };
  const commitMinText = (txt: string) => {
    const n = parseInt(txt, 10);
    if (!isNaN(n) && n >= 0 && n <= 59) setMinute(n);
    else setMinText(String(minute).padStart(2, '0'));
  };

  const handleConfirm = () => {
    // Commit any in-progress typed values before confirming
    let finalHour = hour;
    let finalMinute = minute;
    const typedH = parseInt(hourText, 10);
    const typedM = parseInt(minText, 10);
    if (!isNaN(typedH) && typedH >= 1 && typedH <= 12) {
      finalHour = isPM ? (typedH === 12 ? 12 : typedH + 12) : (typedH === 12 ? 0 : typedH);
    }
    if (!isNaN(typedM) && typedM >= 0 && typedM <= 59) {
      finalMinute = typedM;
    }
    onConfirm(`${String(finalHour).padStart(2, '0')}:${String(finalMinute).padStart(2, '0')}`);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={tp.overlay} onPress={onClose}>
        <Pressable style={tp.card} onPress={e => e.stopPropagation()}>
          {label ? <Text style={tp.pickerLabel}>{label}</Text> : null}
          <Text style={tp.display}>{formatted}</Text>
          <View style={tp.columns}>
            {/* Hour */}
            <View style={tp.col}>
              <Text style={tp.colLabel}>Hour</Text>
              <Pressable style={tp.arrowBtn} onPress={incHour} hitSlop={8}>
                <MaterialIcons name="keyboard-arrow-up" size={32} color={colors.primary} />
              </Pressable>
              <TextInput
                style={[tp.colValue, tp.colInput]}
                value={hourText}
                onChangeText={setHourText}
                onBlur={() => commitHourText(hourText)}
                onSubmitEditing={() => commitHourText(hourText)}
                keyboardType="number-pad"
                maxLength={2}
                selectTextOnFocus
              />
              <Pressable style={tp.arrowBtn} onPress={decHour} hitSlop={8}>
                <MaterialIcons name="keyboard-arrow-down" size={32} color={colors.primary} />
              </Pressable>
            </View>
            <Text style={tp.colon}>:</Text>
            {/* Minute */}
            <View style={tp.col}>
              <Text style={tp.colLabel}>Min</Text>
              <Pressable style={tp.arrowBtn} onPress={incMin} hitSlop={8}>
                <MaterialIcons name="keyboard-arrow-up" size={32} color={colors.primary} />
              </Pressable>
              <TextInput
                style={[tp.colValue, tp.colInput]}
                value={minText}
                onChangeText={setMinText}
                onBlur={() => commitMinText(minText)}
                onSubmitEditing={() => commitMinText(minText)}
                keyboardType="number-pad"
                maxLength={2}
                selectTextOnFocus
              />
              <Pressable style={tp.arrowBtn} onPress={decMin} hitSlop={8}>
                <MaterialIcons name="keyboard-arrow-down" size={32} color={colors.primary} />
              </Pressable>
            </View>
            {/* AM / PM — two separate buttons */}
            <View style={tp.ampmCol}>
              <Text style={tp.colLabel}>&nbsp;</Text>
              <Pressable
                style={[tp.ampmBtn, !isPM
                  ? { backgroundColor: colors.primary, borderColor: colors.primary }
                  : { backgroundColor: 'transparent', borderColor: colors.border }]}
                onPress={setAM}
              >
                <Text style={[tp.ampmText, { color: !isPM ? colors.textLight : colors.textSecondary }]}>AM</Text>
              </Pressable>
              <Pressable
                style={[tp.ampmBtn, isPM
                  ? { backgroundColor: colors.primary, borderColor: colors.primary }
                  : { backgroundColor: 'transparent', borderColor: colors.border }]}
                onPress={setPM}
              >
                <Text style={[tp.ampmText, { color: isPM ? colors.textLight : colors.textSecondary }]}>PM</Text>
              </Pressable>
            </View>
          </View>
          <View style={tp.btnRow}>
            <Pressable style={tp.cancelBtn} onPress={onClose}>
              <Text style={tp.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={tp.confirmBtn} onPress={handleConfirm}>
              <MaterialIcons name="check" size={18} color={colors.textLight} />
              <Text style={tp.confirmText}>Set Time</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Date Picker Component ────────────────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function DatePickerModal({ visible, value, onConfirm, onClose, label }: {
  visible: boolean;
  value: string; // 'YYYY-MM-DD'
  onConfirm: (v: string) => void;
  onClose: () => void;
  label?: string;
}) {
  const parseDate = (s: string) => {
    const parts = (s || '').split('-').map(Number);
    const y = parts[0] || new Date().getFullYear();
    const mo = parts[1] || new Date().getMonth() + 1;
    const d = parts[2] || new Date().getDate();
    return { y, mo, d };
  };

  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [day, setDay] = useState(new Date().getDate());

  React.useEffect(() => {
    if (visible) {
      const { y, mo, d } = parseDate(value);
      setYear(y); setMonth(mo); setDay(d);
    }
  }, [visible, value]);

  const daysInMonth = new Date(year, month, 0).getDate();
  const clampedDay = Math.min(day, daysInMonth);

  const incDay = () => setDay(d => d >= daysInMonth ? 1 : d + 1);
  const decDay = () => setDay(d => d <= 1 ? daysInMonth : d - 1);
  const incMonth = () => { const nm = month >= 12 ? 1 : month + 1; setMonth(nm); };
  const decMonth = () => { const pm = month <= 1 ? 12 : month - 1; setMonth(pm); };
  const incYear = () => setYear(y => y + 1);
  const decYear = () => setYear(y => Math.max(2020, y - 1));

  const formatted = `${String(clampedDay).padStart(2,'0')} ${MONTHS[month-1]} ${year}`;

  // Manual text state for each column
  const [dayText, setDayText] = React.useState(String(clampedDay).padStart(2,'0'));
  const [monthText, setMonthText] = React.useState(String(month).padStart(2,'0'));
  const [yearText, setYearText] = React.useState(String(year));
  React.useEffect(() => { setDayText(String(clampedDay).padStart(2,'0')); }, [day, month, year]);
  React.useEffect(() => { setMonthText(String(month).padStart(2,'0')); }, [month]);
  React.useEffect(() => { setYearText(String(year)); }, [year]);

  const commitDay = (txt: string) => {
    const n = parseInt(txt, 10);
    if (!isNaN(n) && n >= 1 && n <= daysInMonth) setDay(n);
    else setDayText(String(clampedDay).padStart(2,'0'));
  };
  const commitMonth = (txt: string) => {
    const n = parseInt(txt, 10);
    if (!isNaN(n) && n >= 1 && n <= 12) setMonth(n);
    else setMonthText(String(month).padStart(2,'0'));
  };
  const commitYear = (txt: string) => {
    const n = parseInt(txt, 10);
    if (!isNaN(n) && n >= 2020 && n <= 2099) setYear(n);
    else setYearText(String(year));
  };

  const handleConfirm = () => {
    const mm = String(month).padStart(2,'0');
    const dd = String(clampedDay).padStart(2,'0');
    onConfirm(`${year}-${mm}-${dd}`);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={tp.overlay} onPress={onClose}>
        <Pressable style={tp.card} onPress={e => e.stopPropagation()}>
          {label ? <Text style={tp.pickerLabel}>{label}</Text> : null}
          <Text style={tp.display}>{formatted}</Text>
          <View style={tp.columns}>
            {/* Day */}
            <View style={tp.col}>
              <Text style={tp.colLabel}>Day</Text>
              <Pressable style={tp.arrowBtn} onPress={incDay} hitSlop={8}>
                <MaterialIcons name="keyboard-arrow-up" size={32} color={colors.primary} />
              </Pressable>
              <TextInput
                style={[tp.colValue, tp.colInput]}
                value={dayText}
                onChangeText={setDayText}
                onBlur={() => commitDay(dayText)}
                onSubmitEditing={() => commitDay(dayText)}
                keyboardType="number-pad"
                maxLength={2}
                selectTextOnFocus
              />
              <Pressable style={tp.arrowBtn} onPress={decDay} hitSlop={8}>
                <MaterialIcons name="keyboard-arrow-down" size={32} color={colors.primary} />
              </Pressable>
            </View>
            {/* Month */}
            <View style={[tp.col, { minWidth: 52 }]}>
              <Text style={tp.colLabel}>Month (1-12)</Text>
              <Pressable style={tp.arrowBtn} onPress={incMonth} hitSlop={8}>
                <MaterialIcons name="keyboard-arrow-up" size={32} color={colors.primary} />
              </Pressable>
              <TextInput
                style={[tp.colValue, tp.colInput, { fontSize: 26 }]}
                value={monthText}
                onChangeText={setMonthText}
                onBlur={() => commitMonth(monthText)}
                onSubmitEditing={() => commitMonth(monthText)}
                keyboardType="number-pad"
                maxLength={2}
                selectTextOnFocus
              />
              <Text style={[tp.colLabel, { marginTop: 2, fontSize: 10 }]}>{MONTHS[(parseInt(monthText,10)||month)-1] || ''}</Text>
              <Pressable style={tp.arrowBtn} onPress={decMonth} hitSlop={8}>
                <MaterialIcons name="keyboard-arrow-down" size={32} color={colors.primary} />
              </Pressable>
            </View>
            {/* Year */}
            <View style={[tp.col, { minWidth: 72 }]}>
              <Text style={tp.colLabel}>Year</Text>
              <Pressable style={tp.arrowBtn} onPress={incYear} hitSlop={8}>
                <MaterialIcons name="keyboard-arrow-up" size={32} color={colors.primary} />
              </Pressable>
              <TextInput
                style={[tp.colValue, tp.colInput, { fontSize: 24 }]}
                value={yearText}
                onChangeText={setYearText}
                onBlur={() => commitYear(yearText)}
                onSubmitEditing={() => commitYear(yearText)}
                keyboardType="number-pad"
                maxLength={4}
                selectTextOnFocus
              />
              <Pressable style={tp.arrowBtn} onPress={decYear} hitSlop={8}>
                <MaterialIcons name="keyboard-arrow-down" size={32} color={colors.primary} />
              </Pressable>
            </View>
          </View>
          <View style={tp.btnRow}>
            <Pressable style={tp.cancelBtn} onPress={onClose}>
              <Text style={tp.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={tp.confirmBtn} onPress={handleConfirm}>
              <MaterialIcons name="check" size={18} color={colors.textLight} />
              <Text style={tp.confirmText}>Set Date</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── DateField — tappable display that opens the date picker ─────────────────
function DateField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const display = (() => {
    try {
      const [y, m, d] = value.split('-').map(Number);
      return new Date(y, m-1, d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return value; }
  })();
  return (
    <>
      {label ? <Text style={modal.label}>{label}</Text> : null}
      <Pressable
        style={[modal.input, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}
        onPress={() => setOpen(true)}
      >
        <MaterialIcons name="calendar-today" size={16} color={colors.primary} />
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{display}</Text>
      </Pressable>
      <DatePickerModal
        visible={open}
        value={value}
        onConfirm={onChange}
        onClose={() => setOpen(false)}
        label={label}
      />
    </>
  );
}

// ─── TimeField — tappable display that opens the picker ───────────────────────
function TimeField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {label ? <Text style={pb.timeLabel}>{label}</Text> : null}
      <Pressable
        style={[pb.timeInput, { flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'center' }]}
        onPress={() => setOpen(true)}
      >
        <MaterialIcons name="access-time" size={14} color={colors.primary} />
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{formatTime12(value)}</Text>
      </Pressable>
      <TimePickerModal
        visible={open}
        value={value}
        onConfirm={onChange}
        onClose={() => setOpen(false)}
        label={label}
      />
    </>
  );
}

// ─── Plan Block Builder ───────────────────────────────────────────────────────
function PlanBlockEditor({ blocks, onChange, sessionColor }: {
  blocks: PlanBlock[];
  onChange: (b: PlanBlock[]) => void;
  sessionColor: string;
}) {
  const addBlock = () => {
    const last = blocks[blocks.length - 1];
    const startT = last ? last.endTime : now12();
    const [h, m] = startT.split(':').map(Number);
    const endDate = new Date(2000, 0, 1, h, m + 30);
    const endT = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;
    onChange([...blocks, { id: Date.now().toString(), startTime: startT, endTime: endT, activities: ['Batting'], notes: '' }]);
  };

  const updateField = (id: string, field: 'startTime' | 'endTime' | 'notes', value: string) =>
    onChange(blocks.map(b => b.id === id ? { ...b, [field]: value } : b));

  // Multi-select toggle for activities
  const toggleActivity = (id: string, activity: string) =>
    onChange(blocks.map(b => {
      if (b.id !== id) return b;
      const has = b.activities.includes(activity);
      const next = has
        ? b.activities.filter(a => a !== activity)
        : [...b.activities, activity];
      return { ...b, activities: next.length ? next : [activity] };
    }));

  const remove = (id: string) => onChange(blocks.filter(b => b.id !== id));

  return (
    <View style={pb.wrapper}>
      {blocks.map((block, idx) => (
        <View key={block.id} style={[pb.block, { borderLeftColor: sessionColor }]}>
          <View style={pb.blockHeader}>
            <Text style={[pb.blockNum, { color: sessionColor }]}>Block {idx + 1}</Text>
            <Pressable onPress={() => remove(block.id)} hitSlop={6}>
              <MaterialIcons name="remove-circle-outline" size={20} color={colors.error} />
            </Pressable>
          </View>

          {/* Time row — tappable time picker */}
          <View style={pb.timeRow}>
            <View style={pb.timeField}>
              <TimeField
                label="Start"
                value={block.startTime}
                onChange={v => updateField(block.id, 'startTime', v)}
              />
            </View>
            <MaterialIcons name="arrow-forward" size={16} color={colors.textSecondary} style={{ marginTop: 20 }} />
            <View style={pb.timeField}>
              <TimeField
                label="End"
                value={block.endTime}
                onChange={v => updateField(block.id, 'endTime', v)}
              />
            </View>
          </View>

          {/* Activities — multi-select */}
          <Text style={[pb.timeLabel, { marginTop: 6, marginBottom: 4 }]}>Activities (tap to select multiple)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 5 }}>
              {ACTIVITIES.map(a => {
                const selected = block.activities.includes(a);
                return (
                  <Pressable
                    key={a}
                    style={[pb.activityChip, selected && { backgroundColor: sessionColor, borderColor: sessionColor }]}
                    onPress={() => toggleActivity(block.id, a)}
                  >
                    <Text style={[pb.activityChipText, selected && { color: colors.textLight }]}>{a}</Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {/* Block notes — drills go here */}
          <TextInput
            style={pb.blockNotes}
            value={block.notes}
            onChangeText={v => updateField(block.id, 'notes', v)}
            placeholder="Notes & drills e.g. Short-arm jab drill, focus on drive shots"
            placeholderTextColor={colors.textSecondary}
            multiline
          />
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

// ─── Session Card (with full plan details for players) ────────────────────────
function SessionCard({ s, isCoach, academyId, today, router }: {
  s: AcademySession; isCoach: boolean; academyId: string; today: string; router: any;
}) {
  const [expanded, setExpanded] = useState(false);
  const color = TYPE_COLORS[s.session_type] || colors.primary;
  const isToday = s.session_date === today;
  const isPast = s.session_date < today;

  const planBlocks = parsePlanBlocks(s.notes);
  const objectives = parseObjectives(s.notes);
  const coachNotes = parseCoachNotes(s.notes);
  const hasPlan = planBlocks.length > 0 || objectives.length > 0 || !!coachNotes;

  const getActivitiesLabel = (b: PlanBlock) =>
    (b.activities && b.activities.length > 0 ? b.activities : ['Training']).join(' + ');

  return (
    <Pressable
      style={[styles.sessionCard, isToday && styles.sessionCardToday]}
      onPress={() => setExpanded(e => !e)}
    >
      <View style={[styles.sessionStripe, { backgroundColor: color }]} />
      <View style={styles.sessionContent}>
        <View style={styles.sessionTop}>
          <View style={{ flex: 1 }}>
            <View style={styles.sessionTitleRow}>
              <Text style={styles.sessionTitle}>{s.title}</Text>
              {isToday && <View style={styles.todayBadge}><Text style={styles.todayBadgeText}>TODAY</Text></View>}
            </View>
            <Text style={styles.sessionMeta}>
              {formatDateReadable(s.session_date)} · {formatTime12(s.session_time)}
              {s.location ? ` · ${s.location}` : ''}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <View style={[styles.typeBadge, { backgroundColor: color + '20' }]}>
              <Text style={[styles.typeBadgeText, { color }]}>{s.session_type}</Text>
            </View>
            <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={18} color={colors.textSecondary} />
          </View>
        </View>

        {/* Collapsed preview — activity chips */}
        {!expanded && planBlocks.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.xs }}>
            <View style={{ flexDirection: 'row', gap: 5 }}>
              {planBlocks.map(b => (
                <View key={b.id} style={[styles.blockPreviewChip, { backgroundColor: color + '15', borderColor: color + '40' }]}>
                  <Text style={[styles.blockPreviewTime, { color }]}>{formatTime12(b.startTime)}</Text>
                  <Text style={[styles.blockPreviewActivity, { color }]}>{getActivitiesLabel(b)}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        )}

        {/* Expanded view — full training plan */}
        {expanded && hasPlan && (
          <View style={styles.planContainer}>
            {/* Objectives first */}
            {objectives.length > 0 && (
              <View style={styles.planSection}>
                <View style={styles.planSectionHeader}>
                  <MaterialIcons name="flag" size={14} color={colors.warning} />
                  <Text style={[styles.planSectionTitle, { color: colors.warning }]}>Session Objectives</Text>
                </View>
                {objectives.map((o, i) => (
                  <View key={i} style={styles.objRow}>
                    <View style={[styles.objNum, { backgroundColor: colors.warning }]}>
                      <Text style={styles.objNumText}>{i + 1}</Text>
                    </View>
                    <Text style={styles.objText}>{o}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Training Plan Blocks */}
            {planBlocks.length > 0 && (
              <View style={styles.planSection}>
                <View style={styles.planSectionHeader}>
                  <MaterialIcons name="schedule" size={14} color={color} />
                  <Text style={[styles.planSectionTitle, { color }]}>Training Plan</Text>
                </View>
                {planBlocks.map((b, i) => (
                  <View key={b.id} style={[styles.planBlockRow, i < planBlocks.length - 1 && styles.planBlockRowBorder]}>
                    <View style={[styles.planBlockTimeCol, { backgroundColor: color + '12' }]}>
                      <Text style={[styles.planBlockTime, { color }]}>{formatTime12(b.startTime)}</Text>
                      <Text style={styles.planBlockArrow}>↓</Text>
                      <Text style={[styles.planBlockTime, { color }]}>{formatTime12(b.endTime)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.planBlockActivity}>{getActivitiesLabel(b)}</Text>
                      {b.notes ? <Text style={styles.planBlockNotes}>{b.notes}</Text> : null}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Coach Notes */}
            {coachNotes ? (
              <View style={styles.planSection}>
                <View style={styles.planSectionHeader}>
                  <MaterialIcons name="notes" size={14} color={colors.textSecondary} />
                  <Text style={[styles.planSectionTitle, { color: colors.textSecondary }]}>Coach Notes</Text>
                </View>
                <Text style={styles.coachNoteText}>{coachNotes}</Text>
              </View>
            ) : null}
          </View>
        )}

        {!expanded && !hasPlan && s.notes && (
          <Text style={styles.sessionNotes} numberOfLines={2}>{parseCoachNotes(s.notes)}</Text>
        )}

        {isCoach && !isPast && (
          <Pressable style={styles.markAttendanceBtn} onPress={() => router.push({ pathname: '/academy-attendance', params: { academyId } } as any)}>
            <MaterialIcons name="fact-check" size={14} color={colors.primary} />
            <Text style={styles.markAttendanceText}>Mark Attendance</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AcademyScheduleScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();

  const academyId = params.academyId as string;
  const isCoach = params.isCoach === 'true';

  const [sessions, setSessions] = useState<AcademySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form state — auto-filled
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState(todayStr());
  const [newTime, setNewTime] = useState(now12());
  const [newLocation, setNewLocation] = useState('');
  const [newType] = useState('Training'); // Fixed to Training only
  const [newNotes, setNewNotes] = useState('');
  const [planBlocks, setPlanBlocks] = useState<PlanBlock[]>([]);
  const [objectives, setObjectives] = useState<string[]>(['', '']);
  const [creating, setCreating] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const load = useCallback(async () => {
    const { data } = await academyService.getAcademySessions(academyId);
    setSessions(data || []);
    setLoading(false);
  }, [academyId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const resetForm = () => {
    setNewTitle(''); setNewDate(todayStr()); setNewTime(now12());
    setNewLocation(''); setNewNotes('');
    setPlanBlocks([]); setObjectives(['', '']);
  };

  const openModal = () => {
    resetForm();
    setNewDate(todayStr());
    setNewTime(now12()); // refresh to current time on open
    setShowCreateModal(true);
  };

  const handleCreate = async () => {
    if (!user) return;
    if (!newTitle.trim()) { showAlert('Error', 'Please enter a session title'); return; }
    setCreating(true);
    const combinedNotes = buildNotes(newNotes, objectives, planBlocks);
    const { error } = await academyService.createSession({
      academy_id: academyId, title: newTitle.trim(), session_date: newDate,
      session_time: newTime, location: newLocation.trim() || undefined,
      session_type: newType, notes: combinedNotes || undefined, created_by: user.id,
    });
    setCreating(false);
    if (error) { showAlert('Error', error); return; }
    setShowCreateModal(false);
    resetForm();
    await load();
    showAlert('Session Created', 'Players can now see this session and training plan.');
  };

  const today = todayStr();
  const upcoming = sessions.filter(s => s.session_date >= today).sort((a, b) => a.session_date.localeCompare(b.session_date));
  const past = sessions.filter(s => s.session_date < today).sort((a, b) => b.session_date.localeCompare(a.session_date));
  const sessionColor = TYPE_COLORS[newType] || colors.primary;

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
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
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Schedule</Text>
        {isCoach ? (
          <Pressable style={styles.addBtn} onPress={openModal}>
            <MaterialIcons name="add" size={22} color={colors.primary} />
          </Pressable>
        ) : <View style={{ width: 40 }} />}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>

        {upcoming.length === 0 && past.length === 0 && (
          <View style={styles.emptyState}>
            <MaterialIcons name="event-note" size={64} color={colors.border} />
            <Text style={styles.emptyTitle}>No sessions scheduled</Text>
            <Text style={styles.emptySubtitle}>
              {isCoach ? 'Create a session to get started' : 'Your coach will schedule sessions here'}
            </Text>
            {isCoach && (
              <Pressable style={styles.createBtn} onPress={openModal}>
                <MaterialIcons name="add-circle" size={20} color={colors.textLight} />
                <Text style={styles.createBtnText}>Create Session</Text>
              </Pressable>
            )}
          </View>
        )}

        {upcoming.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Upcoming ({upcoming.length}) · Tap to see plan</Text>
            {upcoming.map(s => <SessionCard key={s.id} s={s} isCoach={isCoach} academyId={academyId} today={today} router={router} />)}
          </>
        )}
        {past.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>Past Sessions</Text>
            {past.map(s => <SessionCard key={s.id} s={s} isCoach={isCoach} academyId={academyId} today={today} router={router} />)}
          </>
        )}
      </ScrollView>

      {/* ── Create Session Modal ─────────────────────────────────────────────── */}
      <Modal visible={showCreateModal} animationType="slide" transparent onRequestClose={() => setShowCreateModal(false)}>
        <View style={modal.overlay}>
          <View style={modal.sheet}>
            <View style={modal.handle} />
            <View style={modal.header}>
              <Text style={modal.headerTitle}>Plan Session</Text>
              <Pressable onPress={() => setShowCreateModal(false)} style={modal.closeBtn}>
                <MaterialIcons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <ScrollView contentContainerStyle={modal.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{ flex: 1 }}>

                {/* ── Session Details ── */}
                <View style={modal.sectionBlock}>
                  <View style={modal.sectionHeader}>
                    <MaterialIcons name="event" size={16} color={colors.primary} />
                    <Text style={modal.sectionTitle}>Session Details</Text>
                  </View>

                  <Text style={modal.label}>Session Title *</Text>
                  <TextInput style={modal.input} value={newTitle} onChangeText={setNewTitle} placeholder="e.g. Tuesday Nets" placeholderTextColor={colors.textSecondary} />

                  <DateField label="Date" value={newDate} onChange={setNewDate} />

                  <Text style={modal.label}>Session Time</Text>
                  <Pressable
                    style={[modal.input, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}
                    onPress={() => setShowTimePicker(true)}
                  >
                    <MaterialIcons name="access-time" size={16} color={colors.primary} />
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{formatTime12(newTime)}</Text>
                  </Pressable>
                  <TimePickerModal
                    visible={showTimePicker}
                    value={newTime}
                    onConfirm={setNewTime}
                    onClose={() => setShowTimePicker(false)}
                    label="Session Start Time"
                  />

                  <Text style={modal.label}>Location (Optional)</Text>
                  <TextInput style={modal.input} value={newLocation} onChangeText={setNewLocation} placeholder="e.g. Main Oval" placeholderTextColor={colors.textSecondary} />

                  <Text style={modal.label}>Session Type</Text>
                  <View style={[modal.chip, { backgroundColor: colors.primary, borderColor: colors.primary, alignSelf: 'flex-start' }]}>
                    <Text style={modal.chipTextActive}>Training</Text>
                  </View>
                </View>

                {/* ── Session Objectives — ABOVE Training Plan ── */}
                <View style={modal.sectionBlock}>
                  <View style={modal.sectionHeader}>
                    <MaterialIcons name="flag" size={16} color={colors.warning} />
                    <Text style={[modal.sectionTitle, { color: colors.warning }]}>Session Objectives</Text>
                  </View>
                  {objectives.map((obj, i) => (
                    <View key={i} style={modal.objRow}>
                      <View style={[modal.objNum, { backgroundColor: colors.warning }]}>
                        <Text style={modal.objNumText}>{i + 1}</Text>
                      </View>
                      <TextInput
                        style={[modal.input, { flex: 1 }]}
                        value={obj}
                        onChangeText={v => { const arr = [...objectives]; arr[i] = v; setObjectives(arr); }}
                        placeholder={`Objective ${i + 1}…`}
                        placeholderTextColor={colors.textSecondary}
                      />
                      {i === objectives.length - 1 && (
                        <Pressable onPress={() => setObjectives(o => [...o, ''])} hitSlop={6}>
                          <MaterialIcons name="add-circle" size={22} color={colors.warning} />
                        </Pressable>
                      )}
                    </View>
                  ))}
                </View>

                {/* ── Training Plan Blocks ── */}
                <View style={modal.sectionBlock}>
                  <View style={modal.sectionHeader}>
                    <MaterialIcons name="schedule" size={16} color={sessionColor} />
                    <Text style={[modal.sectionTitle, { color: sessionColor }]}>Training Plan</Text>
                    <Text style={modal.sectionHint}>Visible to players · add drills in block notes</Text>
                  </View>
                  <PlanBlockEditor blocks={planBlocks} onChange={setPlanBlocks} sessionColor={sessionColor} />
                </View>

                {/* ── Coach Notes ── */}
                <View style={modal.sectionBlock}>
                  <View style={modal.sectionHeader}>
                    <MaterialIcons name="notes" size={16} color={colors.textSecondary} />
                    <Text style={modal.sectionTitle}>Coach Notes (Optional)</Text>
                  </View>
                  <TextInput
                    style={[modal.input, { minHeight: 64, textAlignVertical: 'top' }]}
                    value={newNotes}
                    onChangeText={setNewNotes}
                    multiline
                    placeholder="Anything else players should know…"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>

                <Pressable style={[modal.submitBtn, { backgroundColor: sessionColor, marginTop: spacing.md, marginBottom: spacing.xl }, creating && { opacity: 0.6 }]} onPress={handleCreate}>
                  {creating ? <ActivityIndicator color={colors.textLight} /> : (
                    <>
                      <MaterialIcons name="event" size={18} color={colors.textLight} />
                      <Text style={modal.submitBtnText}>Create Session</Text>
                    </>
                  )}
                </Pressable>
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Modal Styles ─────────────────────────────────────────────────────────────
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
  row: { flexDirection: 'row', gap: spacing.sm },
  input: { backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 14, color: colors.text },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: borderRadius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: colors.textLight },
  objRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 5 },
  objNum: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  objNumText: { fontSize: 11, fontWeight: '900', color: colors.textLight },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md, borderRadius: borderRadius.md, marginTop: spacing.sm },
  submitBtnText: { fontSize: 16, color: colors.textLight, fontWeight: '700' },
});

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { ...typography.h4, color: colors.text, fontWeight: '700', flex: 1 },
  addBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end' },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: 60 },
  sectionLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600', marginBottom: spacing.sm },
  sessionCard: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: borderRadius.lg, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  sessionCardToday: { borderColor: colors.primary + '80', borderWidth: 2 },
  sessionStripe: { width: 5 },
  sessionContent: { flex: 1, padding: spacing.md },
  sessionTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  sessionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  sessionTitle: { fontSize: 15, color: colors.text, fontWeight: '700' },
  todayBadge: { backgroundColor: colors.primary, paddingHorizontal: spacing.xs + 2, paddingVertical: 2, borderRadius: borderRadius.sm },
  todayBadgeText: { fontSize: 9, color: colors.textLight, fontWeight: '800' },
  sessionMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  typeBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: borderRadius.sm, alignSelf: 'flex-start' },
  typeBadgeText: { fontSize: 10, fontWeight: '700' },
  sessionNotes: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.xs, lineHeight: 16 },
  markAttendanceBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: spacing.sm, backgroundColor: colors.primary + '15', paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.sm },
  markAttendanceText: { fontSize: 11, color: colors.primary, fontWeight: '700' },
  blockPreviewChip: { borderWidth: 1, borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3, alignItems: 'center' },
  blockPreviewTime: { fontSize: 9, fontWeight: '700' },
  blockPreviewActivity: { fontSize: 11, fontWeight: '800', marginTop: 1 },
  planContainer: { marginTop: spacing.sm, gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
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
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: spacing.md },
  emptyTitle: { fontSize: 16, color: colors.text, fontWeight: '700' },
  emptySubtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  createBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primary, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderRadius: borderRadius.md },
  createBtnText: { fontSize: 14, color: colors.textLight, fontWeight: '700' },
});
