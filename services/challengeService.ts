import { getSupabaseClient } from '@/template';
import { Challenge, UserChallenge } from '@/types';

const supabase = getSupabaseClient();

export const challengeService = {
  async getActiveChallenges(): Promise<{ data: Challenge[] | null; error: string | null }> {
    const { data, error } = await supabase
      .from('challenges')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error: error.message };
    }

    return { data, error: null };
  },

  async getUserChallenges(userId: string): Promise<{ data: UserChallenge[] | null; error: string | null }> {
    const { data, error } = await supabase
      .from('user_challenges')
      .select(`
        *,
        challenge:challenges(*)
      `)
      .eq('user_id', userId)
      .eq('status', 'active');

    if (error) {
      return { data: null, error: error.message };
    }

    return { data, error: null };
  },

  async joinChallenge(userId: string, challengeId: string): Promise<{ data: UserChallenge | null; error: string | null }> {
    const { data, error } = await supabase
      .from('user_challenges')
      .insert({
        user_id: userId,
        challenge_id: challengeId,
        current_progress: 0,
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data, error: null };
  },

  async updateChallengeProgress(
    id: string,
    progress: number
  ): Promise<{ data: UserChallenge | null; error: string | null }> {
    const { data, error } = await supabase
      .from('user_challenges')
      .update({ current_progress: progress })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data, error: null };
  },
};
