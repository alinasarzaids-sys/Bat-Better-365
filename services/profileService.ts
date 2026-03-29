import { getSupabaseClient } from '@/template';
import { UserProgress, UserAchievement, Achievement } from '@/types';

const supabase = getSupabaseClient();

export interface UserProfile {
  id: string;
  email: string;
  username?: string;
  full_name?: string;
  age?: number;
  created_at?: string;
}

export interface ProfileData {
  profile: UserProfile;
  progress: UserProgress;
  achievements: Array<UserAchievement & { achievement: Achievement }>;
  recentSessions: Array<{
    id: string;
    title: string;
    completed_at: string;
    duration_minutes: number;
  }>;
}

export const profileService = {
  async getProfile(userId: string): Promise<{ data: UserProfile | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error: any) {
      console.error('Error fetching profile:', error);
      return { data: null, error: error.message };
    }
  },

  async getProfileData(userId: string): Promise<{ data: ProfileData | null; error: string | null }> {
    try {
      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      // Fetch user progress
      const { data: progressData, error: progressError } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (progressError && progressError.code !== 'PGRST116') {
        throw progressError;
      }

      // Fetch user achievements with achievement details
      const { data: achievementsData, error: achievementsError } = await supabase
        .from('user_achievements')
        .select(`
          *,
          achievement:achievements(*)
        `)
        .eq('user_id', userId);

      if (achievementsError) throw achievementsError;

      // Fetch recent completed sessions
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select('id, title, completed_at, duration_minutes')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(5);

      if (sessionsError) throw sessionsError;

      return {
        data: {
          profile: profileData,
          progress: progressData || {
            id: '',
            user_id: userId,
            total_sessions: 0,
            total_minutes: 0,
            current_streak: 0,
            longest_streak: 0,
            skill_level: 'Beginner',
            technical_points: 0,
            physical_points: 0,
            mental_points: 0,
            tactical_points: 0,
          },
          achievements: achievementsData || [],
          recentSessions: sessionsData || [],
        },
        error: null,
      };
    } catch (error: any) {
      console.error('Error fetching profile data:', error);
      return { data: null, error: error.message };
    }
  },

  async updateProfile(
    userId: string,
    updates: { full_name?: string; username?: string; age?: number }
  ): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', userId);

      if (error) throw error;
      return { error: null };
    } catch (error: any) {
      console.error('Error updating profile:', error);
      return { error: error.message };
    }
  },

  async getAllAchievements(): Promise<{ data: Achievement[] | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('achievements')
        .select('*')
        .order('points', { ascending: true });

      if (error) throw error;
      return { data, error: null };
    } catch (error: any) {
      console.error('Error fetching achievements:', error);
      return { data: null, error: error.message };
    }
  },

  calculateTotalXP(progress: UserProgress): number {
    return (
      progress.technical_points +
      progress.physical_points +
      progress.mental_points +
      progress.tactical_points
    );
  },

  getNextLevel(currentLevel: string): { level: string; xpRequired: number } {
    const levels = [
      { level: 'Beginner', max: 500 },
      { level: 'Amateur', max: 1500 },
      { level: 'Semi-Pro', max: 3000 },
      { level: 'Pro', max: 5000 },
      { level: 'Elite', max: Infinity },
    ];

    const currentIndex = levels.findIndex((l) => l.level === currentLevel);
    if (currentIndex === -1 || currentIndex === levels.length - 1) {
      return { level: 'Elite', xpRequired: 5000 };
    }

    return { level: levels[currentIndex + 1].level, xpRequired: levels[currentIndex + 1].max };
  },

  calculateLevelProgress(totalXP: number, currentLevel: string): number {
    const levels = [
      { level: 'Beginner', min: 0, max: 500 },
      { level: 'Amateur', min: 500, max: 1500 },
      { level: 'Semi-Pro', min: 1500, max: 3000 },
      { level: 'Pro', min: 3000, max: 5000 },
      { level: 'Elite', min: 5000, max: Infinity },
    ];

    const current = levels.find((l) => l.level === currentLevel);
    if (!current || current.max === Infinity) return 100;

    const progress = ((totalXP - current.min) / (current.max - current.min)) * 100;
    return Math.max(0, Math.min(100, progress));
  },
};
