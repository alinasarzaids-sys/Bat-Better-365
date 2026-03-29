import { getSupabaseClient } from '@/template';

const supabase = getSupabaseClient();

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface PersonalizedDrill {
  id: string;
  name: string;
  description: string;
  pillar: string;
  duration_minutes: number;
  reason: string;
}

export const aiCoachService = {
  async getPersonalizedSuggestions(userId: string): Promise<{ data: { category: string; drills: PersonalizedDrill[] } | null; error: string | null }> {
    try {
      const { data, error } = await supabase.functions.invoke('ai-coach-analysis', {
        body: { 
          userId, 
          analysisType: 'personalized_suggestions',
          prompt: `Based on the user's training history, skill level, and recent performance, suggest 2-3 personalized cricket drills. For each drill, provide: drill name, short description (max 30 words), pillar (Technical/Physical/Mental/Tactical), duration in minutes, and a brief reason why this drill is recommended for this user.

Return the response in this exact JSON format:
{
  "category": "Brief category description (e.g., 'Strengthen your technical skills', 'Build mental resilience')",
  "drills": [
    {
      "name": "Drill name",
      "description": "Brief description",
      "pillar": "Technical/Physical/Mental/Tactical",
      "duration_minutes": 20,
      "reason": "Why recommended"
    }
  ]
}`
        },
      });

      if (error) {
        console.error('AI suggestions error:', error);
        return { data: null, error: error.message };
      }

      // Parse AI response
      if (data && data.result) {
        try {
          const parsed = JSON.parse(data.result);
          return { data: parsed, error: null };
        } catch (parseError) {
          console.error('Failed to parse AI response:', parseError);
          return { data: null, error: 'Failed to parse suggestions' };
        }
      }

      return { data: null, error: 'No suggestions returned' };
    } catch (err) {
      console.error('AI suggestions error:', err);
      return { data: null, error: (err as Error).message };
    }
  },

  async getPerformanceAnalysis(userId: string): Promise<{ data: string | null; error: string | null }> {
    try {
      const { data, error } = await supabase.functions.invoke('ai-coach-analysis', {
        body: { userId, analysisType: 'performance' },
      });

      if (error) {
        return { data: null, error: error.message };
      }

      return { data: data.analysis, error: null };
    } catch (err) {
      return { data: null, error: (err as Error).message };
    }
  },

  async getDrillRecommendations(userId: string): Promise<{ data: string[] | null; error: string | null }> {
    try {
      const { data, error } = await supabase.functions.invoke('ai-coach-analysis', {
        body: { userId, analysisType: 'recommendations' },
      });

      if (error) {
        return { data: null, error: error.message };
      }

      return { data: data.recommendations, error: null };
    } catch (err) {
      return { data: null, error: (err as Error).message };
    }
  },

  async generateTrainingPlan(userId: string, days: number = 7): Promise<{ data: any | null; error: string | null }> {
    try {
      const { data, error } = await supabase.functions.invoke('ai-coach-analysis', {
        body: { userId, analysisType: 'training_plan', days },
      });

      if (error) {
        return { data: null, error: error.message };
      }

      return { data: data.plan, error: null };
    } catch (err) {
      return { data: null, error: (err as Error).message };
    }
  },

  async chatWithCoach(messages: ChatMessage[]): Promise<{ data: string | null; error: string | null }> {
    try {
      const { data, error } = await supabase.functions.invoke('ai-coach-chat', {
        body: { messages },
      });

      if (error) {
        return { data: null, error: error.message };
      }

      return { data: data.response, error: null };
    } catch (err) {
      return { data: null, error: (err as Error).message };
    }
  },
};
