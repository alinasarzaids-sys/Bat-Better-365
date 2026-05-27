import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId, tab, timeframe, stats } = await req.json();

    if (!userId || !tab) {
      return new Response(JSON.stringify({ error: 'userId and tab required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Build timeframe filter
    const now = new Date();
    let fromDate = new Date();
    if (timeframe === 'week') fromDate.setDate(now.getDate() - 7);
    else if (timeframe === 'month') fromDate.setDate(now.getDate() - 30);
    else if (timeframe === 'season') fromDate.setMonth(now.getMonth() - 6);
    else fromDate = new Date('2000-01-01'); // all-time

    const fromIso = fromDate.toISOString();
    const fromDate2 = fromDate.toISOString().split('T')[0];

    // Fetch data based on tab
    let prompt = '';
    let data: any = {};

    if (tab === 'overall') {
      const [sessRes, acaRes, techRes, physRes, menRes, tacRes] = await Promise.all([
        supabaseAdmin.from('sessions').select('duration_minutes, notes, session_type, completed_at').eq('user_id', userId).eq('status', 'completed').gte('completed_at', fromIso),
        supabaseAdmin.from('academy_training_logs').select('duration_minutes, balls_faced, runs_scored, session_type, technical_rating, intensity').eq('user_id', userId).gte('log_date', fromDate2),
        supabaseAdmin.from('technical_drill_logs').select('time_elapsed, technique_quality, consistency, shot_control, timing, focus_level, reflection_notes').eq('user_id', userId).gte('created_at', fromIso),
        supabaseAdmin.from('workout_drill_logs').select('time_elapsed, technique_quality, consistency, focus_level, confidence_level').eq('user_id', userId).gte('created_at', fromIso),
        supabaseAdmin.from('mental_drill_logs').select('time_elapsed, adherence, engagement, focus_level, confidence_level, reflection_notes').eq('user_id', userId).gte('created_at', fromIso),
        supabaseAdmin.from('tactical_drill_logs').select('time_elapsed, field_reading, shot_selection_matched, adapted_plan, confidence_pressure, overall_mood, session_notes').eq('user_id', userId).gte('created_at', fromIso),
      ]);

      const sessions = sessRes.data || [];
      const academy = acaRes.data || [];
      const technical = techRes.data || [];
      const physical = physRes.data || [];
      const mental = menRes.data || [];
      const tactical = tacRes.data || [];

      const totalTime = Math.round(
        sessions.reduce((a: number, s: any) => a + (s.duration_minutes || 0), 0) +
        academy.reduce((a: number, l: any) => a + (l.duration_minutes || 0), 0) +
        technical.reduce((a: number, l: any) => a + Math.round((l.time_elapsed || 0) / 60), 0) +
        physical.reduce((a: number, l: any) => a + Math.round((l.time_elapsed || 0) / 60), 0) +
        mental.reduce((a: number, l: any) => a + Math.round((l.time_elapsed || 0) / 60), 0) +
        tactical.reduce((a: number, l: any) => a + Math.round((l.time_elapsed || 0) / 60), 0)
      );

      const totalBalls = academy.reduce((a: number, l: any) => a + (l.balls_faced || 0), 0);
      const totalMiddled = academy.reduce((a: number, l: any) => a + (l.runs_scored || 0), 0);
      const middleRate = totalBalls > 0 ? Math.round((totalMiddled / totalBalls) * 100) : null;

      const avgTech = technical.length ? (technical.reduce((a: number, l: any) => a + (l.technique_quality || 0), 0) / technical.length).toFixed(1) : null;
      const avgPhys = physical.length ? (physical.reduce((a: number, l: any) => a + (l.technique_quality || 0), 0) / physical.length).toFixed(1) : null;
      const avgMental = mental.length ? (mental.reduce((a: number, l: any) => a + (l.adherence || 0), 0) / mental.length).toFixed(1) : null;
      const avgTac = tactical.length ? (tactical.reduce((a: number, l: any) => a + (l.field_reading || 0), 0) / tactical.length).toFixed(1) : null;

      data = { totalTime, totalBalls, middleRate, avgTech, avgPhys, avgMental, avgTac };

      prompt = `You are an expert cricket performance coach. Write a 2-3 sentence "Coach's Report" for a player based on their training stats below. Be specific, motivating, and actionable. Reference actual numbers.

Training Period: ${timeframe === 'week' ? 'Last 7 days' : timeframe === 'month' ? 'Last 30 days' : timeframe === 'season' ? 'Last 6 months' : 'All time'}
Total training time: ${totalTime} minutes
Total sessions: ${sessions.length + academy.length + technical.length + physical.length + mental.length + tactical.length}
Total balls faced: ${totalBalls}${middleRate !== null ? `, Middle rate: ${middleRate}%` : ''}
Technical avg quality: ${avgTech ?? 'no data'}/10
Physical avg quality: ${avgPhys ?? 'no data'}/10
Mental adherence avg: ${avgMental ?? 'no data'}/10
Tactical field reading avg: ${avgTac ?? 'no data'}/10

Write 2-3 sentences max. Be a supportive but direct coach.`;
    }

    else if (tab === 'technical') {
      const [drillRes, sesRes] = await Promise.all([
        supabaseAdmin.from('technical_drill_logs').select('*').eq('user_id', userId).gte('created_at', fromIso).order('created_at', { ascending: false }),
        supabaseAdmin.from('sessions').select('notes, duration_minutes').eq('user_id', userId).eq('status', 'completed').gte('completed_at', fromIso),
      ]);

      const logs = drillRes.data || [];
      const sessions = sesRes.data || [];

      const avgTech = logs.length ? (logs.reduce((a: number, l: any) => a + (l.technique_quality || 0), 0) / logs.length).toFixed(1) : null;
      const avgTiming = logs.length ? (logs.reduce((a: number, l: any) => a + (l.timing || 0), 0) / logs.length).toFixed(1) : null;
      const avgConsistency = logs.length ? (logs.reduce((a: number, l: any) => a + (l.consistency || 0), 0) / logs.length).toFixed(1) : null;
      const avgShotControl = logs.length ? (logs.reduce((a: number, l: any) => a + (l.shot_control || 0), 0) / logs.length).toFixed(1) : null;

      // Parse focus areas from session notes
      const focusAreas: string[] = [];
      sessions.forEach((s: any) => {
        if (!s.notes) return;
        const lines = s.notes.split('\n');
        for (const line of lines) {
          if (line.startsWith('Focus Area:') || line.startsWith('Focus:')) {
            const val = line.split(':')[1]?.trim();
            if (val) focusAreas.push(val);
          }
        }
      });

      const reflections = logs.filter((l: any) => l.reflection_notes).slice(0, 3).map((l: any) => l.reflection_notes).join('; ');
      data = { logs: logs.length, avgTech, avgTiming, avgConsistency, avgShotControl, focusAreas: focusAreas.slice(0, 5), reflections };

      prompt = `You are a cricket technique coach. Analyze this player's technical drill data and write 2-3 actionable sentences focused on correlations between their weakest metric and focus areas.

Period: ${timeframe === 'week' ? 'Last 7 days' : timeframe === 'month' ? 'Last 30 days' : timeframe === 'season' ? 'Last 6 months' : 'All time'}
Technical drill sessions: ${logs.length}
Average technique quality: ${avgTech ?? 'no data'}/10
Average timing: ${avgTiming ?? 'no data'}/10
Average consistency: ${avgConsistency ?? 'no data'}/10
Average shot control: ${avgShotControl ?? 'no data'}/10
Focus areas mentioned: ${focusAreas.length > 0 ? focusAreas.join(', ') : 'none recorded'}
Player reflections: ${reflections || 'none'}

Identify the weakest metric, link it to the focus areas if possible, and recommend one specific adjustment. 2-3 sentences max.`;
    }

    else if (tab === 'physical') {
      const logs = (await supabaseAdmin.from('workout_drill_logs').select('*').eq('user_id', userId).gte('created_at', fromIso).order('created_at', { ascending: false })).data || [];

      const avgEnergy = logs.length ? (logs.reduce((a: number, l: any) => a + (l.focus_level || 0), 0) / logs.length).toFixed(1) : null;
      const avgReaction = logs.length ? (logs.reduce((a: number, l: any) => a + (l.confidence_level || 0), 0) / logs.length).toFixed(1) : null;
      const avgConsistency = logs.length ? (logs.reduce((a: number, l: any) => a + (l.consistency || 0), 0) / logs.length).toFixed(1) : null;
      const totalMins = Math.round(logs.reduce((a: number, l: any) => a + Math.round((l.time_elapsed || 0) / 60), 0));

      // Check for long sessions (>60 min) - use time_elapsed in seconds
      const longSessions = logs.filter((l: any) => (l.time_elapsed || 0) > 3600);
      const longAvgEnergy = longSessions.length > 0 ? (longSessions.reduce((a: number, l: any) => a + (l.focus_level || 0), 0) / longSessions.length).toFixed(1) : null;

      data = { logs: logs.length, avgEnergy, avgReaction, avgConsistency, totalMins, longSessions: longSessions.length, longAvgEnergy };

      prompt = `You are a cricket strength & conditioning coach. Analyze this player's physical training data and provide 2-3 actionable sentences about workload management and fatigue patterns.

Period: ${timeframe === 'week' ? 'Last 7 days' : timeframe === 'month' ? 'Last 30 days' : timeframe === 'season' ? 'Last 6 months' : 'All time'}
Physical drill sessions: ${logs.length}
Total training time: ${totalMins} minutes
Average focus/energy level: ${avgEnergy ?? 'no data'}/10
Average reaction speed/confidence: ${avgReaction ?? 'no data'}/10
Average consistency: ${avgConsistency ?? 'no data'}/10
Sessions over 60 min: ${longSessions.length}${longAvgEnergy ? ` (avg energy in long sessions: ${longAvgEnergy}/10)` : ''}

Analyze fatigue patterns, workload sustainability, and give one specific recommendation. 2-3 sentences max.`;
    }

    else if (tab === 'mental') {
      const logs = (await supabaseAdmin.from('mental_drill_logs').select('*').eq('user_id', userId).gte('created_at', fromIso).order('created_at', { ascending: false })).data || [];

      const avgAdherence = logs.length ? (logs.reduce((a: number, l: any) => a + (l.adherence || 0), 0) / logs.length).toFixed(1) : null;
      const avgFocus = logs.length ? (logs.reduce((a: number, l: any) => a + (l.focus_level || 0), 0) / logs.length).toFixed(1) : null;
      const avgConfidence = logs.length ? (logs.reduce((a: number, l: any) => a + (l.confidence_level || 0), 0) / logs.length).toFixed(1) : null;
      const avgMood = logs.length ? (logs.reduce((a: number, l: any) => a + (l.engagement || 0), 0) / logs.length).toFixed(1) : null;
      const avgEmotionalControl = logs.length ? (logs.reduce((a: number, l: any) => a + (l.emotional_control || 0), 0) / logs.length).toFixed(1) : null;

      // Trend: last 3 vs first 3 confidence
      let confidenceTrend = 'stable';
      if (logs.length >= 6) {
        const recentAvg = logs.slice(0, 3).reduce((a: number, l: any) => a + (l.confidence_level || 0), 0) / 3;
        const olderAvg = logs.slice(-3).reduce((a: number, l: any) => a + (l.confidence_level || 0), 0) / 3;
        const diff = recentAvg - olderAvg;
        if (diff > 1) confidenceTrend = `improving (+${diff.toFixed(1)})`;
        else if (diff < -1) confidenceTrend = `declining (${diff.toFixed(1)})`;
      }

      data = { logs: logs.length, avgAdherence, avgFocus, avgConfidence, avgMood, avgEmotionalControl, confidenceTrend };

      prompt = `You are a cricket sports psychologist. Analyze this player's mental drill data and write 2-3 sentences about their mindset patterns, confidence trends, and composure development.

Period: ${timeframe === 'week' ? 'Last 7 days' : timeframe === 'month' ? 'Last 30 days' : timeframe === 'season' ? 'Last 6 months' : 'All time'}
Mental drill sessions: ${logs.length}
Average drill adherence: ${avgAdherence ?? 'no data'}/10
Average focus level: ${avgFocus ?? 'no data'}/10
Average confidence level: ${avgConfidence ?? 'no data'}/10
Average engagement/mood: ${avgMood ?? 'no data'}/10
Average emotional control: ${avgEmotionalControl ?? 'no data'}/10
Confidence trend: ${confidenceTrend}

Highlight what's working mentally, flag any fluctuation or concern, and give one actionable mental training tip. 2-3 sentences max.`;
    }

    else if (tab === 'tactical') {
      const logs = (await supabaseAdmin.from('tactical_drill_logs').select('*').eq('user_id', userId).gte('created_at', fromIso).order('created_at', { ascending: false })).data || [];

      const avgFieldReading = logs.length ? (logs.reduce((a: number, l: any) => a + (l.field_reading || 0), 0) / logs.length).toFixed(1) : null;
      const avgAdapted = logs.length ? (logs.reduce((a: number, l: any) => a + (l.adapted_plan || 0), 0) / logs.length).toFixed(1) : null;
      const avgConfidence = logs.length ? (logs.reduce((a: number, l: any) => a + (l.confidence_pressure || 0), 0) / logs.length).toFixed(1) : null;
      const shotMatchedCount = logs.filter((l: any) => l.shot_selection_matched === true).length;
      const shotMatchedPct = logs.length > 0 ? Math.round((shotMatchedCount / logs.length) * 100) : null;
      const avgMood = logs.length ? (logs.reduce((a: number, l: any) => a + (l.overall_mood || 0), 0) / logs.length).toFixed(1) : null;

      const recentNotes = logs.filter((l: any) => l.session_notes).slice(0, 3).map((l: any) => l.session_notes).join('; ');

      data = { logs: logs.length, avgFieldReading, avgAdapted, avgConfidence, shotMatchedPct, avgMood, recentNotes };

      prompt = `You are a cricket tactical analyst. Analyze this player's scenario builder data and write 2-3 specific sentences about their decision-making quality and match IQ.

Period: ${timeframe === 'week' ? 'Last 7 days' : timeframe === 'month' ? 'Last 30 days' : timeframe === 'season' ? 'Last 6 months' : 'All time'}
Tactical scenario sessions: ${logs.length}
Average field reading: ${avgFieldReading ?? 'no data'}/10
Average adapted scoring plan: ${avgAdapted ?? 'no data'}/10
Average confidence under pressure: ${avgConfidence ?? 'no data'}/10
Shot selection matched situation: ${shotMatchedPct !== null ? `${shotMatchedPct}%` : 'no data'}
Average mood during scenarios: ${avgMood ?? 'no data'}/10
Recent player notes: ${recentNotes || 'none'}

Identify the gap between field reading (awareness) and execution, and give one precise recommendation. 2-3 sentences max.`;
    }

    else if (tab === 'freestyle') {
      const logs = (await supabaseAdmin.from('sessions').select('session_type, duration_minutes, notes, completed_at').eq('user_id', userId).eq('status', 'completed').gte('completed_at', fromIso).order('completed_at', { ascending: false })).data || [];

      const totalMins = logs.reduce((a: number, s: any) => a + (s.duration_minutes || 0), 0);

      // Parse training types from notes
      const equipmentCount: Record<string, number> = {};
      logs.forEach((s: any) => {
        if (!s.notes) return;
        try {
          const parsed = JSON.parse(s.notes);
          if (Array.isArray(parsed.training_types)) {
            parsed.training_types.forEach((t: string) => {
              equipmentCount[t] = (equipmentCount[t] || 0) + 1;
            });
          }
        } catch {}
      });

      const sorted = Object.entries(equipmentCount).sort((a, b) => b[1] - a[1]);
      const topMethod = sorted[0]?.[0] ?? null;
      const topPct = sorted[0] && logs.length > 0 ? Math.round((sorted[0][1] / logs.length) * 100) : null;
      const varietyScore = Object.keys(equipmentCount).length;

      data = { sessions: logs.length, totalMins, equipmentCount, topMethod, topPct, varietyScore };

      prompt = `You are a cricket training variety coach. Analyze this player's freestyle session data and write 2-3 sentences about their training diversity and any over-reliance on a single method.

Period: ${timeframe === 'week' ? 'Last 7 days' : timeframe === 'month' ? 'Last 30 days' : timeframe === 'season' ? 'Last 6 months' : 'All time'}
Freestyle sessions: ${logs.length}
Total training time: ${totalMins} minutes
Training methods used: ${sorted.map(([k, v]) => `${k} (${v}x)`).join(', ') || 'not categorised'}
Most used method: ${topMethod ?? 'none'}${topPct !== null ? ` (${topPct}% of sessions)` : ''}
Variety score (distinct methods): ${varietyScore}

Flag any over-reliance, recommend a specific alternative training method, and explain why variety improves game awareness. 2-3 sentences max.`;
    }

    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Invalid tab' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiResp = await fetch(`${Deno.env.get('ONSPACE_AI_BASE_URL')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('ONSPACE_AI_API_KEY')}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'You are a world-class cricket performance coach. Be concise, specific, and always reference real numbers from the data provided.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.65,
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      return new Response(JSON.stringify({ error: 'AI error: ' + errText }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiJson = await aiResp.json();
    const insight = aiJson.choices?.[0]?.message?.content ?? '';

    return new Response(JSON.stringify({ insight, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('analytics-insights error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
