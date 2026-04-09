import { getSupabaseClient } from '@/template';

export interface Academy {
  id: string;
  name: string;
  description?: string;
  sport: string;
  player_code: string;
  coach_code: string;
  created_by: string;
  created_at: string;
}

export interface AcademyMember {
  id: string;
  academy_id: string;
  user_id: string;
  role: 'player' | 'coach';
  position: string;
  display_name?: string;
  jersey_number?: string;
  joined_at: string;
  user_profiles?: { username?: string; email: string; full_name?: string };
}

export interface AcademyTrainingLog {
  id: string;
  user_id: string;
  academy_id: string;
  log_date: string;
  session_type: string;
  duration_minutes: number;
  intensity: number;
  balls_faced?: number;
  runs_scored?: number;
  balls_bowled?: number;
  overs_bowled?: number;
  wickets?: number;
  runs_conceded?: number;
  catches?: number;
  run_outs?: number;
  stumpings?: number;
  technical_rating?: number;
  effort_rating?: number;
  fitness_rating?: number;
  notes?: string;
  created_at: string;
}

export interface AcademySession {
  id: string;
  academy_id: string;
  title: string;
  session_date: string;
  session_time: string;
  location?: string;
  session_type: string;
  notes?: string;
  created_by: string;
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  session_id: string;
  user_id: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  marked_at: string;
  marked_by?: string;
}

function generateCode(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export const academyService = {
  // ─── Academy ────────────────────────────────────────────────────────────────
  async createAcademy(name: string, description: string, userId: string): Promise<{ data: Academy | null; error: string | null }> {
    const supabase = getSupabaseClient();
    let playerCode = generateCode();
    let coachCode = generateCode();
    // Ensure codes are different
    while (coachCode === playerCode) coachCode = generateCode();

    const { data, error } = await supabase
      .from('academies')
      .insert({ name, description, player_code: playerCode, coach_code: coachCode, created_by: userId })
      .select()
      .single();

    if (error) return { data: null, error: error.message };

    // Auto-join as coach
    await supabase.from('academy_members').insert({
      academy_id: data.id,
      user_id: userId,
      role: 'coach',
      position: 'Coach',
      display_name: '',
    });

    return { data, error: null };
  },

  async joinAcademy(code: string, userId: string, displayName: string, position: string, jerseyNumber: string): Promise<{ data: { academy: Academy; role: 'player' | 'coach' } | null; error: string | null }> {
    const supabase = getSupabaseClient();
    const upperCode = code.trim().toUpperCase();

    // Check player code
    const { data: byPlayer } = await supabase
      .from('academies')
      .select('*')
      .eq('player_code', upperCode)
      .single();

    // Check coach code
    const { data: byCoach } = await supabase
      .from('academies')
      .select('*')
      .eq('coach_code', upperCode)
      .single();

    const academy = byPlayer || byCoach;
    if (!academy) return { data: null, error: 'Invalid code. Please check and try again.' };

    const role: 'player' | 'coach' = byCoach ? 'coach' : 'player';

    // Check already member
    const { data: existing } = await supabase
      .from('academy_members')
      .select('id')
      .eq('academy_id', academy.id)
      .eq('user_id', userId)
      .single();

    if (existing) return { data: null, error: 'You are already a member of this academy.' };

    const { error: joinError } = await supabase.from('academy_members').insert({
      academy_id: academy.id,
      user_id: userId,
      role,
      position,
      display_name: displayName,
      jersey_number: jerseyNumber,
    });

    if (joinError) return { data: null, error: joinError.message };
    return { data: { academy, role }, error: null };
  },

  async getMyAcademies(userId: string): Promise<{ data: Array<{ academy: Academy; member: AcademyMember }> | null; error: string | null }> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('academy_members')
      .select('*, academies(*)')
      .eq('user_id', userId)
      .order('joined_at', { ascending: false });

    if (error) return { data: null, error: error.message };
    return {
      data: (data || []).map((m: any) => ({ academy: m.academies, member: m })),
      error: null,
    };
  },

  async leaveAcademy(membershipId: string): Promise<{ error: string | null }> {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('academy_members').delete().eq('id', membershipId);
    return { error: error?.message || null };
  },

  // ─── Members ────────────────────────────────────────────────────────────────
  async getAcademyMembers(academyId: string): Promise<{ data: AcademyMember[] | null; error: string | null }> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('academy_members')
      .select('*, user_profiles(username, email, full_name)')
      .eq('academy_id', academyId)
      .order('role', { ascending: false })
      .order('joined_at', { ascending: true });

    if (error) return { data: null, error: error.message };
    return { data: data as any[], error: null };
  },

  // ─── Training Logs ───────────────────────────────────────────────────────────
  async logTraining(log: Omit<AcademyTrainingLog, 'id' | 'created_at'>): Promise<{ data: AcademyTrainingLog | null; error: string | null }> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('academy_training_logs')
      .insert(log)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  },

  async getMyLogs(userId: string, academyId: string, days = 30): Promise<{ data: AcademyTrainingLog[] | null; error: string | null }> {
    const supabase = getSupabaseClient();
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await supabase
      .from('academy_training_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('academy_id', academyId)
      .gte('log_date', since.toISOString().split('T')[0])
      .order('log_date', { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data: data as AcademyTrainingLog[], error: null };
  },

  async getAcademyLogs(academyId: string, days = 30): Promise<{ data: Array<AcademyTrainingLog & { user_profiles: any }> | null; error: string | null }> {
    const supabase = getSupabaseClient();
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await supabase
      .from('academy_training_logs')
      .select('*, user_profiles(username, email, full_name)')
      .eq('academy_id', academyId)
      .gte('log_date', since.toISOString().split('T')[0])
      .order('log_date', { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data: data as any[], error: null };
  },

  async deleteLog(logId: string): Promise<{ error: string | null }> {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('academy_training_logs').delete().eq('id', logId);
    return { error: error?.message || null };
  },

  // ─── Academy Sessions ────────────────────────────────────────────────────────
  async createSession(session: Omit<AcademySession, 'id' | 'created_at'>): Promise<{ data: AcademySession | null; error: string | null }> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('academy_sessions')
      .insert(session)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  },

  async getAcademySessions(academyId: string): Promise<{ data: AcademySession[] | null; error: string | null }> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('academy_sessions')
      .select('*')
      .eq('academy_id', academyId)
      .order('session_date', { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data: data as AcademySession[], error: null };
  },

  async updateSession(sessionId: string, updates: Partial<Omit<AcademySession, 'id' | 'created_at' | 'created_by' | 'academy_id'>>): Promise<{ data: AcademySession | null; error: string | null }> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('academy_sessions')
      .update(updates)
      .eq('id', sessionId)
      .select()
      .single();
    if (error) return { data: null, error: error.message };
    return { data, error: null };
  },

  async deleteSession(sessionId: string): Promise<{ error: string | null }> {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('academy_sessions').delete().eq('id', sessionId);
    return { error: error?.message || null };
  },

  // ─── Attendance ───────────────────────────────────────────────────────────────
  async getSessionAttendance(sessionId: string): Promise<{ data: AttendanceRecord[] | null; error: string | null }> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('session_id', sessionId);

    if (error) return { data: null, error: error.message };
    return { data: data as AttendanceRecord[], error: null };
  },

  async markAttendance(sessionId: string, userId: string, status: AttendanceRecord['status'], markedBy: string): Promise<{ error: string | null }> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('attendance_records')
      .upsert({ session_id: sessionId, user_id: userId, status, marked_by: markedBy, marked_at: new Date().toISOString() }, { onConflict: 'session_id,user_id' });

    return { error: error?.message || null };
  },

  async bulkMarkAttendance(sessionId: string, records: Array<{ userId: string; status: AttendanceRecord['status'] }>, markedBy: string): Promise<{ error: string | null }> {
    const supabase = getSupabaseClient();
    const rows = records.map(r => ({
      session_id: sessionId,
      user_id: r.userId,
      status: r.status,
      marked_by: markedBy,
      marked_at: new Date().toISOString(),
    }));
    const { error } = await supabase
      .from('attendance_records')
      .upsert(rows, { onConflict: 'session_id,user_id' });

    return { error: error?.message || null };
  },

  // ─── AI Analytics ─────────────────────────────────────────────────────────────
  async getAIAnalytics(logs: AcademyTrainingLog[], memberName: string, position: string): Promise<{ data: string | null; error: string | null }> {
    const supabase = getSupabaseClient();
    try {
      const { data, error } = await supabase.functions.invoke('academy-ai-questions', {
        body: {
          mode: 'analysis',
          position,
          sessionType: '',
          stats: { logs, memberName, answers: [] },
        },
      });
      if (error) return { data: null, error: 'AI analysis failed' };
      return { data: data?.report || null, error: null };
    } catch {
      return { data: null, error: 'AI analysis unavailable' };
    }
  },
};
