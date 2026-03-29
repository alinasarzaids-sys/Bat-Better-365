import { getSupabaseClient } from '@/template';

const supabase = getSupabaseClient();

export interface LeaderboardEntry {
  id: string;
  username: string;
  full_name?: string;
  skill_level: string;
  total_xp: number;
  current_streak: number;
  technical_points: number;
  physical_points: number;
  mental_points: number;
  tactical_points: number;
  rank: number;
}

export type LeaderboardType = 'overall' | 'streak' | 'technical' | 'physical' | 'mental' | 'tactical';

export const leaderboardService = {
  async getLeaderboard(type: LeaderboardType, limit?: number): Promise<{ data: LeaderboardEntry[] | null; error: string | null }> {
    try {
      // Fetch all user profiles with their progress data
      const { data, error } = await supabase
        .from('user_profiles')
        .select(`
          id,
          username,
          full_name,
          user_progress (
            skill_level,
            current_streak,
            technical_points,
            physical_points,
            mental_points,
            tactical_points
          )
        `);

      if (error) throw error;

      if (!data) {
        return { data: [], error: null };
      }

      // Transform and calculate rankings
      const entries: LeaderboardEntry[] = data
        .filter((user) => user.user_progress && user.user_progress.length > 0)
        .map((user) => {
          const progress = user.user_progress[0];
          const totalXP =
            progress.technical_points +
            progress.physical_points +
            progress.mental_points +
            progress.tactical_points;

          return {
            id: user.id,
            username: user.username || user.full_name || 'Unknown Player',
            full_name: user.full_name,
            skill_level: progress.skill_level,
            total_xp: totalXP,
            current_streak: progress.current_streak,
            technical_points: progress.technical_points,
            physical_points: progress.physical_points,
            mental_points: progress.mental_points,
            tactical_points: progress.tactical_points,
            rank: 0, // Will be set below
          };
        });

      // Sort based on leaderboard type
      let sortedEntries: LeaderboardEntry[];
      switch (type) {
        case 'overall':
          sortedEntries = entries.sort((a, b) => b.total_xp - a.total_xp);
          break;
        case 'streak':
          sortedEntries = entries.sort((a, b) => b.current_streak - a.current_streak);
          break;
        case 'technical':
          sortedEntries = entries.sort((a, b) => b.technical_points - a.technical_points);
          break;
        case 'physical':
          sortedEntries = entries.sort((a, b) => b.physical_points - a.physical_points);
          break;
        case 'mental':
          sortedEntries = entries.sort((a, b) => b.mental_points - a.mental_points);
          break;
        case 'tactical':
          sortedEntries = entries.sort((a, b) => b.tactical_points - a.tactical_points);
          break;
        default:
          sortedEntries = entries;
      }

      // Assign ranks
      sortedEntries.forEach((entry, index) => {
        entry.rank = index + 1;
      });
      
      // Apply limit if specified
      const finalEntries = limit ? sortedEntries.slice(0, limit) : sortedEntries;

      return { data: finalEntries, error: null };
    } catch (error: any) {
      console.error('Error fetching leaderboard:', error);
      return { data: null, error: error.message };
    }
  },

  async getUserRank(userId: string, type: LeaderboardType): Promise<{ rank: number; total: number } | null> {
    const { data } = await this.getLeaderboard(type);
    if (!data) return null;

    const userEntry = data.find((entry) => entry.id === userId);
    if (!userEntry) return null;

    return {
      rank: userEntry.rank,
      total: data.length,
    };
  },
};
