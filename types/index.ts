// Type definitions for Cricket Training App

export type Pillar = 'Technical' | 'Physical' | 'Mental' | 'Tactical';
export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';
export type SessionType = 'Structured' | 'Freestyle';
export type SessionStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';

export interface Drill {
  id: string;
  name: string;
  description: string;
  pillar: Pillar;
  difficulty: Difficulty;
  duration_minutes: number;
  equipment: string[];
  instructions: {
    steps: string[];
  };
  subcategory?: string;
  format?: string;
  video_url?: string;
  created_at?: string;
}

export interface Session {
  id: string;
  user_id: string;
  title: string;
  scheduled_date: string;
  duration_minutes?: number;
  session_type: SessionType;
  status: SessionStatus;
  notes?: string;
  created_at?: string;
  completed_at?: string;
}

export interface SessionItem {
  id: string;
  session_id: string;
  drill_id?: string;
  order_index: number;
  duration_minutes?: number;
  sets?: number;
  reps?: number;
  notes?: string;
  drill?: Drill;
}

export interface SessionLog {
  id: string;
  session_id: string;
  user_id: string;
  mood?: number;
  energy?: number;
  confidence?: number;
  performance_rating?: number;
  notes?: string;
  created_at?: string;
}

export interface UserProgress {
  id: string;
  user_id: string;
  total_sessions: number;
  total_minutes: number;
  current_streak: number;
  longest_streak: number;
  skill_level: string;
  technical_points: number;
  physical_points: number;
  mental_points: number;
  tactical_points: number;
  last_session_date?: string;
  updated_at?: string;
}

export interface Challenge {
  id: string;
  title: string;
  description?: string;
  challenge_type: string;
  target_value: number;
  reward_points: number;
  start_date?: string;
  end_date?: string;
  is_active: boolean;
  created_at?: string;
}

export interface UserChallenge {
  id: string;
  user_id: string;
  challenge_id: string;
  current_progress: number;
  status: 'active' | 'completed' | 'failed';
  started_at?: string;
  completed_at?: string;
  challenge?: Challenge;
}

export interface Achievement {
  id: string;
  title: string;
  description?: string;
  category: string;
  requirement_type: string;
  requirement_value: number;
  icon?: string;
  points: number;
  created_at?: string;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  unlocked_at?: string;
  achievement?: Achievement;
}

export interface DashboardStats {
  streak: number;
  weeklyMinutes: number;
  weeklyGoal: number;
  skillLevel: string;
  confidence: number;
  sessions: number;
}

export interface PillarProgress {
  pillar: Pillar;
  points: number;
  percentage: number;
}
