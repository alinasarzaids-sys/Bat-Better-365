import { getSupabaseClient } from '@/template';

export interface Academy {
  id: string;
  name: string;
  description?: string;
  sport: string;
  player_code: string;
  coach_code: string;
  admin_code: string;
  created_by: string;
  created_at: string;
}

export interface AcademyMember {
  id: string;
  academy_id: string;
  user_id: string;
  role: 'player' | 'coach' | 'admin';
  position: string;
  display_name?: string;
  jersey_number?: string;
  joined_at: string;
  is_active: boolean;
  device_id?: string;
  squad_id?: string;
  status?: 'pending' | 'approved' | 'rejected' | 'removed';
  cooldown_until?: string | null;
  removal_reason?: string | null;
  user_profiles?: { username?: string; email: string; full_name?: string };
  academy_squads?: { id: string; name: string; color: string } | null;
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
  squad_id?: string | null;
  created_by: string;
  created_at: string;
  academy_squads?: { id: string; name: string; color: string } | null;
}

export interface AcademySquad {
  id: string;
  academy_id: string;
  name: string;
  color: string;
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

  async joinAcademy(code: string, userId: string, displayName: string, position: string, jerseyNumber: string, deviceId?: string, squadId?: string): Promise<{ data: { academy: Academy; role: 'player' | 'coach' | 'admin' } | null; error: string | null }> {
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

    // Check admin code
    const { data: byAdmin } = await supabase
      .from('academies')
      .select('*')
      .eq('admin_code', upperCode)
      .single();

    const academy = byPlayer || byCoach || byAdmin;
    if (!academy) return { data: null, error: 'Invalid code. Please check and try again.' };

    const role: 'player' | 'coach' | 'admin' = byAdmin ? 'admin' : byCoach ? 'coach' : 'player';

    // Check already member
    const { data: existing } = await supabase
      .from('academy_members')
      .select('id')
      .eq('academy_id', academy.id)
      .eq('user_id', userId)
      .single();

    if (existing) return { data: null, error: 'You are already a member of this academy.' };

    // Device-lock: check if this device_id is already used by another member in this academy
    if (deviceId) {
      const { data: deviceCheck } = await supabase
        .from('academy_members')
        .select('id, user_id')
        .eq('academy_id', academy.id)
        .eq('device_id', deviceId)
        .maybeSingle();
      if (deviceCheck && deviceCheck.user_id !== userId) {
        return { data: null, error: 'This device is already registered to another member. Each device can only be used by one player.' };
      }
    }

    // Players AND coaches join with 'pending' status — only admins (head coach/owner) are auto-approved
    // Coaches are FREE (not billed) but still require head coach approval before accessing the portal
    const memberStatus = role === 'admin' ? 'approved' : 'pending';

    // Check 30-day cooldown for players (anti-cheat: was this player removed recently?)
    // Note: Coaches do not have cooldown restrictions — only players do
    if (role === 'player') {
      const { data: removedRecord } = await supabase
        .from('academy_members')
        .select('cooldown_until, status')
        .eq('academy_id', academy.id)
        .eq('user_id', userId)
        .eq('status', 'removed')
        .maybeSingle();

      if (removedRecord?.cooldown_until) {
        const cooldownEnd = new Date(removedRecord.cooldown_until);
        if (cooldownEnd > new Date()) {
          const dateStr = cooldownEnd.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
          return { data: null, error: `You are on a 30-day cooldown for this academy. You can rejoin after ${dateStr}.` };
        }
      }
    }

    const { error: joinError } = await supabase.from('academy_members').insert({
      academy_id: academy.id,
      user_id: userId,
      role,
      position: role === 'admin' ? 'Admin' : position,
      display_name: displayName,
      jersey_number: jerseyNumber,
      status: memberStatus,
      ...(deviceId ? { device_id: deviceId } : {}),
      ...(squadId && role === 'player' ? { squad_id: squadId } : {}),
    });

    if (joinError) return { data: null, error: joinError.message };
    return { data: { academy, role, status: memberStatus as any }, error: null };
  },

  async generateAdminCode(academyId: string): Promise<{ data: string | null; error: string | null }> {
    const supabase = getSupabaseClient();
    const newCode = generateCode();
    const { error } = await supabase
      .from('academies')
      .update({ admin_code: newCode })
      .eq('id', academyId);
    if (error) return { data: null, error: error.message };
    return { data: newCode, error: null };
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

  async updateAcademy(academyId: string, updates: { name?: string; description?: string }): Promise<{ data: Academy | null; error: string | null }> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('academies')
      .update(updates)
      .eq('id', academyId)
      .select()
      .maybeSingle();
    if (error) return { data: null, error: error.message };
    if (!data) return { data: null, error: 'Academy not found or you do not have permission.' };
    return { data, error: null };
  },

  async leaveAcademy(membershipId: string): Promise<{ error: string | null }> {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('academy_members').delete().eq('id', membershipId);
    return { error: error?.message || null };
  },

  // ─── Squads ──────────────────────────────────────────────────────────────────
  async getSquads(academyId: string): Promise<{ data: AcademySquad[] | null; error: string | null }> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('academy_squads')
      .select('*')
      .eq('academy_id', academyId)
      .order('created_at', { ascending: true });
    if (error) return { data: null, error: error.message };
    return { data: data as AcademySquad[], error: null };
  },

  async createSquad(academyId: string, name: string, color: string): Promise<{ data: AcademySquad | null; error: string | null }> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('academy_squads')
      .insert({ academy_id: academyId, name: name.trim(), color })
      .select()
      .single();
    if (error) return { data: null, error: error.message };
    return { data, error: null };
  },

  async updateSquad(squadId: string, updates: { name?: string; color?: string }): Promise<{ error: string | null }> {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('academy_squads').update(updates).eq('id', squadId);
    return { error: error?.message || null };
  },

  async deleteSquad(squadId: string): Promise<{ error: string | null }> {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('academy_squads').delete().eq('id', squadId);
    return { error: error?.message || null };
  },

  async assignPlayerToSquad(memberId: string, squadId: string | null): Promise<{ error: string | null }> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('academy_members')
      .update({ squad_id: squadId })
      .eq('id', memberId);
    return { error: error?.message || null };
  },

  // ─── Members ────────────────────────────────────────────────────────────────
  async getAcademyMembers(academyId: string): Promise<{ data: AcademyMember[] | null; error: string | null }> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('academy_members')
      .select('*, user_profiles(username, email, full_name), academy_squads(id, name, color)')
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

  // ─── Audit & Licensing ───────────────────────────────────────────────────────
  async getMonthlyAuditData(): Promise<{ data: { academies: number; players: number; coaches: number; totalMembers: number; perAcademy: Array<{ id: string; name: string; players: number; coaches: number }> } | null; error: string | null }> {
    const supabase = getSupabaseClient();
    const { data: academies, error: aErr } = await supabase
      .from('academies')
      .select('id, name');
    if (aErr) return { data: null, error: aErr.message };

    const { data: members, error: mErr } = await supabase
      .from('academy_members')
      .select('academy_id, role, is_active');
    if (mErr) return { data: null, error: mErr.message };

    const perAcademy = (academies || []).map((a: any) => {
      const am = (members || []).filter((m: any) => m.academy_id === a.id);
      return {
        id: a.id,
        name: a.name,
        players: am.filter((m: any) => m.role === 'player' && m.is_active !== false).length,
        coaches: am.filter((m: any) => m.role === 'coach' && m.is_active !== false).length,
      };
    });

    // Only count ACTIVE players for billing
    const totalPlayers = (members || []).filter((m: any) => m.role === 'player' && m.is_active !== false).length;
    const totalCoaches = (members || []).filter((m: any) => m.role === 'coach' && m.is_active !== false).length;

    return {
      data: {
        academies: (academies || []).length,
        players: totalPlayers,
        coaches: totalCoaches,
        totalMembers: totalPlayers + totalCoaches,
        perAcademy,
      },
      error: null,
    };
  },

  // ─── Pending Approval System ─────────────────────────────────────────────────
  async getPendingMembers(academyId: string): Promise<{ data: AcademyMember[] | null; error: string | null }> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('academy_members')
      .select('*, user_profiles(username, email, full_name)')
      .eq('academy_id', academyId)
      .eq('status', 'pending')
      .order('joined_at', { ascending: true });
    if (error) return { data: null, error: error.message };
    return { data: data as any[], error: null };
  },

  async approvePlayer(memberId: string): Promise<{ error: string | null }> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('academy_members')
      .update({ status: 'approved', is_active: true })
      .eq('id', memberId);
    return { error: error?.message || null };
  },

  async rejectPlayer(memberId: string): Promise<{ error: string | null }> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('academy_members')
      .update({ status: 'rejected', is_active: false })
      .eq('id', memberId);
    return { error: error?.message || null };
  },

  async removePlayer(memberId: string, reason?: string): Promise<{ error: string | null }> {
    const supabase = getSupabaseClient();
    // 30-day cooldown anti-cheat: player cannot rejoin for 30 days
    const cooldownUntil = new Date(Date.now() + 30 * 86400000).toISOString();
    const { error } = await supabase
      .from('academy_members')
      .update({
        status: 'removed',
        is_active: false,
        deactivated_at: new Date().toISOString(),
        cooldown_until: cooldownUntil,
        removal_reason: reason || null,
      })
      .eq('id', memberId);
    return { error: error?.message || null };
  },

  // ─── Player Deactivation ─────────────────────────────────────────────────────
  async setPlayerActive(memberId: string, isActive: boolean): Promise<{ error: string | null }> {
    const supabase = getSupabaseClient();
    const updates: Record<string, any> = { is_active: isActive };
    if (!isActive) {
      updates.deactivated_at = new Date().toISOString();
    } else {
      updates.deactivated_at = null;
    }
    const { error } = await supabase
      .from('academy_members')
      .update(updates)
      .eq('id', memberId);
    return { error: error?.message || null };
  },

  // Returns true if the player was deactivated less than 30 days ago
  cannotReactivateUntil(member: AcademyMember): Date | null {
    if (member.is_active !== false || !(member as any).deactivated_at) return null;
    const deactivatedAt = new Date((member as any).deactivated_at as string);
    const unlockDate = new Date(deactivatedAt);
    unlockDate.setDate(unlockDate.getDate() + 30);
    return unlockDate > new Date() ? unlockDate : null;
  },

  // Check if a player has a billing record for the current month (was active this month)
  async hasCurrentMonthBilling(playerId: string, academyId: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    const monthYear = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
    const { data } = await supabase
      .from('player_billing_records')
      .select('id')
      .eq('player_id', playerId)
      .eq('academy_id', academyId)
      .eq('month_year', monthYear)
      .eq('is_billable', true)
      .maybeSingle();
    return !!data;
  },

  async deleteLog(logId: string): Promise<{ error: string | null }> {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('academy_training_logs').delete().eq('id', logId);
    return { error: error?.message || null };
  },

  // ─── Academy Sessions ────────────────────────────────────────────────────────
  async createSession(session: Omit<AcademySession, 'id' | 'created_at'> & { squad_id?: string | null }): Promise<{ data: AcademySession | null; error: string | null }> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('academy_sessions')
      .insert(session)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  },

  async getAcademySessions(academyId: string, squadId?: string | null): Promise<{ data: AcademySession[] | null; error: string | null }> {
    const supabase = getSupabaseClient();
    let query = supabase
      .from('academy_sessions')
      .select('*, academy_squads(id, name, color)')
      .eq('academy_id', academyId);
    // Filter: show sessions assigned to this squad OR sessions with no squad (all-squad)
    if (squadId) {
      query = query.or(`squad_id.eq.${squadId},squad_id.is.null`);
    }
    const { data, error } = await query.order('session_date', { ascending: false });

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
      .maybeSingle();
    if (error) return { data: null, error: error.message };
    if (!data) return { data: null, error: 'Session not found or you do not have permission to edit it.' };
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

  // ─── App-wide Stats ───────────────────────────────────────────────────────────
  async getAppStats(): Promise<{ data: { total_users: number; individual_users: number; academy_users: number; no_mode: number; total_academies: number; active_players: number; inactive_players: number; active_coaches: number; total_training_logs: number; total_sessions_planned: number } | null; error: string | null }> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc('get_app_stats');
    if (error) return { data: null, error: error.message };
    return { data: data as any, error: null };
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
