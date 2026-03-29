import { getSupabaseClient } from '@/template';
import { UserProgress, Pillar } from '@/types';

const supabase = getSupabaseClient();

// XP Rewards System
export const XP_REWARDS = {
  DRILL_COMPLETION: 10,    // Base reward for completing any drill
  GOOD_RATING: 5,          // Bonus for quality performance
  CONSISTENCY: 15,         // Bonus for completing 3+ sessions in a week
  STREAK: 20,              // Bonus for maintaining daily streak (3+ days)
};

// Level Thresholds
export const LEVEL_THRESHOLDS = {
  Beginner: 0,
  Amateur: 500,
  'Semi-Pro': 1500,
  Pro: 3000,
  Elite: 5000,
};

export const progressService = {
  async getUserProgress(userId: string): Promise<{ data: UserProgress | null; error: string | null }> {
    const { data, error } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      return { data: null, error: error.message };
    }

    // If no progress exists, create initial record
    if (!data) {
      return await this.initializeUserProgress(userId);
    }

    return { data, error: null };
  },

  async initializeUserProgress(userId: string): Promise<{ data: UserProgress | null; error: string | null }> {
    const { data, error } = await supabase
      .from('user_progress')
      .insert({
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
      })
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data, error: null };
  },

  async updateProgress(
    userId: string,
    updates: Partial<UserProgress>
  ): Promise<{ data: UserProgress | null; error: string | null }> {
    const { data, error } = await supabase
      .from('user_progress')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data, error: null };
  },

  async addPillarPoints(
    userId: string,
    pillar: Pillar,
    points: number
  ): Promise<{ data: UserProgress | null; error: string | null }> {
    // Get current progress
    const { data: current } = await this.getUserProgress(userId);
    if (!current) {
      return { data: null, error: 'User progress not found' };
    }

    const pillarField = `${pillar.toLowerCase()}_points`;
    const newPoints = (current as any)[pillarField] + points;

    const { data, error } = await supabase
      .from('user_progress')
      .update({ [pillarField]: newPoints, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data, error: null };
  },

  async incrementSession(userId: string, minutes: number): Promise<{ data: UserProgress | null; error: string | null }> {
    const { data: current } = await this.getUserProgress(userId);
    if (!current) {
      return { data: null, error: 'User progress not found' };
    }

    const today = new Date().toISOString().split('T')[0];
    const lastSessionDate = current.last_session_date?.split('T')[0];
    
    let newStreak = current.current_streak;
    if (lastSessionDate !== today) {
      // Check if consecutive day
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      if (lastSessionDate === yesterdayStr) {
        newStreak = current.current_streak + 1;
      } else if (!lastSessionDate || lastSessionDate < yesterdayStr) {
        newStreak = 1; // Reset streak
      }
    }

    const { data, error } = await supabase
      .from('user_progress')
      .update({
        total_sessions: current.total_sessions + 1,
        total_minutes: current.total_minutes + minutes,
        current_streak: newStreak,
        longest_streak: Math.max(newStreak, current.longest_streak),
        last_session_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data, error: null };
  },

  /**
   * Calculate XP earned from completing a drill
   * @param pillar - The pillar type (Technical, Physical, Mental, Tactical)
   * @param performanceRating - Performance score (1-10 scale)
   * @param currentProgress - Current user progress data
   * @returns Object with XP breakdown
   */
  calculateDrillXP(
    pillar: Pillar,
    performanceRating: number,
    currentProgress: UserProgress
  ): {
    baseXP: number;
    ratingBonus: number;
    consistencyBonus: number;
    streakBonus: number;
    totalXP: number;
  } {
    let baseXP = XP_REWARDS.DRILL_COMPLETION;
    let ratingBonus = 0;
    let consistencyBonus = 0;
    let streakBonus = 0;

    // Good rating bonus (7+ rating = good performance)
    if (performanceRating >= 7) {
      ratingBonus = XP_REWARDS.GOOD_RATING;
    }

    // Consistency bonus (3+ sessions this week)
    if (currentProgress.total_sessions >= 2) {
      consistencyBonus = XP_REWARDS.CONSISTENCY;
    }

    // Streak bonus (3+ days)
    if (currentProgress.current_streak >= 3) {
      streakBonus = XP_REWARDS.STREAK;
    }

    const totalXP = baseXP + ratingBonus + consistencyBonus + streakBonus;

    return {
      baseXP,
      ratingBonus,
      consistencyBonus,
      streakBonus,
      totalXP,
    };
  },

  /**
   * Award XP and update progress after drill completion
   */
  async awardDrillXP(
    userId: string,
    pillar: Pillar,
    performanceRating: number,
    durationMinutes: number
  ): Promise<{
    data: {
      progress: UserProgress;
      xpBreakdown: {
        baseXP: number;
        ratingBonus: number;
        consistencyBonus: number;
        streakBonus: number;
        totalXP: number;
      };
    } | null;
    error: string | null;
  }> {
    // Get current progress
    const { data: current } = await this.getUserProgress(userId);
    if (!current) {
      return { data: null, error: 'User progress not found' };
    }

    // Calculate XP
    const xpBreakdown = this.calculateDrillXP(pillar, performanceRating, current);

    // Update streak and session count
    const { data: updatedProgress } = await this.incrementSession(userId, durationMinutes);
    if (!updatedProgress) {
      return { data: null, error: 'Failed to update session count' };
    }

    // Add pillar points
    const pillarField = `${pillar.toLowerCase()}_points`;
    const newPillarPoints = (current as any)[pillarField] + xpBreakdown.totalXP;

    // Calculate total XP and determine skill level
    const totalXP =
      (pillar === 'Technical' ? newPillarPoints : updatedProgress.technical_points) +
      (pillar === 'Physical' ? newPillarPoints : updatedProgress.physical_points) +
      (pillar === 'Mental' ? newPillarPoints : updatedProgress.mental_points) +
      (pillar === 'Tactical' ? newPillarPoints : updatedProgress.tactical_points);

    const newSkillLevel = this.getSkillLevel(totalXP);

    // Final update with pillar points and skill level
    const { data: finalProgress, error } = await supabase
      .from('user_progress')
      .update({
        [pillarField]: newPillarPoints,
        skill_level: newSkillLevel,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return {
      data: {
        progress: finalProgress,
        xpBreakdown,
      },
      error: null,
    };
  },

  /**
   * Determine skill level based on total XP
   */
  getSkillLevel(totalXP: number): string {
    if (totalXP >= LEVEL_THRESHOLDS.Elite) return 'Elite';
    if (totalXP >= LEVEL_THRESHOLDS.Pro) return 'Pro';
    if (totalXP >= LEVEL_THRESHOLDS['Semi-Pro']) return 'Semi-Pro';
    if (totalXP >= LEVEL_THRESHOLDS.Amateur) return 'Amateur';
    return 'Beginner';
  },

  /**
   * Get next level info
   */
  getNextLevel(currentLevel: string): { level: string; requiredXP: number } {
    const levels = ['Beginner', 'Amateur', 'Semi-Pro', 'Pro', 'Elite'];
    const currentIndex = levels.indexOf(currentLevel);
    
    if (currentIndex === -1 || currentIndex >= levels.length - 1) {
      return { level: 'Elite', requiredXP: LEVEL_THRESHOLDS.Elite };
    }

    const nextLevel = levels[currentIndex + 1];
    return {
      level: nextLevel,
      requiredXP: LEVEL_THRESHOLDS[nextLevel as keyof typeof LEVEL_THRESHOLDS],
    };
  },

  /**
   * Calculate total XP from progress
   */
  calculateTotalXP(progress: UserProgress | null): number {
    if (!progress) return 0;
    return (
      progress.technical_points +
      progress.physical_points +
      progress.mental_points +
      progress.tactical_points
    );
  },

  /**
   * Calculate progress percentage towards next level
   */
  calculateLevelProgress(totalXP: number, currentLevel: string): number {
    const currentThreshold = LEVEL_THRESHOLDS[currentLevel as keyof typeof LEVEL_THRESHOLDS] || 0;
    const nextLevelInfo = this.getNextLevel(currentLevel);
    const nextThreshold = nextLevelInfo.requiredXP;

    if (totalXP >= nextThreshold) return 100;
    if (nextThreshold === currentThreshold) return 0;

    const progress = ((totalXP - currentThreshold) / (nextThreshold - currentThreshold)) * 100;
    return Math.max(0, Math.min(100, progress));
  },

  async updateUserProgress(
    userId: string,
    updates: {
      total_sessions?: number;
      total_minutes?: number;
      physical_points?: number;
      technical_points?: number;
      mental_points?: number;
      tactical_points?: number;
    }
  ): Promise<{ data: UserProgress | null; error: string | null }> {
    // First, get current progress
    const { data: current } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', userId)
      .single();

    // If no progress exists, create it
    if (!current) {
      const { data, error } = await supabase
        .from('user_progress')
        .insert({
          user_id: userId,
          total_sessions: updates.total_sessions || 0,
          total_minutes: updates.total_minutes || 0,
          physical_points: updates.physical_points || 0,
          technical_points: updates.technical_points || 0,
          mental_points: updates.mental_points || 0,
          tactical_points: updates.tactical_points || 0,
        })
        .select()
        .single();

      if (error) {
        return { data: null, error: error.message };
      }
      return { data, error: null };
    }

    // Otherwise, increment existing values
    const { data, error } = await supabase
      .from('user_progress')
      .update({
        total_sessions: (current.total_sessions || 0) + (updates.total_sessions || 0),
        total_minutes: (current.total_minutes || 0) + (updates.total_minutes || 0),
        physical_points: (current.physical_points || 0) + (updates.physical_points || 0),
        technical_points: (current.technical_points || 0) + (updates.technical_points || 0),
        mental_points: (current.mental_points || 0) + (updates.mental_points || 0),
        tactical_points: (current.tactical_points || 0) + (updates.tactical_points || 0),
        last_session_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data, error: null };
  },

  async createSessionLog(logData: {
    session_id: string;
    user_id: string;
    mood?: number;
    energy?: number;
    confidence?: number;
    performance_rating?: number;
    notes?: string;
  }): Promise<{ error: string | null }> {
    const { error } = await supabase
      .from('session_logs')
      .insert(logData);

    if (error) {
      return { error: error.message };
    }

    return { error: null };
  },
};
