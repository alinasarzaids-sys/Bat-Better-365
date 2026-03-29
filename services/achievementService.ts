import { getSupabaseClient } from '@/template';
import { Achievement, UserAchievement } from '@/types';

const supabase = getSupabaseClient();

export const achievementService = {
  async getAllAchievements(): Promise<{ data: Achievement[] | null; error: string | null }> {
    const { data, error } = await supabase
      .from('achievements')
      .select('*')
      .order('points', { ascending: false });

    if (error) {
      return { data: null, error: error.message };
    }

    return { data, error: null };
  },

  async getUserAchievements(userId: string): Promise<{ data: UserAchievement[] | null; error: string | null }> {
    const { data, error } = await supabase
      .from('user_achievements')
      .select(`
        *,
        achievement:achievements(*)
      `)
      .eq('user_id', userId)
      .order('unlocked_at', { ascending: false });

    if (error) {
      return { data: null, error: error.message };
    }

    return { data, error: null };
  },

  async unlockAchievement(
    userId: string,
    achievementId: string
  ): Promise<{ data: UserAchievement | null; error: string | null }> {
    // Check if already unlocked
    const { data: existing } = await supabase
      .from('user_achievements')
      .select('*')
      .eq('user_id', userId)
      .eq('achievement_id', achievementId)
      .single();

    if (existing) {
      return { data: existing, error: null };
    }

    const { data, error } = await supabase
      .from('user_achievements')
      .insert({
        user_id: userId,
        achievement_id: achievementId,
      })
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data, error: null };
  },
};
