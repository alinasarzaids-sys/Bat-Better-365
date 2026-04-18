import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId, analysisType, days, prompt } = await req.json();

    if (!userId || !analysisType) {
      return new Response(
        JSON.stringify({ error: 'userId and analysisType are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ── WEEKLY REPORT ─────────────────────────────────────────────────────────
    if (analysisType === 'weekly_report') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const fromDate = sevenDaysAgo.toISOString().split('T')[0];

      // Fetch all training log types for past 7 days
      const [academyLogsRes, technicalLogsRes, workoutLogsRes, mentalLogsRes, tacticalLogsRes, sessionsRes] = await Promise.all([
        supabaseAdmin.from('academy_training_logs').select('*').eq('user_id', userId).gte('log_date', fromDate),
        supabaseAdmin.from('technical_drill_logs').select('*').eq('user_id', userId).gte('created_at', sevenDaysAgo.toISOString()),
        supabaseAdmin.from('workout_drill_logs').select('*').eq('user_id', userId).gte('created_at', sevenDaysAgo.toISOString()),
        supabaseAdmin.from('mental_drill_logs').select('*').eq('user_id', userId).gte('created_at', sevenDaysAgo.toISOString()),
        supabaseAdmin.from('tactical_drill_logs').select('*').eq('user_id', userId).gte('created_at', sevenDaysAgo.toISOString()),
        supabaseAdmin.from('sessions').select('*').eq('user_id', userId).eq('status', 'completed').gte('completed_at', sevenDaysAgo.toISOString()),
      ]);

      const academyLogs = academyLogsRes.data || [];
      const technicalLogs = technicalLogsRes.data || [];
      const workoutLogs = workoutLogsRes.data || [];
      const mentalLogs = mentalLogsRes.data || [];
      const tacticalLogs = tacticalLogsRes.data || [];
      const sessions = sessionsRes.data || [];

      const totalSessions = academyLogs.length + technicalLogs.length + workoutLogs.length + mentalLogs.length + tacticalLogs.length + sessions.length;
      const totalMins = academyLogs.reduce((a: number, l: any) => a + (l.duration_minutes || 0), 0)
        + workoutLogs.reduce((a: number, l: any) => a + (l.time_elapsed ? Math.round(l.time_elapsed / 60) : 0), 0)
        + technicalLogs.reduce((a: number, l: any) => a + (l.time_elapsed ? Math.round(l.time_elapsed / 60) : 0), 0)
        + mentalLogs.reduce((a: number, l: any) => a + (l.time_elapsed ? Math.round(l.time_elapsed / 60) : 0), 0)
        + tacticalLogs.reduce((a: number, l: any) => a + (l.time_elapsed ? Math.round(l.time_elapsed / 60) : 0), 0);

      const totalBallsFaced = academyLogs.reduce((a: number, l: any) => a + (l.balls_faced || 0), 0);
      const totalRunsScored = academyLogs.reduce((a: number, l: any) => a + (l.runs_scored || 0), 0);
      const totalBallsBowled = academyLogs.reduce((a: number, l: any) => a + (l.balls_bowled || 0), 0);
      const totalWickets = academyLogs.reduce((a: number, l: any) => a + (l.wickets || 0), 0);
      const totalCatches = academyLogs.reduce((a: number, l: any) => a + (l.catches || 0), 0);
      const avgIntensity = academyLogs.length > 0
        ? (academyLogs.reduce((a: number, l: any) => a + (l.intensity || 5), 0) / academyLogs.length).toFixed(1)
        : 'N/A';

      const avgTechnique = technicalLogs.length > 0
        ? (technicalLogs.reduce((a: number, l: any) => a + (l.technique_quality || 0), 0) / technicalLogs.length).toFixed(1)
        : null;
      const avgMentalAdherence = mentalLogs.length > 0
        ? (mentalLogs.reduce((a: number, l: any) => a + (l.adherence || 0), 0) / mentalLogs.length).toFixed(1)
        : null;

      const notesSnippets = academyLogs
        .filter((l: any) => l.notes && l.notes.trim())
        .slice(0, 5)
        .map((l: any) => `"${l.notes.trim()}"`)
        .join('; ');

      const aiPrompt = `You are a world-class cricket performance coach generating a weekly report for a player. Based on the training data below, write a motivating, specific, and actionable report with EXACTLY 3 sections.

=== PLAYER'S WEEKLY TRAINING DATA (Last 7 Days) ===
Total sessions logged: ${totalSessions}
Total training time: ${totalMins} minutes
Average intensity: ${avgIntensity}/10

Batting (Academy):
- Balls faced: ${totalBallsFaced}
- Runs scored: ${totalRunsScored}
- Strike rate: ${totalBallsFaced > 0 ? ((totalRunsScored / totalBallsFaced) * 100).toFixed(1) : 'N/A'}

Bowling (Academy):
- Balls bowled: ${totalBallsBowled}
- Wickets: ${totalWickets}

Fielding (Academy):
- Catches taken: ${totalCatches}

Technical drill sessions: ${technicalLogs.length}${avgTechnique ? ` (avg technique quality: ${avgTechnique}/5)` : ''}
Physical drill sessions: ${workoutLogs.length}
Mental drill sessions: ${mentalLogs.length}${avgMentalAdherence ? ` (avg adherence: ${avgMentalAdherence}/5)` : ''}
Tactical drill sessions: ${tacticalLogs.length}
Individual completed sessions: ${sessions.length}

Player notes from sessions: ${notesSnippets || 'None recorded this week'}

=== OUTPUT FORMAT (use this EXACTLY) ===
## ✅ What Went Well
[2-3 specific bullet points about genuine strengths from the data. Reference actual numbers.]

## ⚠️ Areas Missing the Objective
[2-3 specific bullet points identifying gaps or areas needing attention. Be direct but constructive.]

## 🎯 Top Drill Recommendation for Next Week
[Recommend 1-2 specific training focuses. Be precise — name the skill, explain why it will help, and suggest a simple goal to hit next week.]

Keep the tone of a supportive but direct coach. Reference the actual data numbers to make it feel personal and earned.`;

      const aiResp = await fetch(`${Deno.env.get('ONSPACE_AI_BASE_URL')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('ONSPACE_AI_API_KEY')}`,
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            { role: 'system', content: 'You are a professional cricket performance analyst and coach. Generate personalised, data-driven weekly reports that motivate players to improve.' },
            { role: 'user', content: aiPrompt },
          ],
        }),
      });

      if (!aiResp.ok) {
        const errText = await aiResp.text();
        console.error('OnSpace AI error:', errText);
        return new Response(JSON.stringify({ error: 'AI service error: ' + errText }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const aiData = await aiResp.json();
      const reportText = aiData.choices?.[0]?.message?.content || '';

      return new Response(
        JSON.stringify({ report: reportText, stats: { totalSessions, totalMins, totalBallsFaced, totalRunsScored, avgIntensity } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── EXISTING ANALYSIS TYPES ───────────────────────────────────────────────
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Get user progress
    const { data: progress, error: progressError } = await supabaseClient
      .from('user_progress')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (progressError) {
      console.error('Progress error:', progressError);
      return new Response(
        JSON.stringify({ error: 'Could not fetch user progress' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For personalized_suggestions, use the provided prompt directly
    if (analysisType === 'personalized_suggestions') {
      // Get all available drills
      const { data: allDrills } = await supabaseClient
        .from('drills')
        .select('id, name, description, pillar, duration_minutes');

      if (!allDrills || allDrills.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No drills available in database' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const { data: sessions } = await supabaseClient
        .from('sessions')
        .select('session_type, items:session_items(drill:drills(pillar))')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .gte('completed_at', startOfMonth.toISOString());

      const { data: mentalLogs } = await supabaseClient
        .from('mental_drill_logs')
        .select('drill_name')
        .eq('user_id', userId)
        .gte('created_at', startOfMonth.toISOString());

      const pillarCounts: Record<string, number> = {
        Technical: 0, Physical: 0, Mental: 0, Tactical: 0,
      };

      sessions?.forEach((session: any) => {
        if (session.items && session.items.length > 0) {
          const pillar = session.items[0]?.drill?.pillar;
          if (pillar && pillarCounts.hasOwnProperty(pillar)) pillarCounts[pillar]++;
        }
      });

      pillarCounts.Mental += mentalLogs?.length || 0;

      const sortedPillars = Object.entries(pillarCounts).sort((a, b) => a[1] - b[1]);
      const weakestPillar = sortedPillars[0][0];

      const drillsList = allDrills.map((d, idx) =>
        `${idx + 1}. "${d.name}" - Pillar: ${d.pillar}, Duration: ${d.duration_minutes}min, Description: ${d.description}`
      ).join('\n');

      const contextPrompt = `You are a cricket training assistant. Your ONLY task is to select 2-3 drills from the EXACT list below.

**STRICT RULES:**
1. You MUST ONLY select drills from the numbered list below
2. Use the EXACT drill names as written (copy them precisely)
3. DO NOT invent, create, or suggest drills not in this list
4. Focus on the user's weakest pillar: ${weakestPillar}

User's Monthly Training Stats:
- Technical: ${pillarCounts.Technical} sessions
- Physical: ${pillarCounts.Physical} sessions  
- Mental: ${pillarCounts.Mental} sessions
- Tactical: ${pillarCounts.Tactical} sessions

**AVAILABLE DRILLS (SELECT FROM THESE ONLY):**
${drillsList}

Provide a response in this EXACT JSON format:
{
  "category": "Brief category like 'Focus on ${weakestPillar}'",
  "drills": [
    {
      "name": "EXACT drill name from list above",
      "description": "Copy the description from the list above",
      "pillar": "Copy the pillar from the list above",
      "duration_minutes": number from list above,
      "reason": "1-2 sentence reason why this drill helps the user"
    }
  ]
}

Select 2-3 drills, prioritizing ${weakestPillar} pillar.`;

      const aiResponse = await fetch(`${Deno.env.get('ONSPACE_AI_BASE_URL')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('ONSPACE_AI_API_KEY')}`,
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            { role: 'system', content: 'You are a drill selector. You can ONLY choose from the exact drills provided. Never invent or create new drills.' },
            { role: 'user', content: contextPrompt },
          ],
          temperature: 0.3,
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error('OnSpace AI error:', errorText);
        return new Response(JSON.stringify({ error: 'AI service error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const aiData = await aiResponse.json();
      const content = aiData.choices[0]?.message?.content || '';

      try {
        const parsed = JSON.parse(content);
        const enrichedDrills = parsed.drills.map((drill: any) => {
          const matchedDrill = allDrills.find(d => {
            const nameMatch = d.name.toLowerCase().trim() === drill.name.toLowerCase().trim();
            const fuzzyMatch = d.name.toLowerCase().includes(drill.name.toLowerCase().trim()) ||
                               drill.name.toLowerCase().includes(d.name.toLowerCase().trim());
            return nameMatch || fuzzyMatch;
          });
          if (!matchedDrill) { console.warn(`No match for: ${drill.name}`); return null; }
          return { id: matchedDrill.id, name: matchedDrill.name, description: matchedDrill.description, pillar: matchedDrill.pillar, duration_minutes: matchedDrill.duration_minutes, reason: drill.reason };
        }).filter(Boolean);

        if (enrichedDrills.length === 0) return new Response(JSON.stringify({ error: 'Could not match AI suggestions to database drills' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        return new Response(
          JSON.stringify({ result: JSON.stringify({ category: parsed.category, drills: enrichedDrills }) }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (parseError) {
        console.error('Failed to parse AI response:', parseError, content);
        return new Response(JSON.stringify({ error: 'Failed to parse AI suggestions' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    let aiPrompt = '';
    if (analysisType === 'performance') {
      aiPrompt = `Analyze this cricket player's training performance and provide a brief assessment (2-3 sentences):
- Total sessions: ${progress.total_sessions}
- Total training time: ${progress.total_minutes} minutes
- Current streak: ${progress.current_streak} days
- Skill level: ${progress.skill_level}
- Technical points: ${progress.technical_points}
- Physical points: ${progress.physical_points}
- Mental points: ${progress.mental_points}
- Tactical points: ${progress.tactical_points}`;
    } else if (analysisType === 'recommendations') {
      aiPrompt = `Based on this player's training data, recommend 3 specific drills they should focus on:
- Technical points: ${progress.technical_points}
- Physical points: ${progress.physical_points}
- Mental points: ${progress.mental_points}
- Tactical points: ${progress.tactical_points}
Identify the weakest area and suggest drills to improve. Return as a JSON array of drill names.`;
    } else if (analysisType === 'training_plan') {
      aiPrompt = `Create a ${days}-day cricket training plan for this player. Format as JSON with structure:
{ "days": [{ "day": 1, "focus": "Technical", "drills": ["drill1", "drill2"], "duration": 30 }] }
Player stats:
- Skill level: ${progress.skill_level}
- Technical: ${progress.technical_points}, Physical: ${progress.physical_points}
- Mental: ${progress.mental_points}, Tactical: ${progress.tactical_points}`;
    }

    const aiResponse = await fetch(`${Deno.env.get('ONSPACE_AI_BASE_URL')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('ONSPACE_AI_API_KEY')}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'You are a cricket coaching expert.' },
          { role: 'user', content: aiPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('OnSpace AI error:', errorText);
      return new Response(JSON.stringify({ error: 'AI service error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices[0]?.message?.content || '';

    let result = {};
    if (analysisType === 'performance') {
      result = { analysis: content };
    } else if (analysisType === 'recommendations') {
      try { result = { recommendations: JSON.parse(content) }; }
      catch { result = { recommendations: [content] }; }
    } else if (analysisType === 'training_plan') {
      try { result = { plan: JSON.parse(content) }; }
      catch { result = { plan: { days: [] } }; }
    }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error in ai-coach-analysis:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
