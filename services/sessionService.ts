import { getSupabaseClient } from '@/template';
import { Session, SessionItem, SessionLog } from '@/types';

const supabase = getSupabaseClient();

export const sessionService = {
  async getUserSessions(userId: string): Promise<{ data: Session[] | null; error: string | null }> {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .order('scheduled_date', { ascending: false });

    if (error) {
      return { data: null, error: error.message };
    }

    return { data, error: null };
  },

  async getUpcomingSessions(userId: string): Promise<{ data: Session[] | null; error: string | null }> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .gte('scheduled_date', now)
      .eq('status', 'planned')
      .order('scheduled_date', { ascending: true })
      .limit(5);

    if (error) {
      return { data: null, error: error.message };
    }

    return { data, error: null };
  },

  async createSession(session: Partial<Session>): Promise<{ data: Session | null; error: string | null }> {
    const { data, error } = await supabase
      .from('sessions')
      .insert(session)
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data, error: null };
  },

  async updateSession(id: string, updates: Partial<Session>): Promise<{ data: Session | null; error: string | null }> {
    const { data, error } = await supabase
      .from('sessions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data, error: null };
  },

  async deleteSession(id: string): Promise<{ error: string | null }> {
    const { error } = await supabase
      .from('sessions')
      .delete()
      .eq('id', id);

    if (error) {
      return { error: error.message };
    }

    return { error: null };
  },

  async getSessionItems(sessionId: string): Promise<{ data: SessionItem[] | null; error: string | null }> {
    const { data, error } = await supabase
      .from('session_items')
      .select(`
        *,
        drill:drills(*)
      `)
      .eq('session_id', sessionId)
      .order('order_index', { ascending: true });

    if (error) {
      return { data: null, error: error.message };
    }

    return { data, error: null };
  },

  async addSessionItem(item: Partial<SessionItem>): Promise<{ data: SessionItem | null; error: string | null }> {
    const { data, error } = await supabase
      .from('session_items')
      .insert(item)
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data, error: null };
  },

  async createSessionLog(log: Partial<SessionLog>): Promise<{ data: SessionLog | null; error: string | null }> {
    const { data, error } = await supabase
      .from('session_logs')
      .insert(log)
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data, error: null };
  },

  async getLastCompletedSession(userId: string): Promise<{ data: (Session & { items?: any[] }) | null; error: string | null }> {
    const { data, error } = await supabase
      .from('sessions')
      .select(`
        *,
        items:session_items(
          *,
          drill:drills(*)
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'completed')
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { data: null, error: 'No completed sessions found' };
      }
      return { data: null, error: error.message };
    }

    return { data, error: null };
  },

  async getMonthlyTrainingByPillar(userId: string): Promise<{ 
    data: { pillar: string; minutes: number }[] | null; 
    error: string | null 
  }> {
    // Get start and end of current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Calculate minutes per pillar
    const pillarMinutes: Record<string, number> = {
      'Technical': 0,
      'Physical': 0,
      'Mental': 0,
      'Tactical': 0,
      'Freestyle': 0,
    };

    try {
      // Query completed sessions from this month with their items and drill info
      const { data: sessions, error: sessionsError } = await supabase
        .from('sessions')
        .select(`
          duration_minutes,
          session_type,
          items:session_items(
            drill:drills(
              pillar
            )
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'completed')
        .gte('completed_at', startOfMonth.toISOString())
        .lte('completed_at', endOfMonth.toISOString());

      if (!sessionsError && sessions) {
        // Process regular sessions
        sessions.forEach((session: any) => {
          if (session.session_type === 'Freestyle') {
            pillarMinutes['Freestyle'] += session.duration_minutes || 0;
          } else if (session.items && session.items.length > 0) {
            const pillar = session.items[0]?.drill?.pillar;
            if (pillar && pillarMinutes.hasOwnProperty(pillar)) {
              pillarMinutes[pillar] += session.duration_minutes || 0;
            }
          }
        });
      }

      // Query technical drill logs from this month
      const { data: technicalLogs } = await supabase
        .from('technical_drill_logs')
        .select('time_elapsed')
        .eq('user_id', userId)
        .gte('created_at', startOfMonth.toISOString())
        .lte('created_at', endOfMonth.toISOString());

      if (technicalLogs) {
        technicalLogs.forEach((log: any) => {
          pillarMinutes['Technical'] += Math.floor((log.time_elapsed || 0) / 60);
        });
      }

      // Query mental drill logs from this month
      const { data: mentalLogs } = await supabase
        .from('mental_drill_logs')
        .select('time_elapsed')
        .eq('user_id', userId)
        .gte('created_at', startOfMonth.toISOString())
        .lte('created_at', endOfMonth.toISOString());

      if (mentalLogs) {
        mentalLogs.forEach((log: any) => {
          pillarMinutes['Mental'] += Math.floor((log.time_elapsed || 0) / 60);
        });
      }

      // Query workout drill logs from this month (Physical pillar)
      const { data: workoutLogs } = await supabase
        .from('workout_drill_logs')
        .select('time_elapsed')
        .eq('user_id', userId)
        .gte('created_at', startOfMonth.toISOString())
        .lte('created_at', endOfMonth.toISOString());

      if (workoutLogs) {
        workoutLogs.forEach((log: any) => {
          pillarMinutes['Physical'] += Math.floor((log.time_elapsed || 0) / 60);
        });
      }

      // Query tactical drill logs from this month
      const { data: tacticalLogs } = await supabase
        .from('tactical_drill_logs')
        .select('time_elapsed')
        .eq('user_id', userId)
        .gte('created_at', startOfMonth.toISOString())
        .lte('created_at', endOfMonth.toISOString());

      if (tacticalLogs) {
        tacticalLogs.forEach((log: any) => {
          pillarMinutes['Tactical'] += Math.floor((log.time_elapsed || 0) / 60);
        });
      }

    } catch (err) {
      console.error('Error in getMonthlyTrainingByPillar:', err);
    }

    // Convert to array format and round to whole numbers
    const result = Object.entries(pillarMinutes).map(([pillar, minutes]) => ({
      pillar,
      minutes: Math.round(minutes),
    }));

    return { data: result, error: null };
  },
};
